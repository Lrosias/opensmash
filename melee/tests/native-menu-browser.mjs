// Real engine: boot straight into Melee, drive the native mode menu with pad input,
// and capture screenshots. Serve a staged dist first (melee/tools/serve.py).
// MELEE_URL=http://127.0.0.1:8079/ PLAYWRIGHT_PATH=... MELEE_SHOTS=<dir> node melee/tests/native-menu-browser.mjs
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const base=process.env.MELEE_URL||'http://127.0.0.1:8079/';
const shots=process.env.MELEE_SHOTS||'melee/test-results/native-menu';
await mkdir(shots,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
const logs=[];
try {
  const page=await browser.newPage({viewport:{width:960,height:720}});
  if(process.env.YOUGAME_SDK_PATH)await page.route('https://yougame.co/sdk.js',r=>r.fulfill({path:process.env.YOUGAME_SDK_PATH,contentType:'text/javascript'}));
  page.on('console',m=>logs.push(m.text()));page.on('pageerror',e=>logs.push('PAGEERROR '+e.message));
  await page.goto(base);
  await page.waitForFunction(()=>window.melee?.phase==='running'||window.melee?.phase==='error',null,{timeout:240000});
  assert.equal(await page.evaluate(()=>melee.phase),'running',logs.slice(-20).join('\n'));
  // Pads reach the engine through the page's own sampler; override its values per seat.
  await page.evaluate(()=>{const m=melee.module,orig=m._melee_input.bind(m);window.__pads={};m._melee_input=(seat,...pad)=>orig(seat,...(window.__pads[seat]||pad));});
  const shot=async name=>{await page.screenshot({path:path.join(shots,name+'.png')});console.log('shot',name);};
  const press=async(buttons,x=0,y=0,ms=140)=>{
    await page.waitForFunction(()=>!melee.assetBlocked,null,{timeout:120000});
    await page.evaluate(([b,x,y])=>{window.__pads[0]=[b,x,y,0,0,0,0];},[buttons,x,y]);await page.waitForTimeout(ms);
    await page.evaluate(()=>{window.__pads[0]=[0,0,0,0,0,0,0];});await page.waitForTimeout(400);
  };
  const active=()=>page.evaluate(()=>melee.module._melee_menu_active());
  await page.waitForFunction(()=>melee.module._melee_menu_active()===1,null,{timeout:60000});
  await page.waitForTimeout(3500);await shot('01-mode-menu');
  assert.equal(await active(),1);
  await press(0,0,-1);await shot('02-cursor-online');
  await press(1);await page.waitForTimeout(300);await shot('03-online-list');
  await page.evaluate(()=>{
    window.__queues=[];
    YouGame.multiplayer.joinLobby=async options=>{__queues.push(options.queue);throw Error('Cancelled');};
  });
  await press(1);
  await page.waitForFunction(()=>__queues.length===1&&melee.menu.phase===0);
  assert.deepEqual(await page.evaluate(()=>__queues),['friends']);
  await press(0,0,-1);await shot('04-cursor-casual');
  await press(1);
  await page.waitForFunction(()=>__queues.length===2&&melee.menu.phase===0);
  assert.deepEqual(await page.evaluate(()=>__queues),['friends','casual']);
  await press(2,0,0,300);await page.waitForTimeout(3000);await shot('07-after-back');
  await page.waitForFunction(()=>melee.module._melee_menu_active()===1,null,{timeout:30000});
  await page.waitForTimeout(2500);await shot('07-mode-menu-again');
  await press(1);
  await page.waitForFunction(()=>melee.module._melee_menu_active()===0,null,{timeout:30000});
  await page.waitForTimeout(2500);await shot('08-local-roster');
  await press(2,0,0,1000);
  if(await active()===0)await press(2,0,0,1500);
  await shot('09-local-back-attempt');
  await page.waitForFunction(()=>melee.module._melee_menu_active()===1,null,{timeout:30000});
  await page.waitForTimeout(1500);await shot('09-back-from-local');
  assert.deepEqual(logs.filter(l=>/\[menu\]|PAGEERROR|Invalid (read|write)|panicked/.test(l)),[]);
  console.log(JSON.stringify({passed:true}));
} finally { await writeFile(path.join(shots,'console.log'),logs.join('\n')); await browser.close(); }
