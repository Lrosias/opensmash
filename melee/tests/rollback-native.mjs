// Real Wasm verification. Requires a served build compiled with rollback exports.
import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const output=process.env.MELEE_RESULTS||'build/melee-web/test-results/rollback-native';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:false,args:['--disable-backgrounding-occluded-windows','--disable-renderer-backgrounding']});
const page=await browser.newPage({viewport:{width:1280,height:720}}),events=[];
page.on('pageerror',e=>events.push(String(e)));
page.on('console',m=>{if(m.type()==='error'||m.type()==='warning')events.push(m.text());});
if(process.env.YOUGAME_SDK_PATH)await page.route('https://yougame.co/sdk.js',r=>r.fulfill({path:process.env.YOUGAME_SDK_PATH,contentType:'text/javascript'}));
try {
  await page.goto(process.env.MELEE_URL||'http://127.0.0.1:8197/?rollback');
  /* the page boots on load */await page.waitForFunction(()=>['running','error'].includes(window.melee?.phase),null,{timeout:240000});
  await page.waitForFunction(()=>melee.displayedFrames>60||melee.errors.length,null,{timeout:120000});
  assert.deepEqual(await page.evaluate(()=>melee.errors),[]);
  const enabled=await page.evaluate(()=>melee.rollback.enable());
  console.log('Native boundary ready',enabled);
  if(process.env.MELEE_SETUP){
    const setup=JSON.parse(await readFile(process.env.MELEE_SETUP,'utf8'));
    for(let i=0;i<setup.length;i++){
      const entry=setup[i];
      await page.evaluate(async({frames,pads})=>{for(let f=0;f<frames;f++)await melee.rollback.step(Array.from({length:4},(_,i)=>pads?.[i]||[0,0,0,0,0,0,0]));},entry);
      if(entry.image)await page.screenshot({path:`${output}/${entry.image}.png`});
      console.log('Setup',i,entry.frames);
    }
  }
  const results=await page.evaluate(async()=>{
    const engine=melee.rollback,results=[];
    const inputs=f=>Array.from({length:4},(_,seat)=>seat===0?[f%5===0?1:0,f%8<4?.5:-.5,0,0,0,0,0]:[0,0,0,0,0,0,0]);
    for(const depth of [1,3,7]) {
      const checkpoint=await engine.save(),original=[];
      for(let f=0;f<depth;f++)original.push(await engine.step(inputs(f)));
      const restored=await engine.load(checkpoint),replayed=[];
      for(let f=0;f<depth;f++)replayed.push(await engine.step(inputs(f),{replaying:true}));
      results.push({depth,checkpoint,restored,original,replayed});
    }
    return results;
  });
  await writeFile(`${output}/results.json`,JSON.stringify({enabled,results,events,engineSha256:await page.evaluate(()=>melee.engineSha256)},null,2));
  for(const run of results){
    assert.equal(run.checkpoint.hash,run.restored.hash,`RAM differs immediately after restore at depth ${run.depth}`);
    assert.deepEqual(run.replayed.map(x=>[x.frame,x.hash]),run.original.map(x=>[x.frame,x.hash]),`Replay diverges at depth ${run.depth}`);
  }
  await page.screenshot({path:`${output}/game.png`});
  console.log('RAM-hash replay passed at depths 1, 3 and 7',results.map(r=>({depth:r.depth,bytes:r.checkpoint.bytes,saveMs:r.checkpoint.ms,loadMs:r.restored.ms,stepMs:r.original.map(s=>s.ms)})));
  const delayed=await page.evaluate(async()=>{
    const {AsyncRollbackTimeline}=await import('./rollback-timeline.mjs');
    const native=melee.rollback,initial=await native.save(),baseline=[],confirmed=[],errors=[];
    const neutral=[0,0,0,0,0,0,0];
    const pad=(f,seat)=>f<2?neutral:[f%13===seat?4:f%9===seat?1:0,(f%24<12?1:-1)*(seat?-.63:.63),0,0,0,0,0];
    for(let f=0;f<100;f++)baseline.push((await native.step([pad(f,0),pad(f,1),neutral,neutral])).hash);
    await native.load(initial);
    let tick=0;const network=[],costs=[];
    const timeline=new AsyncRollbackTimeline({players:['a','b'],me:'a',neutral,input:()=>pad(tick+2,0),send:()=>{},
      engine:{save:()=>native.save(),load:s=>native.load(s),step:(inputs,options)=>native.step([inputs.a,inputs.b,neutral,neutral],options)},
      onConfirm:(f,out)=>confirmed.push([f,out.hash]),onError:error=>errors.push(error.message)});
    for(tick=0;tick<100;tick++){
      const started=performance.now();
      if(tick%7!==0){
        const entries=Array.from({length:Math.min(32,tick+3)},(_,i)=>{const f=Math.max(0,tick-29)+i;return [f,pad(f,1)];});
        network.push({at:tick+3+tick%3,entries});
        if(tick%4===0)network.push({at:tick+6,entries});
      }
      timeline.tick();
      for(let i=network.length-1;i>=0;i--)if(network[i].at<=tick)timeline.receive('b',network.splice(i,1)[0].entries);
      await timeline.running;
      costs.push(performance.now()-started);
      if(timeline.closed)break;
    }
    timeline.stop();
    return {errors,confirmed,baseline,rollbacks:timeline.rollbacks,replayedFrames:timeline.replayedFrames,costs};
  });
  await writeFile(`${output}/delayed-input.json`,JSON.stringify(delayed,null,2));
  assert.deepEqual(delayed.errors,[]);assert.ok(delayed.rollbacks>0);assert.ok(delayed.confirmed.length>80);
  for(const [frame,hash] of delayed.confirmed)assert.equal(hash,delayed.baseline[frame],`Delayed-input replay diverges at frame ${frame}`);
  assert.equal(events.some(e=>/glMapBufferRange|getBufferSubData|Out of memory|Aborted/.test(e)),false,'Native/WebGL checkpoint error');
  console.log('Delayed inputs match uninterrupted RAM hashes', {confirmed:delayed.confirmed.length,rollbacks:delayed.rollbacks,replayedFrames:delayed.replayedFrames});
  await page.evaluate(()=>melee.rollback.release());
  await page.getByRole('button',{name:'Start rollback lab',exact:true}).click();
  await page.waitForFunction(()=>melee.rollbackLab?.timeline.frame>10||melee.errors.length,null,{timeout:30000});
  assert.deepEqual(await page.evaluate(()=>melee.errors),[]);
  assert.equal(await page.evaluate(()=>melee.rollbackLab.timeline.closed),false);
  await page.getByRole('button',{name:'Exit lab',exact:true}).click();
  await page.waitForFunction(()=>window.melee?.phase==='idle');
  console.log('Rollback lab starts and exits through the UI');
} finally {await writeFile(`${output}/events.json`,JSON.stringify(events,null,2));await browser.close();}
