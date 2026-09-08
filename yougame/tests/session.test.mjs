import test from 'node:test';
import assert from 'node:assert/strict';
import {DuelSession} from '../src/session.mjs';
import {PROTOCOL} from '../src/lockstep.mjs';
function setup(){
 const queue=[],reports=[[],[]],failures=[],sessions=[];
 const handlers=[new Map(),new Map()];
 const rooms=[0,1].map(i=>({me:`p${i}`,isHost:i===0,players:[{id:'p0'},{id:'p1'}],
  on(e,h){handlers[i].set(e,h);},off(e){handlers[i].delete(e);},
  send(data){queue.push([1-i,{from:`p${i}`,data:structuredClone(data)}]);},
  finish(r){reports[i].push(r);return Promise.resolve(r);}
 }));
 const flush=()=>{while(queue.length){const [i,e]=queue.shift();handlers[i].get('message')?.(e);}};
 for(let i=0;i<2;i++){
  const s=new DuelSession({room:rooms[i],round:1,fighter:i,build:'test',readInput:()=>[8,i*80,0],
   launch:(_,s)=>{s.engineReady=true;},status:()=>{},stop:m=>failures.push(m)});
  clearInterval(s.timer);sessions.push(s);
 }
 return{queue,reports,failures,sessions,flush,close:()=>sessions.forEach(s=>s.destroy())};
}
test('real session protocol boots both seats, confirms equal results exactly once',()=>{
 const p=setup();try{
  p.flush();
  for(let n=0;n<50;n++){
   p.sessions.forEach(s=>s.pulse());p.flush();
   p.sessions.forEach(s=>{for(let i=0;i<2;i++)if(s.beforeTick())s.afterTick(42,s.line.tick===24?0:-1,3,0,s.line.tick);});p.flush();
  }
  assert.deepEqual(p.failures,[]);assert.equal(p.reports[0].length,1);assert.deepEqual(p.reports[0],p.reports[1]);assert.equal(p.reports[0][0].winner,'p0');
 }finally{p.close();}
});
test('divergent state aborts without submitting a rating result',()=>{
 const p=setup();try{
  p.flush();
  for(let n=0;n<80;n++){
   p.sessions.forEach(s=>s.pulse());p.flush();
   p.sessions.forEach((s,j)=>{for(let i=0;i<2;i++)if(s.beforeTick())s.afterTick(j+100,-1,3,3,s.line.tick);});p.flush();
  }
  assert.ok(p.failures.some(m=>m.includes('diverged')));assert.deepEqual(p.reports,[[],[]]);
 }finally{p.close();}
});
test('old-round and unknown-sender messages cannot change the timeline',()=>{
 const p=setup();try{
  p.queue.push([0,{from:'intruder',data:{p:PROTOCOL,round:1,type:'abort'}}]);
  p.queue.push([0,{from:'p1',data:{p:PROTOCOL,round:0,type:'abort'}}]);p.flush();assert.deepEqual(p.failures,[]);
 }finally{p.close();}
});
