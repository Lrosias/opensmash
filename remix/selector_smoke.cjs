const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');const fs=require('node:fs/promises');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--enable-unsafe-swiftshader','--disable-background-timer-throttling']});
 const page=await browser.newPage({viewport:{width:1100,height:900}});const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 try{
  await page.goto('http://127.0.0.1:4198/');
  await page.waitForFunction(()=>window.remixRoster?.length===94);
  assert.equal(await page.locator('#fighter option').count(),94);
  for(const id of [58,59,73,88]){
   await page.selectOption('#fighter',String(id));
   await page.waitForFunction(fid=>{
    const f=window.remixRoster.find(r=>r.id===fid);
    return window.marthState?.().some(r=>r[0]===1&&r[7]===f.model_file_id+16384&&r[1]===10);
   },id,{timeout:45000});
   assert.equal(await page.locator('iframe').count(),1);
   assert.equal(new URL(page.url()).searchParams.get('fighter'),String(id));
   console.log('Selected and loaded',id);
  }
  await page.locator('#fighter').focus();
  await page.evaluate(()=>document.querySelector('#fighter').addEventListener('keydown',e=>{window.dropdownKeyPrevented=e.defaultPrevented;}));
  await page.keyboard.press('ArrowDown');
  // This installed macOS headless shell does not move even a bare native
  // select with ArrowDown. Verify our gameplay listener does not cancel it.
  assert.equal(await page.evaluate(()=>window.dropdownKeyPrevented),false,'Gameplay input blocked dropdown keys');
  await page.selectOption('#fighter','58');await page.selectOption('#mode','practice');
  assert(new URL(page.url()).searchParams.has('practice'));
  await page.waitForFunction(()=>window.marthState?.().some(r=>r[0]===1&&r[7]===19659&&r[1]===10),{},{timeout:45000});
  const engine=page.frames().find(f=>f.url().includes('/engine/play'));
  assert.equal(await engine.evaluate(()=>Module._port_remix_test_place(300)),0,'Test fixture active in normal play');
  await page.click('#restart');await page.waitForFunction(()=>window.marthState?.().some(r=>r[0]===1&&r[7]===19659),{},{timeout:45000});
  assert.equal(errors.length,0,errors.join('\n'));
  await page.screenshot({path:'build/remix/verification/selector.png'});
  console.log('PASS: 94 options, repeated selections, dropdown key handling, mode changes, restart and test-fixture isolation.');
 }finally{await browser.close();}
})();
