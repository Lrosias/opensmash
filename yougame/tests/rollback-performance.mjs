// Serial, local-only actual-engine benchmark. No uploads or live rooms.
// PLAYWRIGHT_PATH may point to the installed Playwright package.
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import path from 'node:path';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const root=path.resolve(import.meta.dirname,'..');
const output=path.resolve(process.env.PERF_OUTPUT||path.join(root,'test-results/performance'));
const source=process.env.PERF_CHECKPOINTS||path.join(root,'src/checkpoints.mjs');
const engine=path.resolve(process.env.PERF_ENGINE_ROOT||path.join(root,'dist/engine'));
const sdk=process.env.YOUGAME_SDK_PATH;
const paced=process.env.PERF_PACED==='1';
if(paced&&!sdk)throw Error('PERF_PACED requires YOUGAME_SDK_PATH');
const html=`<!doctype html><title>OpenSmash frame benchmark</title><style>body{margin:0;background:black}iframe{border:0;width:960px;height:720px}</style>${paced?'<script src="/sdk.js"></script>':''}<script type="module">
import {NativeCheckpoints} from '/checkpoints.mjs';
window.errors=[];let raw,state,pads=[[0,0,0],[0,0,0]];
window.openSmashAttachEngine=()=>({menuState:()=>({phase:0}),menuAction(){},beforeTick:()=>true,afterTick(...s){state=s;},ready(driver){raw=driver;window.ready=true;},error(e){errors.push(String(e));},readPorts(ptr,H){for(let i=0;i<4;i++){const b=(ptr>>2)+i*4,p=pads[i];H[b]=p?2:1;H[b+1]=p?.[0]||0;H[b+2]=p?.[1]||0;H[b+3]=p?.[2]||0;}}});
const frame=document.createElement('iframe');frame.src='/engine/index.html?SSB64_YOUGAME=1&SSB64_YOUGAME_ROLLBACK=1&SSB64_YOUGAME_SEED=1234&SSB64_BOOT_BATTLE=0,8,6,0&SSB64_BOOT_HUMANS=2&SSB64_BOOT_SLOTS=hhoo&SSB64_STOCKS=99&SSB64_VS_INTRO=0';document.body.append(frame);
const raf=()=>new Promise(r=>requestAnimationFrame(r));
window.measure=async({frames=300,warmup=120})=>{
 for(let i=0;!state?.[4];i++){if(i>900)throw Error('No battle');raw.step();if(i%10===0)await raf();}
 const store=new NativeCheckpoints(raw),samples=[];let last=0,presented=0,lastPresented=0,measuredStart=0,measuredEnd=0;
 function tick(i){
  const start=performance.now();if(i===warmup)measuredStart=start;
  pads=[[i%13<5?32768:i%17<4?16384:0,i%70<35?50:-50,i%41<3?50:0],[i%11<5?32768:0,i%70<35?-50:50,0]];
  raw.step();const stepped=performance.now();store.save(i,state);const end=performance.now();
  if(i>=warmup)samples.push({step:stepped-start,save:end-stepped,total:end-start,interval:start-last});last=start;
 }
 if(${paced}){
  await new Promise(resolve=>{let i=0;const loop=YouGame.fixedStep({hz:60,update(){if(i>=warmup+frames)return;tick(i++);if(i===warmup+frames){loop.stop();resolve();}},render(){if(i>warmup&&i!==lastPresented)presented++;lastPresented=i;}});loop.start();});
 }else for(let i=0;i<warmup+frames;i++){await raf();tick(i);}
 measuredEnd=performance.now();
 const live=store.pages.filter(Boolean),buffers=new Set([...store.frames.values()].flatMap(s=>s.pages.filter(Boolean).map(p=>p.buffer)));
 const memory={used:raw.used(),capturedBytes:live.reduce((a,p)=>a+p.byteLength,0),historyBytes:[...buffers].reduce((a,b)=>a+b.byteLength,0),pages:live.length};
 // Check exact diagnostic replay after restoring a real checkpoint.
 const handle=store.save(10000,state),expected=[];
 for(let i=0;i<10;i++){raw.step();expected.push([...state]);}
 const before=performance.now();store.load(handle);const restoreMs=performance.now()-before;raw.rollback();
 for(let i=0;i<10;i++){raw.step();if(JSON.stringify(state)!==JSON.stringify(expected[i]))throw Error('Replay mismatch at '+i);}
 const gl=frame.contentWindow.Module.canvas.getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');
 return {samples,memory,restoreMs,state,errors,accelerated:typeof raw.comparePage==='function',visibility:document.visibilityState,pacing:${paced}?{simFps:samples.length*1000/(measuredEnd-measuredStart),presentedOpportunitiesFps:presented*1000/(measuredEnd-measuredStart)}:null,renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),canvas:[gl.canvas.width,gl.canvas.height],replay:true};
};</script>`;
const mime={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.json':'application/json','.wasm':'application/wasm'};
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','credentialless');
 if(url.pathname==='/'){res.setHeader('Content-Type','text/html');return res.end(html);}
 if(url.pathname==='/sdk.js'&&sdk){res.setHeader('Content-Type','text/javascript');return res.end(await readFile(sdk));}
 const file=url.pathname==='/checkpoints.mjs'?source:url.pathname.startsWith('/engine/')?path.resolve(engine,'.'+decodeURIComponent(url.pathname.slice(7))):path.resolve(root,'dist','.'+decodeURIComponent(url.pathname));
 if(file!==source&&!file.startsWith(engine+path.sep)&&!['page-compare.mjs','page-compare.wasm','frame-clock.mjs','audio-output.mjs','audio-ring.mjs','audio-worklet.mjs'].some(p=>file===path.join(root,'dist',p)))throw Error('Not a runtime asset');
 res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.setHeader('Content-Length',(await stat(file)).size);createReadStream(file).pipe(res);
 }catch{res.writeHead(404);res.end();}});
await mkdir(output,{recursive:true});await new Promise((r,j)=>{server.once('error',j);server.listen(0,'127.0.0.1',r);});let browser;
try{
 browser=await chromium.launch({channel:'chrome',headless:process.env.PERF_HEADLESS==='1',args:['--autoplay-policy=no-user-gesture-required','--disable-backgrounding-occluded-windows','--disable-renderer-backgrounding']});
 for(const rate of JSON.parse(process.env.PERF_RATES||'[1,6]')){
 const context=await browser.newContext({viewport:{width:960,height:720},deviceScaleFactor:1});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.ready||window.errors?.length,null,{timeout:90000});
 if(await page.evaluate(()=>errors.length))throw Error(await page.evaluate(()=>errors.join(';')));
 const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate});
 if(process.env.PERF_PROFILE){await cdp.send('Profiler.enable');await cdp.send('Profiler.start');}
 const result=await page.evaluate(async frames=>measure({frames}),Number(process.env.PERF_FRAMES||300));
 if(process.env.PERF_PROFILE){const {profile}=await cdp.send('Profiler.stop');await writeFile(path.join(output,'rate-'+rate+'.cpuprofile'),JSON.stringify(profile));}
 if(errors.length||result.errors.length)throw Error([...errors,...result.errors].join(';'));
 if(result.visibility!=='visible')throw Error('Invalid backgrounded benchmark');
 const summarize=key=>{const a=result.samples.map(s=>s[key]).sort((a,b)=>a-b);return {mean:a.reduce((a,b)=>a+b,0)/a.length,p50:a[Math.floor(a.length*.5)],p95:a[Math.floor(a.length*.95)],p99:a[Math.floor(a.length*.99)]};};
 const summary={rate,step:summarize('step'),save:summarize('save'),total:summarize('total'),interval:summarize('interval'),overBudget:result.samples.filter(s=>s.total>1000/60).length,...result.memory,restoreMs:result.restoreMs,replay:result.replay,renderer:result.renderer,pacing:result.pacing,accelerated:result.accelerated};
 await page.screenshot({path:path.join(output,'rate-'+rate+'.png')});
 const hash=async file=>createHash('sha256').update(await readFile(file)).digest('hex');
 await writeFile(path.join(output,'rate-'+rate+'.json'),JSON.stringify({date:new Date().toISOString(),browser:browser.version(),headless:process.env.PERF_HEADLESS==='1',wasm:await hash(path.join(engine,'BattleShip.wasm')),checkpoints:await hash(source),helper:await hash(path.join(root,'dist/page-compare.wasm')),sdk:sdk?await hash(sdk):null,summary,result},null,2));console.log(JSON.stringify(summary));await context.close();
 }
}finally{await browser?.close();await new Promise(r=>server.close(r));}
