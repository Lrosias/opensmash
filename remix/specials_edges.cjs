const {chromium}=require(process.env.PLAYWRIGHT_MODULE),fs=require('node:fs/promises'),assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--enable-unsafe-swiftshader']});try{const results={};for(const [name,first,second] of [['roy_charge',74,58],['falco_reflect',29,32],['marth_air',58,74],['doctor_tornado',32,75]]){
 const p=await b.newPage();await p.goto(`http://127.0.0.1:4199/remix-check.html?battle=${first},${second},16,0&SSB64_REMIX_TEST=1`);await p.waitForFunction(()=>window.driver,{},{timeout:60000});const rows=await p.evaluate(name=>{let r=[];const tick=(n,a=[0,0,0],b=[0,0,0])=>{pads=[a,b];for(let i=0;i<n;i++){driver.step();r.push(probe())}};for(let i=0;(window.state?.[4]||0)<30&&i<900;i++)tick(1);game.contentWindow.Module._port_remix_test_place(name==='falco_reflect'?650:260);tick(2);r=[];
 if(name==='roy_charge'){tick(240,[16384,0,-70]);tick(120);}
 if(name==='falco_reflect'){tick(1,[16384,0,-70]);tick(1,[16384,0,-70],[16384,0,0]);tick(100,[16384,0,-70]);tick(90);}
 if(name==='marth_air'){tick(1,[8,0,0]);tick(20);tick(1,[16384,0,0]);tick(5);for(let i=0;i<65;i++)tick(1,[i%5===4?16384:0,0,0]);tick(140);}
 if(name==='doctor_tornado'){tick(1,[16384,0,-70]);for(let i=0;i<250;i++)tick(1,[i<55&&i%5===4?16384:0,0,-70]);tick(90);}
 return r;},name);results[name]={statuses:[...new Set(rows.map(x=>x[1]))],damage:[rows[0][2],rows.at(-1)[2]],foeDamage:[rows[0][18],rows.at(-1)[18]],maxY:Math.max(...rows.map(x=>x[4])),last:rows.at(-1)};await fs.writeFile(`build/remix/main/checks/${name}.json`,JSON.stringify(rows));console.log(name,results[name]);await p.close();}
 await fs.writeFile('build/remix/main/checks/specials-edges.json',JSON.stringify(results,null,2));
 assert(results.roy_charge.statuses.includes(242),'Roy never released full charge');assert.equal(results.roy_charge.damage[1]-results.roy_charge.damage[0],10,'Roy full-charge recoil');
 assert(results.falco_reflect.foeDamage[1]>0,'Capsule was not reflected back');assert.equal(results.falco_reflect.damage[1],0,'Falco was hurt by a reflected capsule');
 assert(results.marth_air.statuses.includes(231),'Marth aerial neutral not entered');assert.equal(results.doctor_tornado.last[1],10,'Tornado did not end');
 }finally{await b.close()}})();
