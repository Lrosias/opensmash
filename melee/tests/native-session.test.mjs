import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeLaunch} from '../src/native-launch.mjs';
import {NativeRollbackEngine} from '../src/rollback-engine.mjs';

test('normal-menu session preserves sparse ports and preloads no forced choices',()=>{
  for(const slots of [[0,2],[1,3],[3],[0,1,2,3]]) {
    const result=nativeLaunch({nativeSession:true,slots});
    assert.deepEqual(result.slots,slots);assert.notEqual(result.slots,slots);
    assert.equal(result.mask,slots.reduce((m,s)=>m|(1<<s),0));
    assert.deepEqual(result.groups,['menu']);
  }
  for(const slots of [null,[],[0,0],[4],[-1],[0,1.5],[0,1,2,3,4]])
    assert.throws(()=>nativeLaunch({nativeSession:true,slots}),/controller ports/);
});

test('only native sessions can boot; frozen picks are not a launch any more',()=>{
  assert.throws(()=>nativeLaunch({slots:[0,1]}),/native Melee sessions/);
  assert.throws(()=>nativeLaunch({stage:31,selections:[{fighter:2,color:0},{fighter:0,color:0}],slots:[1,3]}),/native Melee sessions/);
});

test('native lifecycle is exposed without treating stale legacy stock fields as a result',async()=>{
  const engine=new NativeRollbackEngine({});
  const boot=engine.waitForBoot();
  const nativeSession={phase:4,battleId:2,seatMask:10,battleMask:10,stage:31};
  engine.receive(0,1,500,0,42,0,0,1,3,4,0,0,100,0,400,0,0,0,0,0,0,0,3,nativeSession);
  const state=await boot;
  assert.equal(state.result,null);assert.deepEqual(state.nativeSession,nativeSession);
  assert.equal(state.hash,42);assert.equal(state.frame,500);
  engine.destroy();
});
