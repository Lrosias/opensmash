const {chromium}=require(process.env.PLAYWRIGHT_MODULE),fs=require('node:fs/promises'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--enable-unsafe-swiftshader']});try{const report={};for(const name of ['charge_ground','charge_air','boost_ground','boost_air']){
 const p=await browser.newPage();p.on('pageerror',e=>console.error(name,String(e)));await p.goto('http://127.0.0.1:4199/remix-check.html?battle=34,74,16,0&SSB64_REMIX_TEST=1');await p.waitForFunction(()=>window.driver,{},{timeout:60000});
 const result=await p.evaluate(name=>{let rows=[],entities=[];const tick=(n,a=[0,0,0])=>{pads=[a,[0,0,0]];for(let i=0;i<n;i++){driver.step();rows.push(probe());const w=game.contentWindow,q=w.Module._port_remix_entity_probe()>>2,b=Array.from(w.HEAP32.slice(q,q+322));entities.push(Array.from({length:b[0]+b[1]},(_,j)=>b.slice(2+j*10,12+j*10)))}};
 for(let i=0;(window.state?.[4]||0)<30&&i<900;i++)tick(1);if(!game.contentWindow.Module._port_remix_test_place(650))throw Error('place');tick(2);rows=[];entities=[];
 if(name==='charge_ground'){tick(1,[16384,0,0]);tick(190);tick(1,[16384,0,0]);tick(150);}
 if(name==='charge_air'){tick(1,[8,0,0]);tick(20);tick(1,[16384,0,0]);tick(45);tick(1,[16384,0,0]);tick(200);}
 if(name==='boost_ground'){tick(1,[16384,0,-70]);tick(60,[0,70,0]);tick(200);}
 if(name==='boost_air'){tick(1,[8,0,0]);tick(20);tick(1,[16384,0,-70]);tick(180);}
 return {rows,entities};},name);await fs.writeFile(`build/remix/main/checks/ds-${name}.json`,JSON.stringify(result));report[name]={statuses:[...new Set(result.rows.map(x=>x[1]))],maxY:Math.max(...result.rows.map(x=>x[4])),damage:result.rows.at(-1)[18],shots:result.entities.flat().filter(x=>x[1]===2).map(x=>({origin:x[2],damage:x[7]})),last:result.rows.at(-1)};console.log(name,{...report[name],shots:[...new Set(report[name].shots.map(x=>JSON.stringify(x)))]});await p.close();}
 await fs.writeFile('build/remix/main/checks/darksamus-edges.json',JSON.stringify(report,null,2));
 assert(report.charge_ground.shots.some(x=>x.origin===34&&x.damage===24),'Full Dark Charge Shot did not use 24 damage');assert(report.charge_ground.damage>0,'Full charge never hit');
 assert(report.charge_air.statuses.includes(231),'Aerial charge missing');assert(report.charge_air.statuses.includes(226),'Aerial charge did not fire');
 assert(report.boost_air.statuses.includes(232)&&report.boost_air.statuses.includes(233),'Aerial Boost Ball did not land');assert(report.boost_ground.damage>0,'Boost Ball never hit');assert.equal(report.boost_ground.last[1],10,'Ground Boost Ball did not end');
}finally{await browser.close()}})();
