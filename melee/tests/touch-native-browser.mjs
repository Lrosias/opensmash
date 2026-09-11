// Drive the real engine with touch on a phone-sized viewport: what the overlay reads
// must be what port 1 receives in _melee_input, offline, with the SDK seat idle.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const out=new URL('../../build/melee-web/test-results/',import.meta.url);
await mkdir(out,{recursive:true});
const NEUTRAL=[0,0,0,0,0,0,0];
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM?{executablePath:process.env.PLAYWRIGHT_CHROMIUM}:{})});
try {
  const page=await browser.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  if(process.env.MELEE_SDK_PATH)await page.route('https://yougame.co/sdk.js',route=>route.fulfill({path:process.env.MELEE_SDK_PATH,contentType:'text/javascript'}));
  await page.addInitScript(()=>{// Browsers report four slots; a missing pad is null, never a short list.
  window.__pads=[null,null,null,null];Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>window.__pads});});
  await page.goto((process.env.MELEE_URL||'http://127.0.0.1:8073')+'/?touch=1');
  await page.locator('#play').tap();
  await page.waitForFunction(()=>window.melee?.samples?.at(-1)?.presents>180,null,{timeout:180000});
  await page.evaluate(()=>{
    window.__pad=null;const original=melee.module._melee_input;
    melee.module._melee_input=(seat,...pad)=>{if(seat===0)window.__pad=pad.map(n=>n||0);return original(seat,...pad);};
  });
  assert.equal(await page.evaluate(()=>document.body.classList.contains('touch')&&document.body.classList.contains('playing')),true,'touch scheme on while playing');
  assert.equal(await page.locator('#touch-controls').isVisible(),true);
  assert.equal(await page.locator('header').isVisible(),false,'desktop header out of the way');
  const picture=await page.locator('#canvas').boundingBox();
  assert.ok(picture.width<844-300&&picture.height>388,'picture inset between the controls: '+JSON.stringify(picture));
  const cdp=await page.context().newCDPSession(page);
  const down=points=>cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points});
  const up=()=>cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  const native=async()=>{await page.waitForTimeout(80);return page.evaluate(()=>__pad);};
  const center=async sel=>{const r=await page.locator(sel).boundingBox();return {x:r.x+r.width/2,y:r.y+r.height/2,r};};
  for(const [sel,mask,l,r] of [['.attack',1,0,0],['.special',2,0,0],['.jump',4,0,0],['.grab',16,0,0],['.shield',2048,0,1],['#touch-taunt',64,0,0],['#touch-start',32,0,0]]){
    await down([await center(sel)]);assert.deepEqual(await native(),[mask,0,0,0,0,l,r],sel);
    await up();assert.deepEqual(await native(),NEUTRAL,sel+' released');
  }
  const stick=await center('#touch-stick'),c=await center('#touch-c'),a=await center('.attack');
  await down([{x:stick.x+stick.r.width/2,y:stick.y}]);assert.deepEqual(await native(),[0,1,0,0,0,0,0],'control stick right');
  await up();assert.deepEqual(await native(),NEUTRAL);
  await down([{x:c.x,y:c.y-c.r.height/2}]);assert.deepEqual(await native(),[0,0,0,0,1,0,0],'C-stick up');
  await up();assert.deepEqual(await native(),NEUTRAL);
  await down([{x:stick.x,y:stick.y-stick.r.height*.2},{x:a.x,y:a.y}]);
  const both=await native();assert.equal(both[0],1);assert.equal(both[1],0);assert.ok(both[2]>.5&&both[2]<=.6,'half-tilt up with A: '+JSON.stringify(both));
  await up();assert.deepEqual(await native(),NEUTRAL);
  // Keyboard on the SDK seat and touch merge on port 1.
  await down([{x:a.x,y:a.y}]);await page.keyboard.down('ArrowRight');
  const merged=await native();assert.equal(merged[0],1);assert.ok(merged[1]>.6,'keyboard axis with a touch button: '+JSON.stringify(merged));
  await page.keyboard.up('ArrowRight');await up();assert.deepEqual(await native(),NEUTRAL);
  assert.equal(await page.locator('#touch-reset').isVisible(),true);assert.equal(await page.locator('#touch-leave').isVisible(),false);
  await page.screenshot({path:new URL('melee-touch-engine-landscape.png',out).pathname});
  // An upright phone turns the surface; the stick still reads along the game's axes.
  await page.setViewportSize({width:390,height:844});
  await page.waitForFunction(()=>document.body.classList.contains('rotated')&&Math.abs(document.getElementById('play-surface').getBoundingClientRect().height-844)<1,null,{timeout:5000});
  const turned=await center('#touch-stick');
  await down([{x:turned.x,y:turned.y+turned.r.height/2}]);assert.deepEqual(await native(),[0,1,0,0,0,0,0],'rotated: down on screen is right in the game');
  await up();assert.deepEqual(await native(),NEUTRAL);
  await page.screenshot({path:new URL('melee-touch-engine-portrait.png',out).pathname});
  await page.setViewportSize({width:844,height:390});
  await page.waitForFunction(()=>!document.body.classList.contains('rotated'),null,{timeout:5000});
  // A controller pressing a button takes over: the overlay goes, the picture fills the screen.
  await page.evaluate(()=>{__pads[0]=({connected:true,mapping:'standard',id:'test pad',index:0,timestamp:1,buttons:Array.from({length:17},()=>({pressed:false,value:0,touched:false})),axes:[0,0,0,0]});const e=new Event('gamepadconnected');Object.defineProperty(e,'gamepad',{value:__pads[0]});dispatchEvent(e);});
  await page.evaluate(()=>{__pads[0].buttons[0].pressed=true;__pads[0].buttons[0].value=1;});
  await page.waitForFunction(()=>document.body.classList.contains('pad'),null,{timeout:3000});
  const full=await page.locator('#canvas').boundingBox();assert.ok(Math.abs(full.width-844)<1,'picture fills the surface with a pad');
  await page.evaluate(()=>{__pads[0].buttons[0].pressed=false;__pads[0].buttons[0].value=0;});
  assert.deepEqual(await page.evaluate(()=>melee.errors),[],'no wrapper error from a connected pad');
  await page.screenshot({path:new URL('melee-touch-engine-pad.png',out).pathname});
  await down([{x:400,y:200}]);await up();
  await page.waitForFunction(()=>!document.body.classList.contains('pad'),null,{timeout:3000});
  assert.equal(await page.locator('#touch-stick').isVisible(),true,'a touch on the picture brings the overlay back');
  assert.deepEqual(await page.evaluate(()=>melee.errors),[]);assert.deepEqual(errors,[]);
  console.log('Native passed: touch buttons, both sticks, two fingers, keyboard merge, rotation and controller hand-off reach _melee_input on port 1.');
} finally {await browser.close();}
