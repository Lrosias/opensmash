import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {RollbackDuelSession,MAX_ROLLBACK} from '../src/rollback-session.mjs';

// Exercise the actual published SDK algorithm with a manually driven clock.
// Set YOUGAME_SDK_PATH to a downloaded https://yougame.co/sdk.js (no network
// or copied/reimplemented prediction algorithm inside the test).
const sdkPath=process.env.YOUGAME_SDK_PATH;
function setup({lag=4,loseEvery=0,attach=true}={}){
 const sdk=readFileSync(sdkPath,'utf8'),loops=[],network=[],sessions=[],reports=[[],[]],errors=[];
 let now=0;
 const source=sdk.slice(sdk.indexOf('  function canon('),sdk.indexOf('  // A hidden tab'))+
  sdk.slice(sdk.indexOf('  function matchConnectionIds(')>=0?sdk.indexOf('  function matchConnectionIds('):sdk.indexOf('  function makeSync('),sdk.indexOf('  /* ---------- host-authoritative kit:'));
 assert.ok(source.includes('function makeSync'));
 const makeSync=vm.runInNewContext(source+'; makeSync',{window:{console},console,Date,performance,
  fixedStep(o){let active=false;const tick=()=>{if(active)o.update();};loops.push(tick);return {start(){active=true;},stop(){active=false;}};}});
 const events=[new Map(),new Map()],engines=[];
 const rooms=[0,1].map(i=>({me:'p'+i,players:[{id:'p0'},{id:'p1'}],playing:true,seed:'test-seed',
  on(e,h){if(!events[i].has(e))events[i].set(e,new Set());events[i].get(e).add(h);},
  off(e,h){events[i].get(e)?.delete(h);},
  rollback(o){return makeSync(this,o,true);},
  send(data){if(data._ls&&loseEvery&&data.f%loseEvery===0)return;network.push({at:now+(data._ls?lag+(data.f%3):0),to:1-i,from:'p'+i,data:structuredClone(data)});},
  finish(r){reports[i].push(r);return Promise.resolve(r);}
 }));
 const deliver=()=>{for(let i=0;i<network.length;){const e=network[i];if(e.at>now){i++;continue;}network.splice(i,1);
  if(e.data._ls)rooms[e.to]._sync?.receive(e.from,e.data);else for(const fn of events[e.to].get('message')||[])fn(e);}};
 for(let i=0;i<2;i++){
  let s={frame:0,x:0};const history=new Map();
  const engine={history,save(){history.set(s.frame,structuredClone(s));return structuredClone(s);},load(v){s=structuredClone(v);},
   step(pads){s.x+=pads[0][1]-pads[1][1];s.frame++;return [s.x>>>0,-1,3,3,s.frame];}};
  engines.push(engine);
  const session=new RollbackDuelSession({room:rooms[i],round:1,fighter:i,build:'same',seed:'test-seed',
   readInput:()=>[0,(now%11<5?1:-1)*(i+1),0],launch:(_,s)=>{if(attach)s.attach(engine);},status(){},stop:e=>errors.push(e)});
  clearInterval(session.timer);sessions.push(session);
 }
 for(let n=0;n<3;n++){deliver();for(const s of sessions){s.lastHello=0;s.pulse();}}
 const tick=()=>{now++;for(const l of loops)l();deliver();};
 return{sessions,rooms,engines,reports,errors,tick,close:()=>sessions.forEach(s=>s.destroy())};
}

test('YouGame SDK rewinds late inputs and converges through jitter and lost bundles',{skip:!sdkPath},()=>{
 const p=setup({lag:5,loseEvery:7});try{
  for(let n=0;n<240;n++)p.tick();
  assert.deepEqual(p.errors,[]);assert.ok(p.sessions.every(s=>s.sync.rollbacks>0));
  const confirmed=Math.min(...p.sessions.map(s=>s.frame))-MAX_ROLLBACK-3;
  assert.ok(confirmed>100);assert.deepEqual(p.engines[0].history.get(confirmed),p.engines[1].history.get(confirmed));
  assert.ok(p.sessions.every(s=>!s.sync.desynced));assert.deepEqual(p.reports,[[],[]]);
 }finally{p.close();}
});

test('speculative KO can be undone without submitting a ranked result',{skip:!sdkPath},async()=>{
 const p=setup({lag:0});try{
  const s=p.sessions[0];s.sync.stop();s.frame=0;
  const before=s.save();s.engine.step=()=>[7,0,3,0,1];s.step(0,{});assert.ok(s.terminal);
  s.load(before);assert.equal(s.terminal,null);assert.deepEqual(p.reports,[[],[]]);
  s.step(0,{});for(let f=1;f<=MAX_ROLLBACK+2;f++)s.step(f,{});
  await Promise.resolve();assert.equal(p.reports[0].length,0);
  s.step(MAX_ROLLBACK+3,{});await Promise.resolve();assert.equal(p.reports[0].length,1);
 }finally{p.close();}
});

test('a runtime failure stops both timelines and voids the round, never a forfeit',{skip:!sdkPath},async()=>{
 const p=setup({lag:0});try{
  p.engines[0].step=()=>{throw new Error('Native checkpoint failure');};
  for(let n=0;n<5;n++)p.tick();
  await Promise.resolve();await Promise.resolve();
  assert.ok(p.sessions.every(s=>s.closed));
  assert.deepEqual(p.reports,[[{void:true}],[{void:true}]]);
  assert.ok(p.errors.some(e=>e.includes('Native checkpoint failure')));
 }finally{p.close();}
});

test('delayed bundles from a previous game or round cannot change a live SDK timeline',{skip:!sdkPath},()=>{
 const p=setup({lag:3});try{
  for(let n=0;n<100;n++)p.tick();const s=p.sessions[0],before=s.frame;
  // These frame numbers overlap the new timeline but belong to older scopes.
  for(const scope of [[s.profile.protocol,1,0],[s.profile.protocol,0,1],['other-edition',1,1]])s.sync.receive('p1',{_ls:1,f:before+2,in:Array(8).fill([32768,80,80]),os:scope});
  for(let n=0;n<100;n++)p.tick();assert.deepEqual(p.errors,[]);assert.equal(s.sync.desynced,false);const f=Math.min(...p.sessions.map(s=>s.frame))-MAX_ROLLBACK-3;assert.deepEqual(p.engines[0].history.get(f),p.engines[1].history.get(f));
 }finally{p.close();}
});


test('native loading failure after platform Ready voids both peers before simulation starts',{skip:!sdkPath},async()=>{
 const p=setup({lag:0,attach:false});try{
  assert.ok(p.sessions.every(s=>!s.started));
  p.sessions[0].fail('Engine asset could not load');
  for(let n=0;n<3;n++)p.tick();
  await Promise.resolve();await Promise.resolve();
  assert.ok(p.sessions.every(s=>s.closed));
  assert.deepEqual(p.reports,[[{void:true}],[{void:true}]]);
  assert.ok(p.errors.includes('Engine asset could not load'));
 }finally{p.close();}
});
