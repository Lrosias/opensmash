import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalEnginePause} from '../src/local-engine-pause.mjs';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function fixture(options={}) {
  const events=[],errors=[];
  const controller=createLocalEnginePause({ready:Promise.resolve(),
    loader:()=>({pauseBackground:async()=>events.push('assets-pause'),resumeBackground:()=>events.push('assets-resume')}),
    audio:()=>({suspend:async()=>events.push('audio-pause'),resume:async()=>events.push('audio-resume')}),
    setPaused:async paused=>events.push(paused?'pause':'resume'),resetFrames:()=>events.push('frames-reset'),
    onError:error=>errors.push(error),...options});
  return {controller,events,errors};
}
test('online boot waits for native pause; overlapping engines keep the local engine paused',async()=>{
  const ack=deferred(),{controller,events}=fixture({setPaused:async p=>{events.push(p?'pause':'resume');if(p)await ack.promise;}});
  let acquired=false;const first=controller.acquire().then(release=>{acquired=true;return release;});
  await tick();assert.equal(controller.blocked,true);assert.equal(acquired,false);
  ack.resolve();const release=await first,release2=await controller.acquire();
  release();release();await tick();assert.equal(controller.blocked,true);
  release2();await tick();assert.equal(controller.blocked,false);
  assert.deepEqual(events,['assets-pause','pause','audio-pause','resume','frames-reset','assets-resume','audio-resume']);
});
test('cancel during native pause resumes after the acknowledgement, without leaking a lease',async()=>{
  const ack=deferred(),abort=new AbortController();
  const {controller,events}=fixture({setPaused:async p=>{events.push(p?'pause':'resume');if(p)await ack.promise;}});
  const result=assert.rejects(controller.acquire(abort.signal),{name:'AbortError'});
  await tick();abort.abort();ack.resolve();await result;await tick();
  assert.equal(controller.blocked,false);assert.equal(events.filter(x=>x==='resume').length,1);
});
test('cancelled boot does not resume underneath its replacement',async()=>{
  const ack=deferred(),abort=new AbortController();
  const {controller,events}=fixture({setPaused:async p=>{events.push(p?'pause':'resume');if(p)await ack.promise;}});
  const old=assert.rejects(controller.acquire(abort.signal));await tick();
  const next=controller.acquire();await tick();abort.abort();ack.resolve();await old;
  const release=await next;await tick();assert.equal(events.includes('resume'),false);
  release();await tick();assert.equal(controller.blocked,false);
});
test('waiting for local boot can be cancelled without pausing or waiting for boot',async()=>{
  const boot=deferred(),abort=new AbortController(),{controller,events}=fixture({ready:boot.promise});
  const result=assert.rejects(controller.acquire(abort.signal),{name:'AbortError'});
  abort.abort();await result;assert.deepEqual(events,[]);boot.resolve();await tick();assert.deepEqual(events,[]);
});
test('native pause failure unwinds assets and permits another attempt',async()=>{
  let fail=true;
  const {controller,events}=fixture({setPaused:async paused=>{if(paused&&fail){fail=false;throw Error('pause failed');}}});
  await assert.rejects(controller.acquire(),/pause failed/);await tick();
  assert.equal(controller.blocked,false);assert.ok(events.includes('assets-resume'));
  const release=await controller.acquire();release();await tick();assert.equal(controller.blocked,false);
});
test('a second acquisition retries a failed pause rather than treating a requested pause as complete',async()=>{
  const ack=deferred();let attempts=0;
  const {controller}=fixture({setPaused:async paused=>{if(paused&&++attempts===1)await ack.promise;}});
  const first=assert.rejects(controller.acquire(),/failed/);await tick();
  const second=controller.acquire();await tick();ack.reject(Error('failed'));
  await first;const release=await second;
  assert.equal(attempts,2);assert.equal(controller.blocked,true);
  release();await tick();assert.equal(controller.blocked,false);
});
