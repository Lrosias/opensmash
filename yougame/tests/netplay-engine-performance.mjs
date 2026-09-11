// Bounded local benchmark: released Wasm/rendering + production SDK + delayed
// in-memory peer. No hosted room, no credentials, no publication.
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const root=path.resolve(process.env.PERF_BUILD_ROOT),output=path.resolve(process.env.PERF_OUTPUT||'yougame/test-results/netplay-performance');
const sdk=await readFile(process.env.YOUGAME_SDK_PATH,'utf8');
const extracted=sdk.slice(sdk.indexOf('  function canon('),sdk.indexOf('  // A hidden tab'))+
 sdk.slice(sdk.indexOf('  function fixedStep('),sdk.indexOf('  /* ---------- asynchronous rollback'));
const html=`<!doctype html><style>body{margin:0;background:black}iframe{width:640px;height:480px;border:0}</style><script>${extracted}</script><script type="module">
let raw,state,pads=[[0,0,0],[0,0,0]],frames=0;window.errors=[];
window.openSmashAttachEngine=()=>({menuState:()=>({phase:0}),menuAction(){},beforeTick:()=>true,afterTick(...s){state=s;},ready(r){raw=r;window.ready=true;},error(e){errors.push(String(e));},readPorts(ptr,H){for(let i=0;i<4;i++){const b=(ptr>>2)+i*4,p=pads[i];H[b]=p?2:1;H[b+1]=p?.[0]||0;H[b+2]=p?.[1]||0;H[b+3]=p?.[2]||0;}}});
const iframe=document.createElement('iframe');iframe.src='/engine/index.html?SSB64_YOUGAME_MUTE=1&SSB64_YOUGAME=1&SSB64_YOUGAME_ROLLBACK=1&SSB64_YOUGAME_SEED=1234&SSB64_BOOT_BATTLE=0,8,6,0&SSB64_BOOT_HUMANS=2&SSB64_BOOT_SLOTS=hhoo&SSB64_STOCKS=99&SSB64_VS_INTRO=0';document.body.append(iframe);
window.measure=async({delay,latency=0,duration=6000})=>{
 const raf=()=>new Promise(r=>requestAnimationFrame(r));
 for(let i=0;!state?.[4]||i<120;i++){if(i>900)throw Error('Battle did not start');raw.step();if(i%8===0)await raf();}
 const samples=[],intervals=[],longTasks=[];let previous=0,opportunities=0,lastFrames=frames,callbacks=0,multi=0,active=true;const timers=new Set();
 const observer=new PerformanceObserver(list=>longTasks.push(...list.getEntries().map(e=>e.duration)));observer.observe({type:'longtask'});
 function observe(){if(!active)return;callbacks++;const n=frames-lastFrames;if(n)opportunities++;if(n>1)multi++;lastFrames=frames;requestAnimationFrame(observe);}requestAnimationFrame(observe);
 function step(f,inputs){const t=performance.now();pads=[inputs?.p0?.[0]||[0,0,0],inputs?.p1?.[0]||[0,0,0]];raw.step();frames++;samples.push(performance.now()-t);if(previous)intervals.push(t-previous);previous=t;}
 const input=f=>[[0,f%120<60?20:-20,0]];let loops=[];
 if(delay==='offline'){loops=[fixedStep({hz:60,update:f=>step(f,{p0:input(f),p1:input(f)})})];}
 else {const rooms=[0,1].map(i=>({me:'p'+i,latency,players:[{id:'p0'},{id:'p1'}],on(){},off(){},send(data){const timer=setTimeout(()=>{timers.delete(timer);if(active)rooms[1-i]._sync.receive(this.me,data);},latency);timers.add(timer);}}));loops=rooms.map((r,i)=>makeSync(r,{hz:60,delay,checksum:false,input,step:i===0?step:()=>{}},false));}
 const start=performance.now();loops.forEach(l=>l.start());await new Promise(r=>setTimeout(r,duration));const elapsed=performance.now()-start;active=false;loops.forEach(l=>l.stop());timers.forEach(clearTimeout);observer.disconnect();
 const describe=a=>{const s=[...a].sort((a,b)=>a-b);return {n:s.length,mean:a.reduce((s,n)=>s+n,0)/(a.length||1),p95:s[Math.floor(s.length*.95)]||0,max:s.at(-1)||0};};
 return {delay,latencyMs:latency,elapsedMs:elapsed,simFps:samples.length*1000/elapsed,presentationOpportunitiesFps:opportunities*1000/elapsed,rafCallbacks:callbacks,multiTickCallbacks:multi,stepMs:describe(samples),intervalMs:describe(intervals),longTasks:describe(longTasks),stalls:loops.map(l=>l.stalls||0),actualDelay:loops.map(l=>l.delay??null),state,visibility:document.visibilityState,errors};
};</script>`;
const server=createServer(async(req,res)=>{try{
 const pathname=new URL(req.url,'http://localhost').pathname;
 res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','credentialless');
 if(pathname==='/'){res.setHeader('Content-Type','text/html');return res.end(html);}
 const file=path.resolve(root,'.'+decodeURIComponent(pathname));if(!file.startsWith(root+path.sep))throw Error('Outside root');
 res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.wasm':'application/wasm','.json':'application/json'})[path.extname(file)]||'application/octet-stream');res.setHeader('Content-Length',(await stat(file)).size);createReadStream(file).pipe(res);
 }catch{res.writeHead(404);res.end();}});
await mkdir(output,{recursive:true});await new Promise((r,j)=>{server.once('error',j);server.listen(0,'127.0.0.1',r);});let browser;
try{
 browser=await chromium.launch({channel:'chrome',headless:false,args:['--mute-audio','--autoplay-policy=no-user-gesture-required','--disable-backgrounding-occluded-windows','--disable-renderer-backgrounding']});
 const results=[];
 for(const rate of JSON.parse(process.env.PERF_RATES||'[1]'))for(const config of [{delay:'offline'},{delay:2,latency:100},{delay:'auto',latency:100},{delay:2,latency:160},{delay:'auto',latency:160}]){
  const context=await browser.newContext({viewport:{width:800,height:600}}),page=await context.newPage();page.setDefaultTimeout(60000);const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.ready||window.errors.length);if(errors.length)throw Error(errors.join(';'));
  const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate});
  const result={rate,...await page.evaluate(c=>measure(c),config)};if(result.errors.length||errors.length||result.visibility!=='visible')throw Error(JSON.stringify({result,errors}));
  results.push(result);console.log(JSON.stringify(result));await page.screenshot({path:path.join(output,rate+'-'+config.delay+'-'+(config.latency||0)+'.png')});await context.close();
 }
 const hash=async file=>createHash('sha256').update(await readFile(file)).digest('hex');
 await writeFile(path.join(output,'results.json'),JSON.stringify({date:new Date().toISOString(),browser:browser.version(),buildRoot:root,engineSha256:await hash(path.join(root,'engine/BattleShip.wasm')),sdkSha256:createHash('sha256').update(sdk).digest('hex'),limitations:'One released battle engine with synthetic peer. No rollback snapshots; checksums disabled for synthetic peer. Local transport delay, not live Internet/iOS.',results},null,2));
}finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
