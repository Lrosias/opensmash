const {chromium}=require(process.env.PLAYWRIGHT_MODULE);
const fs=require('node:fs/promises'),assert=require('node:assert/strict');
const out=process.env.POLISH_EVIDENCE||'/tmp/opensmash-polish-evidence';
(async()=>{
 await fs.mkdir(out,{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 try{
  const p=await browser.newPage({viewport:{width:960,height:720}}),errors=[];p.on('pageerror',e=>errors.push(String(e)));
  let release;const gate=new Promise(resolve=>release=resolve);
  await p.route('**/BattleShip.js',async r=>{await gate;await r.continue();});
  await p.goto((process.env.POLISH_URL||'http://127.0.0.1:4199')+'/remix-check.html?battle=68,7,14,0');
  const frame=p.frames().find(f=>f.url().includes('/engine/'));
  await frame.waitForSelector('#loading-caption');
  assert.equal(await frame.locator('#loading-caption').textContent(),'Loading…');
  assert.equal(await frame.locator('.loading-fighter').count(),0);
  await p.screenshot({path:`${out}/loading-desktop.png`});
  await p.setViewportSize({width:568,height:320});
  await p.evaluate(()=>{game.style.width='100vw';game.style.height='100vh';});
  await p.emulateMedia({reducedMotion:'reduce'});
  await p.screenshot({path:`${out}/loading-mobile.png`});
  const layout=await frame.evaluate(()=>({width:innerWidth,overflow:document.body.scrollWidth>innerWidth,background:getComputedStyle(document.querySelector('#status')).backgroundColor}));
  assert.equal(layout.overflow,false);assert.equal(layout.background,'rgb(0, 0, 0)');
  release();await p.waitForFunction(()=>window.driver,null,{timeout:60000});
  await frame.waitForSelector('#status',{state:'hidden'});
  // Capture the real ROM entrance before gameplay begins.
  await p.setViewportSize({width:960,height:720});
  const entry=await p.evaluate(()=>{
   for(let n=0;n<500;n++){driver.step();const rows=probe();if(rows[1]===284&&rows[5]>25)return rows;}
   throw Error('Entrance was not reached');
  });
  await p.screenshot({path:`${out}/entry-banjo.png`});assert.deepEqual(errors,[]);
  await fs.writeFile(`${out}/loading.json`,JSON.stringify({layout,entry,errors},null,2));
  console.log({layout,errors});
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
