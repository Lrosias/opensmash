import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const output=process.env.MELEE_RESULTS||'melee/test-results/sparse-native';await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--disable-backgrounding-occluded-windows','--disable-renderer-backgrounding','--autoplay-policy=no-user-gesture-required']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});await page.goto(process.env.MELEE_URL||'http://127.0.0.1:8329/');
 const run=await page.evaluate(async()=>{
  const {createNativeMatch}=await import('./native-match.mjs');window.native=await createNativeMatch({stage:31,seed:123456,slots:[1,3],selections:[{fighter:2,color:0},{fighter:20,color:1}]});native.show();
  const pads=Array.from({length:4},()=>[0,0,0,0,0,0,0]),hashes=[];pads[1][1]=.3;pads[3][1]=-.3;
  for(let frame=0;frame<60;frame++)hashes.push((await native.step(pads)).checksum);
  return {initial:native.initial,hashes,manifest:await(await fetch('./engine/wasm.json')).json()};
 });
 await writeFile(`${output}/verification.json`,JSON.stringify(run,null,2));assert.deepEqual(run.initial.match.slots,[1,3]);assert.deepEqual(run.initial.match.fighters,[2,20]);assert.deepEqual(run.initial.match.stocks,[4,4]);assert.equal(run.hashes.length,60);await page.screenshot({path:`${output}/ports-2-and-4.png`});console.log('Sparse native ports2and4booted with exact fighters/stocks and60inputframes');
}finally{await browser.close();}
