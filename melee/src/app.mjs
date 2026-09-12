import {createAssetLoader,defaultDecodeBudget} from './asset-loader.mjs';
import {instantiateEngine,prefetchEngine} from './wasm-loader.mjs';
import {createShaderCache} from './shader-cache.mjs';
import {keyboardOptions,gameCubeInput,withTouch} from './keyboard.mjs';
import {NativeRollbackEngine} from './rollback-engine.mjs';
import {createNativeSession} from './native-match.mjs';
import {MeleeNativeRoomSession,NATIVE_MENU_PROTOCOL} from './native-room-session.mjs';
import {mountAdapterControls} from '../../controllers/gc-adapter-ui.mjs';
import {meleePad} from '../../controllers/gc-adapter.mjs';
import {createTouch} from './touch.mjs';
import {createLocalEnginePause} from './local-engine-pause.mjs';
// The page boots straight into Melee. Modes are picked in the native menu the
// engine draws over the character select (LOCAL VERSUS / ONLINE: FRIENDS, CASUAL,
// RANKED); online games run a second engine in an iframe on Melee's own menus.
// The browser only relays the platform's status line into that native screen.
const $ = id => document.getElementById(id);
const adapter=mountAdapterControls();
document.querySelector('button[aria-label="GameCube adapter controls"]')?.classList.add('melee-adapter-entry');
const state = window.melee = {phase:'idle', errors:[], samples:[], module:null, displayedFrames:0, menu:{phase:0,text:'',revision:0}, queueKind:0, room:null, session:null, build:null};
let input, audio, node, assetLoader, lastFrame=0, generation=0, busy=false;
let resolveLocalReady,rejectLocalReady,pauseSequence=0;
const localReady=new Promise((resolve,reject)=>{resolveLocalReady=resolve;rejectLocalReady=reject;});
localReady.catch(()=>{});
const pauseRequests=new Map();
const localPause=state.localPause=createLocalEnginePause({ready:localReady,
  loader:()=>assetLoader,audio:()=>audio,resetFrames:()=>{lastFrame=0;},
  setPaused:paused=>new Promise((resolve,reject)=>{
    const sequence=++pauseSequence;
    const timer=setTimeout(()=>{pauseRequests.delete(sequence);reject(Error('The local Melee pause request timed out. Reload the game.'));},30000);
    pauseRequests.set(sequence,{resolve:()=>{clearTimeout(timer);resolve();},reject:error=>{clearTimeout(timer);reject(error);}});
    if(paused)for(let seat=0;seat<4;seat++)state.module._melee_input(seat,0,0,0,0,0,0,0);
    if(!state.module._melee_local_pause?.(sequence,Number(paused))){
      clearTimeout(timer);pauseRequests.delete(sequence);reject(Error('This Melee engine does not support pausing local play for online. Reload the updated build.'));
    }
  }),onError:error=>{console.warn(error);state.errors.push(error.message);$('status').textContent=error.message;$('status').classList.remove('sr-only');}
});
async function createOnlineEngine(launch,onStatus,signal) {
  const release=await localPause.acquire(signal);
  try {
    const engine=await createNativeSession(launch,onStatus,signal);
    const destroy=engine.destroy;
    return {...engine,get frame(){return engine.frame;},get active(){return engine.active;},
      get closed(){return engine.closed;},get pending(){return engine.pending;},
      destroy(){try{destroy();}finally{release();}}};
  } catch(error){release();throw error;}
}
function wakeAudio(){
  if(!localPause.blocked)audio?.resume().catch(()=>{});
  state.session?.engine?.resumeAudio?.().catch(()=>{});
}
state.assetBlocked=false;
state.frameGaps=[];
const params=new URLSearchParams(location.search);
const prefetchAllowed=!navigator.connection?.saveData&&!params.has('noprefetch');
const engineProgress={loaded:0,total:0};
state.prefetch={engine:prefetchAllowed,menu:prefetchAllowed};
function pill(kind,label,detail,fraction) {
  const box=$('download-status');box.hidden=false;box.dataset.kind=kind;
  $('download-label').textContent=label;$('download-detail').textContent=detail;
  $('download-bar').style.width=`${Math.max(0,Math.min(1,fraction))*100}%`;$('download-retry').hidden=kind!=='error';
}
function renderBoot(progress) {
  if(state.phase==='running'||progress?.error)return;
  const menu=state.menuProgress||{completed:0,total:0};
  const engineFraction=engineProgress.total?engineProgress.loaded/engineProgress.total:0;
  const menuFraction=menu.total?menu.completed/menu.total:0;
  const fraction=(engineFraction*2+menuFraction)/3;
  pill('preparing',state.phase==='booting'?'Starting Melee':'Loading Melee',`${Math.round(fraction*100)}%`,fraction);
}
function onAssetStatus(progress) {
  state.assetStats=progress.stats;state.assetBlocked=progress.blocked;
  if(localPause.blocked)return;
  if(progress.name==='menus'&&(progress.kind==='selected'||state.phase!=='running'))state.menuProgress={completed:progress.completed,total:progress.total};
  if(state.phase!=='running'){
    if(progress.error)pill('error','Download paused',`${progress.error} Check your connection and retry.`,0);
    else renderBoot(progress);
    return;
  }
  const active=!!progress.name||!!progress.error;
  if(!active){if($('download-status').dataset.kind!=='session')$('download-status').hidden=true;return;}
  const kind=progress.error?'error':progress.kind;
  const mb=n=>(n/1048576).toFixed(1);
  pill(kind,kind==='error'?'Download paused':kind==='preparing'?`Preloading ${progress.name}`:`Loading ${progress.name}`,
    kind==='error'?progress.error:kind==='preparing'?`${Math.round(progress.completed/(progress.total||1)*100)}%`:`${mb(progress.completed)} / ${mb(progress.total)} MB${kind==='blocking'?' · starting when ready':''}`,
    progress.completed/(progress.total||1));
}
function makeLoader() {
  const ready=createAssetLoader(null,null,onAssetStatus,{decodeBudget:defaultDecodeBudget()}).then(loader=>{
    assetLoader=loader;
    loader.background=prefetchAllowed;
    if(prefetchAllowed)void loader.group('menu',0);
    return loader;
  });
  ready.catch(error=>{state.prefetch.menu=false;console.warn('Menu prefetch skipped:',error);});
  return ready;
}
let loaderReady=makeLoader();
if(prefetchAllowed)prefetchEngine((loaded,total)=>{engineProgress.loaded=loaded;engineProgress.total=total;renderBoot();});
$('download-retry').onclick=()=>assetLoader?.retry();
window.YouGame?.ui?.onChange(layout=>{document.body.classList.toggle('host-layout-ready',['ready','standalone'].includes(layout.status));});

// Native menu bridge. Phases follow OpenSmash64: 0 mode list, 1 connecting or
// waiting (status text + BACK), 6 failed (TRY AGAIN / BACK).
function menuStatus(text,phase=state.menu.phase) {
  state.menu={phase,text,revision:state.menu.revision+1};
  $('status').textContent=text||'OpenSmash Melee';
  if(state.module)state.module.ccall('melee_menu_status',null,['number','string'],[phase,text||'']);
}
function sessionStatus(status) {
  if(typeof status==='string'){menuStatus(status,1);return;}
  if(status.event==='download'&&status.name)pill('session',status.name,`${Math.round(status.loaded/(status.total||1)*100)}%`,status.loaded/(status.total||1));
  else if(status.event==='stall')pill('session','Online','Waiting for the connection…',0);
  else if(status.event==='overload')pill('session','Online','This device is running below game speed',0);
  else if(['resume','recovered','boot'].includes(status.event)){const box=$('download-status');if(box.dataset.kind==='session')box.hidden=true;}
}
function disconnect() {
  generation++;busy=false;
  const session=state.session;state.session=null;
  const room=state.room;state.room=null;
  // Leaving must never take the page down: a rejected leave is logged, not fatal.
  for(const step of [()=>session?.destroy(),()=>room?.leave(),()=>window.YouGame?.multiplayer?.leave?.()])try{Promise.resolve(step()).catch(error=>console.warn(error));}catch(error){console.warn(error);}
  const box=$('download-status');if(box.dataset.kind==='session')box.hidden=true;
}
// Leaving online always lands back on the native online list of the local engine.
function cleanup(message='',phase=0){disconnect();touch.clear();menuStatus(message,phase);}
function bind(room,token) {
  if(state.room===room||token!==generation)return;
  state.room=room;
  room.on('close',()=>{if(token===generation&&state.room===room)cleanup('CONNECTION CLOSED',6);});
  state.session=new MeleeNativeRoomSession({room,build:state.build,createEngine:createOnlineEngine,
    readPorts:()=>{const snapshot=adapter.snapshot();return Array.from({length:4},(_,i)=>readSeat(i,snapshot));},
    onStatus:sessionStatus,onError:message=>{if(token===generation)cleanup(message,6);}});
}
async function online(kind) {
  if(busy)return;
  if(!window.YouGame?.multiplayer?.joinLobby){menuStatus('ONLINE UNAVAILABLE',6);return;}
  if(!state.build){menuStatus('MELEE IS STILL LOADING',6);return;}
  busy=true;state.queueKind=kind;touch.clear();
  const token=++generation,queue=kind===1?'ranked':kind>=2?'friends':'casual';
  menuStatus(kind===2?'CREATING FRIEND LOBBY':kind===3?'JOINING FRIEND ROOM':kind===1?'SEARCHING RANKED':'SEARCHING CASUAL',1);
  try {
    const room=await YouGame.multiplayer.joinLobby({players:queue==='friends'?4:2,minPlayers:2,maxLocalPlayers:queue==='friends'?4:1,mode:NATIVE_MENU_PROTOCOL,compatibility:state.build,queue,
      onStatus:s=>{if(token!==generation){s.room?.leave();return;}if(s.room)bind(s.room,token);}});
    if(token!==generation){room.leave();return;}
    bind(room,token);
  } catch(error) {
    if(token!==generation)return;
    console.warn(error);
    cleanup(error.message==='Cancelled'?'':'COULD NOT CONNECT',error.message==='Cancelled'?0:6);
  }
}
// Actions from the native menu: 6 pick a queue (0 casual, 1 ranked, 2 friends),
// 2 back, 4 try again, 7 local play chosen.
function menuAction(action,value) {
  const token=generation;
  // Never tear an engine down from inside its own callback.
  setTimeout(()=>{
    if(token!==generation)return;
    if(action===6)online(value);
    else if(action===2)cleanup();
    else if(action===4){cleanup();online(state.queueKind);}
  },0);
}
state.menuAction=menuAction;
const touch=createTouch({wakeAudio,
  leave:()=>{if(state.session)cleanup('YOU LEFT THE MATCH',6);},controller:()=>!!adapter?.owned});
adapter.subscribe(()=>touch.sync());
state.touch=touch;
$('canvas').addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse')touch.touched();},true);
for(const kind of ['pointerdown','keydown'])window.addEventListener(kind,wakeAudio,true);
window.addEventListener('keydown',e=>{if(e.code==='Escape'&&(state.session||busy))setTimeout(()=>cleanup(state.session?'YOU LEFT THE MATCH':'',state.session?6:0),0);},true);
window.addEventListener('pagehide',disconnect);
function fail(error) {
  const message = error?.message || String(error);
  rejectLocalReady(error);
  for(const request of pauseRequests.values())request.reject(error);
  pauseRequests.clear();
  state.errors.push(message); state.phase='error';
  $('status').textContent=`${message} Reload the page to try again.`; $('status').classList.remove('sr-only'); $('status').classList.add('error');
  $('download-status').hidden=true;
  console.error(error);
}
window.addEventListener('error', event => { if(state.phase!=='idle') fail(event.error || event.message); });
window.addEventListener('unhandledrejection', event => fail(event.reason));
function setupInput() {
  if(input)return;
  if(!window.YouGame?.input)throw Error('The controls could not load. Check your connection and reload.');
  input=YouGame.input.setup(keyboardOptions);
  input.hide();
}
function readSeat(seat,snapshot=adapter.snapshot(),peek=false) {
  if(snapshot.owned)return meleePad(snapshot.ports[seat],adapter.origins[seat]);
  const s=input?.player(seat)?.state;
  const pad=s?gameCubeInput(s):[0,0,0,0,0,0,0];
  return seat===0?withTouch(pad,touch.read(peek)):pad;
}
function sampleInput() {
  const snapshot=adapter.snapshot();
  // An online session owns the pads through readPorts: the local engine and its native
  // menu see neutral until the session ends, so B in a match can never leave the room.
  const online=!!state.session;touch.context(online);
  if (state.module && input && !state.rollback?.active && !localPause.blocked) for (let seat=0; seat<4; seat++) {
    const s=input.player(seat)?.state;
    if (!s) continue;
    // A blocked engine still drains touch taps, so none fires late when the download ends.
    state.module._melee_input(seat,...(state.assetBlocked||online?(seat===0&&!online&&touch.read(false),[0,0,0,0,0,0,0]):readSeat(seat,snapshot,false)));
  }
  requestAnimationFrame(sampleInput);
}
requestAnimationFrame(sampleInput);

async function boot() {
  try {
    if (!crossOriginIsolated || typeof SharedArrayBuffer==='undefined')
      throw Error('This player has not enabled the browser features Melee needs. Open the game in a compatible player with shared memory enabled.');
    if (!WebAssembly.Suspending || !WebAssembly.promising)
      throw Error('Melee needs a current version of Chrome with WebAssembly promise integration.');
    if (!('OffscreenCanvas' in window) || !new OffscreenCanvas(1,1).getContext('webgl2'))
      throw Error('Melee requires a browser with WebGL 2 and worker canvas support.');
    if (!window.YouGame?.input) throw Error('The YouGame controls could not load. Check your connection and reload.');
    const manifest=await fetch('./engine/wasm.json').then(r=>{if(!r.ok)throw Error('The Melee build could not load.');return r.json();});
    if(!/^[a-f0-9]{64}$/.test(manifest.sha256))throw Error('Invalid Melee build identity.');
    state.build=manifest.sha256;
    // Audio starts silent until the first click or key; the platform's Play click usually counts.
    audio=new AudioContext({sampleRate:48000,latencyHint:'interactive'});
    audio.resume().catch(()=>{});
    state.phase='loading';renderBoot();
    setupInput();
    const memory=new WebAssembly.Memory({initial:4096,maximum:32768,shared:true});
    const display=$('canvas').getContext('bitmaprenderer');
    state.module=await createMelee({canvas:$('canvas'),wasmMemory:memory,noInitialRun:true,
      onMeleeAssetRequest:index=>assetLoader.demand(index).catch(fail),
      onMeleeAssetSelection:(kind,id)=>assetLoader.selection(kind,id),
      onMeleeAssetMenu:()=>assetLoader.enterMenu(),
      onMeleeAssetMatch:(...args)=>assetLoader.match(...args).catch(fail),
      onMeleeRollback:(...args)=>state.rollback?.receive(...args),
      onMeleeMenu:menuAction,
      onMeleeLocalPause:(sequence,ok)=>{
        const request=pauseRequests.get(sequence);if(!request)return;
        pauseRequests.delete(sequence);
        if(ok)request.resolve();else request.reject(Error('The local Melee engine could not change pause state.'));
      },
      onMeleeFrame(bitmap) {
        resolveLocalReady();
        if(localPause.blocked){bitmap.close();state.module._melee_frame_ack();return;}
        const now=performance.now();
        if(lastFrame){state.frameGaps.push({time:now,ms:now-lastFrame});if(state.frameGaps.length>6000)state.frameGaps.shift();}
        lastFrame=now;
        state.renderSize=[bitmap.width,bitmap.height];
        display.transferFromImageBitmap(bitmap);
        state.displayedFrames++;
        state.module._melee_frame_ack();
      },
      instantiateWasm(imports,receiveInstance) {
        instantiateEngine(imports,(loaded,total)=>{engineProgress.loaded=loaded;engineProgress.total=total;renderBoot();})
          .then(result=>{state.engineSha256=result.sha256;receiveInstance(result.instance,result.module);}).catch(fail);
        return {};
      },
      locateFile:name=>new URL('./engine/'+name,location.href).href,
      print:line=>{console.log(line);state.lastLog=line;},
      printErr:line=>{console.warn(line);state.lastWarning=line;},
      onAbort:reason=>fail('Melee stopped: '+reason)});
    state.shaderCache=createShaderCache(state.module,state.engineSha256);
    await state.shaderCache.restore();
    setInterval(()=>{if(!localPause.blocked)void state.shaderCache.save();},30000);
    state.rollback=new NativeRollbackEngine(state.module);
    state.phase='preparing';
    try{assetLoader=await loaderReady;}catch{loaderReady=makeLoader();assetLoader=await loaderReady;}
    state.assetLoader=assetLoader;
    await assetLoader.attach(state.module,memory);
    state.assetStats=assetLoader.stats;
    await assetLoader.group('menu',0);
    state.menuTransferBytes=assetLoader.stats.networkBytes;
    await audio.audioWorklet.addModule('./audio-worklet.js');
    node=new AudioWorkletNode(audio,'melee-audio',{outputChannelCount:[2],processorOptions:{memory,pointer:state.module._melee_audio_ring()}});
    node.connect(audio.destination);
    state.phase='booting'; state.startedAt=performance.now();renderBoot();
    menuStatus(state.menu.text,state.menu.phase);
    if(params.get('rollback')==='boot')state.rollbackBoot=state.rollback.waitForBoot().catch(fail);
    state.module.callMain([new URL('./assets/',location.href).href,...(params.has('profile')?['profile']:[]),...(params.has('log')?['log']:[]),
      ...(params.has('native-resolution')?['native-resolution']:[]),...(params.has('rollback')?['rollback']:[]),...(params.get('rollback')==='boot'?['rollback-boot']:[])]);
    let previous=performance.now(), count=0;
    setInterval(()=>{
      const now=performance.now(), presents=state.module._melee_stats();
      if(localPause.blocked){previous=now;count=presents;return;}
      const sample={time:now,presents,fps:(presents-count)*1000/(now-previous),heapBytes:memory.buffer.byteLength,
        displayedFrames:state.displayedFrames,speed:state.module._melee_speed(),vps:state.module._melee_vps(),
        renderSize:state.renderSize,assetMisses:state.module._melee_asset_misses(),shaderCount:state.module._melee_shader_count(),shaderMillis:state.module._melee_shader_millis(),shaderMaxMs:state.module._melee_shader_max(),downloadedBytes:state.module._melee_downloaded_bytes()};
      const ringPointer=state.module._melee_audio_ring();
      const ring=new Uint32Array(memory.buffer,ringPointer,4);
      sample.audioProduced=Atomics.load(ring,0);sample.audioConsumed=Atomics.load(ring,1);
      sample.audioUnderruns=Atomics.load(ring,2);sample.audioState=audio.state;
      state.samples.push(sample); if(state.samples.length>3600)state.samples.shift();
      if(presents>1 && state.phase==='booting') { state.phase='running'; document.body.classList.add('playing');input.show();$('download-status').hidden=true;assetLoader.status(); }
      sample.maxFrameGapMs=Math.max(0,...state.frameGaps.filter(f=>f.time>previous).map(f=>f.ms));
      state.metrics=`${sample.fps.toFixed(1)} FPS · ${Math.round(sample.speed*100)}% speed · ${Math.round(sample.heapBytes/1048576)} MB`;
      previous=now;count=presents;
    },1000);
  } catch(error) { fail(error); }
}
document.addEventListener('visibilitychange',()=>{
  if(document.hidden && state.module && !state.rollback?.active) for(let seat=0;seat<4;seat++){state.module._melee_input(seat,0,0,0,0,0,0,0);}
});
void boot();
// A friend's invitation joins their room right away; the native screen shows the wait.
try{await window.YouGame?.ready?.();}catch(error){console.warn(error);}
if(window.YouGame?.multiplayer?.invite){
  const wait=setInterval(()=>{if(!state.build)return;clearInterval(wait);online(3);},250);
}
