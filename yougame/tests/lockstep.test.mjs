import test from 'node:test';
import assert from 'node:assert/strict';
import {Lockstep,validPad,LEAD} from '../src/lockstep.mjs';
test('both engines replay exactly the same inputs across delayed relay batches',()=>{
 const host=new Lockstep(true,0),guest=new Lockstep(false,1);const h=[],g=[],pending=[];
 for(let pulse=0;pulse<400;pulse++){
  host.sample(()=>[pulse%2?0x8000:0,80,0]);
  pending.push(guest.sample(()=>[pulse%3?8:0,-80,20]));
  if(pulse%3===0)while(pending.length)host.receiveInputs(1,pending.shift());
  guest.receiveFrames(host.commit());
  for(let n=0;n<2;n++){const a=host.take(),b=guest.take();if(a)h.push(a);if(b)g.push(b);}
 }
 assert.ok(h.length>200);assert.deepEqual(h,g);assert.equal(host.tick,guest.tick);
});
test('missing input stalls and buffers remain bounded',()=>{
 const h=new Lockstep(true,0);for(let i=0;i<1000;i++){h.sample(()=>[0,0,0]);assert.deepEqual(h.commit(),[]);assert.equal(h.take(),null);}
 assert.equal(h.sampleTick,LEAD);assert.equal(h.inputs[0].size,LEAD);
});
test('guest rejects altered input and out-of-order authoritative frames',()=>{
 const g=new Lockstep(false,1);g.sample(()=>[8,0,80]);
 assert.throws(()=>g.receiveFrames([[0,[0,0,0],[0,0,0]]]),/changed/);
 assert.throws(()=>g.receiveFrames([[1,[0,0,0],[8,0,80]]]),/Invalid/);
});
test('untrusted inputs cannot pause, exceed N64 ranges, or grow the queue',()=>{
 for(const p of [[0x1000,0,0],[0,81,0],[0,0,Infinity],[NaN,0,0],{},[0]])assert.equal(validPad(p),false);
 const h=new Lockstep(true,0);
 assert.throws(()=>h.receiveInputs(1,[[100000,[0,0,0]]]),/Invalid/);
 assert.throws(()=>h.receiveInputs(0,[[0,[0,0,0]]]),/Invalid/);
});
test('rematch instances start a clean timeline',()=>{
 const h=new Lockstep(true,0);h.sample(()=>[8,0,0]);
 const next=new Lockstep(true,0);assert.equal(next.tick,0);assert.equal(next.sampleTick,0);assert.equal(next.take(),null);
});
