const {chromium}=require(process.env.PLAYWRIGHT_MODULE);const fs=require('fs/promises');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const out='build/remix/main/checks';await fs.mkdir(out,{recursive:true});let results=[];
 const roster=JSON.parse(await fs.readFile('build/remix/main/assets/roster.json'));const stages=[6,16,9,10,11,12,13,14];
 const defaults=Array.from({length:17},(_,i)=>`${roster[2*i].id},${roster[2*i+1].id},${stages[i%8]}`).join(';');
 const battles=(process.env.BATTLES||defaults).split(';');
 for(const battle of battles){let logs=[];const p=await browser.newPage({viewport:{width:960,height:720}});p.on('console',m=>logs.push(m.text()));p.on('pageerror',e=>logs.push('ERROR '+e.stack));let r={battle};
 try{
  await p.goto('http://127.0.0.1:4199/remix-check.html?battle='+battle+',0');
  await p.waitForFunction(()=>window.driver||window.error,{},{timeout:45000});
  r.error=await p.evaluate(()=>window.error);if(r.error)throw Error(r.error);
  r.warm=await p.evaluate(()=>{for(let i=0;i<550;i++)driver.step();return {state,probe:probe()}});
  r.replay=await p.evaluate(()=>replay());
  r.end=await p.evaluate(()=>{for(let i=0;i<180;i++){pads=[[i%30<10?32768:0,i%100<50?55:-55,0],[32768,0,0]];driver.step();}return {state,probe:probe()}});
  r.spawns=r.warm.probe[3]<0&&r.warm.probe[19]>0&&Math.abs(r.warm.probe[4]-r.warm.probe[20])<5;
  r.identity=[r.warm.probe[0],r.warm.probe[16]].join(',')===battle.split(',').slice(0,2).join(',');
  r.pass=r.identity&&r.spawns&&r.warm.state[4]>0&&r.replay&&!logs.some(x=>/RuntimeError|Aborted|ERROR/.test(x));
 }catch(e){r.pass=false;r.error=e.stack;}
 await p.screenshot({path:out+'/'+battle+'.png'});const frame=p.frames().find(f=>f.url().includes('engine/index'));if(frame)r.native=await frame.evaluate(()=>typeof FS!=='undefined'?FS.readFile('/libsdl/BattleShip/ssb64.log',{encoding:'utf8'}).slice(-18000):'').catch(()=>null);
 await fs.writeFile(out+'/'+battle+'.json',JSON.stringify({...r,logs},null,2));delete r.native;console.log(JSON.stringify(r));results.push(r);await p.close();
 }
 await fs.writeFile(out+(process.env.BATTLES?'/stages-results.json':'/roster-results.json'),JSON.stringify(results,null,2));await browser.close();if(results.some(x=>!x.pass))process.exitCode=1;
})();
