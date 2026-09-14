// Real Wasm presentation checks; outputs are separate from historical evidence.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE);
const fs=require('node:fs/promises'),assert=require('node:assert/strict');
const out=process.env.POLISH_EVIDENCE||'/tmp/opensmash-polish-evidence';
const base=process.env.POLISH_URL||'http://127.0.0.1:4199';
const ids=[29,30,31,32,33,52,55,56,57,58,59,62,63,64,65,68,73,72,34,38,74,75];
(async()=>{
 await fs.mkdir(out,{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const report=[];
 try{
  for(let index=0;index<ids.length;index+=2){
   const pair=ids.slice(index,index+2),p=await browser.newPage({viewport:{width:960,height:720}}),errors=[];
   p.on('pageerror',e=>errors.push(String(e)));
   await p.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
   await p.goto(`${base}/remix-check.html?battle=${pair},6,0`);
   await p.waitForFunction(()=>window.driver||window.error,null,{timeout:60000});
   const result=await p.evaluate(()=>{
    if(window.error)throw Error(window.error);
    const entry=[[],[]];let snapshot;
    for(let n=0;n<550;n++){
     driver.step();const rows=probe();
     for(let i=0;i<2;i++)if(rows[i*16+1]>=284&&rows[i*16+1]<=285)entry[i].push(rows.slice(i*16,i*16+16));
    }
    return {entry,final:probe(),replay:replay(),error:window.error};
   });
   for(let i=0;i<2;i++){
    assert.ok(result.entry[i].length>1,`No entrance for ${pair[i]}`);
    assert.ok(new Set(result.entry[i].map(r=>r[5])).size>1,`Frozen entrance for ${pair[i]}`);
    assert.equal(result.final[i*16],pair[i]);
    assert.equal(result.final[i*16+12],0,'Invisible after entry');
    assert.equal(result.final[i*16+13],0,'Ghost after entry');
    assert.equal(result.final[i*16+14],0,'Entry camera not restored');
   }
   assert.ok(result.final[3]<0&&result.final[19]>0,'Spawn positions changed');
   assert.ok(Math.abs(result.final[4]-result.final[20])<5,'Unequal spawn heights');
   assert.equal(result.replay,true);assert.deepEqual(errors,[]);
   const row={pair,frames:result.entry.map(r=>r.length),final:result.final,replay:result.replay,errors};
   report.push(row);console.log(JSON.stringify(row));await p.close();
  }
 }finally{await fs.writeFile(`${out}/entries.json`,JSON.stringify(report,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
