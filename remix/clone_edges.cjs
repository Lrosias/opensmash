const {chromium}=require(process.env.PLAYWRIGHT_MODULE),fs=require('node:fs/promises'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--enable-unsafe-swiftshader']});try{
const report={};for(const [name,first,second] of [['ganon_kick',30,74],['young_bombchu',31,74],['young_recovery',31,74],['lucas_magnet',38,32],['lucas_thunder',38,74]]){
 const page=await browser.newPage();page.on('pageerror',e=>console.error(name,String(e)));
 await page.goto(`http://127.0.0.1:4199/remix-check.html?battle=${first},${second},16,0&SSB64_REMIX_TEST=1`);await page.waitForFunction(()=>window.driver,{},{timeout:60000});
 const result=await page.evaluate(name=>{let rows=[],entities=[];const capture=()=>{const w=game.contentWindow,p=w.Module._port_remix_entity_probe()>>2,a=Array.from(w.HEAP32.slice(p,p+322));return Array.from({length:a[0]+a[1]},(_,i)=>a.slice(2+10*i,12+10*i))};const tick=(n,a=[0,0,0],b=[0,0,0])=>{pads=[a,b];for(let i=0;i<n;i++){driver.step();rows.push(probe());entities.push(capture())}};
 for(let i=0;(window.state?.[4]||0)<30&&i<900;i++)tick(1);if((state?.[4]||0)<30)throw Error('No match');if(!game.contentWindow.Module._port_remix_test_place(name==='lucas_magnet'?650:name==='young_bombchu'?800:260))throw Error('Placement failed');tick(2);rows=[];entities=[];
 if(name==='ganon_kick'){tick(1,[16384,0,-70]);tick(200);}
 if(name==='young_bombchu'){tick(1,[16384,0,-70]);tick(50);tick(1,[32768,0,-70]);tick(320);}
 if(name==='young_recovery'){tick(1,[8,0,0]);tick(20);tick(1,[16384,0,70]);tick(200);}
 if(name==='lucas_magnet'){tick(1,[16384,0,-70]);tick(35,[16384,0,-70]);tick(1,[16384,0,-70],[16384,0,0]);tick(110,[16384,0,-70]);tick(120);}
 if(name==='lucas_thunder'){tick(1,[16384,0,70]);tick(200);tick(100);}
 return {rows,entities};},name);
 await fs.writeFile(`build/remix/main/checks/${name}.json`,JSON.stringify(result));const {rows,entities}=result;report[name]={statuses:[...new Set(rows.map(x=>x[1]))],damage:[rows[0][2],rows.at(-1)[2]],foeDamage:[rows[0][18],rows.at(-1)[18]],maxY:Math.max(...rows.map(x=>x[4])),entityKinds:[...new Set(entities.flat().map(x=>x.slice(0,3).join(':')))],bombStates:[...new Set(entities.flat().filter(x=>x[2]===31&&x[0]===1).map(x=>x[8]))],last:rows.at(-1)};console.log(name,report[name]);await page.screenshot({path:`build/remix/main/checks/${name}.png`});await page.close();}
 await fs.writeFile('build/remix/main/checks/clone-edges.json',JSON.stringify(report,null,2));
 assert(report.ganon_kick.foeDamage[1]>0,'Ganon kick never landed');assert.equal(report.ganon_kick.last[1],10,'Ganon kick never ended');
 assert(report.young_bombchu.bombStates.includes(1),'Bombchu never held');assert(report.young_bombchu.bombStates.includes(2),'Bombchu never ran');assert(report.young_bombchu.bombStates.includes(3),'Bombchu never exploded');
 assert(report.young_recovery.statuses.includes(228),'Young Link aerial Spin Attack missing');assert(report.young_recovery.maxY>1000,'Young Link recovery gained no height');
 assert(report.lucas_magnet.statuses.includes(239),'Lucas never absorbed capsule');assert.equal(report.lucas_magnet.damage[1],0,'Magnet failed to protect Lucas');
 assert(report.lucas_thunder.entityKinds.some(x=>x==='0:14:38'),'Lucas thunder never spawned');
}finally{await browser.close()}})();
