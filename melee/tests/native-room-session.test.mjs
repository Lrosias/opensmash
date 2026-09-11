// Actual production SDK async loop, simulated transport and explicitly fake engines.
// This tests app ownership and frame barriers, not native determinism/performance.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {MeleeNativeRoomSession,nativePads,nativeRoster,nativeResultReceipt,encodeNativePads,decodeNativePads} from '../src/native-room-session.mjs';
const sdkPath=process.env.YOUGAME_SDK_PATH||'/Users/luis/Documents/YouGame-Library-Lobby-Retrofit-20260911/tested-sdk.js';
const sdkSource=readFileSync(sdkPath,'utf8');
const asyncSource=sdkSource.slice(sdkSource.indexOf('  function makeAsyncRollback(room, o) {'),sdkSource.indexOf('  /* ---------- host-authoritative kit:',sdkSource.indexOf('  function makeAsyncRollback(room, o) {')));
const neutral=()=>[0,0,0,0,0,0,0],bundle=()=>Array.from({length:4},neutral),pad=button=>[button,0,0,0,0,0,0];
const members=[{id:'p2',connectionId:'a',slot:1,localIndex:1},{id:'p4',connectionId:'b',slot:3,localIndex:0}];
const flush=async()=>{for(let i=0;i<80;i++)await Promise.resolve();};
function pair({deferBoot=false}={}){
 const rooms=[],sessions=[],engines=[],errors=[],packets=[],boots=[];let now=0,seq=0;const ticks=new Map();
 const make=vm.runInNewContext(asyncSource+';makeAsyncRollback',{
  performance:{now:()=>now},setInterval:fn=>{ticks.set(++seq,fn);return seq;},clearInterval:id=>ticks.delete(id),window:{console},console,
  canon:JSON.stringify,matchConnectionIds:room=>[...new Set(room.matchParticipants.map(p=>p.connectionId))]});
 for(const id of ['a','b']){
  const listeners=new Map(),room={me:id,isHost:id==='a',lifecycle:'game',queue:'casual',revision:1,round:1,seed:4,participants:structuredClone(members),playing:false,matchId:null,begins:0,reports:[],finishes:[],syncs:[],
   on(e,f){if(!listeners.has(e))listeners.set(e,new Set());listeners.get(e).add(f);},off(e,f){listeners.get(e)?.delete(f);},emit(e,d){for(const f of [...listeners.get(e)||[]])f(d);},
   send(data){packets.push({from:id,data});queueMicrotask(()=>{for(const r of rooms)if(r!==room){r._sync?.receive(id,structuredClone(data));r.emit('message',{from:id,data:structuredClone(data)});}});},
   async beginMatch({revision}){assert.equal(revision,this.revision);this.begins++;for(const r of rooms){r.playing=true;r.matchParticipants=structuredClone(r.participants);r.matchId='match-'+r.round;}for(const r of rooms)r.emit('ready',{});},
   reportGame(r){this.reports.push(r);return Promise.resolve();},finish(r){this.finishes.push(r);return Promise.resolve();},
   rollbackAsync(options){const sync=make(this,options);sync.options=options;this.syncs.push(sync);return sync;}};rooms.push(room);
 }
 for(const room of rooms){sessions.push(new MeleeNativeRoomSession({room,build:'build1',readPorts:()=>[pad(256),pad(512)],onError:e=>errors.push(e),async createEngine({slots},status,signal){
   const meta={phase:0,battleId:0,seatMask:slots.reduce((m,p)=>m|(1<<p),0),receipt:null};
   const engine={frame:5,hash:12,steps:[],initial:{frame:5,hash:12,nativeSession:structuredClone(meta)},
    async step(pads,options){assert.equal(options.replaying,false);this.steps.push(structuredClone(pads));await Promise.resolve();this.frame++;this.hash++;meta.phase=this.phase??1;
     if(this.end){meta.phase=6;meta.battleId=1;meta.receipt={battleId:1,kind:'winner',winnerSlot:3,participantsMask:10,humanMask:10,teamBattle:false,noContest:false,places:[-1,1,-1,0],outcome:2,matchKind:2,extraParticipants:0,...this.receiptOverride};}
     return {frame:this.frame,hash:this.hash,result:0,nativeSession:structuredClone(meta)};},
    save(){throw Error('unqualified save');},load(){throw Error('unqualified load');},show(){this.shown=true;},destroy(){this.destroyed=true;}};
   engines.push(engine);if(deferBoot)await new Promise(resolve=>boots.push(resolve));return engine;
  }}));}
 return {rooms,sessions,engines,errors,packets,boots,async ready(){await flush();sessions.forEach(s=>s.pulse());await flush();},async tick(count=1){for(let i=0;i<count;i++){now+=1000/60;for(const fn of [...ticks.values()])fn();await flush();}},async settle(isVoid=false){for(const r of rooms){r.playing=false;r.round++;r.emit('result',{round:r.round-1,void:isVoid,ranking:isVoid?[]:['p4','p2'],draw:false});}await flush();sessions.forEach(s=>s.pulse());await flush();},async close(){await Promise.all(sessions.map(s=>s.destroy()));}};
}
test('native ports remain sparse and connection-local input indexes stay global',()=>{
 const a=bundle(),b=bundle();a[1]=pad(512);b[0]=pad(256);
 assert.deepEqual(nativePads(members,{a:encodeNativePads(a),b:encodeNativePads(b)}),[neutral(),pad(512),neutral(),pad(256)]);
 assert.throws(()=>nativePads(members,{a}));assert.throws(()=>nativeRoster([...members,members[0]]));
});
test('actual SDK starts only after native agreement with fixed3/maxRollback0 and no checkpoint APIs',async()=>{
 const p=pair();try{assert.equal(p.rooms[0].begins,0);await p.ready();assert.equal(p.rooms[0].begins,1);assert.ok(p.sessions.every(s=>s.running));
  for(const r of p.rooms){assert.equal(r.syncs[0].options.delay,3);assert.equal(r.syncs[0].options.maxRollback,0);assert.equal(r.syncs[0].options.save,undefined);}
  await p.tick(8);assert.ok(p.engines.every(e=>e.steps.length>3));assert.deepEqual(p.engines[0].steps.at(-1),[neutral(),pad(512),neutral(),pad(256)]);assert.deepEqual(p.engines[0].steps,p.engines[1].steps);assert.deepEqual(p.errors,[]);
 }finally{await p.close();}
});
test('actual async stop drains precisely at receipt then same engine resumes next platform round',async()=>{
 const p=pair();try{await p.ready();await p.tick(4);p.engines.forEach(e=>e.end=true);await p.tick(3);
  assert.deepEqual(p.rooms.map(r=>r.finishes),[[{winner:'p4'}],[{winner:'p4'}]]);assert.ok(p.sessions.every(s=>s.terminal&&!s.draining&&!s.sync));
  const frames=p.engines.map(e=>e.frame),scopes=p.sessions.map(s=>s.scope);await p.tick(3);assert.deepEqual(p.engines.map(e=>e.frame),frames);
  await p.settle();assert.equal(p.engines.length,2);assert.ok(p.sessions.every((s,i)=>s.running&&s.scope!==scopes[i]));await p.tick(4);
  assert.ok(p.engines.every((e,i)=>e.frame>frames[i]));assert.deepEqual(p.rooms.map(r=>r.finishes.length),[1,1]);assert.deepEqual(p.errors,[]);
 }finally{await p.close();}
});
for(const [name,extra]of [['CPU',{participantsMask:11,humanMask:10}],['teams',{teamBattle:true}],['no contest',{noContest:true}]])test(`${name} receipt finishes neutrally and preserves native results machine`,async()=>{
 const p=pair();try{await p.ready();p.engines.forEach(e=>{e.end=true;e.receiptOverride={kind:'unscored',winnerSlot:null,...extra};});await p.tick(3);
  assert.deepEqual(p.rooms.map(r=>r.reports),[[],[]]);assert.deepEqual(p.rooms.map(r=>r.finishes),[[{void:true}],[{void:true}]]);
  await p.settle(true);assert.equal(p.engines.length,2);assert.ok(p.sessions.every(s=>s.running));assert.deepEqual(p.errors,[]);
 }finally{await p.close();}
});
test('VS exit and legacy result field cannot settle before final native receipt',async()=>{
 const p=pair();try{await p.ready();p.engines.forEach(e=>e.phase=4);await p.tick(4);assert.ok(p.sessions.every(s=>s.running));assert.ok(p.rooms.every(r=>!r.reports.length&&!r.finishes.length));assert.deepEqual(p.errors,[]);}finally{await p.close();}
});
test('departure invalidates pending preparation and rejects the old engine attachment',async()=>{
 const p=pair({deferBoot:true});try{await flush();assert.equal(p.boots.length,2);p.sessions[0].peers.set('b',{key:p.sessions[0].prepareKey,checkpoint:'old'});
  for(const r of p.rooms){r.participants=r.participants.slice(0,1);r.revision++;r.emit('participants',{});}p.boots.forEach(fn=>fn());await flush();
  assert.ok(p.engines.every(e=>e.destroyed));assert.ok(p.sessions.every(s=>!s.engine&&!s.peers.size));assert.equal(p.rooms[0].begins,0);assert.deepEqual(p.errors,[]);
 }finally{await p.close();}
});
test('membership changed during battle waits for settlement then cold-boots a new seat epoch',async()=>{
 const p=pair();try{await p.ready();const next={id:'p1',connectionId:'a',slot:0,localIndex:0};for(const r of p.rooms){r.participants.push(next);r.revision++;r.emit('participants',{});}assert.equal(p.engines.length,2);
  p.engines.forEach(e=>e.end=true);await p.tick(3);await p.settle();assert.equal(p.engines.length,4);assert.ok(p.engines.slice(0,2).every(e=>e.destroyed));assert.ok(p.sessions.every(s=>s.meta.seatMask===11));assert.deepEqual(p.errors,[]);
 }finally{await p.close();}
});
test('active departure or unexpected result stops the machine and does not fabricate rematch',async()=>{
 for(const event of ['leave','result']){const p=pair();try{await p.ready();p.rooms[0].emit(event,event==='leave'?{id:'b'}:{round:1,void:true});await flush();assert.equal(p.sessions[0].closed,true);assert.equal(p.engines[0].destroyed,true);assert.equal(p.rooms[0].syncs.length,1);assert.equal(p.errors.length,1);}finally{await p.close();}}
});
test('different final receipts cannot score',async()=>{
 const p=pair();try{await p.ready();p.engines.forEach(e=>e.end=true);p.engines[1].receiptOverride={winnerSlot:1};await p.tick(3);assert.ok(p.errors.some(e=>e.includes('disagree')));assert.ok(p.rooms.every(r=>r.reports.length===0));}finally{await p.close();}
});
test('old scoped SDK packets cannot enter a new round',async()=>{
 const p=pair();try{await p.ready();await p.tick(2);const old=p.packets.find(p=>p.data._ra===1);p.engines.forEach(e=>e.end=true);await p.tick(3);await p.settle();
  p.rooms[1]._sync.receive('a',{...old.data,round:p.rooms[1].round});await p.tick(3);assert.deepEqual(p.errors,[]);assert.ok(p.sessions.every(s=>s.running));
 }finally{await p.close();}
});

test('new connection joining an active game waits for settlement without owning a native port',async()=>{
 const events=new Map(),launches=[];const room={me:'late',round:1,revision:1,playing:true,matchParticipants:structuredClone(members),participants:[...structuredClone(members),{id:'late-p1',connectionId:'late',slot:0,localIndex:0}],on(e,f){events.set(e,f);},off(){},send(){}};
 const session=new MeleeNativeRoomSession({room,build:'b',readPorts:bundle,createEngine:async launch=>{launches.push(launch);return new Promise(()=>{});},onError:e=>assert.fail(e)});
 try{assert.equal(session.waitingRound,1);assert.equal(launches.length,0);room.playing=false;room.round=2;events.get('result')({round:1,void:false,ranking:['p4','p2']});await flush();assert.deepEqual(launches,[{slots:[0,1,3]}]);assert.equal(session.closed,undefined);}finally{await session.destroy();}
});
test('platform winner must match the locally agreed receipt',async()=>{
 const p=pair();try{await p.ready();p.engines.forEach(e=>e.end=true);await p.tick(3);p.rooms[0].playing=false;p.rooms[0].round=2;p.rooms[0].emit('result',{round:1,void:false,ranking:['p2','p4']});assert.equal(p.sessions[0].closed,true);assert.ok(p.errors.length);}finally{await p.close();}
});

test('four arbitrary analog controllers fit the SDK cap with exact native float32 values',async()=>{
 const pads=Array.from({length:4},(_,i)=>[4095,Math.sin(i+1),-128/127,Math.cos(i+1),1/3,1/7,5/7]);
 const packet=encodeNativePads(pads),decoded=decodeNativePads(packet);assert.equal(packet.length,140);assert.ok(JSON.stringify(packet).length<=256);
 for(let i=0;i<4;i++)for(let j=0;j<7;j++)assert.equal(Math.fround(decoded[i][j]),Math.fround(pads[i][j]));
 assert.throws(()=>decodeNativePads(packet.slice(1)));const bytes=Uint8Array.from(atob(packet),c=>c.charCodeAt(0));new DataView(bytes.buffer).setFloat32(2,NaN,true);assert.throws(()=>decodeNativePads(btoa(String.fromCharCode(...bytes))));
 const p=pair();try{p.sessions.forEach(s=>s.readPorts=()=>pads);await p.ready();await p.tick(8);assert.deepEqual(p.errors,[]);assert.ok(p.engines.every(e=>e.steps.length>3));}finally{await p.close();}
});
test('a delayed prepared packet cannot compare a running engine against its old boot checkpoint',async()=>{
 const p=pair();try{await p.ready();const packet=p.packets.find(p=>p.from==='b'&&p.data.type==='native-prepared');await p.tick(5);p.rooms[0].emit('message',{from:'b',data:packet.data});assert.equal(p.sessions[0].closed,undefined);assert.deepEqual(p.errors,[]);}finally{await p.close();}
});
