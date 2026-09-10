import test from 'node:test';
import assert from 'node:assert/strict';
import {CompetitiveSet,STAGES,rankPresentation} from '../src/competitive-rules.mjs';
import {MeleeCompetitiveRoom} from '../src/competitive-room.mjs';
const pick=(fighter=2)=>({type:'character',selection:{fighter,color:0}});
function selected(mode='ranked',bag=null){const m=new CompetitiveSet({mode,seed:57,bag});m.apply(0,pick());m.apply(1,pick(20));return m;}
function launch(m){while(m.state.phase==='striking')m.apply(m.actor,{type:'stage',stage:m.legalStages()[0].id});m.apply(0,{type:'ready'});m.apply(1,{type:'ready'});}
function result(m,winner){m.recordConfirmed({game:m.state.game,winner,frame:300,checksum:`hash-${m.state.game}`});}
function next(m){m.apply(0,{type:'continue'});m.apply(1,{type:'continue'});}

test('ranked uses 1–2–1 starter strikes and rejects wrong turns and Stadium',()=>{
  const m=selected();assert.equal(m.state.phase,'striking');
  assert.throws(()=>m.apply(1,{type:'stage',stage:31}),/other player/);
  assert.throws(()=>m.apply(0,{type:'stage',stage:3}),/cannot/);
  const turns=[];while(m.state.phase==='striking'){turns.push(m.actor);m.apply(m.actor,{type:'stage',stage:m.legalStages()[0].id});}
  assert.deepEqual(turns,[0,1,1,0]);assert.equal(m.state.phase,'ready');assert.equal(m.state.struck.length,4);
  assert.equal(m.launch.rules.stocks,4);assert.equal(m.launch.rules.seconds,480);assert.equal(m.launch.rules.frozenStadium,false);
});
test('BO3 counterpick order and last-win DSR hold until one player wins twice',()=>{
  const m=selected();launch(m);const first=m.state.stage;result(m,0);next(m);
  assert.equal(m.state.phase,'ban');assert.equal(m.actor,0);
  m.apply(0,{type:'stage',stage:31});assert.equal(m.actor,1);
  m.apply(1,{type:'stage',stage:3});assert.equal(m.state.phase,'winner-character');
  assert.throws(()=>m.apply(1,pick(9)),/other player/);
  m.apply(0,pick(9));m.apply(1,pick(19));launch(m);result(m,1);next(m);
  assert.equal(m.state.phase,'ban');assert.equal(m.actor,1);
  assert.equal(m.legalStages().some(t=>t.id===first),false);
  m.apply(1,{type:'stage',stage:31});assert.throws(()=>m.apply(0,{type:'stage',stage:first}),/cannot/);
  m.apply(0,{type:'stage',stage:32});m.apply(1,pick(20));m.apply(0,pick(2));launch(m);result(m,0);
  assert.equal(m.state.phase,'complete');assert.deepEqual(m.state.scores,[2,1]);assert.equal(m.state.history.length,3);
  assert.throws(()=>result(m,0),/Invalid/);
});
test('a tied ranked game retains stage and fighters without awarding counterpick advantage',()=>{
  const m=selected();launch(m);const config=m.launch;result(m,null);next(m);
  assert.equal(m.state.phase,'ready');assert.equal(m.state.stage,config.stage);assert.deepEqual(m.state.selections,config.selections);assert.deepEqual(m.state.scores,[0,0]);
});
test('casual shuffled stage bags agree and do not repeat across six rematches',()=>{
  const stages=[];let bag=null;
  for(let i=0;i<12;i++){
    const a=selected('casual',bag),b=selected('casual',bag);assert.equal(a.state.stage,b.state.stage);
    stages.push(a.state.stage);bag=a.snapshot.bag;launch(a);result(a,0);assert.equal(a.state.phase,'complete');
  }
  assert.equal(new Set(stages.slice(0,6)).size,STAGES.length);assert.equal(new Set(stages.slice(6)).size,STAGES.length);
});
test('locked fighters, mirror colors and platform rank data have explicit boundaries',()=>{
  const m=new CompetitiveSet();m.apply(0,pick(18));assert.throws(()=>m.apply(0,pick(2)),/locked/);m.apply(1,pick(19));assert.equal(m.state.selections[1].color,1);
  assert.equal(rankPresentation({ranked:false,myRating:{after:1800}}),null);
  assert.equal(rankPresentation({ranked:true,void:true,myRating:{after:1800}}),null);
  assert.equal(rankPresentation({ranked:true,myRating:{rank:{placed:false}}}).label,'Placement sets');
  assert.deepEqual(rankPresentation({ranked:true,myRating:{before:1110,after:1124,rank:{placed:true,label:'Gold IV'}}}),{label:'Gold IV',detail:'1124 rating · +14',delta:14});
});

const flush=async()=>{for(let i=0;i<8;i++)await new Promise(r=>setImmediate(r));};
function pair({differentResult=false,ranked=true}={}){
  const rooms=[],sessions=[],errors=[],finishes=[[],[]],pending=[[],[]],stopped=[0,0],wire=[];
  for(let i=0;i<2;i++){
    const handlers=new Map();
    rooms.push({me:['a','b'][i],players:[{id:'a',name:'Alice'},{id:'b',name:'Bob'}],round:1,seed:77,ranked,queue:ranked?'ranked':'casual',
      on:(e,f)=>{if(!handlers.has(e))handlers.set(e,new Set());handlers.get(e).add(f);},off:(e,f)=>handlers.get(e)?.delete(f),
      emit:(e,data)=>{for(const f of handlers.get(e)??[])f(data);},
      send:data=>{wire.push({from:i,data:structuredClone(data)});queueMicrotask(()=>rooms[1-i].emit('message',{from:['a','b'][i],data:structuredClone(data)}));},
      finish:async data=>{finishes[i].push(data);return data;}});
  }
  for(let i=0;i<2;i++)sessions.push(new MeleeCompetitiveRoom({room:rooms[i],build:'same-build',selection:{fighter:i?20:2,color:0},
    adapter:{prepare:async()=>{},play:async config=>new Promise(resolve=>pending[i].push(winner=>resolve({confirmed:true,winner,frame:300,checksum:differentResult?`peer-${i}`:`game-${config.game}`}))),stop:()=>stopped[i]++},
    onError:e=>errors.push(e.message)}));
  return {rooms,sessions,errors,finishes,pending,stopped,wire,stop:()=>sessions.forEach(s=>s.stop())};
}
async function stageToPlay(p){
  await flush();
  while(p.sessions[0].model.state.phase==='striking'){
    const m=p.sessions[0].model;p.sessions[m.actor].action({type:'stage',stage:m.legalStages()[0].id});await flush();
  }
  assert.ok(p.sessions.every(s=>s.model.state.phase==='playing'));
}
test('two room clients run one BO3 and submit exactly one matching platform result',async()=>{
  const p=pair();try{
    await stageToPlay(p);p.pending.forEach(q=>q.shift()(0));await flush();
    assert.deepEqual(p.finishes,[[],[]]);assert.deepEqual(p.sessions[0].model.snapshot,p.sessions[1].model.snapshot);
    p.sessions.forEach(s=>s.action({type:'continue'}));await flush();
    p.sessions[0].action({type:'stage',stage:31});await flush();p.sessions[1].action({type:'stage',stage:3});await flush();
    p.sessions[0].action(pick(9));await flush();p.sessions[1].action(pick(19));await flush();
    assert.ok(p.sessions.every(s=>s.model.state.phase==='playing'));
    p.pending.forEach(q=>q.shift()(0));await flush();
    assert.deepEqual(p.errors,[]);assert.equal(p.finishes[0].length,1);assert.deepEqual(p.finishes[0],p.finishes[1]);
    assert.deepEqual(p.finishes[0][0],{winner:'a',scores:{a:2,b:0}});
    const last=p.wire.findLast(e=>e.data.kind==='game-result');p.rooms[1].emit('message',{from:'a',data:last.data});await flush();assert.equal(p.finishes[1].length,1);
  }finally{p.stop();}
});
test('conflicting confirmed results abort and never manufacture a ranked win',async()=>{
  const p=pair({differentResult:true});try{await stageToPlay(p);p.pending.forEach(q=>q.shift()(0));await flush();assert.ok(p.errors.some(s=>/disagree/.test(s)));assert.deepEqual(p.finishes,[[{void:true}],[{void:true}]]);assert.ok(p.stopped.every(n=>n===1));}finally{p.stop();}
});
test('wrong-round and unauthenticated menu actions are ignored; disconnect stops engines',async()=>{
  const p=pair();try{
    await flush();const before=p.sessions[0].model.snapshot;
    const d={p:before.protocol,round:1,kind:'request',data:{id:1,game:1,phase:'striking',action:{type:'stage',stage:31}}};
    p.rooms[0].emit('message',{from:'intruder',data:d});p.rooms[0].emit('message',{from:'b',data:{...d,round:99}});
    assert.deepEqual(p.sessions[0].model.snapshot,before);p.rooms[0].emit('leave',{id:'b'});assert.equal(p.stopped[0],1);
    await flush();assert.deepEqual(p.finishes,[[{void:true}],[{void:true}]]);
  }finally{p.stop();}
});
