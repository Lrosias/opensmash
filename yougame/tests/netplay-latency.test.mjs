import test from 'node:test';
import assert from 'node:assert/strict';

test('production SDK automatic lockstep buffering prevents sustained moderate-latency slowdown', {skip:!process.env.YOUGAME_SDK_PATH},async()=>{
 const {measure}=await import('./netplay-latency.mjs');
 for(const latency of [100,160]){
  const fixed=measure({delay:2,latency}),adaptive=measure({delay:'auto',latency});
  assert.ok(fixed.simFps.every(f=>f<45));
  assert.ok(adaptive.simFps.every(f=>f>59));
  assert.ok(adaptive.presentationOpportunitiesFps.every(f=>f>59));
  assert.equal(adaptive.agreement,true);
 }
});
test('automatic buffering keeps fast links responsive and agrees through delivery jitter', {skip:!process.env.YOUGAME_SDK_PATH},async()=>{
 const {measure}=await import('./netplay-latency.mjs');
 const fast=measure({delay:'auto',latency:0});assert.deepEqual(fast.actualDelay,[2,2]);assert.ok(fast.simFps.every(f=>f>59));
 const jitter=measure({delay:'auto',latency:100,jitter:20});assert.equal(jitter.agreement,true);assert.ok(jitter.simFps.every(f=>f>59));
});
