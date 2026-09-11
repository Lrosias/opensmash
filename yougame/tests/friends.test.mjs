import {GameLobby} from '../../controllers/online-lobby.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import vm from 'node:vm';
import {ACTIVE_PROFILE,engineParams,validFighter} from '../src/game-profile.mjs';
import {nativeResultArgs} from '../src/native-results.mjs';
// Exercise the actual app bridge, keeping only platform/DOM/native dependencies mocked.
async function setup(invite=null){
 const frames=[],calls=[],sets=[],tasks=[],ui={visible:false,setup(fighter,options){this.visible=true;this.fighter=fighter;this.options=options;},hide(){this.visible=false;},show(){},lobby(view){this.visible=true;this.lobbyView=view;},result(){},notice(){}};let uiOptions;
 const status={textContent:'',classList:{remove(){}}};
 const win={addEventListener(){},focus(){},YouGame:{ready:async()=>{},multiplayer:{invite,leave(){},joinLobby(options){return new Promise((resolve,reject)=>calls.push({options,resolve,reject}));}}}};
 const document={body:{classList:{remove(){},toggle(){}}},getElementById:id=>id==='game'?{append:f=>frames.push(f)}:id==='play-surface'?{append(){}}:status,createElement(){return{hidden:false,contentWindow:{Module:{nativeScene:16},addEventListener(){},focus(){}},remove(){}};}};
 class Set{constructor(o){Object.assign(this,o);sets.push(this);}destroy(){this.closed=true;}view(){return{round:this.round,wins:[0,0],fighters:[this.fighter,0],seat:0};}}
 const scope={GameLobby,PrivateSet:Set,nativeResultArgs,readAdapterMenu:()=>null,createMatchClock:()=>({show(){},hide(){},updateStatus(){}}),mountAdapterControls:()=>null,window:win,YouGame:win.YouGame,document,URLSearchParams,console,ACTIVE_PROFILE,engineParams,validFighter,COMPETITIVE_MODE:ACTIVE_PROFILE.mode,CompetitiveSet:Set,createCompetitiveUI:o=>{uiOptions=o;return ui;},setTimeout:fn=>tasks.push(fn),createTouch:()=>({clear(){},context(){},active:()=>false,read:()=>[0,0,0]}),engineAudioContext:()=>null,createInput:()=>({attach(){},destroy(){},read:()=>[0,0,0]})};
 const source=(await readFile(new URL('../src/app.mjs',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');await vm.runInNewContext(`(async()=>{${source}})()`,scope);
 const bridge=win.openSmashAttachEngine(frames[0].contentWindow),flush=async()=>{while(tasks.length)tasks.shift()();await Promise.resolve();await Promise.resolve();};
 return{calls,sets,bridge,status,ui,flush,pick:(id,f)=>uiOptions.onSelection(id,f),ready:id=>uiOptions.onReady(id),start:()=>uiOptions.onStart(),invite:()=>win.YouGame.multiplayer.invite,back:f=>uiOptions.onBack(f),join:async(f=4)=>{uiOptions.onJoinInvite(f);await flush();},queue:async(q,f=4)=>{uiOptions.onQueue(q,f);await flush();},action:async(a,v=0)=>{bridge.menuAction(a,v);await flush();}};
}
function room(queue='private',isHost=true){const events=new Map();return{queue,isHost,me:'me',players:[{id:'me'},{id:'peer'}],participants:[{id:'me',connectionId:'me',slot:0,localIndex:0,name:'Me'},{id:'peer',connectionId:'peer',slot:1,localIndex:0,name:'Peer'}],revision:1,playing:false,round:1,leaves:0,send(){},on(e,h){if(!events.has(e))events.set(e,new Set());events.get(e).add(h);},off(e,h){events.get(e)?.delete(h);},emit(e,data){for(const h of events.get(e)||[])h(data);},async beginMatch(){this.matchParticipants=this.participants.slice();this.playing=true;this.emit('ready',{round:this.round});},leave(){this.leaves++;}};}
function peerReady(r){r.emit('message',{from:'peer',data:{p:ACTIVE_PROFILE.mode+':lobby-v1',type:'lobby',revision:1,round:1,sequence:1,choices:[{id:'peer',selection:4,ready:true}]}});}
test('native Friends mode opens membership immediately before any fighter selection',async()=>{
 const t=await setup();try{await t.action(6,2);assert.equal(t.calls.length,1);const call=t.calls[0],r=room();assert.equal(call.options.queue,'friends');assert.equal(call.options.players,4);assert.equal(call.options.minPlayers,2);call.options.onStatus({room:r});call.resolve(r);await t.flush();assert.equal(t.ui.lobbyView.participants[0].selection,null);assert.equal(t.sets.length,0);t.pick('me',8);t.ready('me');peerReady(r);await t.start();assert.equal(t.sets.length,1);assert.equal(t.sets[0].fighter,8);}finally{t.back();}
});
test('incoming invite joins immediately and leaves fighter selection to the game lobby',async()=>{
 const t=await setup('friend-code');try{assert.equal(t.calls.length,1);const call=t.calls[0],r=room('private',false);assert.equal(call.options.queue,'friends');call.resolve(r);await t.flush();assert.equal(t.ui.lobbyView.participants[0].selection,null);assert.equal(t.sets.length,0);await t.join();assert.equal(t.calls.length,1);}finally{t.back();}
});
test('casual and ranked request two human slots, game readiness starts exactly one match',async()=>{for(const queue of ['casual','ranked']){const t=await setup();try{await t.queue(queue);const call=t.calls[0],r=room(queue);assert.equal(call.options.players,2);assert.equal(call.options.maxLocalPlayers,1);call.options.onStatus({room:r});call.resolve(r);await t.flush();t.pick('me',4);t.ready('me');peerReady(r);await t.start();r.emit('ready',{round:1});assert.equal(t.sets.length,1);}finally{t.back();}}});
test('cancel restores game menu and an obsolete lobby cannot attach after another search',async()=>{
 const t=await setup();try{await t.queue('friends');const stale=t.calls[0];await t.action(2);await t.queue('ranked');const r=room();stale.options.onStatus({room:r});assert.equal(r.leaves,1);stale.resolve(r);await t.flush();assert.equal(t.sets.length,0);assert.equal(t.status.textContent,'SEARCHING RANKED');}finally{t.back();}
});
