import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const dir=new URL('../../build/melee-web/test-results/',import.meta.url);
await mkdir(dir,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:false});
const cdp=await browser.newBrowserCDPSession();
let sequence=0;
const pending=new Map();
cdp.on('Target.receivedMessageFromTarget',({sessionId,message})=>{
  const value=JSON.parse(message), key=sessionId+':'+value.id, request=pending.get(key);
  if(!request)return;
  pending.delete(key);value.error?request.reject(value.error):request.resolve(value.result);
});
function send(sessionId,method,params={}) {
  const id=++sequence;
  return new Promise((resolve,reject)=>{
    pending.set(sessionId+':'+id,{resolve,reject});
    cdp.send('Target.sendMessageToTarget',{sessionId,message:JSON.stringify({id,method,params})}).catch(reject);
  });
}
const page=await browser.newPage({viewport:{width:1024,height:768}});
const events=[];
page.on('console',m=>events.push({type:m.type(),text:m.text()}));
page.on('pageerror',e=>events.push({type:'error',text:String(e)}));
try {
  await page.goto('http://127.0.0.1:8073');/* the page boots on load */await page.waitForFunction(()=>['running','error'].includes(window.melee?.phase),null,{timeout:240000});
  await page.waitForTimeout(28000);
  const {targetInfos}=await cdp.send('Target.getTargets');
  const sessions=[];
  for(const target of targetInfos.filter(t=>t.type==='worker'&&t.url.includes('/engine/'))) {
    const {sessionId}=await cdp.send('Target.attachToTarget',{targetId:target.targetId,flatten:false});
    const diagnostic=await send(sessionId,'Runtime.evaluate',{expression:`typeof GL!=='undefined'&&GL.currentContext?JSON.stringify((()=>{const gl=GL.currentContext.GLctx,e=gl.getExtension('WEBGL_debug_renderer_info');return {renderer:e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),error:gl.getError(),canvas:[gl.canvas.width,gl.canvas.height],lost:gl.isContextLost(),extensions:gl.getSupportedExtensions()}})()):'no GL'`,returnByValue:true});
    console.log('GL',diagnostic.result?.value);
    await send(sessionId,'Profiler.enable');await send(sessionId,'Profiler.start');
    sessions.push({sessionId,target});
  }
  console.log('Profiling',sessions.length,'engine workers');
  await page.waitForTimeout(10000);
  for(let i=0;i<sessions.length;i++) {
    const {sessionId,target}=sessions[i];
    const result=await send(sessionId,'Profiler.stop');
    await writeFile(new URL(`worker-${i}.cpuprofile`,dir),JSON.stringify(result.profile));
    const nodes=new Map(result.profile.nodes.map(n=>[n.id,n]));
    const counts=new Map();
    for(const id of result.profile.samples||[])counts.set(id,(counts.get(id)||0)+1);
    console.log(i,target.url,[...counts].sort((a,b)=>b[1]-a[1]).slice(0,12).map(([id,n])=>({n,name:nodes.get(id).callFrame.functionName})));
  }
  console.log(await page.evaluate(()=>({phase:melee.phase,sample:melee.samples.at(-1),errors:melee.errors})));
  await writeFile(new URL('profile-console.json',dir),JSON.stringify(events,null,2));
} finally {await browser.close();}
