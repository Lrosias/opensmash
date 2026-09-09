import test from 'node:test';import assert from 'node:assert/strict';import {FrameClock} from '../src/frame-clock.mjs';
for(const hz of [30,50,60,90,120,144])test(`60 Hz simulation stays consistent on ${hz} Hz displays`,()=>{
 const clock=new FrameClock();let ticks=0;for(let n=0;n<=hz*10;n++)ticks+=clock.advance(n*1000/hz);assert.equal(ticks,601);
});
test('late frames have bounded catch-up and hidden time is discarded',()=>{
 const clock=new FrameClock();clock.advance(0);assert.equal(clock.advance(200),2);assert.equal(clock.advance(1200),1);
 clock.reset();assert.equal(clock.advance(50000),1);assert.equal(clock.advance(50001),0);
});

test('offline driver pauses while hidden, resets on resume, and cancels on disposal',async()=>{
 const {startOfflineClock}=await import('../src/frame-clock.mjs');
 let callback,visibility,ticks=0,cancelled=false;
 const doc={hidden:false,addEventListener(_,fn){visibility=fn;},removeEventListener(_,fn){assert.equal(fn,visibility);visibility=null;}};
 const stop=startOfflineClock(()=>ticks++,{doc,raf:fn=>{callback=fn;return 7;},cancel:id=>{assert.equal(id,7);cancelled=true;}});
 callback(0);callback(1000/60);assert.equal(ticks,2);
 doc.hidden=true;visibility();callback(500);assert.equal(ticks,2);
 doc.hidden=false;visibility();callback(10000);assert.equal(ticks,3);
 stop();callback(11000);assert.equal(ticks,3);assert.equal(visibility,null);assert.ok(cancelled);
});

test('rounded 120 Hz timestamps keep each simulation frame on two refreshes',()=>{
 const clock=new FrameClock();let ticks=0;
 for(let n=0;n<=1200;n++){
  const count=clock.advance(Math.round((n*1000/120+(n%3-1)*.4)*10)/10);
  assert.equal(count,n%2===0?1:0,`refresh ${n}`);ticks+=count;
 }
 assert.equal(ticks,601);
});
