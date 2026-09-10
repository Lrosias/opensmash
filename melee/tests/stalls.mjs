// Interactive cold/warm action benchmark. Uses a fresh browser, actual inputs and displayed frames.
import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import readline from 'node:readline';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const out=process.env.MELEE_RESULTS||'build/melee-web/test-results/stalls-baseline';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:false,...(process.env.MELEE_BROWSER_CHANNEL?{channel:process.env.MELEE_BROWSER_CHANNEL}:{}),args:['--disable-backgrounding-occluded-windows','--disable-renderer-backgrounding']});
await writeFile(`${out}/environment.json`,JSON.stringify({browserVersion:browser.version(),channel:process.env.MELEE_BROWSER_CHANNEL||'bundled-chromium',headless:false,viewport:{width:1280,height:720},url:process.env.MELEE_URL||'http://127.0.0.1:8075',capturedAt:new Date().toISOString()},null,2));
const page=await browser.newPage({viewport:{width:1280,height:720}});
const requests=[],errors=[],events=[],actions=[];
await page.addInitScript(()=>{window.testPads=[null,null,null,null];Object.defineProperty(navigator,'getGamepads',{value:()=>window.testPads});});
page.on('requestfinished',r=>{if(r.url().includes('/assets/'))requests.push({url:r.url(),timing:r.timing(),size:r.sizes()});});
page.on('pageerror',e=>errors.push(String(e)));
page.on('console',m=>{if(m.type()==='warning'||m.type()==='error')events.push(m.text());});
const cdp=await page.context().newCDPSession(page);
const browserCDP=await browser.newBrowserCDPSession();
let sequence=0;const pending=new Map();
browserCDP.on('Target.receivedMessageFromTarget',({sessionId,message})=>{const value=JSON.parse(message),key=sessionId+':'+value.id,request=pending.get(key);if(!request)return;pending.delete(key);value.error?request.reject(value.error):request.resolve(value.result);});
function send(sessionId,method,params={}){const id=++sequence;return new Promise((resolve,reject)=>{pending.set(sessionId+':'+id,{resolve,reject});browserCDP.send('Target.sendMessageToTarget',{sessionId,message:JSON.stringify({id,method,params})}).catch(reject);});}
await cdp.send('Network.enable');
if(process.env.MELEE_LATENCY)await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:Number(process.env.MELEE_LATENCY),downloadThroughput:-1,uploadThroughput:-1});
await page.goto(process.env.MELEE_URL||'http://127.0.0.1:8075');
await page.evaluate(()=>{
 const original=createMelee;
 window.frameTimes=[];
 window.createMelee=options=>{const frame=options.onMeleeFrame;options.onMeleeFrame=bitmap=>{frameTimes.push(performance.now());frame(bitmap);};return original(options);};
});
console.log('Ready; commands {start,key,hold,wait,screenshot,stats,close}.');
const commands=readline.createInterface({input:process.stdin});
try {
 for await(const line of commands){
  try {
   const c=JSON.parse(line),start=Date.now();
   if(c.start)await page.locator('#play').click();
   if(c.ready)await page.waitForFunction(()=>window.melee?.samples?.at(-1)?.presents>120,null,{timeout:120000});
   if(c.saveState){
     await page.evaluate(()=>melee.module._melee_save_state());
     await page.waitForTimeout(2500);
     const bytes=await page.evaluate(()=>melee.module.FS.readFile('/checkpoint.sav').toBase64());
     await writeFile(c.saveState,Buffer.from(bytes,'base64'));
   }
   if(c.loadState){
     const bytes=await readFile(c.loadState);
     await page.evaluate(bytes=>{melee.module.FS.writeFile('/checkpoint.sav',Uint8Array.fromBase64(bytes));melee.module._melee_load_state();},bytes.toString('base64'));
     await page.waitForTimeout(2500);
   }
   if(c.benchmark){
     const begin=await page.evaluate(()=>({time:performance.now(),presents:melee.module._melee_stats(),displayed:melee.displayedFrames,misses:melee.module._melee_asset_misses(),shaders:melee.module._melee_shader_count(),shaderMs:melee.module._melee_shader_millis()}));
     const requestCount=requests.length;
     const combat=async()=>{
       const deadline=Date.now()+c.benchmark;
       const moves=[['4',450],['p',80],['o',80],['m',80],['2',250],['p',80],['o',80],['m',80]];
       let index=0;
       while(Date.now()<deadline){
         const [key,hold]=moves[index++%moves.length];
         await page.keyboard.down(key);
         await page.waitForTimeout(Math.max(1,Math.min(hold,deadline-Date.now())));
         await page.keyboard.up(key);
         if(Date.now()<deadline)await page.waitForTimeout(Math.min(120,deadline-Date.now()));
       }
     };
     await Promise.all([page.waitForTimeout(c.benchmark),c.combat?combat():Promise.resolve()]);
     const result=await page.evaluate(begin=>{
       const elapsed=performance.now()-begin.time;
       const gaps=frameTimes.filter(t=>t>=begin.time).map((t,i,a)=>i?t-a[i-1]:null).filter(t=>t!==null).sort((a,b)=>a-b);
       return {elapsed,engineSha256:melee.engineSha256,presentFPS:(melee.module._melee_stats()-begin.presents)*1000/elapsed,
         displayedFPS:(melee.displayedFrames-begin.displayed)*1000/elapsed,p50Gap:gaps[Math.floor(gaps.length*.5)],p99Gap:gaps[Math.floor(gaps.length*.99)],maxGap:gaps.at(-1),
         assetMisses:melee.module._melee_asset_misses()-begin.misses,shaderCount:melee.module._melee_shader_count()-begin.shaders,shaderMs:melee.module._melee_shader_millis()-begin.shaderMs,
         samples:melee.samples.filter(s=>s.time>=begin.time),errors:melee.errors};
     },begin);
     result.assetRequests=requests.length-requestCount;
     result.scriptedCombat=!!c.combat;
     await writeFile(`${out}/${c.label||'benchmark'}.json`,JSON.stringify(result,null,2));
     const {samples,...summary}=result;
     console.log('benchmark',summary);
   }
   if(c.clearCache)await page.evaluate(async()=>{for(const name of await caches.keys())if(name.startsWith('opensmash-melee-assets'))await caches.delete(name);});
   if(c.latency!==undefined)await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:c.latency,downloadThroughput:-1,uploadThroughput:-1});
   if(c.offline!==undefined)await cdp.send('Network.emulateNetworkConditions',{offline:c.offline,latency:0,downloadThroughput:-1,uploadThroughput:-1});
   if(c.retry)await page.locator('#download-retry').click();
   if(c.reload){await page.reload();await page.evaluate(()=>{const original=createMelee;window.frameTimes=[];window.createMelee=options=>{const frame=options.onMeleeFrame;options.onMeleeFrame=bitmap=>{frameTimes.push(performance.now());frame(bitmap);};return original(options);};});}
   if(c.resize)await page.setViewportSize(c.resize);
   if(c.profile){
     const {targetInfos}=await browserCDP.send('Target.getTargets'),sessions=[];
     for(const target of targetInfos.filter(t=>t.type==='worker'&&t.url.includes('/engine/'))){const {sessionId}=await browserCDP.send('Target.attachToTarget',{targetId:target.targetId,flatten:false});await send(sessionId,'Profiler.enable');await send(sessionId,'Profiler.start');sessions.push(sessionId);}
     await page.waitForTimeout(c.profile);
     for(let i=0;i<sessions.length;i++){const {profile}=await send(sessions[i],'Profiler.stop');await writeFile(`${out}/worker-${i}.cpuprofile`,JSON.stringify(profile));}
   }
   if(c.pad)await page.evaluate(({seat=1,buttons=[],axes=[0,0,0,0]})=>{const fresh=!testPads[seat];const pad={id:'Standard test controller',index:seat,connected:true,mapping:'standard',timestamp:performance.now(),axes,buttons:Array.from({length:17},(_,i)=>({pressed:buttons.includes(i),touched:buttons.includes(i),value:buttons.includes(i)?1:0}))};testPads[seat]=pad;if(fresh){const e=new Event('gamepadconnected');Object.defineProperty(e,'gamepad',{value:pad});window.dispatchEvent(e);}},c.pad);
   actions.push({command:c,time:await page.evaluate(()=>performance.now())});
   if(c.key){await page.keyboard.down(c.key);await page.waitForTimeout(c.hold||100);await page.keyboard.up(c.key);}
   if(c.wait)await page.waitForTimeout(c.wait);
   if(c.screenshot)await page.screenshot({path:`${out}/${c.screenshot}.png`});
   const data=await page.evaluate(()=>({timeOrigin:performance.timeOrigin,phase:melee.phase,engine:melee.engineSha256,errors:melee.errors,frames:frameTimes,samples:melee.samples,assets:melee.assetStats,menuTransferBytes:melee.menuTransferBytes,downloadUI:{text:document.querySelector('#download-status')?.innerText,hidden:document.querySelector('#download-status')?.hidden,blocked:melee.assetBlocked}}));
   await writeFile(`${out}/measurement.json`,JSON.stringify({data,actions,requests:await Promise.all(requests.map(async r=>({...r,size:await r.size}))),errors,events},null,2));
   if(c.snapshot)await writeFile(`${out}/${c.snapshot}.json`,JSON.stringify({data,actions,requests:await Promise.all(requests.map(async r=>({...r,size:await r.size}))),errors,events},null,2));
   if(c.stats){const frames=data.frames.filter(t=>t>data.frames.at(-1)-10000),gaps=frames.slice(1).map((t,i)=>t-frames[i]).sort((a,b)=>a-b);console.log({phase:data.phase,frames:frames.length,maxGap:gaps.at(-1),p99:gaps[Math.floor(gaps.length*.99)],sample:data.samples.at(-1),requests:requests.length,errors});}
   console.log('done',c,Date.now()-start);
   if(c.close)break;
  }catch(e){console.error(e);}
 }
}finally{
 commands.close();
 await browserCDP.detach().catch(()=>{});
 await cdp.detach().catch(()=>{});
 await browser.close();
 process.stdin.pause();
}
