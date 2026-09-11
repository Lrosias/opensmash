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
 assert.deepEqual(errors,[]);
 console.log('Browser touch checks passed: four viewports, five scenes, outside-circle taps, capture/release, Start and touch cancellation.');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
