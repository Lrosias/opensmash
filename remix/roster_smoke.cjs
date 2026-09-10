/* Offline, real-engine coverage for every selectable imported fighter. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs/promises');const path=require('node:path');
(async()=>{
 const out=path.resolve('build/remix/verification');await fs.mkdir(out,{recursive:true});
 let roster=JSON.parse(await fs.readFile('build/remix/assets/roster.json','utf8'));
 if(process.env.FIGHTERS){const ids=process.env.FIGHTERS.split(',').map(Number);roster=ids.map(id=>roster.find(f=>f.id===id));}
 console.log("Launching browser");
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--enable-unsafe-swiftshader','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']});
 console.log("Browser launched");
 const results=[];let index=0;
 async function worker(){while(index<roster.length){
  const f=roster[index++];console.log("Testing",f.id,f.name);const logs=[];let result={id:f.id,name:f.name};
  const page=await browser.newPage({viewport:{width:960,height:780}});
  page.on('console',m=>{logs.push(m.text())});page.on('pageerror',e=>logs.push('PAGEERROR '+e.stack));
  await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  const key=async(k,ms=80)=>{await page.keyboard.down(k);await page.waitForTimeout(ms);await page.keyboard.up(k)};
  try{
   console.log("Loading",f.id);
   await page.goto(`http://127.0.0.1:4198/?fighter=${f.id}&practice=1&test=1`);
   await page.waitForFunction(()=>window.marthState?.().length===2&&window.marthState().every(r=>r[1]===10),{},{timeout:45000});
   await page.waitForTimeout(2500); // Wait for the match countdown to unlock controls.
   console.log("Ready",f.id);
   const start=await page.evaluate(()=>window.marthState());
   await key('ArrowRight',250);await page.waitForTimeout(200);await key('KeyM');await page.waitForTimeout(500);
   await key('KeyP');await page.waitForTimeout(150);await key('KeyM');await page.waitForTimeout(1000);
   await page.keyboard.down('ArrowDown');await key('KeyM');await page.keyboard.up('ArrowDown');await page.waitForTimeout(450);
   const engine=page.frames().find(x=>x.url().includes('/engine/play'));
   for(const gap of [300,200,450,150]){
    if(await page.evaluate(()=>window.marthState().some(r=>r[0]===8&&r[2]>0)))break;
    const placed=await engine.evaluate(g=>Module._port_remix_test_place(g),gap);
    if(!placed)throw Error('Combat fixture unavailable');
    await page.waitForTimeout(50);
    await key('KeyM');await page.waitForTimeout(500);await key('KeyM');await page.waitForTimeout(500);
    if(f.id===60)break; // The ROM intentionally gives Sandbag no attacks.
   }
   const samples=await page.evaluate(()=>window.marthSamples);const rows=samples.flat().filter(r=>r[0]===1);const other=samples.flat().filter(r=>r[0]===8);
   result={...result,model:rows.every(r=>r[7]===f.model_file_id+16384),main:rows.every(r=>r[6]===f.main_file_id+16384),
    movement:new Set(rows.map(r=>r[3])).size>10,animation:new Set(rows.map(r=>r[5])).size>10,
    hitboxes:rows.some(r=>r.slice(8,12).some(x=>x>0)),visible:rows.some(r=>!r[12]&&!r[13]&&!r[14]),
    damage:Math.max(...other.map(r=>r[2])),frames:samples.length,statuses:[...new Set(rows.map(r=>r[1]))]};
   result.nonCombat=f.id===60;
   result.pass=result.model&&result.main&&result.movement&&result.animation&&result.visible&&(result.nonCombat?(!result.hitboxes&&result.damage===0):(result.hitboxes&&result.damage>0))&&!logs.some(x=>/PAGEERROR|Aborted|RuntimeError/.test(x));
   await page.screenshot({path:path.join(out,`${f.id}.png`)});
   await fs.writeFile(path.join(out,`${f.id}.json`),JSON.stringify({result,start,samples},null,2));
  }catch(e){result.pass=false;result.error=e.stack;const ef=page.frames().find(x=>x.url().includes('/engine/play'));if(ef){await ef.evaluate(()=>typeof FS!=='undefined'?FS.readFile('/libsdl/BattleShip/ssb64.log',{encoding:'utf8'}):'No FS').then(x=>fs.writeFile(path.join(out,`${f.id}-native.log`),x)).catch(()=>{});}
await page.screenshot({path:path.join(out,`${f.id}.png`)}).catch(()=>{});}
  await fs.writeFile(path.join(out,`${f.id}.log`),logs.join('\n'));
  await page.close();results.push(result);await fs.writeFile(path.join(out,'results.json'),JSON.stringify(results,null,2));
  console.log(JSON.stringify(result));
 }}
 try{await Promise.all(Array.from({length:Number(process.env.WORKERS||2)},worker));}finally{await browser.close();}
 console.log(`RESULT: ${results.filter(r=>r.pass).length}/${results.length} passed`);
 if(results.some(r=>!r.pass))process.exitCode=1;
})();
