// Two independent Wasm boots, checkpoint replay, and a real four-stock finish.
// Serve authored source and the release engine with serve-competitive.py.
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const output=process.env.MELEE_RESULTS||'melee/test-results/competitive-native';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:false,args:['--disable-backgrounding-occluded-windows','--disable-renderer-backgrounding','--autoplay-policy=no-user-gesture-required']});
const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
page.on('pageerror',e=>errors.push(String(e)));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.text().includes('competitive match configured'))console.log(m.text());});
const runs=[];let engineSha256;
try {
 await page.goto(process.env.MELEE_URL||'http://127.0.0.1:8291/');
 engineSha256=await page.evaluate(async()=>(await(await fetch('./engine/wasm.json')).json()).sha256);
 for(let boot=0;boot<2;boot++) {
  console.log('Boot',boot+1);
  const run=await page.evaluate(async()=>{
   const {createNativeMatch}=await import('./native-match.mjs');
   window.native=await createNativeMatch({stage:31,seed:123456,selections:[{fighter:2,color:0},{fighter:20,color:1}]});
   native.show();
   const initial=native.initial,hashes=[];
   const pads=Array.from({length:4},()=>[0,0,0,0,0,0,0]);
   for(let i=0;i<240;i++)hashes.push((await native.step(pads)).checksum);
   const state=await native.save(),original=[];
   pads[0][1]=1;
   for(let i=0;i<7;i++)original.push((await native.step(pads)).checksum);
   const restored=await native.load(state),replayed=[];
   for(let i=0;i<7;i++)replayed.push((await native.step(pads,{replaying:true})).checksum);
   await native.discard(state);
   return {initial,hashes,checkpoint:state,restored,original,replayed};
  });
  assert.equal(run.initial.active,true);
  assert.deepEqual(run.initial.match?.fighters,[2,20]);
  assert.equal(run.initial.match?.stage,31);
  assert.deepEqual(run.initial.match?.stocks,[4,4]);
  assert.ok(run.initial.match?.seconds>=479&&run.initial.match.seconds<=480,'Expected an eight-minute match at the first active frame');
  assert.equal(run.checkpoint.checksum,run.restored.checksum);
  assert.deepEqual(run.original,run.replayed);
  runs.push(run);
  await writeFile(`${output}/boot-verification.json`,JSON.stringify({engineSha256,runs,errors},null,2));
  if(boot===0){await page.screenshot({path:`${output}/match.png`});await page.evaluate(()=>native.destroy());}
 }
 assert.equal(runs[0].initial.checksum,runs[1].initial.checksum,'Independent match boot diverged');
 assert.deepEqual(runs[0].hashes,runs[1].hashes,'Independent same-input gameplay diverged');
 console.log('Independent boot and seven-frame replay agree');
 const terminal=await page.evaluate(async()=>{
  const pads=Array.from({length:4},()=>[0,0,0,0,0,0,0]);pads[0][1]=1;
  for(let i=0;i<3600;i++){
   const out=await native.step(pads);
   if(out.result)return {ticks:i+1,...out};
  }
  throw Error('Four-stock self-destruct match did not finish');
 });
 await writeFile(`${output}/verification.json`,JSON.stringify({engineSha256,runs,terminal,errors},null,2));
 assert.equal(terminal.result.winner,1);
 assert.equal(terminal.result.outcome,2);
 assert.equal(terminal.result.stocks[0],0);
 assert.equal(terminal.result.stocks[1],4);
 await page.screenshot({path:`${output}/terminal.png`});
 await writeFile(`${output}/verification.json`,JSON.stringify({engineSha256,runs,terminal,errors},null,2));
 assert.equal(errors.some(e=>/Aborted|Out of memory|glMapBufferRange|getBufferSubData/.test(e)),false);
 console.log('Native four-stock elimination reports seat two',terminal.result);
}finally{await writeFile(`${output}/errors.json`,JSON.stringify(errors,null,2));await browser.close();}
