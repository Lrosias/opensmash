// Real DOM interaction with an explicitly stubbed platform; no native gameplay
// or hosted rankings are claimed by this menu acceptance test.
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const output=process.env.MELEE_RESULTS||'melee/test-results/competitive';await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});const errors=[];
try{
  const context=await browser.newContext({viewport:{width:1280,height:900},hasTouch:true});
  await context.route('**/engine/melee.js',r=>r.fulfill({body:'/* Native engine intentionally not needed for menu verification. */',contentType:'text/javascript'}));
  await context.route('https://yougame.co/sdk.js',r=>r.fulfill({contentType:'text/javascript',body:`window.queueCalls=[];window.YouGame={ready:async()=>{},ui:{onChange:fn=>{fn({status:'standalone'});return()=>{}}},multiplayer:{invite:null,open:async options=>{queueCalls.push({queue:options.queue,mode:options.mode});throw Error('Cancelled')}}};`}));
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.MELEE_URL||'http://127.0.0.1:8275/');
  await page.getByRole('button',{name:'GameCube adapter controls',exact:true}).waitFor();
  await page.locator('#online').click();await page.locator('[data-action=fighter][data-value="2"]').click();
  assert.equal(await page.getByRole('button',{name:'GameCube adapter controls',exact:true}).isVisible(),false);
  await page.screenshot({path:`${output}/desktop-fighters.png`});
  await page.getByRole('button',{name:'Lock fighter →',exact:true}).click();
  for(const mode of ['Casual','Ranked','Friends'])assert.equal(await page.getByRole('button',{name:mode,exact:true}).isDisabled(),false);
  await page.screenshot({path:`${output}/desktop-modes.png`});
  await page.getByRole('button',{name:'Preview Ranked flow',exact:true}).click();
  assert.equal(await page.locator('[data-action=stage][data-value="3"]').isDisabled(),true);
  for(const id of [31,32,28,8])await page.locator(`[data-action=stage][data-value="${id}"]`).click();
  await page.getByRole('button',{name:'Preview game →'}).click();await page.getByRole('button',{name:'Record P1 win',exact:true}).click();
  await page.getByRole('button',{name:'Continue to counterpick'}).click();
  await page.locator('[data-action=stage][data-value="31"]').click();await page.locator('[data-action=stage][data-value="3"]').click();
  await page.locator('[data-action=counterfighter][data-value="20"]').click();await page.getByRole('button',{name:'Lock character',exact:true}).click();
  await page.locator('[data-action=counterfighter][data-value="9"]').click();await page.getByRole('button',{name:'Lock character',exact:true}).click();
  await page.getByRole('button',{name:'Preview game →'}).click();await page.getByRole('button',{name:'Record P2 win',exact:true}).click();await page.getByRole('button',{name:'Continue to counterpick'}).click();
  assert.equal(await page.locator('[data-action=stage][data-value="2"]').isDisabled(),true);
  await page.screenshot({path:`${output}/desktop-counterpick.png`});
  await page.locator('[data-action=stage][data-value="31"]').click();await page.locator('[data-action=stage][data-value="8"]').click();
  await page.getByRole('button',{name:'Lock character',exact:true}).click();await page.getByRole('button',{name:'Lock character',exact:true}).click();
  await page.getByRole('button',{name:'Preview game →'}).click();await page.getByRole('button',{name:'Record P1 win',exact:true}).click();
  assert.match(await page.locator('#competitive').innerText(),/Set score · 2 – 1/);
  await page.screenshot({path:`${output}/desktop-set-result.png`});
  await page.getByRole('button',{name:'Change fighter',exact:true}).click();
  await page.setViewportSize({width:390,height:844});await page.locator('[data-action=fighter][data-value="9"]').tap();
  assert.equal(await page.evaluate(()=>document.getElementById('competitive').scrollWidth<=innerWidth),true);
  await page.screenshot({path:`${output}/mobile-fighters.png`});
  await page.getByRole('button',{name:'Lock fighter →',exact:true}).tap();await page.getByRole('button',{name:'Preview Casual flow'}).tap();
  await page.screenshot({path:`${output}/mobile-casual-stage.png`});
  const first=await page.evaluate(()=>melee.competitive.model.state.stage);
  await page.getByRole('button',{name:'Preview game →'}).tap();await page.getByRole('button',{name:'Record P1 win',exact:true}).tap();await page.getByRole('button',{name:'Play again',exact:true}).tap();
  assert.notEqual(await page.evaluate(()=>melee.competitive.model.state.stage),first);
  // Exercise controller navigation through the same focus/click path as hardware.
  await page.getByRole('button',{name:'Local play',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:'GameCube adapter controls',exact:true}).isVisible(),true);
  await page.evaluate(()=>{const frame=document.createElement('iframe');frame.className='native-match';document.body.append(frame);});
  assert.equal(await page.getByRole('button',{name:'GameCube adapter controls',exact:true}).isVisible(),false);
  await page.evaluate(()=>document.querySelector('.native-match').remove());
  assert.equal(await page.getByRole('button',{name:'GameCube adapter controls',exact:true}).isVisible(),true);
  await page.locator('#online').click();
  await page.locator('[data-action=fighter][data-value="2"]').focus();await page.keyboard.press('ArrowRight');
  assert.notEqual(await page.evaluate(()=>document.activeElement.dataset.value),'2');
  await page.evaluate(()=>melee.competitive.pollInput({source:'gamepad',move:{x:0,y:0},a:true,b:false}));
  assert.equal(await page.evaluate(()=>Number(document.activeElement.dataset.value)===melee.competitive.selection.fighter),true);
  // Raw adapter ownership suppresses standard-pad fallback, including neutral stale samples.
  await page.evaluate(()=>{
    const ui=melee.competitive;ui.readMenu=()=>({direction:0,select:false,back:false,start:false});
    ui.padA=false;ui.pollInput({source:'gamepad',a:true,b:true,move:{x:1,y:0}});
    if(ui.root.hidden)throw Error('Owned neutral adapter allowed fallback back button');
    ui.readMenu=()=>({direction:1,select:false,back:false,start:false});ui.padAt=0;ui.pollInput();
    ui.readMenu=()=>({direction:0,select:true,back:false,start:false});ui.pollInput();
    if(Number(document.activeElement.dataset.value)!==ui.selection.fighter)throw Error('Raw adapter selection did not reach fighter picker');
    ui.readMenu=()=>null;ui.pollInput();
  });
  await page.getByRole('button',{name:'Lock fighter →',exact:true}).click();
  // A fixture engine adapter isolates menu routing from native gameplay.
  await page.evaluate(()=>melee.competitive.setAdapter(()=>({prepare:async()=>{},play:async()=>{},stop:()=>{}}),'test-build'));
  for(const mode of ['Casual','Ranked','Friends'])await page.getByRole('button',{name:mode,exact:true}).click();
  assert.deepEqual(await page.evaluate(()=>queueCalls.map(c=>c.queue)),['casual','ranked','friends']);
  assert.deepEqual(errors,[]);
  await writeFile(`${output}/verification.json`,JSON.stringify({scope:'Real browser DOM; stubbed platform; no gameplay or hosted rating test',passed:true,flows:['fighter lock','ranked 2–1 set','1–2–1 striking','counterpick DSR','ordered character picks','casual stage rotation','mobile touch','keyboard/controller focus','enabled live queues','SDK queue routing and cancellation'],errors},null,2));
  console.log('Melee competitive menu flows passed (platform stub; native gameplay not run).');
}finally{await browser.close();}
