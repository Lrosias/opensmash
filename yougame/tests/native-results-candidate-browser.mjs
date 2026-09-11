// Real staged native engine and authored app. SDK/controller/peer fixtures only;
// this checks rendering and consumer layout, not real hosted settlement or FPS.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../..'),stage=path.resolve(process.env.NATIVE_RESULTS_STAGE||path.join(root,'build/competitive-remix-f265-v3'));
const out=path.resolve(process.env.NATIVE_RESULTS_OUTPUT||path.join(root,'yougame/test-results/native-results-candidate-v3'));await mkdir(out,{recursive:true});
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'/Users/luis/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const sdk=(await readFile(path.join(root,'yougame/tests/native-results-sdk-fixture.js'),'utf8'))+`
// Keep the real app's agreed fighters, but do not boot a battle or claim combat.
resultFixture.room.send=function(data){resultFixture.sent.push(structuredClone(data));if(data.p==='opensmash64-remix-competitive-v1'&&data.type==='hello')queueMicrotask(()=>this.emit('message',{from:'b',data:{...data,fighter:59}}));};
resultFixture.rawPads=null;
YouGame.controllers.snapshot=()=>({owned:!!resultFixture.rawPads,state:resultFixture.rawPads?'connected':'native-required',stale:false,suspended:false,ports:Array.from({length:4},(_,port)=>({port,connected:!!resultFixture.rawPads&&port<2,buttons:resultFixture.rawPads?.[port]||0,axes:[128,128,128,128],triggers:[0,0]}))});
YouGame.ui.getLayout=()=>({insets:{top:80,bottom:100,left:20,right:20}});
`;
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');if(url.pathname==='/engine/index.html'&&!url.searchParams.has('SSB64_YOUGAME_MUTE')){url.searchParams.set('SSB64_YOUGAME_MUTE','1');res.writeHead(302,{Location:url.pathname+url.search});res.end();return;}
 const file=path.resolve(stage,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));if(!file.startsWith(stage+path.sep))throw Error();
 const bytes=await readFile(file);res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','credentialless');res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.wasm':'application/wasm','.png':'image/png','.wav':'audio/wav'})[path.extname(file)]||'application/octet-stream');if(bytes[0]===31&&bytes[1]===139)res.setHeader('Content-Encoding','gzip');res.end(bytes);
}catch{res.writeHead(404);res.end();}});await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
let browser;const evidence=[];
try{
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio']});
 for(const mobile of [false,true]){
  const viewport=mobile?{width:375,height:812}:{width:1440,height:900};
  const page=await browser.newPage({viewport,isMobile:mobile,hasTouch:mobile}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://yougame.co/sdk.js',route=>route.fulfill({body:sdk,contentType:'text/javascript'}));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForFunction(()=>{const m=document.querySelector('iframe')?.contentWindow.Module;return m?._port_remix_online_results&&[7,9,16].includes(m.nativeScene);},{},{timeout:120000});
  await page.evaluate(()=>{
   const m=document.querySelector('iframe').contentWindow.Module,fn=m._port_remix_online_results,tick=m.beforeGameTick;
   window.nativeEvidence={calls:[],ticks:0,original:m,originalExports:0};m._port_remix_online_results=(...args)=>{nativeEvidence.originalExports++;return fn(...args);};
   m.beforeGameTick=()=>{const allowed=tick();if(allowed)nativeEvidence.localTicks=(nativeEvidence.localTicks||0)+1;return allowed;};
   const attach=window.openSmashAttachEngine;window.openSmashAttachEngine=win=>{const bridge=attach(win);if(win.frameElement.title==='OpenSmash64 native results'){const ready=bridge.ready,before=bridge.beforeTick;bridge.ready=raw=>{const native=win.Module._port_remix_online_results;win.Module._port_remix_online_results=(...args)=>{const accepted=native(...args);nativeEvidence.calls.push({args,accepted});return accepted;};return ready(raw);};bridge.beforeTick=()=>{const allowed=before();if(allowed)nativeEvidence.ticks++;return allowed;};}return bridge;};
   nativeEvidence.memory={maxAttachedFrames:0,maxAttachedWasmBytes:0,maxJsUsedBytes:0};
   function sample(){const frames=[...document.querySelectorAll('iframe')],bytes=frames.reduce((n,f)=>n+(f.contentWindow.HEAPU8?.byteLength||0),0);nativeEvidence.memory.maxAttachedFrames=Math.max(nativeEvidence.memory.maxAttachedFrames,frames.length);nativeEvidence.memory.maxAttachedWasmBytes=Math.max(nativeEvidence.memory.maxAttachedWasmBytes,bytes);nativeEvidence.memory.maxJsUsedBytes=Math.max(nativeEvidence.memory.maxJsUsedBytes,performance.memory?.usedJSHeapSize||0);requestAnimationFrame(sample);}sample();
   const host=document.createElement('div');host.id='host-reserve-fixture';host.textContent='HOST';host.style.cssText='position:fixed;left:0;top:0;width:64px;height:64px;background:#333;color:white;z-index:50';document.body.append(host);
  });
  const gc=page.getByRole('button',{name:'GameCube adapter controls',exact:true});
  assert.equal(await gc.textContent(),'Use a GameCube controller');assert.equal(await gc.isVisible(),true);
  const gcBox=await gc.boundingBox();assert.ok(gcBox.x>=64&&gcBox.x+gcBox.width<=viewport.width&&gcBox.y>=0,'Long adapter label avoids top-left host reserve and viewport edge');
  await gc.click();const setup=page.getByRole('link',{name:'Check GameCube setup and update availability'});await setup.waitFor();assert.equal(await setup.getAttribute('href'),'https://yougame.co/desktop#gamecube-setup');assert.match(await page.locator('dialog[open]').textContent(),/0\.3\.0 cannot use this adapter/);assert.equal(await page.locator('dialog[open] [data-connect]').isDisabled(),true);
  await page.screenshot({path:path.join(out,`${mobile?'phone':'desktop'}-gc.png`)});await page.getByRole('button',{name:'Done',exact:true}).click();
  // Enter and customize the actual local native CSS using input only.
  await page.evaluate(()=>document.querySelector('iframe').contentWindow.focus());
  for(let n=0;n<3&&!await page.evaluate(()=>!!nativeEvidence.original.remixMenu);n++){await page.keyboard.press('KeyX');await page.waitForTimeout(500);}
  await page.waitForFunction(()=>!!nativeEvidence.original.remixMenu);
  await page.keyboard.press('ArrowRight');await page.waitForTimeout(250);await page.keyboard.press('KeyX');
  await page.waitForFunction(()=>nativeEvidence.original.remixMenu.phase===1);
  await page.evaluate(()=>{resultFixture.rawPads=[0,256];});await page.waitForFunction(()=>nativeEvidence.original.remixMenu.humans===3);
  await page.evaluate(()=>{resultFixture.rawPads=[0,0];nativeEvidence.savedMenu=structuredClone(nativeEvidence.original.remixMenu);});
  await page.screenshot({path:path.join(out,`${mobile?'phone':'desktop'}-local-before.png`)});
  await page.getByRole('button',{name:'Competitive online',exact:true}).click();assert.equal(await gc.isVisible(),false);
  await page.locator('[data-fighter="58"]').click();await page.getByRole('button',{name:/^Casual /}).click();
  await page.waitForFunction(()=>resultFixture.syncs.length===1);
  const cases=[];
  for(const [index,winner] of [0,1,-1,-2].entries()){
   const callCount=await page.evaluate(()=>nativeEvidence.calls.length);
   await page.evaluate(winner=>{const r=resultFixture.room;const event={round:r.round,won:winner===0,draw:winner===-1,void:winner===-2};r.playing=false;r.round++;r.emit('result',event);},winner);
   await page.waitForFunction(count=>nativeEvidence.calls.length===count+1,callCount);
   try{await page.waitForFunction(winner=>{const m=document.querySelector('iframe[title="OpenSmash64 native results"]')?.contentWindow.Module;return m?.remixResults?.winner===(winner<0?-1:winner)&&m.remixResults?.fighters.join(',')==='58,59';},winner,{timeout:10000});}catch(error){await page.screenshot({path:path.join(out,'failure.png')});console.log(JSON.stringify(await page.evaluate(()=>({calls:nativeEvidence.calls,ticks:nativeEvidence.ticks,frames:[...document.querySelectorAll('iframe')].map(f=>({title:f.title,hidden:f.hidden,scene:f.contentWindow.Module?.nativeScene,results:f.contentWindow.Module?.remixResults,menu:f.contentWindow.Module?.remixMenu})),body:document.body.className,status:document.querySelector('#status').textContent}))));throw error;}
   const before=await page.evaluate(()=>nativeEvidence.ticks);await page.waitForFunction(ticks=>nativeEvidence.ticks>ticks+30,before);
   assert.deepEqual(await page.evaluate(()=>nativeEvidence.calls.at(-1)),{args:[58,59,winner,0,0],accepted:1});
   assert.equal(await gc.isVisible(),false);assert.equal(await page.locator('#competitive.native-result').isVisible(),true);
   const menu=page.frames().find(frame=>frame!==page.mainFrame()&&frame.frameElement&&frame===page.frames().at(-1));
   const rawA=await menu.locator('canvas').screenshot();const ticksA=await page.evaluate(()=>nativeEvidence.ticks);await page.waitForFunction(ticks=>nativeEvidence.ticks>ticks+20,ticksA);const rawB=await menu.locator('canvas').screenshot();
   assert.notEqual(createHash('sha256').update(rawA).digest('hex'),createHash('sha256').update(rawB).digest('hex'),'Native result image animates');
   await writeFile(path.join(out,`${mobile?'phone':'desktop'}-${winner}-native.png`),rawB);
   await page.screenshot({path:path.join(out,`${mobile?'phone':'desktop'}-${winner}-app.png`)});
   const layout=await page.evaluate(()=>{const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};const f=document.querySelector('iframe[title="OpenSmash64 native results"]');return {canvas:rect(f),panel:rect(document.querySelector('#competitive .competitive-card')),surface:rect(document.querySelector('#play-surface')),native:f.contentWindow.Module.remixResults,frames:[...document.querySelectorAll('iframe')].map(f=>f.title),heapBytes:[...document.querySelectorAll('iframe')].map(f=>f.contentWindow.HEAPU8?.byteLength||0),jsHeap:performance.memory?.usedJSHeapSize};});
   cases.push({winner,call:await page.evaluate(()=>nativeEvidence.calls.at(-1)),animatedImage:true,layout});
   if(index<3){await page.evaluate(()=>resultFixture.room.ready());await page.waitForFunction(n=>resultFixture.syncs.length===n,index+2);}
  }
  await page.evaluate(()=>resultFixture.room.emit('leave',{}));await page.getByRole('button',{name:'Back to local play',exact:true}).click();assert.equal(await gc.isVisible(),true);
  assert.equal(await page.locator('iframe').count(),1);assert.equal(await page.locator('#competitive').isVisible(),false);
  assert.deepEqual(await page.evaluate(()=>{const m=document.querySelector('iframe').contentWindow.Module;return {same:m===nativeEvidence.original,menu:m.remixMenu,saved:nativeEvidence.savedMenu,exports:nativeEvidence.originalExports,results:m.remixResults||null};}),await page.evaluate(()=>({same:true,menu:nativeEvidence.savedMenu,saved:nativeEvidence.savedMenu,exports:0,results:null})));
  // The native CSS intentionally debounces the preceding port-join selection.
  // Let its preserved wait counter drain before issuing a fresh A edge.
  const localTicks=await page.evaluate(()=>nativeEvidence.localTicks);await page.waitForFunction(ticks=>nativeEvidence.localTicks>ticks+20,localTicks);
  await page.evaluate(()=>{document.querySelector('iframe').contentWindow.focus();resultFixture.rawPads=[0,1];});await page.waitForFunction(()=>nativeEvidence.original.remixMenu.phase===3);
  await page.evaluate(()=>{resultFixture.rawPads=[0,0];});await page.waitForTimeout(300);await page.evaluate(()=>{resultFixture.rawPads=[256,0];});await page.waitForFunction(()=>nativeEvidence.original.remixMenu.phase===2);await page.evaluate(()=>{resultFixture.rawPads=null;});
  await page.screenshot({path:path.join(out,`${mobile?'phone':'desktop'}-local-return.png`)});
  assert.deepEqual(errors,[]);evidence.push({mobile,viewport,gcBox,hostReserve:64,pickerAndNativeHide:true,localRestored:true,originalMenuRosterPortsPreserved:true,localAConfirmsAndStartOpensStages:true,pendingDesktopCopy:true,memory:await page.evaluate(()=>nativeEvidence.memory),memoryScope:'RAF-sampled attached engine Wasm capacity and Chromium used JS heap; not process RSS or a combat transition measurement',cases,errors});await page.close();
 }
 const wasm=await readFile(path.join(stage,'engine/BattleShip.wasm'));
 await writeFile(path.join(out,'verification.json'),JSON.stringify({scope:'Real staged native/app presentation; fixture SDK room and controller status; no battle or hosted settlement claim',stage,muted:true,nativeFileSha256:createHash('sha256').update(wasm).digest('hex'),evidence},null,2));console.log(JSON.stringify({passed:evidence.length,out}));
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
