import test from 'node:test';
import assert from 'node:assert/strict';
import {NativeRoomSession,nativePads,nativeRoster,nativeSessionParams,prepareNativeSessionEngine} from '../src/native-room-session.mjs';
const profile={protocol:'native-test',stocks:4,remix:false};
const members=[{id:'p1',connectionId:'a',slot:0,localIndex:0},{id:'p3',connectionId:'b',slot:2,localIndex:1}];
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function pair(){
 const rooms=[],sessions=[],engines=[],errors=[],packets=[];
 for(const id of ['a','b']){
  const listeners=new Map(),room={me:id,isHost:id==='a',queue:'casual',seed:33,revision:1,round:1,participants:structuredClone(members),playing:false,matchId:null,begins:0,reports:[],finishes:[],syncs:[],
   on(e,f){if(!listeners.has(e))listeners.set(e,new Set());listeners.get(e).add(f);},off(e,f){listeners.get(e)?.delete(f);},emit(e,d){for(const f of [...listeners.get(e)||[]])f(d);},
   send(data){packets.push({from:id,data});queueMicrotask(()=>{for(const r of rooms)if(r!==room)r.emit('message',{from:id,data:structuredClone(data)});});},
   async beginMatch(){this.begins++;for(const r of rooms){r.playing=true;r.matchParticipants=structuredClone(r.participants);r.matchId='match-'+r.round;}for(const r of rooms)r.emit('ready',{});},
   reportGame(r){this.reports.push(r);return Promise.resolve();},finish(r){this.finishes.push(r);return Promise.resolve();},
   lockstep(options){const sync={options,received:[],start(){this.running=true;},stop(){this.running=false;},receive(...args){this.received.push(args);},on(){}};this.syncs.push(sync);return sync;}};rooms.push(room);
 }
 for(const room of rooms){const session=new NativeRoomSession({room,build:'build1',profile,readPorts:()=>[[0x1000,1,2],[0x8000,3,4]],onError:e=>errors.push(e),launch(owner,token){const engine={meta:{frame:5,scene:16,battleId:0,battleTicks:0,hash:12,seatMask:5},steps:[],metadata(){return {...this.meta};},step(pads){this.steps.push(pads);this.meta.frame++;if(this.end){this.meta.scene=22;this.meta.battleId=1;this.meta.battleTicks=60;}return {meta:{...this.meta},state:[12,this.end?2:-1,4,0,this.meta.battleTicks,4,0,this.end?5:0]};},destroy(){this.destroyed=true;}};engines.push(engine);queueMicrotask(()=>owner.attach(engine,token));}});sessions.push(session);}
 return {rooms,sessions,engines,errors,packets,close(){sessions.forEach(s=>s.destroy());}};
}
test('global ports preserve holes and local controller indices; native bootstrap stays unselected',()=>{
 assert.deepEqual(nativePads(members,{a:[[1,2,3]],b:[[4,5,6]]}),[[1,2,3],null,[4,5,6],null]);
 const params=nativeSessionParams({participants:members,seed:9,profile});assert.equal(params.get('SSB64_BOOT_SLOTS'),'hoho');assert.equal(params.get('SSB64_BOOT_BATTLE'),'-1,-1,6,0,-1,-1');assert.equal(params.get('SSB64_YOUGAME_SESSION'),'1');
 assert.throws(()=>nativeRoster([...members,{...members[1],id:'bad'}]));assert.throws(()=>nativePads(members,{a:[[1,200,0]]}));
});
test('all engines prepare before host auto-begin; fixed delay and scoped traffic retain global ports',async()=>{
 const p=pair();try{assert.equal(p.rooms[0].begins,0);await flush();p.sessions.forEach(s=>s.pulse());await flush();
  assert.equal(p.rooms[0].begins,1);assert.ok(p.sessions.every(s=>s.running));
  for(const room of p.rooms){const sync=room.syncs[0];assert.equal(sync.options.delay,2);assert.equal(sync.options.hz,60);assert.deepEqual(sync.options.input(),room.me==='a'?[[0x1000,1,2]]:[[0x8000,3,4]]);sync.options.step(0,{a:[[0x1000,0,0]],b:[[0x8000,0,0]]});assert.deepEqual(p.engines[p.rooms.indexOf(room)].steps[0],[[0x1000,0,0],null,[0x8000,0,0],null]);sync.receive('b',{_ls:1,nativeScope:'stale'});assert.equal(sync.received.length,0);}
  assert.deepEqual(p.errors,[]);
 }finally{p.close();}
});
test('native terminal requires peer agreement, settles once and resumes same engine in a new timeline',async()=>{
 const p=pair();try{await flush();p.sessions.forEach(s=>s.pulse());await flush();p.engines.forEach(e=>e.end=true);
  p.rooms[0].syncs[0].options.step(0,{});await flush();assert.equal(p.rooms[0].finishes.length,0);assert.equal(p.sessions[0].running,false);
  p.rooms[1].syncs[0].options.step(0,{});await flush();p.sessions.forEach(s=>s.pulse());await flush();
  assert.deepEqual(p.rooms.map(r=>r.finishes),[[{winner:'p3'}],[{winner:'p3'}]]);
  const oldScopes=p.sessions.map(s=>s.scope),frames=p.engines.map(e=>e.meta.frame);
  for(const r of p.rooms){r.playing=false;r.round=2;r.emit('result',{round:1,void:false});}
  await flush();p.sessions.forEach(s=>s.pulse());await flush();
  assert.equal(p.engines.length,2);assert.deepEqual(p.engines.map(e=>e.meta.frame),frames);assert.ok(p.sessions.every((s,i)=>s.scope!==oldScopes[i]&&s.running));
  for(const r of p.rooms){r.emit('result',{round:1,void:false});r.syncs[1].options.step(0,{});}
  await flush();assert.deepEqual(p.rooms.map(r=>r.finishes.length),[1,1],'Same battle terminal cannot score twice');assert.deepEqual(p.errors,[]);
 }finally{p.close();}
});
test('engine driver owns ticks during preparation and preserves null holes',async()=>{
 const owner={participants:members,closed:false},meta={frame:0,scene:16,hash:1},seen=[];let pads;
 const engine=await prepareNativeSessionEngine({step(){assert.equal(owner.stepping,true);seen.push(pads);meta.frame++;}}, {owner,getState:()=>[1,-1,0,0,0,0,0,0],getMeta:()=>meta,setPads:p=>pads=p});
 assert.equal(meta.frame,2);assert.equal(owner.stepping,false);assert.deepEqual(seen[0],[[0,0,0],null,[0,0,0],null]);engine.step(nativePads(members,{}));assert.equal(meta.frame,3);
});
test('late join during terminal wait cannot restart input; next roster epoch cold-boots only after settlement',async()=>{
 const p=pair();try{await flush();p.sessions.forEach(s=>s.pulse());await flush();p.engines.forEach(e=>e.end=true);p.rooms.forEach(r=>r.syncs[0].options.step(0,{}));await flush();
  const next={id:'p2',connectionId:'a',slot:1,localIndex:2};for(const r of p.rooms){r.participants.push(next);r.revision++;r.emit('participants',{});}
  assert.equal(p.engines.length,2);assert.ok(p.sessions.every(s=>s.terminal&&!s.sync));
  for(const r of p.rooms){r.playing=false;r.round=2;r.emit('result',{round:1,void:false});}await flush();p.sessions.forEach(s=>s.pulse());await flush();
  assert.equal(p.engines.length,4);assert.ok(p.engines.slice(0,2).every(e=>e.destroyed));assert.ok(p.sessions.every(s=>s.participants.map(p=>p.slot).join(',')==='0,1,2'));assert.deepEqual(p.errors,[]);
 }finally{p.close();}
});
test('active departure voids instead of continuing with a reindexed player',async()=>{
 const p=pair();try{await flush();p.sessions.forEach(s=>s.pulse());await flush();p.rooms[0].emit('leave',{id:'b'});assert.equal(p.sessions[0].closed,true);assert.equal(p.rooms[0].syncs[0].running,false);assert.deepEqual(p.rooms[0].finishes,[{void:true}]);assert.deepEqual(p.errors,['A player left the native game.']);}finally{p.close();}
});
test('a departed peer invalidates an unfinished boot and its cached preparation before dropping below minimum',()=>{
 const events=new Map(),boots=[],errors=[];let begins=0;
 const room={me:'a',isHost:true,round:1,revision:1,seed:1,participants:structuredClone(members),playing:false,on(e,fn){events.set(e,fn);},off(){},send(){},beginMatch(){begins++;return Promise.resolve();}};
 const session=new NativeRoomSession({room,build:'b',profile,launch(owner,token){boots.push({owner,token});},readPorts:()=>[],onError:e=>errors.push(e)});
 try{const oldKey=session.prepareKey,oldToken=boots[0].token;session.peers.set('b',{key:oldKey,checkpoint:'prepared'});room.participants=room.participants.slice(0,1);room.revision++;events.get('participants')();const oldEngine={metadata:()=>({frame:2,scene:16,hash:1}),destroy(){this.destroyed=true;}};session.attach(oldEngine,oldToken);session.pulse();assert.equal(oldEngine.destroyed,true);assert.equal(session.engine,null);assert.equal(session.peers.size,0);assert.equal(begins,0);assert.notEqual(session.prepareKey,oldKey);assert.equal(session.closed,undefined);assert.deepEqual(errors,[]);}finally{session.destroy();}
});
