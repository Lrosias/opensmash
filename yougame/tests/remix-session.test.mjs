import test from 'node:test';
import assert from 'node:assert/strict';
import {RollbackDuelSession,ROLLBACK_PROTOCOL} from '../src/rollback-session.mjs';
function make(seat,fighter,stage){
 const launched=[],errors=[];const room={me:String(seat),players:[{id:'0'},{id:'1'}],on(){},off(){},send(){},rollback(){return {on(){},stop(){},start(){}}}};
 const session=new RollbackDuelSession({room,round:1,fighter,stage,build:'remix',seed:1,readInput:()=>[0,0,0],launch:(f,s)=>launched.push({fighters:f,stage:s.stage}),status(){},stop:e=>errors.push(e)});
 clearInterval(session.timer);return {session,launched,errors};
}
const hello=(fighter,stage)=>({p:ROLLBACK_PROTOCOL,type:'hello',build:'remix',seed:1,fighter,stage});
test('Marth and Roy negotiate the same P1 stage from different preferences',()=>{
 const a=make(0,58,11),b=make(1,74,6);
 try{a.session.receive(hello(74,6));b.session.receive(hello(58,11));assert.deepEqual(a.launched,[{fighters:[58,74],stage:11}]);assert.deepEqual(a.launched,b.launched);assert.equal(b.session.stagePreference,6);}
 finally{a.session.destroy();b.session.destroy();}
});
test('bonus bosses and stages outside the curated pool cannot join',()=>{
 const a=make(0,58,11);try{assert.throws(()=>a.session.receive(hello(60,11)));assert.throws(()=>a.session.receive(hello(88,11)));assert.throws(()=>a.session.receive(hello(74,7)));}finally{a.session.destroy();}
});
test('stage metadata cannot change during the handshake',()=>{
 const a=make(0,58,11);try{a.session.receive(hello(74,6));assert.throws(()=>a.session.receive(hello(74,16)),/changed stage/);}finally{a.session.destroy();}
});

test('competitive handshake cannot replace locked fighters or the agreed stage',()=>{
 const a=make(0,58,6);a.session.expectedFighters=[58,74];try{assert.throws(()=>a.session.receive(hello(29,6)),/agreed/);assert.throws(()=>a.session.receive(hello(74,11)),/agreed/);a.session.receive(hello(74,6));assert.deepEqual(a.launched,[{fighters:[58,74],stage:6}]);}finally{a.session.destroy();}
});
