const {chromium}=require(process.env.PLAYWRIGHT_MODULE);
const fs=require('node:fs/promises'),assert=require('node:assert/strict');
(async()=>{
 const out=process.env.POLISH_EVIDENCE||'/tmp/opensmash-polish-evidence';await fs.mkdir(out,{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 try{for(const mode of ['', '?ko']){
  const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(String(e)));
  await p.goto((process.env.POLISH_URL||'http://127.0.0.1:4199')+'/pair-check.html'+mode);
  await p.waitForFunction(()=>!document.getElementById('run').disabled||/FAIL|ERROR/.test(document.getElementById('report').textContent),null,{timeout:60000});
  assert.equal(await p.locator('#run').isDisabled(),false);
  await p.locator('#run').click();
  await p.waitForFunction(()=>/PASS:|FAIL:/.test(document.getElementById('report').textContent),null,{timeout:240000});
  const result=await p.locator('#report').textContent();
  await fs.writeFile(`${out}/pair${mode?'-ko':''}.txt`,result);console.log(result);
  assert.ok(result.includes('PASS:'));assert.deepEqual(errors,[]);await p.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
