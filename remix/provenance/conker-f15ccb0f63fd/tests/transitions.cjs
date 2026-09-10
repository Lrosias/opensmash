const {chromium}=require(process.env.PLAYWRIGHT_MODULE),fs=require('node:fs/promises'),assert=require('node:assert/strict');
(async()=>{let browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--enable-unsafe-swiftshader','--mute-audio']});try{let results=[];
for(const seat of [0,1])for(const mode of ['falling','aircharge','grenade-fail','grenade-air-fail']){
 const page=await browser.newPage();let errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(`http://127.0.0.1:4207/remix-check.html?battle=${seat?'58,56':'56,58'},13,0&SSB64_REMIX_TEST=1&SSB64_YOUGAME_MUTE=1&SSB64_YOUGAME_SEED=2243759118`);await page.waitForFunction(()=>window.driver,{},{timeout:60000});
 const r=await Promise.race([page.evaluate(async({seat,mode})=>{
  const {NativeCheckpoints}=await import('/checkpoints.mjs'),w=game.contentWindow,m=w.Module;
  const tick=(pad=[0,0,0])=>{pads=[[0,0,0],[0,0,0]];pads[seat]=pad;driver.step();};for(let n=0;(window.state?.[4]||0)<30&&n<900;n++)tick();
  if(mode!=='walkoff'&&mode!=='falling'){m._port_remix_test_place(1800);tick();if(mode==='air'||mode==='landing'||mode==='grenade-air'||mode==='aircharge')m._port_remix_test_position(seat,seat?900:-900,mode==='landing'?300:mode==='aircharge'?4800:1800);tick();}
  const observe=()=>{let e=m._port_remix_entity_probe()>>2,s=m._port_remix_sound_probe()>>2;return{state:[...state],fighters:probe(),entities:Array.from(w.HEAP32.slice(e,e+322)),sounds:Array.from(w.HEAP32.slice(s,s+3))};};
  const input=n=>mode==='falling'?(n<22?[0,seat?80:-80,0]:n<55?[16384,0,0]:[0,0,0]):mode==='walkoff'?(n<36?[0,seat?80:-80,0]:n===37?[16384,0,0]:[0,0,0]):[(mode.endsWith('-fail')&&n===55)||n<(mode==='charge'||mode==='landing'||mode==='aircharge'?80:mode==='air'?12:mode.startsWith('grenade')?12:1)?16384:0,0,mode.startsWith('grenade')?-70:0];
  const store=new NativeCheckpoints(driver,{window:240}),snap=store.save(0,state),rows=[];for(let n=0;n<220;n++){if(n===54&&mode==='grenade-air-fail')m._port_remix_test_position(seat,seat?900:-900,1800);tick(input(n));rows.push(observe());}
  state=store.load(snap);for(let n=0;n<220;n++){if(n===54&&mode==='grenade-air-fail')m._port_remix_test_position(seat,seat?900:-900,1800);tick(input(n));if(JSON.stringify(observe())!==JSON.stringify(rows[n]))throw Error('rollback divergence '+mode+' '+seat+' '+n);}
  return{seat,mode,statuses:[...new Set(rows.map(x=>x.fighters[seat*16+1]))],maxWeapons:Math.max(...rows.map(x=>x.entities[0])),maxItems:Math.max(...rows.map(x=>x.entities[1])),rollbackFrames:220,final:rows.at(-1).fighters};
 },{seat,mode}),new Promise((_,rej)=>setTimeout(()=>rej(Error('timeout '+seat+mode)),30000))]);
 console.log("CHECK",JSON.stringify(r));assert.deepEqual(errors,[]);if(['tap','charge','air','landing','aircharge'].includes(mode))assert(r.maxWeapons>0,`${mode} emitted no projectile`);if(mode.startsWith('grenade'))assert(r.maxItems>0,`${mode} emitted no grenade`);if(mode==='falling'){assert(r.statuses.includes(246));assert(r.statuses.includes(249));}if(mode==='aircharge')assert(r.statuses.includes(250));if(mode==='grenade-fail')assert(r.statuses.includes(239));if(mode==='grenade-air-fail')assert(r.statuses.includes(245));results.push(r);console.log(JSON.stringify(r));await fs.writeFile('build/remix/conker-fix/transitions.json',JSON.stringify(results,null,2));await page.close();
}
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
