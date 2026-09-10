import {readAdapterMenu} from '../../controllers/controller-menu.mjs';
import {createMatchClock} from './match-clock.mjs';
import {mountAdapterControls} from '../../controllers/gc-adapter-ui.mjs';
import {ACTIVE_PROFILE,engineParams,validFighter} from './game-profile.mjs';
import {CompetitiveSet,COMPETITIVE_MODE} from './competitive-set.mjs';
import {createCompetitiveUI} from './competitive-ui.mjs';
import {engineAudioContext} from './audio-output.mjs';
import {RollbackDuelSession} from './rollback-session.mjs';
import {prepareRollbackEngine} from './rollback-engine.mjs';
import {createTouch} from './touch.mjs';
import {createInput} from './input.mjs';
const BUILD = 'YOUGAME_BUILD';
const adapter=mountAdapterControls();
const matchClock=createMatchClock();
document.title=ACTIVE_PROFILE.title+' · uGames';
let fighter=0, stage=6, queueKind=0, busy=false, room=null, session=null, set=null, menu=null, battle=null, generation=0, platformLobby=false,resultsPresentation=false;
let menuState={phase:0,text:'',revision:0};
const engines=new Map(),listeners=[],rotationSeeds=new WeakMap();
const touch=createTouch({wakeAudio:()=>{engineAudioContext((battle||menu)?.contentWindow)?.resume().catch(()=>{});},leave:()=>cleanup('YOU LEFT THE MATCH',6)});
const competitive=createCompetitiveUI({readController:()=>readAdapterMenu(adapter),onQueue:(queue,choice)=>{fighter=choice;queueKind={casual:0,ranked:1,friends:2}[queue];online();},onBack:()=>{competitive.hide();menu?.contentWindow.focus();},onPick:choice=>{try{set?.choose(choice);}catch(e){set?.fail(e.message);}}});
const onlineEntry=document.createElement('button');onlineEntry.id='online-entry';onlineEntry.textContent='Competitive online';onlineEntry.onclick=()=>{if(!busy){touch.clear();competitive.setup(fighter);window.focus();}};document.getElementById('play-surface').append(onlineEntry);
function status(text,phase=menuState.phase){
 menuState={phase,text,revision:menuState.revision+1};
 document.getElementById('status').textContent=text;
 if(menu?.contentWindow.Module)menu.contentWindow.Module.yougameMenu=menuState;
}
function removeEngine(frame){
 if(!frame)return;engines.get(frame)?.input.destroy();engines.delete(frame);frame.contentWindow.Module?.yougameDispose?.();frame.remove();
}
function showMenu(){matchClock.hide();if(!menu)return;touch.clear();touch.context(false,9);removeEngine(battle);battle=null;menu.hidden=false;engineAudioContext(menu.contentWindow)?.resume().catch(()=>{});if(platformLobby)window.focus();else menu.contentWindow.focus();}
function disconnect(){
 matchClock.hide();
 generation++;session?.destroy();session=null;set?.destroy();set=null;
 for(const [r,event,handler]of listeners.splice(0))r.off(event,handler);
 const old=room;room=null;old?.leave();window.YouGame?.multiplayer?.leave();busy=false;onlineEntry.hidden=false;platformLobby=false;
}
function cleanup(message='',phase=0){resultsPresentation=false;disconnect();showMenu();competitive.setup(fighter);if(message)competitive.notice(message);status(message,phase);}
function listen(r,event,handler){r.on(event,handler);listeners.push([r,event,handler]);}
function createEngine(params,duel=null){
 const frame=document.createElement('iframe');frame.title=duel?'OpenSmash64 online battle':'OpenSmash64 native menus';frame.allow='autoplay; gamepad; fullscreen';
 const input=createInput({adapter,allowStart:!duel,readTouch:()=>touch.read(),enabled:()=>!competitive.visible&&!platformLobby});input.attach(window);
 engines.set(frame,{input,duel});frame.src=`./engine/index.html?${params}`;document.getElementById('game').append(frame);return frame;
}
function launch(fighters,duel){
 resultsPresentation=false;competitive.hide();matchClock.show();
 touch.clear();touch.context(true,22);removeEngine(battle);menu.hidden=true;engineAudioContext(menu.contentWindow)?.suspend().catch(()=>{});
 const params=engineParams({battle:{fighters,stage:duel.stage},seed:duel.seed});
 battle=createEngine(params,duel);status('LOADING MATCH',3);
}
function menuAction(action,value){
 // Do not remove an engine from inside its C -> JS callback.
 setTimeout(()=>{
  if(action===5){fighter=validFighter(value&255)?value&255:0;queueKind=(value>>8)&255;stage=(value>>16)&255;competitive.setup(fighter);window.focus();}
  else if(action===1){fighter=validFighter(value&255)?value&255:0;queueKind=value>>8;competitive.setup(fighter);window.focus();}
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
   if(!duel?.closed&&!touch.active()&&!competitive.visible&&!platformLobby)win.focus();
  },
  beforeTick(){if(!duel){onlineEntry.hidden=busy||![7,9,16].includes(win.Module.nativeScene);if(competitive.visible)return false;if(platformLobby&&busy&&!room?.playing&&!resultsPresentation)return false;if(!frame.hidden)touch.context(false,win.Module.nativeScene);return !frame.hidden;}return !duel.closed;},
  afterTick(...args){nativeState=args;},
  readPorts(ptr,H){const local=duel?null:input.readPorts();for(let i=0;i<4;i++){
   const p=duel?pads[i]:local[i];const base=(ptr>>2)+i*4;
   H[base]=p?2:1;H[base+1]=p?.[0]||0;H[base+2]=p?.[1]||0;H[base+3]=p?.[2]||0;
  }},
  error(message){console.error(message);if(duel)duel.fail(message);else document.getElementById('status').classList.remove('sr-only');status('GAME COULD NOT LOAD',6);}
 };
};
function startRound(r,round){
 if(r!==room||set?.round===round)return;
 session?.destroy();set?.destroy();
 try {if(!rotationSeeds.has(r))rotationSeeds.set(r,r.seed);set=new CompetitiveSet({room:r,round,fighter,build:BUILD,rotationSeed:rotationSeeds.get(r),
  onChange:view=>{if(view.phase!=='playing'){showMenu();platformLobby=false;}competitive.show(view,r.players);if(view.phase!=='playing')window.focus();},
  onGame:config=>{
   session?.destroy();platformLobby=false;
   session=new RollbackDuelSession({room:r,round,game:config.game,expectedFighters:config.fighters,fighter:config.fighters[r.players.findIndex(p=>p.id===r.me)],stage:config.stage,build:BUILD,seed:config.seed,
    readInput:()=>engines.get(battle)?.input.read()||[0,0,0],launch,
    onGameResult:result=>{try{set?.completeGame(result);}catch(e){set?.fail(e.message);}},
    status:text=>{document.getElementById('status').textContent=text;matchClock.updateStatus(text);},stop:message=>cleanup(message,6)});
  },onError:message=>cleanup(message,6)});
 }catch(e){console.error(e);cleanup('ONLINE UNAVAILABLE: '+e.message,6);}
}
function bind(r){
 if(room===r)return;room=r;
 listen(r,'ready',e=>startRound(r,e.round));
 listen(r,'leave',()=>{
  if(set&&!set.closed&&r.playing){
   session?.destroy();set.destroy();status('CONFIRMING FORFEIT',3);
   r.finish({winner:r.me}).catch(()=>cleanup('OPPONENT DISCONNECTED',6));
  }else cleanup('OPPONENT LEFT',6);
 });
 listen(r,'close',()=>cleanup('CONNECTION CLOSED',6));
 listen(r,'result',e=>{
  const view=set?.view();session?.destroy();set?.destroy();showMenu();platformLobby=true;
  status(e.void?'SET VOID':e.draw?'DRAW':e.won?'SET WON':'SET LOST',4);
  competitive.result(e,view);
 });
 if(r.queue==='private'&&r.isHost)r.settings({fill:false});
}

async function online(){
 if(busy)return;
 if(!window.YouGame?.multiplayer){status('ONLINE UNAVAILABLE',6);return;}
 platformLobby=true;competitive.hide();
 busy=true;onlineEntry.hidden=true;touch.clear();
 if(platformLobby)window.focus();
 status(queueKind===2?'CHOOSE A FRIEND':queueKind===3?'JOINING FRIEND ROOM':queueKind===1?'SEARCHING RANKED':'SEARCHING CASUAL',1);const token=++generation;
 try{
  const options={players:2,mode:COMPETITIVE_MODE,queue:queueKind===1?'ranked':queueKind===2?'friends':'casual',onStatus:s=>{
   if(token!==generation){s.room?.leave();return;}
   if(s.room)bind(s.room);
  }};
  const r=await YouGame.multiplayer.open(options);
  if(token!==generation){r.leave();return;}bind(r);if(r.playing)startRound(r,r.round);
 }catch(e){if(token===generation){console.warn(e);cleanup(e.message==='Cancelled'?'CANCELLED':'COULD NOT CONNECT',6);}}
}
window.addEventListener('pagehide',disconnect);
const params=engineParams();
try{if(window.YouGame){await YouGame.ready();if(YouGame.multiplayer.invite){queueKind=3;params.set('SSB64_START_SCENE','16');params.set('SSB64_YOUGAME_INVITE','1');}}}catch(e){console.warn(e);}
menu=createEngine(params);
if(window.YouGame?.multiplayer?.invite)online();
