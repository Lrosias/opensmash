const {execFile}=require('node:child_process'),{promisify}=require('node:util'),fs=require('node:fs/promises'),assert=require('node:assert/strict');
(async()=>{const report=[];for(const id of [29,30,31,32,33,34,38,52,55,56,57,58,59,62,63,64,65,68,72,73,74,75]){
 const {stdout}=await promisify(execFile)(process.execPath,['remix/specials_smoke.cjs'],{env:{...process.env,FIGHTER:String(id)},timeout:180000,maxBuffer:2e6});
 const r=JSON.parse(await fs.readFile(`build/remix/main/checks/specials-${id}.json`));assert.deepEqual(r.errors,[]);assert.equal(r.rollback,true);
 for(const move of ['neutral','up','counter'])assert(r[move].some(row=>row[1]>=220),`${id} ${move} did not enter a special`);
 assert(r.recovery.some(x=>x[1]>=220),`${id} aerial recovery did not enter a special`);
 const row={fighter:id,neutral:[...new Set(r.neutral.map(x=>x[1]))],up:[...new Set(r.up.map(x=>x[1]))],down:[...new Set(r.counter.map(x=>x[1]))],rollback:r.rollback};report.push(row);console.log(row);await fs.writeFile('build/remix/main/checks/all-specials.json',JSON.stringify(report,null,2));
}})().catch(e=>{console.error(e);process.exitCode=1});
