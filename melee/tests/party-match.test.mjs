import test from 'node:test';
import assert from 'node:assert/strict';
import {MeleePartyMatch} from '../src/party-match.mjs';
import {MeleeCompetitiveUI} from '../src/competitive-ui.mjs';
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

const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function departureFixture(phase='playing'){
 const handlers=new Map(),pending=deferred(),reports=[],finals=[],errors=[];
 const participants=[{id:'a',connectionId:'a',slot:0,selection:{fighter:2,color:0}},{id:'b',connectionId:'b',slot:1,selection:{fighter:20,color:0}},
  {id:'a-local',connectionId:'a',slot:2,selection:{fighter:2,color:0}},{id:'b-local',connectionId:'b',slot:3,selection:{fighter:20,color:0}}];
 const room={me:'a',round:2,seed:1,queue:'private',playing:true,connected:true,participants,
  on(e,f){if(!handlers.has(e))handlers.set(e,new Set());handlers.get(e).add(f);},off(e,f){handlers.get(e)?.delete(f);},
  emit(e,value){for(const f of handlers.get(e)??[])f(value);},
  async reportGame(value){reports.push(value);if(phase==='reporting')await pending.promise;},
  async completeMatch(value){finals.push(value);return pending.promise;}};
 let stops=0,resumes=0;
 const adapter={async prepare(){if(phase==='preparing')await pending.promise;},async play(){return phase==='playing'?pending.promise:{confirmed:true,winner:0};},
  stop(){stops++;if(phase==='preparing'||phase==='playing')pending.reject(Error('Set has ended.'));}};
 const ui=Object.assign(Object.create(MeleeCompetitiveUI.prototype),{room,root:{hidden:false},adapterFactory:()=>adapter,lobby:{resume(){resumes++;}},render(){}});
 ui.beginRound(participants);
 const session=ui.session;session.onError=error=>errors.push(error);
 return {ui,room,session,pending,reports,finals,errors,get stops(){return stops;},get resumes(){return resumes;},
  depart(){room.emit('leave',{id:'b'});room.participants=participants.filter(p=>p.connectionId==='a');},
  receipt(){room.round=3;room.playing=false;const result={round:2,void:true,ranking:participants.map(p=>p.id)};room.emit('result',result);return result;}};
}

for(const phase of ['preparing','playing','reporting'])test(`Friends departure during ${phase} waits for the platform receipt and keeps the lobby`,async()=>{
 const f=departureFixture(phase);await flush();
 f.depart();f.depart();await flush();
 assert.equal(f.stops,1);assert.equal(f.session.closed,undefined);assert.equal(f.ui.screen,'party');assert.equal(f.ui.root.hidden,false);
 assert.match(f.ui.partyScreen(),/Waiting for the game result/);assert.equal(f.ui.platformResult,null);
 // The interrupted native task must not submit a winner or synthesize a void.
 f.pending.resolve();await flush();assert.deepEqual(f.finals,[]);assert.deepEqual(f.errors,[]);
 f.room.emit('result',{round:1,void:true});assert.equal(f.ui.platformResult,null);
 const result=f.receipt();assert.equal(f.ui.platformResult,result);assert.equal(f.session.closed,true);
 assert.match(f.ui.partyScreen(),/Game cancelled/);assert.match(f.ui.partyScreen(),/Return to lobby/);
 await f.ui.handle('return-lobby');assert.equal(f.ui.room,f.room);assert.equal(f.ui.screen,'lobby');assert.equal(f.resumes,1);
 assert.deepEqual(f.room.participants.map(p=>p.slot),[0,2]);assert.equal(f.stops,1);
});

test('Friends receipt settles once when a departure races an already pending final',async()=>{
 const f=departureFixture('finishing');await flush();assert.equal(f.finals.length,1);
 f.depart();const result=f.receipt();f.pending.resolve(result);await flush();
 assert.equal(f.ui.platformResult,result);assert.equal(f.session.settled,true);assert.equal(f.stops,1);assert.deepEqual(f.errors,[]);
});

test('explicitly leaving Friends while awaiting a departure receipt ignores its later arrival',async()=>{
 const f=departureFixture();await flush();f.depart();await f.session.stop();f.receipt();await flush();
 assert.equal(f.ui.platformResult,null);assert.equal(f.stops,1);assert.deepEqual(f.finals,[]);assert.deepEqual(f.errors,[]);
});

test('a closed connection exits the interrupted Friends session and removes its receipt listener',async()=>{
 const f=departureFixture();await flush();f.depart();f.room.playing=false;f.room.emit('close');await flush();
 assert.equal(f.session.closed,true);assert.equal(f.stops,1);assert.match(f.errors[0]?.message,/lobby connection closed/);
 f.receipt();assert.equal(f.ui.platformResult,null);assert.deepEqual(f.finals,[]);
});
