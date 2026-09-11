import test from 'node:test';
import assert from 'node:assert/strict';
import {MeleePartyMatch} from '../src/party-match.mjs';
const flush=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
test('friend match snapshots ports, ignores a late member, and reports participant identity once',async()=>{
 const listeners=new Map(),reports=[],finals=[],results=[],launches=[];let finish;
 const participants=[{id:'a',connectionId:'a',slot:0,localIndex:0,selection:{fighter:2,color:0}},{id:'a-guest',connectionId:'a',slot:2,localIndex:1,selection:{fighter:20,color:0}},{id:'b',connectionId:'b',slot:3,localIndex:0,selection:{fighter:9,color:0}}];
 const room={round:3,seed:123,playing:true,on(e,f){listeners.set(e,f);},off(e,f){if(listeners.get(e)===f)listeners.delete(e);},async reportGame(r){reports.push(r);},async completeMatch(r){finals.push(r);return {round:3,ranking:[r.winner]};}};
 const session=new MeleePartyMatch({room,participants,adapter:{async prepare(launch){launches.push(launch);},play:()=>new Promise(r=>finish=r),async stop(){}},onResult:r=>results.push(r),onError:e=>assert.fail(e)});
 await flush();participants.push({id:'late',connectionId:'late',slot:1});listeners.get('leave')({id:'late'});finish({confirmed:true,winner:2});await flush();
 assert.deepEqual(launches[0].slots,[0,2,3]);assert.deepEqual(reports,[{id:'game-1',winner:'a-guest'}]);assert.deepEqual(finals,[{winner:'a-guest'}]);assert.equal(results.length,1);assert.equal(session.closed,true);
});
test('leaving while the final report is pending cannot reopen the stopped private match',async()=>{
 const handlers=new Map(),results=[];let finish;
 const room={round:1,seed:1,playing:true,on(e,f){handlers.set(e,f);},off(e,f){if(handlers.get(e)===f)handlers.delete(e);},async reportGame(){},completeMatch:()=>new Promise(resolve=>finish=resolve)};
 const participants=[{id:'a',connectionId:'a',slot:0,selection:{fighter:2,color:0}},{id:'b',connectionId:'b',slot:1,selection:{fighter:20,color:0}}];
 const session=new MeleePartyMatch({room,participants,adapter:{async prepare(){},async play(){return {confirmed:true,winner:0};},async stop(){}},onResult:r=>results.push(r),onError:e=>assert.fail(e)});
 await flush();assert.equal(typeof finish,'function');await session.stop();finish({round:1,ranking:['a','b']});await flush();assert.deepEqual(results,[]);
});
