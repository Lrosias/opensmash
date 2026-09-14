const {chromium}=require(process.env.PLAYWRIGHT_MODULE),fs=require('fs'),assert=require('node:assert/strict');
const rows=JSON.parse(fs.readFileSync('build/remix/main/assets/costume-extraction.json')).fighters;
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--enable-unsafe-swiftshader']});try{const p=await browser.newPage({viewport:{width:960,height:720}}),errors=[];p.on('pageerror',e=>errors.push(String(e)));p.on('console',m=>{if(/OVERFLOW/i.test(m.text()))errors.push(m.text())});
await p.goto((process.env.POLISH_URL||'http://127.0.0.1:4201')+'/presentation-check.html');await p.waitForFunction(()=>window.driver,null,{timeout:60000});
const report=await p.evaluate(rows=>{
 const tick=(n,port=0,pad=[0,0,0])=>{pads=Array.from({length:4},()=>[0,0,0]);pads[port]=pad;for(let i=0;i<n;i++)driver.step();};
const layout=[63,32,4,0,2,5,3,7,30,59,64,31,11,6,8,1,9,10,29,62,65,72,33,73,52,55,56,57,58,68,34,38,74,75];
   const choose=(port,id,drop=true)=>{const m=()=>game.contentWindow.Module.remixMenu,i=layout.indexOf(id),cx=i<30?39+(i%10)*24:111+(i-30)*24,cy=i<30?44+Math.floor(i/10)*24:120,tx=cx-1,ty=cy+13;
    if(m().confirmed&(1<<port)){tick(1,port,[16384,0,0]);tick(5);}
    for(let n=0;n<400;n++){const dx=tx-m().hx[port],dy=m().hy[port]-ty;if(Math.abs(dx)<1&&Math.abs(dy)<1)break;const stick=v=>{let s=Math.max(-80,Math.min(80,Math.round(v*20)));return s&&Math.abs(s)<=8?Math.sign(s)*9:s;};tick(1,port,[0,stick(dx),stick(dy)]);}
    if(drop){tick(1,port,[32768,0,0]);tick(35);}
   };
 const probe=()=>{const m=game.contentWindow.Module,at=m._port_remix_costume_probe()>>2;return [...game.contentWindow.HEAP32.slice(at,at+12)];};
 tick(50);const checks=[];
 for(const {id,count} of rows){choose(0,id);const colors=[];for(let c=0;c<count;c++){colors.push(probe()[2]);tick(1,0,[1,0,0]);tick(4);}checks.push({id,count,colors,wrapped:probe()[2]});}
 choose(0,68,false);tick(1,1,[4096,0,0]);tick(20);choose(1,68,false);
 pads=[[32768,0,0],[32768,0,0],[0,0,0],[0,0,0]];driver.step();tick(35);const simultaneous=probe();
 for(let port=2;port<4;port++){tick(1,port,[4096,0,0]);tick(20);choose(port,68);}
 const duplicates=probe();tick(1,2,[1,0,0]);tick(3);const selected=probe();
 tick(1,0,[4096,0,0]);tick(60);tick(1,0,[32768,0,0]);tick(800);const battle=probe();
 let frames=0;while(game.contentWindow.Module.nativeScene!==24&&frames++<6000){if(frames%240===0)for(let port=0;port<3;port++)game.contentWindow.Module._port_remix_test_position(port,4900,100);tick(1);}tick(410);
 const result={...game.contentWindow.Module.remixResults};tick(1,3,[4096,0,0]);tick(100);if(game.contentWindow.Module.nativeScene!==16)throw Error('Results did not return to character select');tick(1,0,[4096,0,0]);tick(60);tick(1,0,[32768,0,0]);tick(800);const rematch=probe();
 return {checks,simultaneous,duplicates,selected,battle,result,rematch};
},rows);
for(const c of report.checks){assert.deepEqual(c.colors,Array.from({length:c.count},(_,i)=>i),String(c.id));assert.equal(c.wrapped,0);}
assert.notEqual(report.simultaneous[2],report.simultaneous[5]);
assert.equal(new Set([2,5,8,11].map(i=>report.duplicates[i])).size,4);assert.equal(report.result.winner,3);
for(const i of [2,5,8,11]){assert.equal(report.selected[i],report.battle[i]);assert.equal(report.battle[i],report.rematch[i]);}
assert.deepEqual(errors,[]);await p.screenshot({path:(process.env.POLISH_EVIDENCE||'/tmp')+'/remix-costumes-rematch.png'});fs.writeFileSync((process.env.POLISH_EVIDENCE||'/tmp')+'/remix-costumes-results.json',JSON.stringify({report,errors},null,2));console.log(JSON.stringify({fighters:report.checks.length,colors:report.checks.reduce((a,c)=>a+c.count,0),duplicates:report.duplicates,selected:report.selected,battle:report.battle,rematch:report.rematch,errors}));
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
