// Copy acquisition must replay exactly, including hat files loaded on demand,
// attached charge weapons, sound voices, and the first stock after losing a hat.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE),fs=require('node:fs/promises'),assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--enable-unsafe-swiftshader']});
try{const table=JSON.parse(await fs.readFile('build/remix/main/assets/kirby-extraction.json')),report=[];
for(const id of (process.env.FIGHTERS||'34,57,58,62,64,68').split(',').map(Number)){
 const p=await b.newPage(),errors=[];p.on('pageerror',e=>errors.push(String(e)));
 await p.goto(`http://127.0.0.1:4199/remix-check.html?battle=8,${id},16,0&SSB64_REMIX_TEST=1`);await p.waitForFunction(()=>window.driver,{},{timeout:60000});
 const r=await p.evaluate(async ({id,hat})=>{
  const m=game.contentWindow.Module,{NativeCheckpoints}=await import('/checkpoints.mjs');
  const tick=(n,pad=[0,0,0])=>{pads=[pad,[0,0,0]];for(let k=0;k<n;k++)driver.step()};
  const read=(name,len)=>{const ptr=m[name]()>>2;return Array.from(game.contentWindow.HEAP32.slice(ptr,ptr+len))};
  const copy=()=>read('_port_remix_copy_probe',32),entities=()=>read('_port_remix_entity_probe',322);
  const observe=()=>({state:[...state],fighter:probe(),copy:copy(),entities:entities(),sound:read('_port_remix_sound_probe',3)});
  const check=(yes,message)=>{if(!yes)throw Error(`${id}: ${message}; ${JSON.stringify(observe())}`)};
  for(let n=0;(window.state?.[4]||0)<30&&n<900;n++)tick(1);
  m._port_remix_test_place(220);tick(2);tick(80,[16384,0,0]);tick(2);
  const store=new NativeCheckpoints(driver,{window:240}),snap=store.save(0,state),expected=[];
  const input=n=>n===0?[0,0,-70]:n===125?[16384,0,0]:n===160?[16384,0,0]:[0,0,0];
  for(let n=0;n<210;n++){tick(1,input(n));expected.push(observe());}
  check(copy()[1]===id,'copy ID');check(copy()[2]===hat,'hat ID');
  state=store.load(snap);
  for(let n=0;n<210;n++){tick(1,input(n));check(JSON.stringify(observe())===JSON.stringify(expected[n]),`copy acquisition rollback frame ${n}`);}
  const acquisition=copy(),checks=[];
  tick(300); // Let the replayed attack finish before repositioning fighters.
  if(id===34||id===57){
   m._port_remix_test_place(1800);tick(2);tick(1,[16384,0,0]);tick(70);
   check(copy()[6]>0&&entities()[0]>0,'charge creates attached shot');
   const level=copy()[6];tick(1,[8192,0,0]);tick(3);check(copy()[6]===level,'cancel keeps charge');check(entities()[0]===0,'cancel releases attached object');
   tick(1,[16384,0,0]);tick(180);check(copy()[6]===7,'full charge');check(probe()[1]===10,'full charge returns to wait');check(entities()[0]===0,'full charge detaches object');
   tick(1,[16384,0,0]);tick(45);check(copy()[6]===0,'shot spends charge');checks.push('charge, cancel, full-charge release');
  }
  m._port_remix_test_position(0,4900,100);tick(300);
  check(copy()[1]===8,'stock clears power');check(copy()[2]===0,'stock clears hat');
  check(copy()[6]===0,'stock clears charge');
  m._port_remix_test_place(2000);tick(2);tick(1,[16384,0,70]);tick(120);check(probe()[1]===10,'native up B returns to wait');
  tick(1,[16384,0,-70]);tick(50);tick(1,[16384,0,0]);tick(90);check(probe()[1]===10,'native stone exits');
  return {id,hat,acquisition,rollbackFrames:210,checks,stockReset:true,nativeSpecials:true};
 },{id,hat:table.copies[id][1]});
 assert.deepEqual(errors,[]);report.push(r);console.log(r);await fs.writeFile('build/remix/main/checks/kirby-lifecycle.json',JSON.stringify(report,null,2));await p.close();
}
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
