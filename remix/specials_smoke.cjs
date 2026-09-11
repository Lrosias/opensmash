const {chromium}=require(process.env.PLAYWRIGHT_MODULE),fs=require('node:fs/promises');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--enable-unsafe-swiftshader']});try{
 const page=await browser.newPage({viewport:{width:960,height:720}});let errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'||m.text().startsWith('CHECK:'))console.log(m.text())});
 await page.goto('http://127.0.0.1:4199/remix-check.html?battle='+ (process.env.FIGHTER||58) +',74,16,0&SSB64_REMIX_TEST=1');await page.waitForFunction(()=>window.driver,{},{timeout:60000});
 const r=await page.evaluate(async()=>{const {NativeCheckpoints}=await import("/checkpoints.mjs");let result={};const tick=(n,a=[0,0,0],b=[0,0,0])=>{let rows=[];for(let i=0;i<n;i++){pads=[a,b];driver.step();rows.push(probe())}return rows};for(let n=0;(window.state?.[4]||0)<30&&n<900;n++)tick(1);if((window.state?.[4]||0)<30)throw Error("Match never reached GO");const place=()=>{if(!game.contentWindow.Module._port_remix_test_place(260))throw Error('fixture placement failed');tick(2)};
 console.log('CHECK: neutral');place();result.neutral=tick(1,[16384,0,0]);for(let n=0;n<75;n++)result.neutral.push(...tick(1,[n%5===4?16384:0,0,0]));result.neutral.push(...tick(90));
 console.log('CHECK: up',probe());place();result.up=[...tick(1,[16384,0,70]),...tick(110)];
 console.log('CHECK: aerial recovery',probe());place();tick(1,[8,0,0]);tick(18);result.recovery=[...tick(1,[16384,0,70]),...tick(130)];
 console.log('CHECK: down',probe());place();result.counter=[...tick(1,[16384,0,-70]),...tick(10),...tick(1,[0,0,0],[32768,0,0]),...tick(65)];
 console.log('CHECK: rollback',probe());place();const store=new NativeCheckpoints(driver,{window:180});const snap=store.save(0,state);const expected=[];
 const input=n=>n===0?[16384,0,-70]:n===55?[16384,0,70]:[0,0,0];const other=n=>n===11?[32768,0,0]:[0,0,0];
 for(let n=0;n<130;n++){tick(1,input(n),other(n));expected.push(JSON.stringify({state,probe:probe()}));}
 state=store.load(snap);for(let n=0;n<130;n++){tick(1,input(n),other(n));if(JSON.stringify({state,probe:probe()})!==expected[n])throw Error('Special rollback diverged at '+n);}
 result.rollback=true;return result;});
 r.errors=errors;await fs.writeFile(`build/remix/main/checks/specials-${process.env.FIGHTER||58}.json`,JSON.stringify(r));console.log(Object.fromEntries(Object.entries(r).map(([k,v])=>[k,Array.isArray(v)&&v[0]?.length===32?{statuses:[...new Set(v.map(x=>x[1]))],damage:[v[0][2],v.at(-1)[2]],foeDamage:[v[0][18],v.at(-1)[18]],ymax:Math.max(...v.map(x=>x[4]))}:v])));await page.screenshot({path:`build/remix/main/checks/specials-${process.env.FIGHTER||58}.png`});
 }finally{await browser.close()}})();
