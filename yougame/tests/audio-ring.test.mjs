import test from 'node:test';import assert from 'node:assert/strict';import {AudioRing,createAudioRing,C} from '../src/audio-ring.mjs';
function pair(capacity=1024){const b=createAudioRing(capacity);return [new AudioRing(b),new AudioRing(b)];}
test('stereo PCM is consumed in order and buffering is bounded',()=>{
 const [p,c]=pair(8);const pcm=new Int16Array(20);for(let i=0;i<10;i++){pcm[i*2]=i*1000;pcm[i*2+1]=-i*1000;}
 assert.equal(p.push(pcm),8);assert.equal(p.buffered(),8);assert.equal(p.push(pcm),0);
 const l=new Float32Array(4),r=new Float32Array(4);c.render(l,r,48000);
 for(let i=0;i<4;i++){assert.equal(l[i],i*1000/32768);assert.equal(r[i],(-i*1000/32768)||0);}assert.equal(p.buffered(),4);
});
test('rollback flush skips old audio and retains newly submitted samples',()=>{
 const [p,c]=pair(16);p.push(new Int16Array(16).fill(1000));p.flush();p.push(new Int16Array(12).fill(2000));
 const l=new Float32Array(4),r=new Float32Array(4);c.render(l,r,44100);assert.ok(l.every(v=>v===2000/32768));assert.equal(p.buffered(),2);
});
test('resampling maintains duration and underflow produces silence',()=>{
 const [p,c]=pair(8192);Atomics.store(p.control,C.RATE,32000);p.push(new Int16Array(6400).fill(8192));
 const l=new Float32Array(2400),r=new Float32Array(2400);c.render(l,r,48000);assert.ok(l.every(v=>v===.25));assert.ok(Math.abs(p.buffered()-1600)<=1);
 p.flush();c.render(l,r,48000);assert.ok(l.every(v=>v===0));
});
test('counters wrap safely during long sessions, including flush',()=>{
 const [p,c]=pair(16);Atomics.store(p.control,C.WRITE,-4);Atomics.store(p.control,C.READ,-4);p.push(new Int16Array(16).fill(5000));
 const l=new Float32Array(4),r=new Float32Array(4);c.render(l,r,48000);assert.ok(l.every(v=>v===5000/32768));assert.equal(p.buffered(),4);
 p.flush();c.render(l,r,48000);assert.equal(p.buffered(),0);assert.ok(l.every(v=>v===0));
});
