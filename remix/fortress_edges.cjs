const {chromium}=require(process.env.PLAYWRIGHT_MODULE),fs=require('node:fs/promises'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--enable-unsafe-swiftshader']});try{
 const report={};for(const [name,first,second] of [['wolf_reflect',55,32],['wolf_air',55,74],['wolf_shorten',55,74],['wario_shield',33,74],['wario_recovery',33,74],['wario_pound',33,74],['bowser_breath',52,74],['bowser_recovery',52,74],['bowser_pound',52,74]]){
  if(process.env.FILTER&&!name.startsWith(process.env.FILTER))continue;
  const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(String(e)));
  await p.goto(`http://127.0.0.1:4199/remix-check.html?battle=${first},${second},16,0&SSB64_REMIX_TEST=1`);await p.waitForFunction(()=>window.driver,{},{timeout:60000});
  const r=await p.evaluate(name=>{let rows=[],entities=[];const tick=(n,a=[0,0,0],b=[0,0,0])=>{pads=[a,b];for(let i=0;i<n;i++){driver.step();rows.push(probe());const w=game.contentWindow,q=w.Module._port_remix_entity_probe()>>2,v=Array.from(w.HEAP32.slice(q,q+322));entities.push(Array.from({length:v[0]+v[1]},(_,j)=>v.slice(2+j*10,12+j*10)))}};
   for(let n=0;(window.state?.[4]||0)<30&&n<900;n++)tick(1);if(!game.contentWindow.Module._port_remix_test_place(name==='wolf_reflect'?650:name==='bowser_breath'?800:260))throw Error('place');tick(2);rows=[];entities=[];
   if(name==='wolf_reflect'){tick(1,[16384,0,-70]);tick(35,[16384,0,-70]);tick(1,[16384,0,-70],[16384,0,0]);tick(130,[16384,0,-70]);tick(120);}
   if(name==='wolf_air'){tick(1,[8,0,0]);tick(20);tick(1,[16384,0,70]);tick(20,[0,0,70]);tick(180);}
   if(name==='wolf_shorten'){tick(1,[16384,0,70]);tick(20);tick(1,[16384,0,70]);tick(200);}
   if(name==='wario_shield'){tick(1,[16384,0,0],[8192,0,0]);tick(80,[0,0,0],[8192,0,0]);tick(180);}
   if(name==='wario_recovery'){tick(1,[8,0,0]);tick(20);tick(1,[16384,0,70]);tick(280);}
   if(name==='wario_pound'||name==='bowser_pound'){tick(1,[8,0,0]);tick(20);tick(1,[16384,0,-70]);tick(280);}
   if(name==='bowser_breath'){tick(1,[16384,0,0]);tick(260,[16384,0,0]);tick(400);tick(1,[16384,0,0]);tick(90);tick(120);}
   if(name==='bowser_recovery'){tick(1,[8,0,0]);tick(20);tick(1,[16384,0,70]);tick(280);}
   return {rows,entities};},name);
  await fs.writeFile(`build/remix/main/checks/${name}.json`,JSON.stringify(r));const s=report[name]={statuses:[...new Set(r.rows.map(x=>x[1]))],damage:r.rows.at(-1)[2],foeDamage:r.rows.at(-1)[18],maxY:Math.max(...r.rows.map(x=>x[4])),last:r.rows.at(-1)[1],entities:[...new Set(r.entities.flat().map(x=>x.slice(0,3).join(':')))],errors};console.log(name,s);assert.deepEqual(errors,[]);
  if(name==='wolf_reflect'){assert.equal(s.damage,0);assert(s.foeDamage>0);assert(s.statuses.includes(239));}
  if(name==='wolf_air')assert(s.statuses.includes(227)&&s.statuses.includes(232));
  if(name==='wario_shield')assert(s.statuses.includes(230)&&s.statuses.includes(229));
  if(name==='wario_recovery'){assert(s.maxY>1700);assert.equal(s.last,10);}
  if(name==='wario_pound')assert(s.statuses.includes(228)&&s.statuses.includes(226)&&s.last===10);
  if(name==='bowser_breath'){assert(s.entities.length>0);assert(s.foeDamage>0);assert.equal(s.last,10);assert(r.entities.slice(660).flat().length>0,'Flames did not recharge');}
  if(name==='bowser_recovery'){assert(s.maxY>1500);assert.equal(s.last,10);}
  if(name==='bowser_pound')assert(s.statuses.includes(226)&&s.statuses.includes(225)&&s.last===10);
  await p.close();
 }
 await fs.writeFile('build/remix/main/checks/fortress-edges.json',JSON.stringify(report,null,2));
}finally{await browser.close()}})();
