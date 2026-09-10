const {chromium}=require(process.env.PLAYWRIGHT_MODULE),fs=require('node:fs/promises'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--enable-unsafe-swiftshader']});try{const report={};
for(const id of [32,38,52,55,57,59,62,63,64,65,68,75,73]){
const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(String(e)));await p.goto(`http://127.0.0.1:4199/remix-check.html?battle=${id},74,16,0&SSB64_REMIX_TEST=1`);await p.waitForFunction(()=>window.driver,{},{timeout:60000});
const r=await p.evaluate(()=>{const tick=(n,a=[0,0,0])=>{const rows=[];pads=[a,[0,0,0]];for(let i=0;i<n;i++){driver.step();rows.push(probe())}return rows};for(let n=0;(window.state?.[4]||0)<30&&n<900;n++)tick(1);if(!game.contentWindow.Module._port_remix_test_place(1800))throw Error('place');tick(2);const jabs=[];for(let i=0;i<240;i++)jabs.push(...tick(1,[i%5===0?32768:0,0,0]));tick(100);game.contentWindow.Module._port_remix_test_place(1800);const jumps=[...tick(1,[8,0,0]),...tick(25),...tick(140,[8,0,0]),...tick(180)];return {jabs,jumps};});
report[id]={jabs:[...new Set(r.jabs.map(x=>x[1]))],jumps:[...new Set(r.jumps.map(x=>x[1]))],maxY:Math.max(...r.jumps.map(x=>x[4])),last:r.jumps.at(-1)[1],errors};console.log(id,report[id]);assert.deepEqual(errors,[]);assert.equal(report[id].last,10);await fs.writeFile(`build/remix/main/checks/normals-${id}.json`,JSON.stringify(r));await p.close();}
for(const [id,status] of [[32,220],[38,220],[52,233],[55,220],[57,232],[59,220],[62,221],[63,221],[64,254],[65,220],[68,222],[75,220]])assert(report[id].jabs.includes(status),`${id} missing jab ${status}`);
for(const status of [223,224,225,226])assert(report[64].jumps.includes(status),`Dedede missing jump ${status}`);
await fs.writeFile('build/remix/main/checks/normals.json',JSON.stringify(report,null,2));
}finally{await browser.close()}})();
