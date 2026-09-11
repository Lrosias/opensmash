import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GameLobby} from '../../controllers/online-lobby.mjs';
import {RollbackPartySession} from '../src/rollback-session.mjs';
import {PrivateSet} from '../src/competitive-set.mjs';
import {engineParams,PROFILES} from '../src/game-profile.mjs';
const participant=(id,connectionId,slot,localIndex=0)=>({id,connectionId,slot,localIndex,name:id});
function room(me='a'){
 const listeners=new Map();return {me,isHost:me==='a',round:1,revision:1,playing:false,players:[{id:'a'},{id:'b'}],participants:[participant('a','a',0),participant('b','b',1)],sent:[],
 on(e,f){if(!listeners.has(e))listeners.set(e,new Set());listeners.get(e).add(f);},off(e,f){listeners.get(e)?.delete(f);},emit(e,v){for(const f of listeners.get(e)||[])f(v);},send(d){this.sent.push(d);},finish:async()=>{},
 async beginMatch({revision}){assert.equal(revision,this.revision);this.matchParticipants=structuredClone(this.participants);this.playing=true;this.emit('ready',{round:this.round});}};
}
test('game lobby exposes empty seats before picks; only owned ports can choose and ready',()=>{
 const r=room();r.participants=[participant('a','a',0)];const lobby=new GameLobby({room:r,protocol:'test',validSelection:Number.isInteger});
 try{assert.equal(lobby.view().participants[0].selection,null);assert.equal(lobby.view().canStart,false);assert.throws(()=>lobby.pick('b',1));lobby.pick('a',3);lobby.toggleReady('a');assert.equal(lobby.view().canStart,false);}finally{lobby.destroy();}
});
test('two local players per device own four ports and start only after all game ready',async()=>{
 const r=room();r.participants=[participant('a','a',0),participant('a2','a',1,1),participant('b','b',2),participant('b2','b',3,1)];let start;
 const lobby=new GameLobby({room:r,protocol:'test',validSelection:Number.isInteger,onStart:p=>start=p});
 try{for(const id of ['a','a2']){lobby.pick(id,4);lobby.toggleReady(id);}lobby.receive({from:'b',data:{p:'test',type:'lobby',round:1,revision:1,sequence:1,choices:[{id:'b',selection:2,ready:true},{id:'b2',selection:5,ready:true}]}});assert.equal(lobby.view().canStart,true);await lobby.start();assert.deepEqual(start.map(p=>p.slot),[0,1,2,3]);assert.deepEqual(start.map(p=>p.selection),[4,4,2,5]);}finally{lobby.destroy();}
});
test('late participant waits for next game and may select without starting the active match',()=>{
 const r=room('c');r.playing=true;r.matchParticipants=r.participants.slice();r.participants.push(participant('c','c',3));let started=false;
 const lobby=new GameLobby({room:r,protocol:'test',validSelection:Number.isInteger,onStart:()=>started=true});
 try{assert.equal(lobby.view().waitingNext,true);lobby.pick('c',8);lobby.toggleReady('c');lobby.started();assert.equal(started,false);assert.equal(lobby.view().participants.at(-1).selection,8);assert.equal(lobby.view().canStart,false);}finally{lobby.destroy();}
});
test('roster revisions clear readiness; stale or forged remote choices cannot change ports',()=>{
 const r=room(),lobby=new GameLobby({room:r,protocol:'test',validSelection:Number.isInteger});
 try{lobby.pick('a',4);lobby.toggleReady('a');r.revision++;lobby.refresh();assert.equal(lobby.view().participants[0].ready,false);lobby.receive({from:'b',data:{p:'test',type:'lobby',round:1,revision:2,sequence:1,choices:[{id:'a',selection:9,ready:true}]}});assert.equal(lobby.view().participants[0].selection,4);}finally{lobby.destroy();}
});
test('native private startup preserves holes and all four fighter selections',()=>{
 const params=engineParams({profile:PROFILES.original,battle:{fighters:[1,3,5],stage:6,participants:[{slot:0},{slot:2},{slot:3}]},seed:3});
 assert.equal(params.get('SSB64_BOOT_SLOTS'),'hohh');assert.equal(params.get('SSB64_BOOT_BATTLE'),'1,0,6,0,3,5');
});
test('four-port simulation uses frozen ownership and ignores a pending next-game connection',()=>{
 const r=room();r.participants=[participant('a','a',0),participant('a2','a',1,1),participant('b','b',2),participant('b2','b',3,1)];let options,lastPads;
 r.rollback=o=>{options=o;return {on(){},stop(){},start(){},receive(){}};};
 const session=new RollbackPartySession({room:r,round:1,participants:r.participants.slice(),expectedFighters:[0,1,2,3],game:1,stage:6,seed:4,build:'fixture',readPorts:()=>[[1,0,0],[2,0,0]],launch(){},status(){},stop(){},onGameResult(){},profile:PROFILES.original});
 try{session.engine={step:p=>{lastPads=p;return [4,-1,4,4,1,4,4,15];},destroy(){}};r.players.push({id:'c'});options.step(0,{a:[[1,0,0],[2,0,0]],b:[[3,0,0],[4,0,0]],c:[[9,0,0]]});assert.deepEqual(lastPads.map(p=>p[0]),[1,2,3,4]);}finally{session.destroy();}
});
test('private result records the game before its match, once for all four participants',async()=>{
 const r=room();r.participants=[participant('a','a',0),participant('a2','a',1,1),participant('b','b',2),participant('b2','b',3,1)].map((p,i)=>({...p,selection:i}));const calls=[];
 r.reportGame=async result=>calls.push(['game',result]);r.finish=async result=>calls.push(['match',result]);
 const set=new PrivateSet({room:r,round:1,participants:r.participants,build:'fixture',onGame(){},profile:PROFILES.original});
 try{await Promise.resolve();const result={result:3,hash:4,stocks:[0,0,0,1]};set.completeGame(result);set.accept('b',result);set.accept('b',result);await new Promise(resolve=>setTimeout(resolve,0));assert.deepEqual(calls.map(c=>c[0]),['game','match']);assert.equal(calls[0][1].winner,'b2');assert.equal(calls[1][1].winner,'b2');}finally{set.destroy();}
});
test('unchanged heartbeats do not replace the game lobby UI or keyboard focus',()=>{
 const r=room();let renders=0;const lobby=new GameLobby({room:r,protocol:'test',validSelection:Number.isInteger,onChange:()=>renders++});
 try{lobby.refresh();lobby.refresh();assert.equal(renders,1);lobby.pick('a',2);assert.equal(renders,2);lobby.refresh();assert.equal(renders,2);}finally{lobby.destroy();}
});
test('actual SDK rollback converges four port bundles while a late connection waits',{skip:!process.env.YOUGAME_SDK_PATH},async()=>{
 const {readFileSync}=await import('node:fs');const vm=await import('node:vm');const sdk=readFileSync(process.env.YOUGAME_SDK_PATH,'utf8');
 const source=sdk.slice(sdk.indexOf('  function canon('),sdk.indexOf('  // A hidden tab'))+sdk.slice(sdk.indexOf('  function matchConnectionIds('),sdk.indexOf('  /* ---------- host-authoritative kit:'));
 const loops=[],wire=[],sessions=[],errors=[],histories=[];let tick=0;
 const makeSync=vm.runInNewContext(source+';makeSync',{window:{console},console,Date,performance,fixedStep(o){let active=false;loops.push(()=>{if(active)o.update();});return{start(){active=true;},stop(){active=false;}};}});
 const participants=[participant('a','a',0),participant('a2','a',1,1),participant('b','b',2),participant('b2','b',3,1)];
 const rooms=['a','b'].map((id,i)=>{const r=room(id);r.lifecycle='game';r.playing=true;r.participants=participants;r.matchParticipants=participants;r.matchConnections=['a','b'];r.rollback=o=>makeSync(r,o,true);r.send=d=>wire.push({from:id,to:1-i,at:tick+(d._ls?4+(d.f%3):0),data:structuredClone(d)});return r;});
 const deliver=()=>{for(let i=0;i<wire.length;){const e=wire[i];if(e.at>tick){i++;continue;}wire.splice(i,1);if(e.data._ls)rooms[e.to]._sync?.receive(e.from,e.data);else rooms[e.to].emit('message',e);}};
 try{for(let i=0;i<2;i++){let frame=0,total=0;const history=histories[i]=new Map();const engine={save:()=>({frame,total}),load:s=>{frame=s.frame;total=s.total;},step:pads=>{frame++;total+=pads.reduce((sum,p)=>sum+p[1],0);history.set(frame,total);return[total>>>0,-1,4,4,frame,4,4,15];},destroy(){}};
  sessions[i]=new RollbackPartySession({room:rooms[i],round:1,participants,expectedFighters:[0,1,2,3],stage:6,seed:7,build:'fixture',readPorts:()=>[[0,tick%11<5?1:-1,0],[0,i?3:2,0]],launch:(_,s)=>s.attach(engine),status(){},stop:e=>errors.push(e),onGameResult(){},profile:PROFILES.original});clearInterval(sessions[i].timer);
 }
 for(tick=0;tick<250;tick++){if(tick===20)for(const r of rooms){r.players.push({id:'late'});r.participants=[...participants,participant('late','late',4)];}deliver();for(const s of sessions)s.pulse();for(const loop of loops)loop();deliver();await Promise.resolve();}
 assert.deepEqual(errors,[]);assert.ok(sessions.every(s=>s.frame>200));const target=Math.min(...sessions.map(s=>s.frame))-15;assert.ok(target>180);assert.equal(histories[0].get(target),histories[1].get(target));assert.ok(sessions.some(s=>s.sync.rollbacks>0));
 }finally{sessions.forEach(s=>s.destroy());}
});
test('reused controller slots credit their current participants instead of connection join order',async()=>{
 const r=room('c');r.players=[{id:'c'},{id:'d'}];r.participants=[participant('d','d',1),participant('c','c',2)].map((p,i)=>({...p,selection:i}));const calls=[];
 r.reportGame=async result=>calls.push(['game',result]);r.finish=async result=>calls.push(['match',result]);
 const set=new PrivateSet({room:r,round:1,participants:r.participants,build:'fixture',onGame(){},profile:PROFILES.original});
 try{await Promise.resolve();const result={result:0,hash:4,stocks:[1,0]};set.completeGame(result);set.accept('d',result);await new Promise(resolve=>setTimeout(resolve,0));assert.equal(calls[0][1].winner,'d');assert.equal(calls[1][1].winner,'d');}finally{set.destroy();}
});
