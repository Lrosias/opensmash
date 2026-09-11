import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import readline from 'node:readline';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const out=new URL('../../build/melee-web/test-results/',import.meta.url);
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:false,args:['--disable-backgrounding-occluded-windows','--disable-renderer-backgrounding']});
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
page.on('pageerror',e=>events.push({type:'pageerror',text:String(e)}));
await page.goto(process.env.MELEE_URL||'http://127.0.0.1:8073');
/* the page boots on load */await page.waitForFunction(()=>['running','error'].includes(window.melee?.phase),null,{timeout:240000});
console.log('Started. JSON commands: {key,hold,wait,screenshot,stats,close}.');
try {
for await(const line of readline.createInterface({input:process.stdin})){
 try{
  const command=JSON.parse(line);
  if(command.profile){
    const {targetInfos}=await cdp.send('Target.getTargets');const sessions=[];
    for(const target of targetInfos.filter(t=>t.type==='worker'&&t.url.includes('/engine/'))){
      const {sessionId}=await cdp.send('Target.attachToTarget',{targetId:target.targetId,flatten:false});
      await send(sessionId,'Profiler.enable');await send(sessionId,'Profiler.start');sessions.push(sessionId);
    }
    await page.waitForTimeout(command.profile);
    for(let i=0;i<sessions.length;i++){
      const {profile}=await send(sessions[i],'Profiler.stop');
      await writeFile(new URL('play-worker-'+i+'.cpuprofile',out),JSON.stringify(profile));
      const nodes=new Map(profile.nodes.map(n=>[n.id,n]));const counts=new Map();
      for(const id of profile.samples||[])counts.set(id,(counts.get(id)||0)+1);
      console.log(i,[...counts].sort((a,b)=>b[1]-a[1]).slice(0,8).map(([id,n])=>({n,name:nodes.get(id).callFrame.functionName})));
    }
  }
  if(command.saveState){
    await page.evaluate(()=>melee.module._melee_save_state());await page.waitForTimeout(2500);
    const bytes=await page.evaluate(()=>melee.module.FS.readFile('/checkpoint.sav').toBase64());
    await writeFile(new URL('checkpoint.sav',out),Buffer.from(bytes,'base64'));console.log('Saved checkpoint',Buffer.byteLength(bytes,'base64'));
  }
  if(command.loadState){
    const bytes=await readFile(new URL('checkpoint.sav',out));
    await page.evaluate(bytes=>{melee.module.FS.writeFile('/checkpoint.sav',Uint8Array.fromBase64(bytes));melee.module._melee_load_state();},bytes.toString('base64'));
  }
  if(command.trace){
    const trace=await page.evaluate(()=>melee.module.FS.readFile('/dispatch.csv',{encoding:'utf8'}));
    await writeFile(new URL('dispatch.csv',out),trace);console.log(trace.slice(-2500));
  }
  if(command.files) console.log(await page.evaluate(()=>{const fs=melee.module.FS;function walk(p){return fs.readdir(p).filter(n=>n!=='.'&&n!=='..').flatMap(n=>{const name=p+'/'+n;return ((fs.stat(name).mode&0xf000)===0x4000)?walk(name):[{name,size:fs.stat(name).size}]});}return walk('/user');}));
  if(command.key){await page.keyboard.down(command.key);await page.waitForTimeout(command.hold||120);
    if(command.input)console.log(await page.evaluate(()=>({focus:document.activeElement?.tagName,players:YouGame.input.players.map(p=>p.state)})));
    await page.keyboard.up(command.key);}
  if(command.wait)await page.waitForTimeout(command.wait);
  if(command.screenshot)await page.screenshot({path:new URL(command.screenshot+'.png',out).pathname,timeout:5000});
  if(command.stats)console.log(await page.evaluate(()=>({phase:melee.phase,errors:melee.errors,samples:melee.samples.slice(-10)})));
  await writeFile(new URL('play-console.json',out),JSON.stringify(events,null,2));
  await writeFile(new URL('play-metrics.json',out),JSON.stringify(await page.evaluate(()=>melee.samples),null,2));
  console.log('done',command);
  if(command.close)break;
 }catch(e){console.log('command failed',String(e));}
}
}finally{await browser.close();}
