import {GameLobby} from '../../controllers/online-lobby.mjs';
import {readAdapterMenu} from '../../controllers/controller-menu.mjs';
import {createMatchClock} from './match-clock.mjs';
import {mountAdapterControls} from '../../controllers/gc-adapter-ui.mjs';
import {ACTIVE_PROFILE,engineParams,validFighter} from './game-profile.mjs';
import {CompetitiveSet,PrivateSet,COMPETITIVE_MODE} from './competitive-set.mjs';
import {createCompetitiveUI} from './competitive-ui.mjs';
import {engineAudioContext} from './audio-output.mjs';
import {RollbackDuelSession,RollbackPartySession} from './rollback-session.mjs';
import {prepareRollbackEngine} from './rollback-engine.mjs';
import {createTouch} from './touch.mjs';
import {createInput} from './input.mjs';
import {nativeResultArgs} from './native-results.mjs';
const BUILD = 'YOUGAME_BUILD';
const adapter=mountAdapterControls();
const matchClock=createMatchClock();
document.title=ACTIVE_PROFILE.title+' · uGames';
let lobby=null,matchParticipants=null,lastResult=null;
let fighter=0, stage=6, queueKind=0, busy=false, room=null, session=null, set=null, menu=null, battle=null, presentation=null, generation=0, platformLobby=false,resultsPresentation=false;
let onlineMenu='custom';
let menuState={phase:0,text:'',revision:0};
const engines=new Map(),listeners=[],rotationSeeds=new WeakMap(),settledRounds=new WeakMap();
const touch=createTouch({wakeAudio:()=>{engineAudioContext((battle||menu)?.contentWindow)?.resume().catch(()=>{});},leave:()=>cleanup('YOU LEFT THE MATCH',6)});
const competitive=createCompetitiveUI({readController:()=>readAdapterMenu(adapter),onQueue:queue=>{if(busy)return;queueKind={casual:0,ranked:1,friends:2}[queue];online('custom');},onJoinInvite:()=>{queueKind=3;online();},onBack:()=>{cleanup();competitive.hide();menu?.contentWindow.focus();},onPick:choice=>{try{set?.choose(choice);}catch(e){set?.fail(e.message);}},onSelection:(id,choice)=>lobby?.pick(id,choice),onReady:id=>lobby?.toggleReady(id),onStart:()=>lobby?.start(),onReturnLobby:event=>{clearPresentation();if(event.ranked||!room){cleanup();showSetup();return;}lastResult=null;set?.destroy();set=null;showMenu();lobby?.resume();}});
const onlineEntry=document.createElement('button');onlineEntry.id='online-entry';onlineEntry.textContent='Competitive online';onlineEntry.onclick=()=>{if(!busy){onlineMenu='custom';touch.clear();showSetup();window.focus();}};document.getElementById('play-surface').append(onlineEntry);
function showSetup(){competitive.setup();}
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
 generation++;lobby?.destroy();lobby=null;matchParticipants=null;lastResult=null;session?.destroy();session=null;set?.destroy();set=null;
 for(const [r,event,handler]of listeners.splice(0))r.off(event,handler);
 const old=room;room=null;old?.leave();window.YouGame?.multiplayer?.leave();busy=false;onlineEntry.hidden=false;platformLobby=false;
}
function clearPresentation(){const old=presentation;presentation=null;resultsPresentation=false;document.body.classList.remove('native-results');removeEngine(old);if(menu)menu.hidden=false;}
// The native online scene already owns its mode picker. Resume that same scene
// when it started the search; the optional browser entry keeps its own picker.
function cleanup(message='',phase=0){clearPresentation();disconnect();if(onlineMenu==='native')competitive.hide();showMenu();if(onlineMenu!=='native'){showSetup();if(message)competitive.notice(message);}status(message,phase);}
function listen(r,event,handler){r.on(event,handler);listeners.push([r,event,handler]);}
function createEngine(params,duel=null,result=null){
 const frame=document.createElement('iframe');frame.title=duel?'OpenSmash64 online battle':result?'OpenSmash64 native results':'OpenSmash64 native menus';frame.allow='autoplay; gamepad; fullscreen';
 const input=createInput({adapter,allowStart:!duel,readTouch:()=>touch.read(),enabled:()=>!competitive.visible&&!platformLobby});input.attach(window);
 engines.set(frame,{input,duel,result});frame.src=`./engine/index.html?${params}`;document.getElementById('game').append(frame);return frame;
}
function launch(fighters,duel){
 clearPresentation();competitive.hide();matchClock.show();
 touch.clear();touch.context(true,22);removeEngine(battle);menu.hidden=true;engineAudioContext(menu.contentWindow)?.suspend().catch(()=>{});
 const params=engineParams({battle:{fighters,stage:duel.stage,participants:duel.participants},seed:duel.seed});
 battle=createEngine(params,duel);status('LOADING MATCH',3);
}
function menuAction(action,value){
 if(resultsPresentation||(platformLobby&&menuState.phase===4))return;
 const token=generation;
 // Do not remove an engine from inside its C -> JS callback.
 setTimeout(()=>{
  if(token!==generation||resultsPresentation||(platformLobby&&menuState.phase===4))return;
  if(action===6){queueKind=value;online('native');window.focus();}
  else if(action===5){queueKind=(value>>8)&255;online('native');window.focus();}
  else if(action===1){queueKind=value>>8;online('native');window.focus();}
  else if(action===2)cleanup();
  else if(action===3 && room && !room.playing){status('WAITING FOR OPPONENT',5);room.ready();}
  else if(action===4){cleanup();if(!window.YouGame?.multiplayer?.invite)online();}
 },0);
}
window.openSmashAttachEngine=win=>{
 const frame=[...engines.keys()].find(f=>f.contentWindow===win);
 if(!frame)throw new Error('Unexpected game frame');
 const {input,duel,result}=engines.get(frame);let pads=[[0,0,0],[0,0,0]],nativeState=null;input.attach(win);
 const resumeAudio=()=>engineAudioContext(win)?.resume().catch(()=>{});
 win.addEventListener('pointerdown',resumeAudio,true);win.addEventListener('keydown',resumeAudio,true);
 // Own controller mapping in menus too; SDL must not also interpret the same keys.
 win.addEventListener('keydown',e=>{if(e.code==='Escape'&&duel)setTimeout(()=>cleanup('YOU LEFT THE MATCH',6),0);},true);
 for(const kind of ['keydown','keyup'])win.addEventListener(kind,e=>{e.preventDefault();e.stopImmediatePropagation();},true);
 return {
  menuState:()=>menuState,
  menuAction:result?()=>{}:menuAction,
  async ready(raw){
   if(result){
    if(frame!==presentation||room!==result.room||set?.round!==result.round)return;
    // callMain yields before the first menu scene is initialized. Let that
    // scene finish before requesting results, or startup overwrites the request.
    result.booting=true;let menuFrames=0;
    for(let i=0;i<120&&menuFrames<2;i++){
     if(frame!==presentation||room!==result.room||set?.round!==result.round)return;
     raw.step();menuFrames=[7,9,16].includes(win.Module.nativeScene)?menuFrames+1:0;
     if(menuFrames<2)await new Promise(resolve=>setTimeout(resolve,0));
    }
    result.booting=false;
    if(frame!==presentation||room!==result.room||set?.round!==result.round)return;
    if(menuFrames<2)throw new Error('Native result menu did not initialize');
    try{resultsPresentation=win.Module?._port_remix_online_results?.(...result.args)===1;}catch{resultsPresentation=false;}
    if(resultsPresentation){frame.hidden=false;menu.hidden=true;engineAudioContext(menu.contentWindow)?.suspend().catch(()=>{});document.body.classList.add('native-results');competitive.result(result.event,result.view,{native:true});}
    else queueMicrotask(()=>{if(frame===presentation)clearPresentation();});
    return;
   }
   if(duel)try{const driver=await prepareRollbackEngine(raw,{getState:()=>nativeState,setPads:p=>{pads=p;},cancelled:()=>duel.closed});if(driver)duel.attach(driver);}catch(e){duel.fail(e.message);}
   if(!duel?.closed&&!touch.active()&&!competitive.visible&&!platformLobby)win.focus();
  },
  beforeTick(){if(result)return frame===presentation&&(result.booting||resultsPresentation&&!frame.hidden);if(!duel){onlineEntry.hidden=busy||![7,9,16].includes(win.Module.nativeScene);if(competitive.visible&&!resultsPresentation)return false;if(platformLobby&&busy&&!room?.playing&&!resultsPresentation)return false;if(!frame.hidden)touch.context(false,win.Module.nativeScene);return !frame.hidden;}return !duel.closed;},
  afterTick(...args){nativeState=args;},
  readPorts(ptr,H){const local=duel?null:(result||competitive.visible||platformLobby||resultsPresentation)?[[0,0,0],[0,0,0],null,null]:input.readPorts();for(let i=0;i<4;i++){
   const p=duel?pads[i]:local[i];const base=(ptr>>2)+i*4;
   H[base]=p?2:1;H[base+1]=p?.[0]||0;H[base+2]=p?.[1]||0;H[base+3]=p?.[2]||0;
  }},
  error(message){if(result){console.warn(message);queueMicrotask(()=>{if(frame===presentation){clearPresentation();competitive.result(result.event,result.view);}});return;}console.error(message);if(duel)duel.fail(message);else document.getElementById('status').classList.remove('sr-only');status('GAME COULD NOT LOAD',6);}
 };
};
function startRound(r,round,participants=matchParticipants){
 if(r!==room||set?.round===round)return;
 clearPresentation();
 session?.destroy();set?.destroy();
 try {if(!rotationSeeds.has(r))rotationSeeds.set(r,r.seed);const party=r.queue==='private'||participants&&(participants.length!==2||r.players.length!==2);const SetClass=party?PrivateSet:CompetitiveSet;fighter=participants?.find(p=>p.connectionId===r.me)?.selection??fighter;set=new SetClass({room:r,round,fighter,participants,build:BUILD,rotationSeed:rotationSeeds.get(r),
  onChange:view=>{if(view.phase!=='playing'){showMenu();platformLobby=false;}competitive.show(view,participants||r.players);if(view.phase!=='playing')window.focus();},
  onGame:config=>{
   session?.destroy();platformLobby=false;
   const SessionClass=participants?RollbackPartySession:RollbackDuelSession;
   session=new SessionClass({room:r,round,participants,game:config.game,expectedFighters:config.fighters,fighter:config.fighters[r.players.findIndex(p=>p.id===r.me)],stage:config.stage,build:BUILD,seed:config.seed,
    readInput:()=>engines.get(battle)?.input.read()||[0,0,0],readPorts:()=>engines.get(battle)?.input.readPorts()||[],launch,
    onGameResult:result=>{try{set?.completeGame(result);}catch(e){set?.fail(e.message);}},
    status:text=>{document.getElementById('status').textContent=text;matchClock.updateStatus(text);},stop:message=>cleanup(message,6)});
  },onError:message=>cleanup(message,6)});
 }catch(e){console.error(e);cleanup('ONLINE UNAVAILABLE: '+e.message,6);}
}
function bind(r){
 if(room===r)return;room=r;
 lobby=new GameLobby({room:r,protocol:COMPETITIVE_MODE+':lobby-v1',validSelection:validFighter,onChange:view=>{view.capacity=r.queue==='private'?4:2;if((!r.playing||view.waitingNext)&&!lastResult)competitive.lobby(view);},onStart:participants=>{matchParticipants=participants;lastResult=null;startRound(r,r.round,participants);},onError:error=>{competitive.notice(error.message);}});
 listen(r,'leave',player=>{
  if(r.playing&&matchParticipants&&!matchParticipants.some(p=>p.connectionId===player?.id))return;
  if(set&&!set.closed&&r.playing){
   session?.destroy();set.destroy();status('CONFIRMING FORFEIT',3);
   r.finish(matchParticipants?.length>2?{void:true}:{winner:r.me}).catch(()=>cleanup('OPPONENT DISCONNECTED',6));
  }else if(!lastResult){lobby?.refresh();}
 });
 listen(r,'close',()=>{if(lastResult){lobby?.destroy();lobby=null;room=null;return;}cleanup('CONNECTION CLOSED',6);});
 listen(r,'result',e=>{
  const view=set?.view();
  if(r!==room||!view||(Number.isInteger(e.round)&&e.round!==view.round)||settledRounds.get(r)===view.round)return;
  settledRounds.set(r,view.round);lastResult=e;
  const previous=session?.round===view.round?session:null;
  const args=matchParticipants?.length>2?null:nativeResultArgs(e,previous?.expectedFighters?{...view,fighters:previous.expectedFighters}:view,previous?.terminal);
  session?.destroy();session=null;set?.destroy();showMenu();platformLobby=false;clearPresentation();
  // Preserve the paused local menu and its roster/ports. Results get a separate
  // disposable engine; leaving or Continue cannot strand the local menu there.
  status(e.void?'SET VOID':e.draw?'DRAW':e.won?'SET WON':'SET LOST',4);
  competitive.result(e,view);
  if(args){presentation=createEngine(engineParams(),null,{args,event:e,view,room:r,round:view.round});presentation.hidden=true;}
 });

}

async function online(entry=onlineMenu){
 if(busy)return;
 onlineMenu=entry;
 if(!window.YouGame?.multiplayer?.joinLobby){status('ONLINE UNAVAILABLE',6);return;}
 platformLobby=false;competitive.hide();
 busy=true;onlineEntry.hidden=true;touch.clear();
 if(platformLobby)window.focus();
 status(queueKind===2?'CREATING FRIEND LOBBY':queueKind===3?'JOINING FRIEND ROOM':queueKind===1?'SEARCHING RANKED':'SEARCHING CASUAL',1);const token=++generation;
 try{
  const options={players:queueKind>=2?4:2,minPlayers:2,maxLocalPlayers:queueKind>=2?4:1,compatibility:BUILD+':slots-v1',mode:COMPETITIVE_MODE,queue:queueKind===1?'ranked':queueKind>=2?'friends':'casual',onStatus:s=>{
   if(token!==generation){s.room?.leave();return;}
   if(s.room)bind(s.room);
  }};
  const r=await YouGame.multiplayer.joinLobby(options);
  if(token!==generation){r.leave();return;}bind(r);
 }catch(e){if(token===generation){console.warn(e);cleanup(e.message==='Cancelled'?'':'COULD NOT CONNECT',e.message==='Cancelled'?0:6);}}
}
window.addEventListener('pagehide',disconnect);
const params=engineParams();
try{if(window.YouGame){await YouGame.ready();if(YouGame.multiplayer.invite){queueKind=3;params.set('SSB64_START_SCENE','16');params.set('SSB64_YOUGAME_INVITE','1');}}}catch(e){console.warn(e);}
menu=createEngine(params);
if(window.YouGame?.multiplayer?.invite){queueKind=3;online('native');window.focus();}
