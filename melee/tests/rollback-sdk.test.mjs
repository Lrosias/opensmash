import test from 'node:test';
import assert from 'node:assert/strict';
import {createMeleeSync} from '../src/rollback-sdk.mjs';
import {neutralPad} from '../src/rollback-engine.mjs';

function fixture(){
  const handlers=new Map(),calls=[];let options;
  const room={players:[{id:'host'},{id:'guest'}],me:'guest',round:2,
    rollbackAsync:o=>{options=o;return {on:(ev,fn)=>handlers.set(ev,fn),start(){},async stop(){}};}};
  const engine={active:true,frame:471,closed:false,pending:false,
    async checkpointStats(){return {count:0};},async manageCheckpoints(){calls.push('manage');},
    async save(){return {handle:9,frame:this.frame};},async load(t){this.frame=t.frame;},
    async discard(t){calls.push(['discard',t.handle]);},
    async step(pads,metadata){calls.push({pads,metadata});return {hash:123,frame:++this.frame};}};
  return {room,engine,handlers,calls,get options(){return options;}};
}
test('SDK bridge maps ordered seats, base frame, opaque ownership and completed checksum',async()=>{
  const f=fixture(),errors=[];
  const session=await createMeleeSync({...f,input:neutralPad,maxRollback:7,onError:e=>errors.push(e)});
  const o=f.options;assert.equal(o.neutral.length,7);assert.equal(o.round,2);
  const token=await o.save(0),pad=[1,.5,0,0,0,0,0];
  assert.equal(session.checkpoints,1);
  assert.deepEqual(await o.step(0,{guest:pad,host:neutralPad()},{replaying:true}),{checksum:123,engineFrame:472});
  assert.deepEqual(f.calls.at(-1),{pads:[neutralPad(),pad,neutralPad(),neutralPad()],metadata:{replaying:true}});
  await o.load(token);assert.equal(f.engine.frame,471);
  await o.release(token);assert.equal(session.checkpoints,0);
  assert.deepEqual(f.calls.at(-1),['discard',9]);
  await assert.rejects(o.load(token),/unowned/);await assert.rejects(o.release(token),/unowned/);
  assert.deepEqual(errors,[]);
});
test('engine failure requests real teardown and cleanup never sends commands to the closed driver',async()=>{
  const f=fixture(),failures=[];
  const session=await createMeleeSync({...f,input:neutralPad,onError:(e,details)=>failures.push([e.message,details])});
  const token=await f.options.save(0);
  f.engine.closed=true;f.handlers.get('error')(Error('restore failed'));
  f.handlers.get('error')(Error('duplicate cleanup failure'));
  await f.options.release(token);await session.stop();
  assert.equal(session.requiresReload,true);assert.equal(session.checkpoints,0);
  assert.deepEqual(failures,[['restore failed',{requiresReload:true}]]);
  assert.deepEqual(f.calls,['manage'],'closed engine must not receive discard');
});
test('invalid setup, window or controller values never step the engine',async()=>{
  const f=fixture();await assert.rejects(createMeleeSync({...f,input:neutralPad,maxRollback:8}),/seven/);
  f.engine.checkpointStats=async()=>({count:1});
  await assert.rejects(createMeleeSync({...f,input:neutralPad}),/setup checkpoints/);
  assert.deepEqual(f.calls,[]);
  f.engine.checkpointStats=async()=>({count:0});
  await createMeleeSync({...f,input:()=>[4096,0,0,0,0,0,0]});
  assert.throws(()=>f.options.input(0),/Invalid local/);
  await assert.rejects(f.options.step(0,{guest:neutralPad(),host:[0,NaN,0,0,0,0,0]},{replaying:false}),/Invalid remote/);
  assert.deepEqual(f.calls,['manage']);
});
