const {chromium}=require(process.env.PLAYWRIGHT_MODULE),fs=require('node:fs/promises'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--enable-unsafe-swiftshader']});
try{const report=[];for(const id of (process.env.FIGHTERS||'58,74,56,59,64,65,29,34').split(',').map(Number)){
 const page=await browser.newPage({viewport:{width:960,height:720}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(`http://127.0.0.1:4199/remix-check.html?battle=${id},8,16,0&SSB64_REMIX_TEST=1`);await page.waitForFunction(()=>window.driver,{},{timeout:60000});await page.frames().find(f=>f.url().includes('/engine/')).locator('canvas').click();
 const r=await page.evaluate(id=>{const m=game.contentWindow.Module,read=(fn,n)=>{const p=m[fn]()>>2;return [...game.contentWindow.HEAP32.slice(p,p+n)]};
 const tick=(n,pad=[0,0,0])=>{pads=[pad,[0,0,0]];for(let i=0;i<n;i++){driver.step();const v=read('_port_remix_visual_probe',24);rows.push(v);if(v[3]>=2&&v[2]>=2)seen.add(v[2]);}};let rows=[],seen=new Set;
 for(let i=0;(window.state?.[4]||0)<30&&i<900;i++)tick(1);m._port_remix_test_place(1700);tick(2);
 tick(1,[32768,70,0]);tick(80);tick(1,[32768,0,70]);tick(80);tick(1,[32768,0,-70]);tick(80);
 for(const [x,y] of [[0,0],[70,0],[-70,0],[0,70],[0,-70]]){m._port_remix_test_place(1700);tick(2);tick(1,[8,0,0]);tick(12);tick(1,[32768,x,y]);tick(120);}
 tick(1,[16384,0,0]);tick(80);tick(1,[16384,0,70]);tick(100);tick(1,[16384,0,-70]);tick(110);
 // Leave a currently active sword trail on screen for visual inspection.
 for(let n=0;n<120;n++){tick(1,[n%45===0?32768:0,n%45===0?70:0,0]);if(rows.at(-1)[3]>=2&&rows.at(-1)[2]>=2)break;}
 tick(2);
 return {id,trailTypes:[...seen],sounds:read('_port_remix_sound_probe',3),last:rows.at(-1),smashVoice:rows[0][5]};},id);
 await page.screenshot({path:`build/remix/main/checks/feedback-${id}.png`});assert.deepEqual(errors,[]);assert(r.trailTypes.length,`fighter ${id} has no visible custom trail`);report.push(r);console.log(r);await page.close();await fs.writeFile('build/remix/main/checks/visual-feedback.json',JSON.stringify(report,null,2));
}
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
