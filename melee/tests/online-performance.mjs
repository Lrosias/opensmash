// Controlled native online combat at 60 Hz, without a remote network peer.
// Run baseline with MELEE_PAUSE_LOCAL=0; rebuilt candidate with =1.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const out=process.env.MELEE_RESULTS||'build/melee-web/test-results/online-performance';
const pause=process.env.MELEE_PAUSE_LOCAL==='1';
const profiling=process.env.MELEE_PROFILE==='1';
const duration=Number(process.env.MELEE_BENCHMARK_MS||60000);
assert.ok(Number.isFinite(duration)&&duration>=1000);
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:false,args:['--disable-backgrounding-occluded-windows','--disable-renderer-backgrounding']});
const logs=[],errors=[];
try {
  const diagnostics=await browser.newBrowserCDPSession();
  const {gpu}=await diagnostics.send('SystemInfo.getInfo');await diagnostics.detach();
  const page=await browser.newPage({viewport:{width:1280,height:720}});
  page.on('console',m=>logs.push(m.text()));page.on('pageerror',e=>errors.push(e.message));
  if(process.env.YOUGAME_SDK_PATH)await page.route('https://yougame.co/sdk.js',r=>r.fulfill({path:process.env.YOUGAME_SDK_PATH,contentType:'text/javascript'}));
  const url=process.env.MELEE_URL||'http://127.0.0.1:8073/';
  await page.goto(url);
  await page.waitForFunction(()=>['running','error'].includes(window.melee?.phase),null,{timeout:240000});
  assert.equal(await page.evaluate(()=>melee.phase),'running',logs.slice(-20).join('\n'));
  await page.waitForFunction(()=>melee.module._melee_menu_active()===1,null,{timeout:60000});
  await page.mouse.click(10,10);
  await page.evaluate(async pause=>{
    if(pause)window.releaseBenchmarkLocal=await melee.localPause.acquire();
    const {createNativeSession}=await import('./native-match.mjs');
    window.benchmarkEngine=await createNativeSession({slots:[0,1]},s=>console.log('benchmark-online',JSON.stringify(s)));
    benchmarkEngine.show();await benchmarkEngine.resumeAudio();
  },pause);
  const setup=[{frames:100},...JSON.parse(await readFile(new URL('./rollback-match-setup.json',import.meta.url),'utf8'))];
  let boundary;
  for(let i=0;i<setup.length;i++){
    boundary=await page.evaluate(async({frames,pads})=>{
      let output;
      for(let f=0;f<frames;f++)output=await benchmarkEngine.step(Array.from({length:4},(_,seat)=>pads?.[seat]||[0,0,0,0,0,0,0]));
      return output;
    },setup[i]);
    if(setup[i].image)await page.screenshot({path:path.join(out,`setup-${i}-${setup[i].image}.png`)});
  }
  await writeFile(path.join(out,'setup-boundary.json'),JSON.stringify(boundary,null,2));
  assert.equal(boundary.nativeSession?.phase,3,'Recorded setup did not reach combat; inspect setup screenshots.');
  const run=async ms=>page.evaluate(async ms=>{
    const first=benchmarkEngine.frame,localFirst=melee.module._melee_stats(),start=performance.now(),steps=[];
    let frame=0,output;
    while(performance.now()-start<ms){
      const before=performance.now();
      const pad=seat=>[frame%37===0?4:frame%13===0?1:0,(frame%60<30?.63:-.63)*(seat? -1:1),0,0,0,0,0];
      output=await benchmarkEngine.step([pad(0),pad(1),[0,0,0,0,0,0,0],[0,0,0,0,0,0,0]]);
      steps.push({at:before-start,ms:performance.now()-before,nativeMs:output.ms,phase:output.nativeSession?.phase});
      frame++;
      const remaining=start+frame*1000/60-performance.now();
      if(remaining>0)await new Promise(r=>setTimeout(r,remaining));
      if(output.nativeSession?.phase!==3)break;
    }
    return {elapsedMs:performance.now()-start,frames:benchmarkEngine.frame-first,localFrames:melee.module._melee_stats()-localFirst,steps,last:output};
  },ms);
  await run(10000); // Warm the scene's shaders and assets before measuring.
  let profiler;
  if(profiling){
    const client=await browser.newBrowserCDPSession(),pending=new Map();let sequence=0;
    client.on('Target.receivedMessageFromTarget',({sessionId,message})=>{
      const reply=JSON.parse(message),key=sessionId+':'+reply.id,request=pending.get(key);
      if(!request)return;pending.delete(key);reply.error?request.reject(Error(reply.error.message)):request.resolve(reply.result);
    });
    const send=(sessionId,method,params={})=>new Promise((resolve,reject)=>{
      const id=++sequence;pending.set(sessionId+':'+id,{resolve,reject});
      client.send('Target.sendMessageToTarget',{sessionId,message:JSON.stringify({id,method,params})}).catch(reject);
    });
    const {targetInfos}=await client.send('Target.getTargets'),sessions=[];
    for(const target of targetInfos.filter(t=>t.type==='worker'&&t.url.includes('/engine/'))){
      const {sessionId}=await client.send('Target.attachToTarget',{targetId:target.targetId,flatten:false});
      await send(sessionId,'Profiler.enable');await send(sessionId,'Profiler.start');sessions.push({sessionId,target});
    }
    profiler={client,send,sessions};
  }
  const result=await run(duration);
  if(profiler){
    for(let i=0;i<profiler.sessions.length;i++){
      const {sessionId,target}=profiler.sessions[i],{profile}=await profiler.send(sessionId,'Profiler.stop');
      await writeFile(path.join(out,`worker-${i}.cpuprofile`),JSON.stringify(profile));
      await writeFile(path.join(out,`worker-${i}-target.json`),JSON.stringify(target));
    }
    await profiler.client.detach();
  }
  await page.screenshot({path:path.join(out,'combat-end.png')});
  const times=result.steps.map(s=>s.ms).sort((a,b)=>a-b);
  const report={scope:'Controlled native online engine at 60 Hz; no remote peer, packet delay or rollback workload.',url,pauseLocal:pause,profiling,browser:browser.version(),gpu,
    engineSha256:await page.evaluate(()=>melee.engineSha256),fps:result.frames*1000/result.elapsedMs,
    p50StepMs:times[Math.floor(times.length*.5)],p99StepMs:times[Math.floor(times.length*.99)],maxStepMs:times.at(-1),
    exceededFrameBudget:times.filter(t=>t>1000/60).length,errors,...result};
  await writeFile(path.join(out,'benchmark.json'),JSON.stringify(report,null,2));
  assert.deepEqual(errors,[]);
  assert.deepEqual(await page.evaluate(()=>melee.errors),[]);
  assert.ok(result.elapsedMs>=duration,'Combat ended before the benchmark interval.');
  if(pause)assert.equal(result.localFrames,0);
  console.log(JSON.stringify({fps:report.fps,p99StepMs:report.p99StepMs,maxStepMs:report.maxStepMs,localFrames:result.localFrames}));
  await page.evaluate(()=>{benchmarkEngine.destroy();window.releaseBenchmarkLocal?.();});
} finally {await writeFile(path.join(out,'console.log'),logs.join('\n'));await browser.close();}
