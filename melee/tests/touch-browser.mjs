// Browser regression for the production touch layout, without loading the engine.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const server=http.createServer(async(req,res)=>{
 try{
  const name=req.url.split('?')[0].slice(1)||'index.html';
  if(!['index.html','style.css','competitive.css','touch.mjs','touch-state.mjs','touch-stick.mjs'].includes(name))throw Error();
  let content=await readFile(new URL('../src/'+name,import.meta.url),'utf8');
  if(name==='index.html')content=content.replace('<script src="https://yougame.co/sdk.js"></script>','').replace('<script src="./engine/melee.js"></script>','')
   .replace('<script type="module" src="./app.mjs"></script>',`<script type="module">
    import {createTouch} from './touch.mjs';
    import {RESET_CHORD} from './touch-state.mjs';
    window.RESET_CHORD=RESET_CHORD;
    document.getElementById('welcome').hidden=true;document.body.classList.add('playing');
    document.getElementById('download-status').hidden=false;document.getElementById('download-label').textContent='Downloading Fox…';
    window.touch=createTouch({wakeAudio(){},leave(){window.left=(window.left||0)+1;}});touch.context(false);
   </script>`);
  res.setHeader('Content-Type',name.endsWith('.html')?'text/html':name.endsWith('.css')?'text/css':'text/javascript');res.end(content);
 }catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const NEUTRAL=[0,0,0,0,0,0,0];
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM?{executablePath:process.env.PLAYWRIGHT_CHROMIUM}:{})});
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.__pads=[];Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>window.__pads});});
 await page.goto(`http://127.0.0.1:${server.address().port}/?touch=1`);
 await page.waitForFunction(()=>window.touch);
 const settled=viewport=>page.waitForFunction(({width,height})=>{
  const r=document.getElementById('play-surface').getBoundingClientRect();
  return document.body.classList.contains('rotated')===(height>width)&&Math.abs(r.width-width)<1&&Math.abs(r.height-height)<1;
 },viewport,{timeout:5000});
 const read=()=>page.evaluate(()=>[...touch.read()]);
 const boxes=async()=>page.evaluate(()=>Object.fromEntries(['#touch-stick','#touch-c','#touch-taunt','.attack','.special','.jump','.grab','.shield','#touch-start','#touch-reset','#download-status','#touch-stick-zone','#touch-c-zone','#canvas'].map(s=>{const r=document.querySelector(s).getBoundingClientRect();return [s,{x:r.x,y:r.y,w:r.width,h:r.height}];})));
 const overlap=(a,b)=>a.x+2<b.x+b.w&&b.x+2<a.x+a.w&&a.y+2<b.y+b.h&&b.y+2<a.y+a.h;
 for(const viewport of [{width:390,height:844},{width:844,height:390},{width:852,height:393},{width:393,height:852},{width:667,height:375},{width:360,height:780}]){
  await page.setViewportSize(viewport);await settled(viewport);
  const rotated=viewport.height>viewport.width,span=rotated?viewport.height:viewport.width,depth=rotated?viewport.width:viewport.height;
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight),true,'no page overflow');
  const b=await boxes();
  // Every control is on screen and the controls never cover each other or the picture.
  const controls=Object.entries(b).filter(([k])=>!['#canvas','#download-status','#touch-stick-zone','#touch-c-zone'].includes(k));
  for(const [k,r] of controls){assert.ok(r.w>0&&r.h>0,k+' laid out');assert.ok(r.x>=-1&&r.y>=-1&&r.x+r.w<=viewport.width+1&&r.y+r.h<=viewport.height+1,`${k} inside ${JSON.stringify(viewport)}: ${JSON.stringify(r)}`);}
  for(let i=0;i<controls.length;i++)for(let j=i+1;j<controls.length;j++)assert.ok(!overlap(controls[i][1],controls[j][1]),`${controls[i][0]} overlaps ${controls[j][0]} at ${JSON.stringify(viewport)}`);
  for(const [k,r] of [...controls,['#touch-stick-zone',b['#touch-stick-zone']],['#touch-c-zone',b['#touch-c-zone']]])assert.ok(!overlap(r,b['#canvas']),`${k} covers the picture at ${JSON.stringify(viewport)}`);
  // The download toast turns with the surface and sits over the picture's bottom edge, clear of the thumbs.
  for(const [k,r] of controls)assert.ok(!overlap(r,b['#download-status']),`${k} under the download toast at ${JSON.stringify(viewport)}`);
  assert.ok(overlap(b['#download-status'],b['#canvas']),'download toast over the picture');
  assert.ok(rotated?b['#download-status'].w<b['#download-status'].h:b['#download-status'].w>b['#download-status'].h,'download toast turned with the surface');
  assert.ok((rotated?b['#canvas'].h:b['#canvas'].w)<span-300&&(rotated?b['#canvas'].w:b['#canvas'].h)>depth-2,'picture is inset between the controls');
  // Sticks: a contact beyond the visible circle inside the zone still drives the stick.
  for(const [sel,index] of [['#touch-stick',1],['#touch-c',3]]){
   const rect=await page.locator(sel).boundingBox(),x=rect.x+rect.width/2,y=rect.y+rect.height/2,reach=sel==='#touch-c'?rect.width*.4:rect.width/2+8;
   for(const dir of [-1,1]){
    await page.mouse.move(x+(rotated?0:dir*reach),y+(rotated?dir*reach:0));await page.mouse.down();
    const expected=[...NEUTRAL];expected[index]=dir;assert.deepEqual(await read(),expected,`${sel} ${dir} at ${JSON.stringify(viewport)}`);
    await page.mouse.move(viewport.width-1,viewport.height-1);await page.mouse.up();
    assert.deepEqual(await read(),NEUTRAL);
   }
  }
  await page.locator('#touch-start').click();assert.deepEqual(await read(),[32,0,0,0,0,0,0]);
  assert.equal(await page.evaluate(()=>Number(document.getElementById('touch-reset').dataset.mask)===RESET_CHORD),true,'reset button carries L+R+A+Start');
  await page.locator('#touch-reset').click();assert.deepEqual(await read(),[3105,0,0,0,0,1,1]);
  await page.locator('.shield').click();assert.deepEqual(await read(),[2048,0,0,0,0,0,1]);
  const cdp=await page.context().newCDPSession(page);
  const stick=await page.locator('#touch-stick').boundingBox(),a=await page.locator('.attack').boundingBox();
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:stick.x+stick.width/2+(rotated?0:-stick.width*.6),y:stick.y+stick.height/2+(rotated?-stick.height*.6:0)},{x:a.x+a.width/2,y:a.y+a.height/2}]});
  assert.deepEqual(await read(),[1,-1,0,0,0,0,0],'stick and A together');
  await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
  assert.deepEqual(await read(),NEUTRAL);
  await cdp.detach();
  await page.screenshot({path:new URL(`../../build/melee-web/test-results/touch-${viewport.width}x${viewport.height}.png`,import.meta.url).pathname}).catch(()=>{});
 }
 // Online: the reset goes, the leave hold appears, Start stays for the native menus.
 await page.evaluate(()=>touch.context(true));
 assert.equal(await page.locator('#touch-reset').isVisible(),false);assert.equal(await page.locator('#touch-leave').isVisible(),true);assert.equal(await page.locator('#touch-start').isVisible(),true);
 await page.evaluate(()=>touch.context(false));
 assert.equal(await page.locator('#touch-reset').isVisible(),true);assert.equal(await page.locator('#touch-leave').isVisible(),false);
 // A connected controller collapses the overlay and gives the picture the whole surface.
 for(const viewport of [{width:844,height:390},{width:390,height:844}]){
  await page.setViewportSize(viewport);await settled(viewport);
  const rotated=viewport.height>viewport.width,span=rotated?viewport.height:viewport.width;
  const stick=await page.locator('#touch-stick').boundingBox(),before=await page.locator('#canvas').boundingBox();
  assert.ok((rotated?before.height:before.width)<span-100,'picture is inset between the controls');
  const hold=[stick.x+stick.width/2+(rotated?0:stick.width/2+8),stick.y+stick.height/2+(rotated?stick.height/2+8:0)];
  await page.mouse.move(...hold);await page.mouse.down();
  assert.deepEqual(await read(),[0,1,0,0,0,0,0]);
  await page.evaluate(()=>{__pads.push({connected:true,buttons:[{pressed:false}],axes:[0,0,0,0]});const e=new Event('gamepadconnected');Object.defineProperty(e,'gamepad',{value:__pads[0]});dispatchEvent(e);});
  assert.equal(await page.evaluate(()=>document.body.classList.contains('pad')),false,'an idle pad leaves the overlay');
  await page.evaluate(()=>{__pads[0].buttons[0].pressed=true;});
  await page.waitForFunction(()=>{touch.read();return document.body.classList.contains('pad');},null,{timeout:2000});
  assert.deepEqual(await read(),NEUTRAL,'the held stick is dropped');
  assert.equal(await page.evaluate(([x,y])=>document.elementFromPoint(x,y)?.id,hold),'canvas','the stick zone no longer takes the contact');
  await page.mouse.up();await page.evaluate(()=>{__pads[0].buttons[0].pressed=false;});
  for(const id of ['#touch-stick','#touch-c','#touch-taunt','#touch-start','#touch-reset','.attack','.jump','.special','.shield','.grab'])assert.equal(await page.locator(id).isVisible(),false,id+' hidden with a pad');
  const picture=await page.locator('#canvas').boundingBox();
  assert.ok(Math.abs(picture.width-viewport.width)<1&&Math.abs(picture.height-viewport.height)<1,'picture fills the surface with a pad');
  await page.evaluate(()=>touch.context(true));
  assert.equal(await page.locator('#touch-leave').isVisible(),true,'leave hold stays online');
  await page.evaluate(()=>{touch.touched();touch.context(false);});
  assert.equal(await page.evaluate(()=>document.body.classList.contains('pad')),false);
  assert.equal(await page.locator('#touch-stick').isVisible(),true);
  await page.mouse.move(...hold);await page.mouse.down();assert.deepEqual(await read(),[0,1,0,0,0,0,0]);await page.mouse.up();
  await page.evaluate(()=>{__pads[0].axes=[0,-.9,0,0];});
  await page.waitForFunction(()=>{touch.read();return document.body.classList.contains('pad');},null,{timeout:2000});
  await page.evaluate(()=>{const gone=__pads[0];__pads.length=0;const e=new Event('gamepaddisconnected');Object.defineProperty(e,'gamepad',{value:gone});dispatchEvent(e);});
  assert.equal(await page.evaluate(()=>document.body.classList.contains('pad')),false,'the pad going away hands back');
 }
 // The header and the SDK's own overlay stay out of the way; a covered overlay reads nothing.
 assert.equal(await page.locator('header').isVisible(),false,'page header hidden while playing on touch');
 await page.evaluate(()=>{document.getElementById('competitive').hidden=false;});
 assert.equal(await page.locator('#touch-controls').isVisible(),false,'online screens cover the overlay');
 await page.evaluate(()=>{document.getElementById('competitive').hidden=true;});
 assert.deepEqual(errors,[]);
 console.log('Browser passed: Melee touch layout, sticks, buttons, online context, controller hand-off at six viewports.');
}finally{await browser?.close();server.close();}
