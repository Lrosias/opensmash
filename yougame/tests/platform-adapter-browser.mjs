// Run against YouGame's tools/controllers/browser-lab.mjs with candidate games
// containing these controllers/*.mjs. The lab simulates USB, not host/SDK/Wasm.
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const out=process.env.GC_PLATFORM_RESULTS||'/tmp/opensmash-platform-review-results';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const results=[];
try {
  const page=await browser.newPage({viewport:{width:1280,height:1100}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.YG_CONTROLLER_LAB||'http://127.0.0.1:4312');
  for(const edition of ['opensmash64','opensmash64-remix','opensmash-melee']){
    await page.selectOption('#edition',edition);
    await page.waitForFunction(e=>document.querySelector('iframe')?.src.includes('/'+e+'/'),edition);
    const game=await (await page.locator('iframe').elementHandle()).contentFrame();
    await game.waitForFunction(()=>window.YouGame?.controllers?.capabilities().connected);
    await game.getByRole('button',{name:'GameCube adapter controls',exact:true}).click();
    await game.getByRole('button',{name:'Connect adapter',exact:true}).click();
    await page.getByText('Game requested host Controls.',{exact:false}).waitFor();
    await page.click('#connect');
    await game.waitForFunction(()=>YouGame.controllers.snapshot({diagnostic:true}).owned);
    if(edition==='opensmash-melee'){
      await game.locator('#play').click();await game.waitForFunction(()=>window.melee?.phase==='running',{},{timeout:180000});
    }else await game.waitForFunction(()=>window.lastNativePorts,{},{timeout:90000});
    await page.click('#press');
    await game.waitForFunction(()=>{const p=YouGame.controllers.snapshot().ports[0];return p?.buttons===1&&p.axes[0]===208;});
    const menu=await game.evaluate(async()=>{
      const {readAdapterMenu}=await import('./controllers/controller-menu.mjs');
      return {active:readAdapterMenu({snapshot:()=>YouGame.controllers.snapshot()}),hole:readAdapterMenu({snapshot:()=>YouGame.controllers.snapshot()},1)};
    });
    assert.deepEqual(menu.active,{direction:1,select:true,back:false,start:false});assert.equal(menu.hole.select,false);
    if(edition==='opensmash-melee')await game.waitForFunction(()=>window.lastNativePads?.[0]?.[0]===1&&window.lastNativePads[0][5]===80/255);
    else await game.waitForFunction(()=>window.lastNativePorts?.[1]===40960&&window.lastNativePorts[2]===80);
    const native=await game.evaluate(()=>window.lastNativePads||window.lastNativePorts);
    await page.click('#pause');
    await game.waitForFunction(()=>YouGame.controllers.snapshot().suspended);
    const paused=await game.evaluate(async()=>{const {readAdapterMenu}=await import('./controllers/controller-menu.mjs');return readAdapterMenu({snapshot:()=>YouGame.controllers.snapshot()});});
    assert.equal(paused.select,false);await page.click('#resume');await page.click('#release');
    await game.getByRole('button',{name:'GameCube adapter controls',exact:true}).click();
    await game.getByRole('button',{name:'Calibrate port 1',exact:true}).click();
    await game.getByText('Port 1 calibrated.',{exact:true}).waitFor();
    assert.equal(await game.getByText('YouGame must allow USB access',{exact:false}).count(),0);
    await game.getByRole('button',{name:'Use regular controls',exact:true}).click();
    await game.waitForFunction(()=>!YouGame.controllers.snapshot({diagnostic:true}).owned);
    await game.getByRole('button',{name:'Done',exact:true}).click();
    results.push({edition,menu,native,calibration:true,release:true,hardware:'simulated',errors:[...errors]});
    await writeFile(out+'/results.json',JSON.stringify(results,null,2));console.log(edition+' passed');
  }
  assert.deepEqual(errors,[]);
}finally{await browser.close();}
