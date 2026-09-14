const {chromium}=require(process.env.PLAYWRIGHT_MODULE);
const fs=require('node:fs/promises'),assert=require('node:assert/strict');
const out=process.env.POLISH_EVIDENCE||'/tmp/opensmash-polish-evidence';
const base=process.env.POLISH_URL||'http://127.0.0.1:4199';
const roster=[...Array(12).keys(),29,30,31,32,33,52,55,56,57,58,59,62,63,64,65,68,73,72,34,38,74,75];
(async()=>{
 await fs.mkdir(out,{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const errors=[],report=[],logs=[],overflows=[];let p,selections=[],actions=[],exceptional=null;
 try{
  p=await browser.newPage({viewport:{width:960,height:720}});
  p.on('pageerror',e=>errors.push(String(e)));
  p.on('console',m=>{logs.push(m.text());if(/OVERFLOW|over flow/i.test(m.text()))overflows.push(m.text());if(logs.length>60)logs.shift();});
  await p.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  if(!process.env.POLISH_LOCAL_ONLY){
  await p.goto(`${base}/presentation-check.html`);
  await p.waitForFunction(()=>window.driver,null,{timeout:60000});
  await p.evaluate(()=>{for(let n=0;n<40;n++)driver.step();});
  selections=await p.evaluate(()=>{
   const m=game.contentWindow.Module,selected=[];
   const tick=(n,port=0,pad=[0,0,0])=>{pads=Array.from({length:4},()=>[0,0,0]);pads[port]=pad;for(let i=0;i<n;i++)driver.step();};
   const layout=[63,32,4,0,2,5,3,7,30,59,64,31,11,6,8,1,9,10,29,62,65,72,33,73,52,55,56,57,58,68,34,38,74,75];
   const choose=(port,id)=>{const m=()=>game.contentWindow.Module.remixMenu,i=layout.indexOf(id),cx=i<30?39+(i%10)*24:111+(i-30)*24,cy=i<30?44+Math.floor(i/10)*24:120,tx=cx-1,ty=cy+13;
    if(m().confirmed&(1<<port)){tick(1,port,[16384,0,0]);tick(5);}
    for(let n=0;n<400;n++){const dx=tx-m().hx[port],dy=m().hy[port]-ty;if(Math.abs(dx)<1&&Math.abs(dy)<1)break;const stick=v=>{let s=Math.max(-80,Math.min(80,Math.round(v*20)));return s&&Math.abs(s)<=8?Math.sign(s)*9:s;};tick(1,port,[0,stick(dx),stick(dy)]);}
    tick(1,port,[32768,0,0]);tick(35);
   };
   for(const id of layout){choose(0,id);
    const at=m._port_marth_probe()>>2,rows=[...game.contentWindow.HEAP32.slice(at,at+32)];
    selected.push({id,status:[rows.slice(0,16),rows.slice(16,32)].find(r=>r[0]===id&&r[1]===65540)?.[1]});
   }
   return selected;
  });
  assert.equal(new Set(selections.map(s=>s.id)).size,34);
  for(const s of selections)assert.equal(s.status,65540,`Selection pose missing for ${s.id}`);
  for(const id of roster){
   const result=await p.evaluate(id=>{
    const m=game.contentWindow.Module,poses=[];
    const probe=()=>{const at=m._port_marth_probe()>>2;return [...game.contentWindow.HEAP32.slice(at,at+32)];};
    for(let pose=0;pose<3;pose++){
     if(!m._port_remix_online_results(id,58,0,2,0))throw Error('Results rejected');
     pads=[[0,0,0],[0,0,0]];for(let n=0;n<20;n++)driver.step();
     const before=probe();for(let n=0;n<60;n++)driver.step();
     poses.push({result:{...m.remixResults},before,after:probe()});
    }
    return poses;
   },id);
   assert.deepEqual(result.map(p=>p.result.pose),[65537,65538,65539]);
   for(const pose of result){
    assert.equal(pose.result.winner,0);assert.equal(pose.result.online,true);
    assert.equal(pose.after[0],id);assert.equal(pose.after[1],pose.result.pose);
    assert.notEqual(pose.before[5],pose.after[5],`Frozen victory ${id}/${pose.result.pose}`);
    assert.equal(pose.after[17],65541);
   }
   if([58,68,7].includes(id))await p.screenshot({path:`${out}/victory-${id}.png`});
   assert.deepEqual(errors,[]);report.push({id,poses:result.map(p=>p.result.pose)});console.log(JSON.stringify(report.at(-1)));
  }
  actions=await p.evaluate(()=>{
   pads=[[32768,0,0]];driver.step();pads=[[0,0,0]];for(let n=0;n<35;n++)driver.step();pads=[[16384,0,0]];driver.step();return events;
  });
  assert.deepEqual(actions,[[3,0],[2,0]]);
  exceptional=await p.evaluate(()=>{
   const m=game.contentWindow.Module,rows=[];pads=[[0,0,0]];for(let n=0;n<40;n++)driver.step();
   for(const winner of [-1,-2,1]){m._port_remix_online_results(58,74,winner,0,2);for(let n=0;n<80;n++)driver.step();rows.push({...m.remixResults});}
   return {rows,rejected:[m._port_remix_online_results(96,74,0,1,0),m._port_remix_online_results(58,74,4,1,0),m._port_remix_online_results(58,74,0,-1,0),m._port_remix_online_results(58,74,0,128,0)]};
  });
  assert.deepEqual(exceptional.rows.map(r=>r.winner),[-1,-1,1]);assert.deepEqual(exceptional.rejected,[0,0,0,0]);
  }
  // A fresh native menu drives a complete four-controller match, a rematch
  // initiated by P4, then a return to the original saved controller roster.
  await p.goto(`${base}/presentation-check.html`);await p.waitForFunction(()=>window.driver,null,{timeout:60000});
  await p.evaluate(()=>{
   window.tick=(n,port=0,pad=[0,0,0])=>{pads=Array.from({length:4},()=>[0,0,0]);pads[port]=pad;for(let i=0;i<n;i++)driver.step();};
   const layout=[63,32,4,0,2,5,3,7,30,59,64,31,11,6,8,1,9,10,29,62,65,72,33,73,52,55,56,57,58,68,34,38,74,75];
   const choose=(port,id)=>{const m=()=>game.contentWindow.Module.remixMenu,i=layout.indexOf(id),cx=i<30?39+(i%10)*24:111+(i-30)*24,cy=i<30?44+Math.floor(i/10)*24:120,tx=cx-1,ty=cy+13;
    if(m().confirmed&(1<<port)){tick(1,port,[16384,0,0]);tick(5);}
    for(let n=0;n<400;n++){const dx=tx-m().hx[port],dy=m().hy[port]-ty;if(Math.abs(dx)<1&&Math.abs(dy)<1)break;const stick=v=>{let s=Math.max(-80,Math.min(80,Math.round(v*20)));return s&&Math.abs(s)<=8?Math.sign(s)*9:s;};tick(1,port,[0,stick(dx),stick(dy)]);}
    tick(1,port,[32768,0,0]);tick(35);
   };
   tick(40);choose(0,68);
   for(let port=1;port<4;port++){tick(1,port,[4096,0,0]);tick(20);choose(port,[68,73,72,64][port]);}
  });
  await p.screenshot({path:`${out}/four-ready.png`});
  const setup=await p.evaluate(()=>({...game.contentWindow.Module.remixMenu}));assert.equal(setup.confirmed,15);
  const rounds=[];
  await p.evaluate(()=>{tick(1,0,[4096,0,0]);tick(60);tick(1,0,[32768,0,0]);tick(800);});
  for(let round=0;round<2;round++){
   const result=await p.evaluate(()=>{
    const m=game.contentWindow.Module;let frames=0;
    while(m.nativeScene!==24&&frames<6000){if(frames%240===0)for(let port=0;port<3;port++)m._port_remix_test_position(port,4900,100);tick(1);frames++;}
    if(m.nativeScene!==24)throw Error('Match did not finish');tick(80);return {...m.remixResults,frames};
   });assert.equal(result.winner,3);assert.equal(result.fighters.length,4);rounds.push(result);
   await p.screenshot({path:`${out}/four-results-${round}.png`});
   await p.evaluate(()=>{tick(1,3,[8192,0,0]);tick(2);});
   assert.equal(await p.evaluate(()=>game.contentWindow.Module.remixResults.details),true);
   await p.screenshot({path:`${out}/four-stats-${round}.png`});
   if(!round){
    const state=await p.evaluate(()=>{tick(1,3,[4096,0,0]);tick(800);const m=game.contentWindow.Module,at=m._port_remix_multiplayer_probe()>>2;return {scene:m.nativeScene,players:[...game.contentWindow.HEAP32.slice(at,at+26)]};});
    assert.equal(state.scene,22);assert.equal(state.players[0],4);assert.equal(state.players[1],0);
    for(let port=0;port<4;port++)assert.equal(state.players[7+port*6],0,'Rematch damage did not reset');
   }
  }
  const returned=await p.evaluate(()=>{tick(1,3,[32768,0,0]);tick(100);return {...game.contentWindow.Module.remixMenu};});
  assert.equal(returned.humans,15);assert.equal(returned.active,15);assert.equal(returned.p1,setup.p1);assert.equal(returned.p2,setup.p2);assert.deepEqual(errors,[]);
  assert.deepEqual(overflows,[],'Native render buffer overflow');
  await fs.writeFile(`${out}/results.json`,JSON.stringify({selections,fighters:report,actions,exceptional,rounds,returned,errors,overflows},null,2));
  console.log(JSON.stringify({actions,rounds,returned,errors}));
 }catch(e){
  const native=await p?.evaluate(()=>game.contentWindow.FS.readFile('/libsdl/BattleShip/ssb64.log',{encoding:'utf8'}).slice(-18000)).catch(()=>null);
  await fs.writeFile(`${out}/results-failure.json`,JSON.stringify({error:String(e),logs,native},null,2));throw e;
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
