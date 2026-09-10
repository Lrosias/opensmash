/* Exercise the real Wasm engine using only local extracted ROM assets. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
(async()=>{
 const out=path.resolve('build/marth/verification');await fs.mkdir(out,{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--enable-unsafe-swiftshader','--disable-background-timer-throttling']});
 const page=await browser.newPage({viewport:{width:1100,height:900}});
 const logs=[];page.on('console',m=>logs.push(m.text()));page.on('pageerror',e=>logs.push('PAGEERROR '+e.stack));
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 const key=async(k,ms=75)=>{await page.keyboard.down(k);await page.waitForTimeout(ms);await page.keyboard.up(k);};
 try{
  await page.goto(process.env.MARTH_URL||'http://127.0.0.1:4197/?practice=1');
  await page.waitForFunction(()=>window.marthState?.().some(r=>r[0]===1&&r[6]===19658),{},{timeout:30000});
  await page.waitForTimeout(9000);
  const idle=await page.evaluate(()=>window.marthState());
  await page.screenshot({path:path.join(out,'marth-idle.png')});
  // Input reaches the same keyboard and controller bridge used by OpenSmash.
  await key('ArrowLeft',250);await page.waitForTimeout(500);
  await key('KeyM',80);await page.waitForTimeout(140);
  await page.screenshot({path:path.join(out,'marth-attack.png')});
  await page.waitForTimeout(700);await key('KeyP',80);await page.waitForTimeout(250);
  await key('KeyM',80);await page.waitForTimeout(900);
  for(let i=0;i<6;i++){await key('KeyM',70);await page.waitForTimeout(400);}
  // Close distance on the stationary practice opponent and confirm that
  // the extracted sword hitboxes actually inflict damage, not just display.
  for(let i=0;i<35;i++){
   const state=await page.evaluate(()=>window.marthState());
   const marth=state.find(r=>r[0]===1),other=state.find(r=>r[0]===8);
   if(other[2]>0)break;
   const dx=other[3]-marth[3];
   if(Math.abs(dx)>330)await key(dx<0?'ArrowLeft':'ArrowRight',80);
   else {if(Math.sign(dx)!==marth[15])await key(dx<0?'ArrowLeft':'ArrowRight',25);await key('KeyM',80);await page.waitForTimeout(250);}
  }
  const samples=await page.evaluate(()=>window.marthSamples);
  const rows=samples.flat().filter(r=>r[0]===1);
  const checks={originalModel:rows.every(r=>r[7]===19659),
   movement:new Set(rows.map(r=>r[3])).size>10,
   animation:new Set(rows.map(r=>r[5])).size>10,
   activeHitboxes:rows.some(r=>r.slice(8,12).some(x=>x>0)),
   visible:rows.some(r=>r[12]===0&&r[13]===0&&r[14]===0),
   normalAttack:rows.some(r=>r[1]>=190&&r[1]<=213),
   sampleCount:samples.length,
   statuses:[...new Set(rows.map(r=>r[1]))],
   maxOpponentDamage:Math.max(...samples.flat().filter(r=>r[0]===8).map(r=>r[2])),
   maxMarthDamage:Math.max(...rows.map(r=>r[2]))};
  const engine=page.frames().find(f=>f.url().includes('/engine/play.html'));
  const nativeLog=await engine.evaluate(()=>FS.readFile('/libsdl/BattleShip/ssb64.log',{encoding:'utf8'}));
  await fs.writeFile(path.join(out,'native.log'),nativeLog);
  await fs.writeFile(path.join(out,'state.json'),JSON.stringify({idle,checks,samples},null,2));
  await page.screenshot({path:path.join(out,'marth.png')});
  console.log(JSON.stringify(checks,null,2));
  assert(checks.originalModel,'Marth model is not loaded');
  assert(checks.movement,'No movement observed');
  assert(checks.animation,'No animation observed');
  assert(checks.activeHitboxes,'Normal attack hitboxes did not activate');
  assert(checks.visible,'Marth never became visible and active after his entrance');
  assert(checks.maxOpponentDamage>0,'Sword attacks did not damage the practice opponent');
  assert(!logs.some(l=>l.startsWith('PAGEERROR')||/Aborted|RuntimeError/.test(l)),'Runtime errors');
 }finally{
  await fs.writeFile(path.join(out,'browser.log'),logs.join('\n'));
  await browser.close();
 }
})();
