// Two independently booted Wasm engines, using the actual production SDK. Only
// the room factory and transport are replaced for deterministic local testing.
import {createRequire} from 'node:module';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const directory=process.env.MELEE_RESULTS||'build/melee-web/test-results/rollback-sdk-native';
await mkdir(directory,{recursive:true});
const sdk=await readFile(process.env.YOUGAME_SDK_PATH||'/tmp/opensmash-rollback-integration-sdk.js','utf8');
assert.ok(sdk.includes('rollbackAsync: function'));
const instrumented=sdk.replace('  window.YouGame = {','  window.__meleeTestRoom = makeRoom;\n  window.YouGame = {');
assert.notEqual(instrumented,sdk);
const browser=await chromium.launch({channel:'chrome',headless:false,args:['--disable-backgrounding-occluded-windows','--disable-renderer-backgrounding','--disable-background-timer-throttling']});
const pages=await Promise.all([0,1].map(()=>browser.newPage({viewport:{width:1280,height:720}})));
const events=[],timers=new Set(),report={sdkSha256:createHash('sha256').update(sdk).digest('hex'),runs:[]};
let networkMode=0,packets=0,ending=false;
try {
  for(let i=0;i<2;i++){
    const page=pages[i];page.on('pageerror',e=>events.push({peer:i,error:String(e)}));
    page.on('console',m=>{if(['error','warning'].includes(m.type())&&/glMapBufferRange|getBufferSubData|Out of memory|Aborted/i.test(m.text()))events.push({peer:i,error:m.text()});});
    await page.route('https://yougame.co/sdk.js',r=>r.fulfill({body:instrumented,contentType:'text/javascript'}));
    await page.exposeFunction('__sendMeleePacket',packet=>{
      if(ending)return;
      const seq=++packets;
      if(networkMode===7&&seq%9===0)return; // Drop some bundles; history repairs them.
      const delay=networkMode===0?12:70+seq%5*20;
      const timer=setTimeout(async()=>{
        timers.delete(timer);if(ending)return;
        try {await pages[1-i].evaluate(({from,packet})=>window.sdkSession?.sync.receive(from,packet),{from:i?'b':'a',packet});}
        catch(e){if(!ending)events.push({peer:i,error:String(e)});}
      },delay);timers.add(timer);
    });
  }
  await Promise.all(pages.map(async page=>{
    await page.goto(process.env.MELEE_URL||'http://127.0.0.1:8197/?rollback=boot');
    await page.locator('#play').click();
    await page.waitForFunction(()=>window.melee?.rollbackBoot||window.melee?.errors.length,null,{timeout:120000});
  }));
  report.initial=await Promise.all(pages.map(p=>p.evaluate(()=>melee.rollbackBoot)));
  report.engineSha256=await Promise.all(pages.map(p=>p.evaluate(()=>melee.engineSha256)));
  assert.equal(report.engineSha256[0],report.engineSha256[1],'Engine builds differ');
  assert.equal(report.initial[0].hash,report.initial[1].hash,'Independent boot boundaries differ');
  console.log('Independent boot states match',report.initial);
  const neutral=[0,0,0,0,0,0,0];
  const setup=[{frames:100},...JSON.parse(await readFile('melee/tests/rollback-match-setup.json','utf8'))];
  report.setup=[];
  for(let stage=0;stage<setup.length;stage++){
    const entry=setup[stage];
    const outputs=await Promise.all(pages.map(p=>p.evaluate(async({frames,pads})=>{
      const hashes=[];
      for(let f=0;f<frames;f++)hashes.push((await melee.rollback.step(Array.from({length:4},(_,i)=>pads?.[i]||[0,0,0,0,0,0,0]))).hash);
      return hashes;
    },entry)));
    report.setup.push({stage,outputs});
    assert.deepEqual(outputs[0],outputs[1],`Independent engines diverged during setup group ${stage}`);
    console.log('Shared setup',stage,entry.frames);
  }
  await Promise.all(pages.map((p,i)=>p.screenshot({path:`${directory}/match-${i}.png`})));
  report.managedOwnership=await Promise.all(pages.map(p=>p.evaluate(async()=>{
    const e=melee.rollback,z=Array.from({length:4},()=>[0,0,0,0,0,0,0]);
    await e.manageCheckpoints();
    const first=await e.save();await e.step(z);const later=await e.save();
    await e.load(first);const laterRestored=await e.load(later);await e.load(first);
    const sameFrame=await e.save();const firstRestored=await e.load(first);
    await e.discard(first);await e.discard(later);await e.discard(sameFrame);
    return {first:first.hash,firstRestored:firstRestored.hash,later:later.hash,laterRestored:laterRestored.hash,stats:await e.checkpointStats()};
  })));
  for(const r of report.managedOwnership){assert.equal(r.first,r.firstRestored);assert.equal(r.later,r.laterRestored);assert.equal(r.stats.count,0);}
  for(const maxRollback of [0,7]){
    networkMode=maxRollback;
    const started=performance.now();
    await Promise.all(pages.map((p,i)=>p.evaluate(async({me,maxRollback})=>{
      const {createMeleeSync}=await import('./rollback-sdk.mjs');
      const room=window.__meleeTestRoom({});room.me=me;room.players=[{id:'a'},{id:'b'}];room.round=maxRollback+1;
      room.send=packet=>window.__sendMeleePacket(packet);
      window.sdkConfirmed=[];window.sdkErrors=[];
      window.sdkSession=await createMeleeSync({room,engine:melee.rollback,delay:3,maxRollback,checksumEvery:5,
        input:f=>[f%13===0?4:f%9===0?1:0,(f%24<12?.63:-.63)*(me==='a'?1:-1),0,0,0,0,0],
        onConfirm:e=>window.sdkConfirmed.push([e.frame,e.output.checksum]),onError:e=>window.sdkErrors.push(e.message)});
    },{me:i?'b':'a',maxRollback})));
    await Promise.all(pages.map(p=>p.evaluate(()=>{sdkSession.start();})));
    await Promise.all(pages.map(p=>p.waitForFunction(()=>sdkSession.sync.confirmedFrame>=119||sdkErrors.length,null,{timeout:120000})));
    // Freeze collection on both peers, then await the SDK's owned-token cleanup.
    const results=await Promise.all(pages.map(p=>p.evaluate(async()=>{
      await sdkSession.stop();
      return {confirmed:sdkConfirmed,errors:sdkErrors,stats:sdkSession.stats,frame:melee.rollback.frame,
        held:sdkSession.checkpoints,native:await melee.rollback.checkpointStats(),pageErrors:melee.errors,
        rollbacks:sdkSession.sync.rollbacks,baseFrame:sdkSession.baseFrame};
    })));
    const elapsedMs=performance.now()-started;
    report.runs.push({maxRollback,elapsedMs,results});
    const count=Math.min(...results.map(r=>r.confirmed.length));
    assert.ok(count>=120);assert.deepEqual(results.map(r=>r.errors),[[],[]]);
    assert.deepEqual(results.map(r=>r.pageErrors),[[],[]]);
    assert.deepEqual(events,[],'Native page or WebGL failure');
    assert.deepEqual(results[0].confirmed.slice(0,count),results[1].confirmed.slice(0,count),'Confirmed native states diverged');
    assert.ok(results.every(r=>r.held===0&&r.native.count===0&&r.stats.saves===r.stats.releases));
    if(maxRollback===0)assert.ok(results.every(r=>r.stats.saves===0&&r.stats.loads===0&&r.stats.releases===0));
    else assert.ok(results.some(r=>r.rollbacks>0),'Impaired link did not exercise a correction');
    console.log('Production SDK native pair passed',{maxRollback,confirmed:count,confirmedHz:count*1000/elapsedMs,stats:results.map(r=>r.stats)});
    // Peers can stop at different frames. Only buffered mode can advance the
    // shorter peer to a shared boundary using the known scripted inputs.
    if(maxRollback===0){
      // Move both deterministically to a common future field after stopping.
      // This is not a production reset: test inputs are reproducible by frame.
      const target=Math.max(...results.map(r=>r.frame));
      for(let i=0;i<2;i++)await pages[i].evaluate(async({target,base})=>{
        const pad=(f,seat)=>f<3?[0,0,0,0,0,0,0]:[f%13===0?4:f%9===0?1:0,(f%24<12?.63:-.63)*(seat===0?1:-1),0,0,0,0,0];
        while(melee.rollback.frame<target){const f=melee.rollback.frame-base;await melee.rollback.step([pad(f,0),pad(f,1),[0,0,0,0,0,0,0],[0,0,0,0,0,0,0]]);}
      },{target,base:results[i].baseFrame});
      const states=await Promise.all(pages.map(p=>p.evaluate(()=>melee.rollback.inspect())));
      assert.equal(states[0].hash,states[1].hash,'Buffered shutdown did not reconcile to the shared boundary');
    }
  }
}finally{
  ending=true;for(const timer of timers)clearTimeout(timer);
  report.events=events;await writeFile(`${directory}/results.json`,JSON.stringify(report,null,2));
  await browser.close();
}
