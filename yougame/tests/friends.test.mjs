import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

// Run the actual app's native-menu bridge against a controllable SDK boundary.
// No friends receive invites, and these tests never enter a public queue.
async function setup(invite=null){
 const frames=[],calls=[],sessions=[],tasks=[];
 const status={textContent:'',classList:{remove(){}}};
 const win={addEventListener(){},focus(){},YouGame:{ready:async()=>{},checksum:()=>42,
  multiplayer:{invite,leave(){},findMatch(options){
   return new Promise((resolve,reject)=>calls.push({options,resolve,reject}));
  }}}};
 const document={getElementById:id=>id==='game'?{append:f=>frames.push(f)}:status,
  createElement(){return {hidden:false,contentWindow:{Module:{nativeScene:16},addEventListener(){},focus(){}},remove(){}};}};
 class Duel{constructor(o){Object.assign(this,o);sessions.push(this);}destroy(){this.closed=true;}}
 const scope={window:win,YouGame:win.YouGame,document,URLSearchParams,console,
  setTimeout:fn=>tasks.push(fn),RollbackDuelSession:Duel,ROLLBACK_PROTOCOL:'test-protocol',
  createTouch:()=>({clear(){},context(){},active:()=>false,read:()=>[0,0,0]}),
  engineAudioContext:()=>null,
  createInput:()=>({attach(){},destroy(){},read:()=>[0,0,0]})};
 const source=(await readFile(new URL('../src/app.mjs',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');
 await vm.runInNewContext(`(async()=>{${source}})()`,scope);
 const bridge=win.openSmashAttachEngine(frames[0].contentWindow);
 const flush=async()=>{while(tasks.length)tasks.shift()();await Promise.resolve();await Promise.resolve();};
 const action=async(a,v=0)=>{bridge.menuAction(a,v);await flush();};
 return {calls,sessions,bridge,status,flush,action};
}
function room(queue='private',isHost=true){
 const events=new Map();
 return {queue,isHost,me:'me',playing:false,full:false,round:1,readyCalls:0,settingsCalls:[],leaves:0,
  on(e,h){if(!events.has(e))events.set(e,new Set());events.get(e).add(h);},
  off(e,h){events.get(e)?.delete(h);},emit(e,data){for(const h of events.get(e)||[])h(data);},
  ready(){this.readyCalls++;},settings(o){this.settingsCalls.push(o);},leave(){this.leaves++;}};
}

test('Friends opens SDK picker and lobby; host waits for explicit Ready without public fill',async()=>{
 const t=await setup();await t.action(1,(2<<8)|4);
 const call=t.calls[0],r=room();assert.equal(call.options.friend,true);assert.equal(call.options.ui,true);
 assert.equal(call.options.ranked,undefined);assert.equal(t.status.textContent,'CHOOSE A FRIEND');
 call.options.onStatus({type:'lobby',room:r});
 assert.equal(r.readyCalls,0);assert.deepEqual(JSON.parse(JSON.stringify(r.settingsCalls)),[{fill:false}]);
 assert.equal(t.status.textContent,'WAITING FOR FRIEND');assert.equal(t.bridge.beforeTick(),false);
 r.full=true;call.options.onStatus({type:'join',room:r});
 assert.equal(r.readyCalls,0);assert.equal(t.sessions.length,0);assert.equal(t.status.textContent,'READY IN THE LOBBY');
 // The SDK's Ready barrier, not room fullness or findMatch's callbacks, starts play.
 r.playing=true;r.emit('ready',{round:1});call.resolve(r);await t.flush();
 assert.equal(t.sessions.length,1);assert.equal(t.sessions[0].fighter,4);
 r.playing=false;r.emit('result',{won:true});
 assert.equal(r.readyCalls,0);assert.equal(t.bridge.beforeTick(),false);
 r.playing=true;r.round=2;r.emit('ready',{round:2});assert.equal(t.sessions.length,2);
});

test('invite recipient joins the existing room with SDK lobby, without a second friend picker',async()=>{
 const t=await setup('friend-code');await t.action(1,(3<<8)|1);
 const call=t.calls[0],r=room('private',false);
 assert.equal(call.options.ui,true);assert.equal(call.options.friend,undefined);assert.equal(call.options.ranked,undefined);
 call.options.onStatus({type:'lobby',room:r});
 assert.equal(r.readyCalls,0);assert.deepEqual(r.settingsCalls,[]);
});

test('casual and ranked retain native ready and rematch flow',async()=>{
 for(const kind of [0,1]){
  const t=await setup();await t.action(1,kind<<8);const call=t.calls[0],r=room(kind?'ranked':'casual');
  assert.equal(call.options.ui,false);assert.equal(call.options.ranked,kind===1);assert.equal(call.options.friend,undefined);
  call.options.onStatus({type:'lobby',room:r});call.options.onStatus({type:'lobby',room:r});
  assert.equal(r.readyCalls,1);assert.equal(t.bridge.beforeTick(),true);
  await t.action(3);assert.equal(r.readyCalls,2);
 }
});

test('cancelling picker restores native menu; late room events cannot attach to a new search',async()=>{
 const t=await setup();await t.action(1,2<<8);t.calls[0].reject(new Error('Cancelled'));await t.flush();
 assert.equal(t.status.textContent,'CANCELLED');assert.equal(t.bridge.beforeTick(),true);
 await t.action(1,2<<8);const stale=t.calls[1];await t.action(2);await t.action(1,2<<8);
 const r=room();stale.options.onStatus({type:'lobby',room:r});
 assert.equal(r.leaves,1);assert.equal(r.readyCalls,0);assert.deepEqual(r.settingsCalls,[]);
 assert.equal(t.status.textContent,'CHOOSE A FRIEND');
});
