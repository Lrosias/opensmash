// Browser regression for the production touch layout, without loading the engine.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const server=http.createServer(async(req,res)=>{
 try{
  const name=req.url.split('?')[0].slice(1)||'index.html';
  if(!['index.html','style.css','touch.mjs','touch-state.mjs','touch-stick.mjs'].includes(name))throw Error();
  let content=await readFile(new URL('../src/'+name,import.meta.url),'utf8');
  if(name==='index.html')content=content.replace('<script src="https://yougame.co/sdk.js"></script>','')
   .replace('<script type="module" src="./app.mjs"></script>',`<script type="module">
    import {createTouch} from './touch.mjs';
    window.touch=createTouch({wakeAudio(){},leave(){}});touch.context(false,9);
   </script>`);
  res.setHeader('Content-Type',name.endsWith('.html')?'text/html':name.endsWith('.css')?'text/css':'text/javascript');res.end(content);
 }catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
 browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 // Chrome exposes a controller on the Mac after the first gesture; the page only sees the stub.
 await page.addInitScript(()=>{window.__pads=[];navigator.getGamepads=()=>window.__pads;});
 await page.goto(`http://127.0.0.1:${server.address().port}/?touch=1`);
 await page.waitForFunction(()=>window.touch);
 for(const viewport of [{width:390,height:844},{width:844,height:390},{width:852,height:393},{width:393,height:852}]){
  await page.setViewportSize(viewport);
  const rotated=viewport.height>viewport.width;
  await page.waitForFunction(({width,height})=>{
   const r=document.getElementById('play-surface').getBoundingClientRect();
   return document.body.classList.contains('rotated')===(height>width)&&Math.abs(r.width-width)<1&&Math.abs(r.height-height)<1;
  },viewport,{timeout:5000}).catch(async error=>{
   console.error(await page.evaluate(()=>({innerWidth,innerHeight,visual:[visualViewport.width,visualViewport.height],
    surface:document.getElementById('play-surface').getBoundingClientRect().toJSON(),style:document.body.style.cssText})),viewport);throw error;
  });
  const surface=await page.locator('#play-surface').boundingBox();
  assert.ok(Math.abs(surface.width-viewport.width)<1&&Math.abs(surface.height-viewport.height)<1);
  const rect=await page.locator('#touch-stick').boundingBox();
  const x=rect.x+rect.width/2,y=rect.y+rect.height/2;
  for(const scene of [9,10,22,52,99]){
   await page.evaluate(scene=>touch.context(false,scene),scene);
   for(const dir of [-1,1]){
    // Start beyond the visible circle, but inside the enlarged movement zone.
    await page.mouse.move(x+(rotated?0:dir*(rect.width/2+8)),y+(rotated?dir*(rect.height/2+8):0));
    await page.mouse.down();
    assert.deepEqual(await page.evaluate(()=>touch.read()),[0,dir*80,0]);
    await page.mouse.move(viewport.width-1,viewport.height-1);await page.mouse.up();
    assert.deepEqual(await page.evaluate(()=>touch.read()),[0,0,0]);
   }
  }
  await page.locator('#touch-start').click();
  assert.deepEqual(await page.evaluate(()=>touch.read()),[4096,0,0]);
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x+(rotated?0:-rect.width*.6),y:y+(rotated?-rect.height*.6:0)}]});
  assert.deepEqual(await page.evaluate(()=>touch.read()),[0,-80,0]);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
  assert.deepEqual(await page.evaluate(()=>touch.read()),[0,0,0]);
  await cdp.detach();
 }
 // A connected controller collapses the overlay and gives the picture the whole surface.
 for(const viewport of [{width:844,height:390},{width:390,height:844}]){
  await page.setViewportSize(viewport);
  await page.waitForFunction(({width,height})=>{
   const r=document.getElementById('play-surface').getBoundingClientRect();
   return document.body.classList.contains('rotated')===(height>width)&&Math.abs(r.width-width)<1&&Math.abs(r.height-height)<1;
  },viewport,{timeout:5000});
  await page.evaluate(()=>touch.context(false,22));
  const rotated=viewport.height>viewport.width,span=rotated?viewport.height:viewport.width;
  const stick=await page.locator('#touch-stick').boundingBox(),before=await page.locator('#game').boundingBox();
  assert.ok((rotated?before.height:before.width)<span-100,'picture is inset between the controls');
  // Hold the stick, then press a button on the pad: the hold is dropped and the overlay goes.
  const hold=[stick.x+stick.width/2+(rotated?0:stick.width/2+8),stick.y+stick.height/2+(rotated?stick.height/2+8:0)];
  await page.mouse.move(...hold);await page.mouse.down();
  assert.deepEqual(await page.evaluate(()=>touch.read()),[0,80,0]);
  await page.evaluate(()=>{__pads.push({connected:true,buttons:[{pressed:false}],axes:[0,0,0,0]});dispatchEvent(new Event('gamepadconnected'));});
  assert.equal(await page.evaluate(()=>document.body.classList.contains('pad')),false,'an idle pad leaves the overlay');
  await page.evaluate(()=>{__pads[0].buttons[0].pressed=true;});
  await page.waitForFunction(()=>{touch.read();return document.body.classList.contains('pad');},null,{timeout:2000});
  assert.deepEqual(await page.evaluate(()=>touch.read()),[0,0,0],'the held stick is dropped');
  assert.equal(await page.evaluate(([x,y])=>document.elementFromPoint(x,y)?.id,hold),'game','the stick zone no longer takes the contact');
  await page.mouse.up();await page.evaluate(()=>{__pads[0].buttons[0].pressed=false;});
  for(const id of ['#touch-stick','#touch-start','#touch-reset','.attack','.jump','.special','.shield','.grab'])assert.equal(await page.locator(id).isVisible(),false,id+' hidden with a pad');
  const game=await page.locator('#game').boundingBox();
  assert.ok(Math.abs(game.width-viewport.width)<1&&Math.abs(game.height-viewport.height)<1,'picture fills the surface with a pad');
  await page.mouse.move(...hold);await page.mouse.down();assert.deepEqual(await page.evaluate(()=>touch.read()),[0,0,0]);await page.mouse.up();
  await page.evaluate(()=>touch.context(true,22));
  assert.equal(await page.locator('#touch-leave').isVisible(),true,'leave hold stays online');
  // A touch on the picture brings the overlay back while the pad stays connected.
  await page.evaluate(()=>{touch.touched();touch.context(false,22);});
  assert.equal(await page.evaluate(()=>document.body.classList.contains('pad')),false);
  assert.equal(await page.locator('#touch-stick').isVisible(),true);
  await page.mouse.move(...hold);await page.mouse.down();assert.deepEqual(await page.evaluate(()=>touch.read()),[0,80,0]);await page.mouse.up();
  // Pad input takes over again; the pad going away hands back too.
  await page.evaluate(()=>{__pads[0].axes=[0,-.9,0,0];});
  await page.waitForFunction(()=>{touch.read();return document.body.classList.contains('pad');},null,{timeout:2000});
  await page.evaluate(()=>{__pads.length=0;dispatchEvent(new Event('gamepaddisconnected'));});
  assert.equal(await page.evaluate(()=>document.body.classList.contains('pad')),false);
  assert.equal(await page.locator('#touch-stick').isVisible(),true);
  const after=await page.locator('#game').boundingBox();
  assert.ok(Math.abs((rotated?after.height:after.width)-(rotated?before.height:before.width))<1,'inset returns when the pad goes');
 }
 assert.deepEqual(errors,[]);
 console.log('Browser touch checks passed: four viewports, five scenes, outside-circle taps, capture/release, Start, touch cancellation, and the controller overlay swap.');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
