const {chromium}=require(process.env.PLAYWRIGHT_MODULE),fs=require('node:fs/promises'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--enable-unsafe-swiftshader']});try{const report={};for(const name of ['parasol','turnip','float']){
 const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(String(e)));await p.goto('http://127.0.0.1:4199/remix-check.html?battle=73,74,16,0&SSB64_REMIX_TEST=1');await p.waitForFunction(()=>window.driver,{},{timeout:60000});
 const r=await p.evaluate(name=>{let rows=[],items=[];const tick=(n,a=[0,0,0])=>{pads=[a,[0,0,0]];for(let j=0;j<n;j++){driver.step();rows.push(probe());let w=game.contentWindow,q=w.Module._port_remix_entity_probe()>>2,v=Array.from(w.HEAP32.slice(q,q+322));items.push(Array.from({length:v[0]+v[1]},(_,i)=>v.slice(2+i*10,12+i*10)))}};
 for(let n=0;(window.state?.[4]||0)<30&&n<900;n++)tick(1);if(!game.contentWindow.Module._port_remix_test_place(500))throw Error('place');tick(2);rows=[];items=[];
 if(name==='parasol'){tick(1,[8,0,0]);tick(20);tick(1,[16384,0,70]);tick(75);tick(12,[0,0,-70]);tick(1,[0,0,70]);tick(90);tick(300);}
 if(name==='turnip'){tick(1,[16384,0,-70]);tick(65);tick(1,[16384,0,-70]);tick(250);}
 if(name==='float'){tick(1,[8,0,0]);tick(35);tick(1,[8,0,-70]);tick(30,[8,0,0]);tick(1,[32776,0,0]);tick(55,[8,0,0]);tick(100);}
 return {rows,items};},name);await fs.writeFile(`build/remix/main/checks/peach-${name}.json`,JSON.stringify(r));report[name]={statuses:[...new Set(r.rows.map(x=>x[1]))],last:r.rows.at(-1)[1],damage:r.rows.at(-1)[18],items:Math.max(...r.items.map(x=>x.length)),errors};console.log(name,report[name]);assert.deepEqual(errors,[]);await p.close();}
 await fs.writeFile('build/remix/main/checks/peach-edges.json',JSON.stringify(report,null,2));assert(report.parasol.statuses.includes(230)&&report.parasol.statuses.includes(231)&&report.parasol.statuses.includes(232));assert(report.turnip.items>0&&report.turnip.damage>0);assert(report.float.statuses.includes(222)&&report.float.statuses.includes(209));
}finally{await browser.close()}})();
