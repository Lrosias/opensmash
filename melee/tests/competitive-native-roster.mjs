import {createRequire} from 'node:module';
import {writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const output=process.env.MELEE_RESULTS||'melee/test-results/competitive-native-roster';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:false,args:['--disable-backgrounding-occluded-windows','--disable-renderer-backgrounding','--autoplay-policy=no-user-gesture-required']});
const page=await browser.newPage({viewport:{width:1200,height:800}}),outputs=[];
page.on('pageerror',e=>console.log('ERROR',e));
try {
 await page.goto(process.env.MELEE_URL||'http://127.0.0.1:8291/');
 for(const launch of [{stage:2,seed:234567,selections:[{fighter:4,color:0},{fighter:18,color:1}]},{stage:3,seed:345678,selections:[{fighter:19,color:0},{fighter:14,color:1}]}]) {
  console.log('LAUNCH',JSON.stringify(launch));
  const out=await page.evaluate(async launch=>{
   const {createNativeMatch}=await import('./native-match.mjs');
   window.native=await createNativeMatch(launch);native.show();
   const pads=Array.from({length:4},()=>[0,0,0,0,0,0,0]),initial=native.initial;
   for(let i=0;i<60;i++)await native.step(pads);
   const state=await native.save(),original=[];
   for(let i=0;i<7;i++)original.push((await native.step(pads)).checksum);
   await native.load(state);const replayed=[];
   for(let i=0;i<7;i++)replayed.push((await native.step(pads,{replaying:true})).checksum);
   await native.discard(state);return {initial,original,replayed};
  },launch);
  console.log('RESULT',JSON.stringify(out));outputs.push({launch,...out});
  await page.screenshot({path:`${output}/stage-${launch.stage}.png`});
  await page.evaluate(()=>native.destroy());
  assert.deepEqual(out.initial.match.fighters,launch.selections.map(s=>s.fighter));assert.equal(out.initial.match.stage,launch.stage);assert.deepEqual(out.original,out.replayed);
 }
}finally{await writeFile(`${output}/verification.json`,JSON.stringify(outputs,null,2));await browser.close();}
