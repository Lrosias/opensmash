// Actual engine acceptance: four human ports, deterministic boot/input, and a real result.
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const output=process.env.MELEE_RESULTS||'melee/test-results/party-native';await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--disable-backgrounding-occluded-windows','--disable-renderer-backgrounding','--autoplay-policy=no-user-gesture-required']});
const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[],runs=[];
page.on('pageerror',e=>errors.push(String(e)));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(/competitive match configured|Native four-port/.test(m.text()))console.log(m.text());});
try{
 await page.goto(process.env.MELEE_URL||'http://127.0.0.1:8329/');
 const engineSha256=await page.evaluate(async()=>(await(await fetch('./engine/wasm.json')).json()).sha256);
 for(let boot=0;boot<2;boot++){
  console.log('Four-port native boot',boot+1);
  const run=await page.evaluate(async()=>{
   const {createNativeMatch}=await import('./native-match.mjs');
   window.native=await createNativeMatch({stage:31,seed:123456,slots:[0,1,2,3],selections:[{fighter:2,color:0},{fighter:20,color:1},{fighter:9,color:0},{fighter:19,color:0}]});native.show();console.log('Native four-port starting boundary reached');
   const initial=native.initial,hashes=[],pads=Array.from({length:4},()=>[0,0,0,0,0,0,0]);
   for(let i=0;i<120;i++){for(let port=0;port<4;port++)pads[port][1]=(i%30<15?1:-1)*.3*(port%2?1:-1);hashes.push((await native.step(pads)).checksum);}
   return {initial,hashes};
  });
  assert.equal(run.initial.active,true);assert.deepEqual(run.initial.match.fighters,[2,20,9,19]);assert.deepEqual(run.initial.match.stocks,[4,4,4,4]);assert.equal(run.initial.match.stage,31);runs.push(run);
  await writeFile(`${output}/boot.json`,JSON.stringify({engineSha256,runs,errors},null,2));
  if(boot===0){await page.screenshot({path:`${output}/four-ports.png`});await page.evaluate(()=>native.destroy());}
 }
 assert.equal(runs[0].initial.checksum,runs[1].initial.checksum);assert.deepEqual(runs[0].hashes,runs[1].hashes);
 console.log('Independent four-port boots and varied input hashes agree');
 const terminal=await page.evaluate(async()=>{
  const pads=Array.from({length:4},()=>[0,0,0,0,0,0,0]);for(let p=0;p<3;p++)pads[p][1]=1;
  for(let frame=0;frame<4200;frame++){const output=await native.step(pads);if(output.result)return {ticks:frame+1,...output};}
  throw Error('Four-port elimination did not finish');
 });
 await writeFile(`${output}/verification.json`,JSON.stringify({engineSha256,runs,terminal,errors},null,2));
 assert.equal(terminal.result.winner,3);assert.deepEqual(terminal.result.stocks,[0,0,0,4]);
 await page.screenshot({path:`${output}/four-port-result.png`});
 assert.equal(errors.some(e=>/Aborted|Out of memory|glMapBufferRange|getBufferSubData/.test(e)),false);
 console.log('Confirmed four-port elimination winner',terminal.result);
}finally{await writeFile(`${output}/errors.json`,JSON.stringify(errors,null,2));await browser.close();}
