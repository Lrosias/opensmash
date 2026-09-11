// Exercise real browser key events through the YouGame SDK and into Melee.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const out=new URL('../../build/melee-web/test-results/',import.meta.url);
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
try {
  const page=await browser.newPage({viewport:{width:1280,height:720}});
  if(process.env.MELEE_SDK_PATH)await page.route('https://yougame.co/sdk.js',route=>route.fulfill({path:process.env.MELEE_SDK_PATH,contentType:'text/javascript'}));
  await page.addInitScript(()=>{window.keyboardTestGamepad=null;Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[window.keyboardTestGamepad,null,null,null]});});
  await page.goto(process.env.MELEE_URL||'http://127.0.0.1:8075');
  await page.locator('#play').click();
  await page.waitForFunction(()=>window.melee?.samples?.at(-1)?.presents>180,null,{timeout:180000});
  await page.locator('#canvas').click();
  await page.evaluate(async()=>{
    window.keyboardTestConvert=(await import('./keyboard.mjs')).gameCubeInput;
    const original=melee.module._melee_input;
    melee.module._melee_input=(seat,...pad)=>{if(seat===0)window.keyboardTestPad=pad;return original(seat,...pad);};
  });
  const read=()=>page.evaluate(()=>keyboardTestConvert(YouGame.input.player(0).state).map(n=>n||0));
  const check=async(keys,expected)=>{
    for(const key of keys)await page.keyboard.down(key);
    await page.waitForTimeout(40);
    const actual=await read();
    assert.deepEqual(actual,expected,keys.join('+'));
    assert.deepEqual(await page.evaluate(()=>keyboardTestPad.map(n=>n||0)),expected,'native input: '+keys.join('+'));
    for(const key of [...keys].reverse())await page.keyboard.up(key);
    assert.deepEqual(await read(),[0,0,0,0,0,0,0],'released '+keys.join('+'));
  };
  const axis=80/127;
  for(const [key,index,value] of [['ArrowRight',1,axis],['ArrowLeft',1,-axis],['ArrowUp',2,axis],['ArrowDown',2,-axis],['i',4,axis],['k',4,-axis],['j',3,-axis],['l',3,axis]]){
    const expected=[0,0,0,0,0,0,0];expected[index]=value;await check([key],expected);
  }
  await check(['ArrowLeft','ArrowRight'],[0,0,0,0,0,0,0]);
  await check(['ArrowRight','ShiftLeft'],[0,axis/2,0,0,0,0,0]);
  await check(['i','ControlLeft'],[0,0,0,0,axis/2,0,0]);
  for(const [key,mask] of [['x',1],['z',2],['c',4],['s',8],['d',16],['Enter',32],['t',64],['g',128],['f',256],['h',512]])
    await check([key],[mask,0,0,0,0,0,0]);
  await check(['q'],[1024,0,0,0,0,1,0]);
  await check(['w'],[2048,0,0,0,0,0,1]);
  await check(['AltLeft','Enter'],[0,0,0,0,0,0,0]);
  assert.ok(await page.evaluate(()=>YouGame.input.players.slice(1).every(p=>!p.keyboard)));
  // Check a remapped Move action reaches the native engine, not an obsolete
  // custom stick action. This uses the same SDK setup path as the defaults.
  await page.evaluate(async()=>{
    const {keyboardOptions}=await import('./keyboard.mjs');
    YouGame.input.setup({...keyboardOptions,keys:[{...keyboardOptions.keys[0],right:['KeyR']},...keyboardOptions.keys.slice(1)]});
  });
  await check(['r'],[0,axis,0,0,0,0,0]);
  await check(['ArrowRight'],[0,0,0,0,0,0,0]);
  await page.evaluate(async()=>YouGame.input.setup((await import('./keyboard.mjs')).keyboardOptions));
  // A small ordinary-pad movement can win SDK source while keyboard wins axes.
  await page.evaluate(()=>{
    window.keyboardTestGamepad={id:'Standard mixed-input test pad',index:0,connected:true,mapping:'standard',timestamp:performance.now(),axes:[.3,0,0,0],buttons:Array.from({length:17},(_,i)=>({pressed:i===0,touched:i===0,value:i===0?1:0}))};
    Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[window.keyboardTestGamepad,null,null,null]});
    const e=new Event('gamepadconnected');Object.defineProperty(e,'gamepad',{value:keyboardTestGamepad});window.dispatchEvent(e);
  });
  await page.waitForFunction(()=>YouGame.input.player(0).state.source==='gamepad');
  const padOnly=await page.evaluate(()=>({x:YouGame.input.player(0).state.move.x,pad:keyboardTestConvert(YouGame.input.player(0).state)}));
  assert.ok(padOnly.x>0);assert.equal(padOnly.pad[1],padOnly.x,'ordinary pad retains full range');
  await page.keyboard.down('ArrowRight');await page.waitForTimeout(80);
  assert.equal((await read())[1],1,'unmodified merged input retains SDK source scaling');
  await page.keyboard.down('ShiftLeft');
  await page.keyboard.down('i');await page.keyboard.down('ControlLeft');await page.keyboard.down('t');
  await page.waitForFunction(()=>YouGame.input.player(0).state.source==='gamepad');
  await page.waitForTimeout(80);
  assert.deepEqual(await read(),[65,axis/2,0,0,axis/2,0,0],'keyboard modifiers and D-pad with active ordinary gamepad');
  assert.deepEqual(await page.evaluate(()=>keyboardTestPad.map(n=>n||0)),[65,axis/2,0,0,axis/2,0,0]);
  for(const key of ['t','ControlLeft','i','ShiftLeft','ArrowRight'])await page.keyboard.up(key);
  await page.evaluate(()=>{const pad=window.keyboardTestGamepad;pad.connected=false;window.keyboardTestGamepad=null;const e=new Event('gamepaddisconnected');Object.defineProperty(e,'gamepad',{value:pad});window.dispatchEvent(e);});
  await page.screenshot({path:new URL('slippi-keyboard-before.png',out).pathname});
  await page.keyboard.down('ArrowRight');await page.waitForTimeout(450);await page.keyboard.up('ArrowRight');
  await page.screenshot({path:new URL('slippi-keyboard-after.png',out).pathname});
  assert.deepEqual(await page.evaluate(()=>melee.errors),[]);
  console.log('Browser passed: Slippi keys reach the SDK and native engine; modifiers, releases, opposite directions, remapped movement, and seat isolation.');
} finally {await browser.close();}
