import {engineAudioContext} from './audio-output.mjs';
import {RollbackDuelSession,ROLLBACK_PROTOCOL} from './rollback-session.mjs';
import {prepareRollbackEngine} from './rollback-engine.mjs';
import {createTouch} from './touch.mjs';
import {createInput} from './input.mjs';
const BUILD = 'YOUGAME_BUILD';
let fighter=0, queueKind=0, busy=false, room=null, session=null, menu=null, battle=null, generation=0, platformLobby=false;
let menuState={phase:0,text:'',revision:0};
const engines=new Map(),listeners=[];
const touch=createTouch({wakeAudio:()=>{engineAudioContext((battle||menu)?.contentWindow)?.resume().catch(()=>{});},leave:()=>cleanup('YOU LEFT THE MATCH',6)});
function status(text,phase=menuState.phase){
 menuState={phase,text,revision:menuState.revision+1};
 document.getElementById('status').textContent=text;
 if(menu?.contentWindow.Module)menu.contentWindow.Module.yougameMenu=menuState;
}
function removeEngine(frame){
 if(!frame)return;engines.get(frame)?.input.destroy();engines.delete(frame);frame.contentWindow.Module?.yougameDispose?.();frame.remove();
}
function showMenu(){touch.clear();touch.context(false,9);removeEngine(battle);battle=null;menu.hidden=false;engineAudioContext(menu.contentWindow)?.resume().catch(()=>{});if(platformLobby)window.focus();else menu.contentWindow.focus();}
function disconnect(){
 generation++;session?.destroy();session=null;
 for(const [r,event,handler]of listeners.splice(0))r.off(event,handler);
 const old=room;room=null;old?.leave();window.YouGame?.multiplayer?.leave();busy=false;platformLobby=false;
}
function cleanup(message='',phase=0){disconnect();showMenu();status(message,phase);}
function listen(r,event,handler){r.on(event,handler);listeners.push([r,event,handler]);}
function createEngine(params,duel=null){
 const frame=document.createElement('iframe');frame.title=duel?'OpenSmash online battle':'OpenSmash native menus';frame.allow='autoplay; gamepad; fullscreen';
 const input=createInput({allowStart:!duel,readTouch:()=>touch.read()});input.attach(window);
 engines.set(frame,{input,duel});frame.src=`./engine/index.html?${params}`;document.getElementById('game').append(frame);return frame;
}
function launch(fighters,duel){
 touch.clear();touch.context(true,22);removeEngine(battle);menu.hidden=true;engineAudioContext(menu.contentWindow)?.suspend().catch(()=>{});
 const params=new URLSearchParams({SSB64_BOOT_BATTLE:`${fighters[0]},${fighters[1]},6,0`,SSB64_STOCKS:'3',SSB64_YOUGAME:'1',SSB64_YOUGAME_ROLLBACK:'1',SSB64_YOUGAME_SEED:String(duel.seed),SSB64_BOOT_HUMANS:'2',SSB64_BOOT_SLOTS:'hhoo',SSB64_VS_INTRO:'0'});
 battle=createEngine(params,duel);status('LOADING MATCH',3);
}
function menuAction(action,value){
 // Do not remove an engine from inside its C -> JS callback.
 setTimeout(()=>{
  if(action===1){fighter=value&255;queueKind=value>>8;online();}
  else if(action===2)cleanup();
  else if(action===3 && room && !room.playing){status('WAITING FOR OPPONENT',5);room.ready();}
  else if(action===4){cleanup();online();}
 },0);
}
window.openSmashAttachEngine=win=>{
 const frame=[...engines.keys()].find(f=>f.contentWindow===win);
 if(!frame)throw new Error('Unexpected game frame');
 const {input,duel}=engines.get(frame);let pads=[[0,0,0],[0,0,0]],nativeState=null;input.attach(win);
 const resumeAudio=()=>engineAudioContext(win)?.resume().catch(()=>{});
 win.addEventListener('pointerdown',resumeAudio,true);win.addEventListener('keydown',resumeAudio,true);
 // Own controller mapping in menus too; SDL must not also interpret the same keys.
 win.addEventListener('keydown',e=>{if(e.code==='Escape'&&duel)setTimeout(()=>cleanup('YOU LEFT THE MATCH',6),0);},true);
 for(const kind of ['keydown','keyup'])win.addEventListener(kind,e=>{e.preventDefault();e.stopImmediatePropagation();},true);
 return {
  menuState:()=>menuState,
  menuAction,
  async ready(raw){
   if(duel)try{const driver=await prepareRollbackEngine(raw,{getState:()=>nativeState,setPads:p=>{pads=p;},cancelled:()=>duel.closed});if(driver)duel.attach(driver);}catch(e){duel.fail(e.message);}
   if(!duel?.closed&&!touch.active())win.focus();
  },
  beforeTick(){if(!duel){if(platformLobby&&busy&&!room?.playing)return false;if(!frame.hidden)touch.context(false,win.Module.nativeScene);return !frame.hidden;}return !duel.closed;},
  afterTick(...args){nativeState=args;},
  readPorts(ptr,H){const local=duel?null:input.read();for(let i=0;i<4;i++){
   const p=duel?pads[i]:i===0?local:null;const base=(ptr>>2)+i*4;
   H[base]=p?2:1;H[base+1]=p?.[0]||0;H[base+2]=p?.[1]||0;H[base+3]=p?.[2]||0;
  }},
  error(message){console.error(message);if(duel)duel.fail(message);else document.getElementById('status').classList.remove('sr-only');status('GAME COULD NOT LOAD',6);}
 };
};
function startRound(r,round){
 if(r!==room||session?.round===round)return;
 session?.destroy();
 try { session=new RollbackDuelSession({room:r,round,fighter,build:BUILD,seed:YouGame.checksum({seed:r.seed,round}),readInput:()=>engines.get(battle)?.input.read()||[0,0,0],launch,
  status:text=>{document.getElementById('status').textContent=text;},stop:message=>{console.warn(message);cleanup('CONNECTION LOST',6);}}); } catch(e){console.error(e);cleanup('ONLINE UNAVAILABLE',6);}
}
function bind(r){
 if(room===r)return;room=r;
 listen(r,'ready',e=>startRound(r,e.round));
 listen(r,'leave',()=>{
  if(session&&!session.closed&&r.playing&&session.engineReady&&session.peerReady&&!session.reported){
   session.destroy();status('CONFIRMING FORFEIT',3);
   r.finish({winner:r.me}).then(()=>cleanup('YOU WIN BY FORFEIT',6)).catch(()=>cleanup('OPPONENT DISCONNECTED',6));
  }else cleanup('OPPONENT LEFT',6);
 });
 listen(r,'close',()=>cleanup('CONNECTION CLOSED',6));
 listen(r,'result',e=>{session?.destroy();showMenu();status(e.void?'MATCH VOID':e.draw?'DRAW':e.won?'YOU WIN':'YOU LOSE',4);});
 // Friends keep YouGame's visible lobby and explicit Ready/Continue actions.
 // Do not let an empty private room fill from the public queue before the friend joins.
 if(platformLobby){
  if(r.queue==='private'&&r.isHost)r.settings({fill:false});
 }else r.ready();
}
async function online(){
 if(busy)return;
 if(!window.YouGame?.multiplayer){status('ONLINE UNAVAILABLE',6);return;}
 platformLobby=queueKind===2||queueKind===3||!!YouGame.multiplayer.invite;
 busy=true;touch.clear();
 if(platformLobby)window.focus();
 status(queueKind===2?'CHOOSE A FRIEND':platformLobby?'JOINING FRIEND ROOM':queueKind===1?'SEARCHING RANKED':'SEARCHING',1);const token=++generation;
 try{
  const options={players:2,mode:ROLLBACK_PROTOCOL,ui:platformLobby,lobby:true,onStatus:s=>{
   if(token!==generation){s.room?.leave();return;}
   if(s.room){bind(s.room);if(platformLobby&&!s.room.playing)status(s.room.full?'READY IN THE LOBBY':'WAITING FOR FRIEND',2);}
  }};
  if(queueKind===2)options.friend=true;else if(queueKind!==3)options.ranked=queueKind===1;
  const r=await YouGame.multiplayer.findMatch(options);
  if(token!==generation){r.leave();return;}bind(r);if(r.playing)startRound(r,r.round);
 }catch(e){if(token===generation){console.warn(e);cleanup(e.message==='Cancelled'?'CANCELLED':'COULD NOT CONNECT',6);}}
}
window.addEventListener('pagehide',disconnect);
const params=new URLSearchParams({SSB64_START_SCENE:'7'});
try{if(window.YouGame){await YouGame.ready();if(YouGame.multiplayer.invite){queueKind=3;params.set('SSB64_START_SCENE','16');params.set('SSB64_YOUGAME_INVITE','1');}}}catch(e){console.warn(e);}
menu=createEngine(params);
