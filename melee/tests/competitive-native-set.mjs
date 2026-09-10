// Production set/engine adapters + actual deployed SDK controller, with a local
// deterministic transport fixture. Hosted identity/rating acceptance is separate.
import {createRequire} from 'node:module';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const sdk=await readFile(process.env.YOUGAME_SDK_PATH,'utf8');
const asyncSDK=sdk.slice(sdk.indexOf('  function canon('),sdk.indexOf('  // A hidden tab'))+
  sdk.slice(sdk.indexOf('  function makeAsyncRollback('),sdk.indexOf('  /* ---------- host-authoritative kit:'));
const base=process.env.MELEE_URL||'http://127.0.0.1:8291/';
const output=process.env.MELEE_RESULTS||'melee/test-results/native-set';await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--autoplay-policy=no-user-gesture-required','--disable-background-timer-throttling','--disable-renderer-backgrounding']});
const pages=[],errors=[],reports=[[],[]];let packet=0;
const html=`<!doctype html><style>body{margin:0}.native-match{position:fixed;inset:0;width:100%;height:100%;border:0}</style><script>${asyncSDK};window.makeAsync=makeAsyncRollback;</script><script type="module">
import {MeleeCompetitiveRoom} from './competitive-room.mjs';
import {MeleeMatchAdapter} from './competitive-adapter.mjs';
import {createNativeMatch} from './native-match.mjs';
window.setup=async seat=>{
 const handlers=new Map(),players=[{id:'a',name:'Ada'},{id:'b',name:'Bo'}];
 const manifest=await(await fetch('./engine/wasm.json')).json();
 const room=window.testRoom={me:players[seat].id,players,round:1,seed:77,ranked:true,queue:'ranked',playing:true,
 on(e,f){if(!handlers.has(e))handlers.set(e,new Set());handlers.get(e).add(f);},off(e,f){handlers.get(e)?.delete(f);},
 send(data){window.sendPacket(data);},finish:async result=>{window.reportResult(result);return result;},
 rollbackAsync(o){return makeAsync(this,o);}};
 window.receivePacket=(from,data)=>{if(data._ra)room._sync?.receive(from,data);else for(const f of handlers.get('message')??[])f({from,data});};
 window.matchErrors=[];window.launches=[];
 const adapter=window.nativeAdapter=new MeleeMatchAdapter({room,build:manifest.sha256,input:()=>[0,seat?1:0,0,0,0,0,0],
 createEngine:async launch=>{const engine=await createNativeMatch(launch);window.launches.push({launch,initial:engine.initial});return engine;}});
 window.series=new MeleeCompetitiveRoom({room,build:manifest.sha256,selection:{fighter:seat?20:2,color:0},adapter,
 onError:e=>window.matchErrors.push(e.message)});
};</script>`;
try {
  for(let i=0;i<2;i++){
    const context=await browser.newContext({viewport:{width:960,height:720}}),page=await context.newPage();pages.push(page);
    page.on('pageerror',e=>errors.push({seat:i,error:e.message}));
    await page.exposeFunction('sendPacket',data=>{
      if(data._ra&&++packet%13===0)return;
      setTimeout(()=>pages[1-i]?.evaluate(({from,data})=>window.receivePacket?.(from,data),{from:['a','b'][i],data}).catch(e=>errors.push({seat:i,error:e.message})),data._ra?(i?30:8):0);
    });
    await page.exposeFunction('reportResult',result=>reports[i].push(result));
    await page.route('**/__native-set-test.html',route=>route.fulfill({body:html,contentType:'text/html'}));
    await page.goto(new URL('__native-set-test.html',base).href);await page.waitForFunction(()=>window.setup);
  }
  await Promise.all(pages.map((p,i)=>p.evaluate(i=>setup(i),i)));
  const snapshot=()=>pages[0].evaluate(()=>series.model?.snapshot);
  const waitPhase=async phase=>{
    await Promise.all(pages.map(p=>p.waitForFunction(phase=>series.model?.state.phase===phase||matchErrors.length,phase,{timeout:240000})));
    for(const p of pages)assert.deepEqual(await p.evaluate(()=>matchErrors),[]);
  };
  await waitPhase('striking');
  for(const stage of [31,32,28,8]){
    const seat=await pages[0].evaluate(()=>series.model.actor);
    await pages[seat].evaluate(stage=>series.action({type:'stage',stage}),stage);
    await pages[0].waitForFunction(stage=>series.model.state.struck.includes(stage),stage);
  }
  await waitPhase('playing');
  await pages[0].screenshot({path:output+'/game-one.png'});
  console.log('Native game one started');
  await waitPhase('game-result');console.log('Native game one confirmed');
  assert.deepEqual((await snapshot()).scores,[1,0]);
  await Promise.all(pages.map(p=>p.evaluate(()=>series.action({type:'continue'}))));await waitPhase('ban');
  await pages[0].evaluate(()=>series.action({type:'stage',stage:31}));await waitPhase('counterpick');
  await pages[1].evaluate(()=>series.action({type:'stage',stage:32}));await waitPhase('winner-character');
  await pages[0].evaluate(()=>series.action({type:'character',selection:{fighter:9,color:0}}));await waitPhase('loser-character');
  await pages[1].evaluate(()=>series.action({type:'character',selection:{fighter:23,color:0}}));await waitPhase('playing');
  console.log('Native counterpick game started');await waitPhase('complete');
  await pages[0].waitForTimeout(100);
  assert.deepEqual(reports,[[{winner:'a',scores:{a:2,b:0}}],[{winner:'a',scores:{a:2,b:0}}]]);
  const states=await Promise.all(pages.map(p=>p.evaluate(()=>({set:series.model.snapshot,launches}))));
  assert.deepEqual(states[0].set,states[1].set);
  for(const state of states)for(const {initial} of state.launches){assert.deepEqual(initial.match.stocks,[4,4]);assert.ok(initial.match.seconds>=479&&initial.match.seconds<=480);}
  assert.deepEqual(errors,[]);
  await writeFile(output+'/verification.json',JSON.stringify({scope:'Native BO3 with actual SDK async controller; local transport fixture, no hosted ratings',reports,states,errors},null,2));
  console.log('Native Melee set integration passed');
} finally {
  for(const p of pages)await p.evaluate(()=>window.series?.stop()).catch(()=>{});
  await writeFile(output+'/errors.json',JSON.stringify(errors,null,2));await browser.close();
}
