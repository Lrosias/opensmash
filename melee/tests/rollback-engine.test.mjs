import test from 'node:test';
import assert from 'node:assert/strict';
import {NativeRollbackEngine,neutralPad} from '../src/rollback-engine.mjs';

test('native adapter owns one command and rejects invalid inputs before touching the engine',async()=>{
  const writes=[];let command;
  const engine=new NativeRollbackEngine({_melee_rb_enable:()=>1,
    _melee_rb_command:(...args)=>{command=args;return 1;},_melee_input:(...args)=>writes.push(args)});
  await assert.rejects(engine.step(Array.from({length:4},neutralPad)),/not active/);
  const enabling=engine.enable();engine.receive(0,1,0,0,0,0,0);await enabling;
  for(const bad of [[4096,0,0,0,0,0,0],[1,NaN,0,0,0,0,0],[0,0,0,0,0,-.1,0],[0,1.1,0,0,0,0,0]])
    await assert.rejects(engine.step([bad,neutralPad(),neutralPad(),neutralPad()]),/complete/);
  assert.equal(writes.length,0);
  const stepping=engine.step(Array.from({length:4},neutralPad),{replaying:true});
  assert.equal(command[3],1);assert.equal(writes.length,4);
  await assert.rejects(engine.save(),/Overlapping/);
  await assert.rejects(engine.step(Array.from({length:4},neutralPad)),/Overlapping/);
  assert.equal(writes.length,4);
  engine.receive(command[0]+1,1,4,0,0,0,0);assert.ok(engine.pending);
  engine.receive(command[0],1,1,0,-1,0,1);
  assert.equal((await stepping).hash,4294967295);engine.destroy();
});

test('failed restore closes the native driver instead of continuing a potentially corrupt match',async()=>{
  const engine=new NativeRollbackEngine({_melee_rb_enable:()=>1,_melee_rb_command:()=>1,_melee_input:()=>assert.fail('must not write')});
  const enabling=engine.enable();engine.receive(0,1,0,0,0,0,0);await enabling;
  const restoring=engine.load({handle:1});engine.receive(1,-2,0,0,0,0,0);
  await assert.rejects(restoring,/failed/);assert.equal(engine.closed,true);
  await assert.rejects(engine.step(Array.from({length:4},neutralPad)),/not active/);
});
