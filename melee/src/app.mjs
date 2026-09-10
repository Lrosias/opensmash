import {createAssetLoader} from './asset-loader.mjs';
import {instantiateEngine} from './wasm-loader.mjs';
import {createShaderCache} from './shader-cache.mjs';
import {keyboardOptions,gameCubeInput} from './keyboard.mjs';
import {NativeRollbackEngine} from './rollback-engine.mjs';
import {startRollbackLab} from './rollback-lab.mjs';
import {MeleeCompetitiveUI} from './competitive-ui.mjs';
import {MeleeMatchAdapter} from './competitive-adapter.mjs';
import {createNativeMatch} from './native-match.mjs';
import {mountAdapterControls} from '../../controllers/gc-adapter-ui.mjs';
import {readAdapterMenu} from '../../controllers/controller-menu.mjs';
import {meleePad} from '../../controllers/gc-adapter.mjs';
const $ = id => document.getElementById(id);
const adapter=mountAdapterControls({before:$('controls')});
$('controls').previousElementSibling.classList.add('melee-adapter-entry');
const matchSound=document.createElement('button');matchSound.textContent='Enable sound';matchSound.hidden=true;
$('controls').before(matchSound);
matchSound.onclick=()=>state.competitive.session?.adapter?.engine?.resumeAudio?.().catch(()=>{});
const state = window.melee = {phase:'idle', errors:[], samples:[], module:null, displayedFrames:0};
let input, audio, node, assetLoader, lastFrame=0;
state.assetBlocked=false;
state.frameGaps=[];
state.competitive=new MeleeCompetitiveUI({root:$('competitive'),sdk:window.YouGame,readMenu:()=>readAdapterMenu(adapter),onLocal:()=>$('online').focus()});
fetch('./engine/wasm.json').then(r=>{if(!r.ok)throw Error('The Melee build could not load.');return r.json();}).then(manifest=>{
  if(!/^[a-f0-9]{64}$/.test(manifest.sha256))throw Error('Invalid Melee build identity.');
  state.competitive.setAdapter(room=>{setupInput();return new MeleeMatchAdapter({room,build:manifest.sha256,createEngine:createNativeMatch,
    input:()=>readSeat(0),onStatus:status=>{
      if(status.event==='audio')matchSound.hidden=status.running;
      if(status.event==='download'&&status.name)$('metrics').textContent=`${status.name} · ${Math.round(status.loaded/(status.total||1)*100)}%`;
      else if(status.event==='stall')$('metrics').textContent='Waiting for the connection…';
      else if(status.event==='overload')$('metrics').textContent='This device is running below game speed';
      else if(['resume','recovered'].includes(status.event))$('metrics').textContent='Online · 3-frame input buffer';
    }});},manifest.sha256);
}).catch(error=>{state.competitive.notice=error.message;state.competitive.render();});
$('online').onclick=()=>{if(window.YouGame?.input)setupInput();input?.hide();state.competitive.show();};
window.YouGame?.ui?.onChange(layout=>{
  $('competitive').classList.toggle('host-layout-ready',['ready','standalone'].includes(layout.status));
});
function fail(error) {
  const message = error?.message || String(error);
  state.errors.push(message); state.phase='error';
  $('status').textContent=message; $('status').classList.add('error');
  $('welcome').hidden=false; $('play').disabled=false; $('play-label').textContent='Reload & retry';
  $('play').onclick=()=>location.reload();
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
for(const id of ['welcome-controls','controls'])$(id).onclick=()=>{
  try{setupInput();YouGame.input.settings();}catch(error){$('status').textContent=error.message;}
  $(id).blur();
};
$('fullscreen').onclick=async()=>{
  try { await (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()); }
  catch(error) { console.warn('Fullscreen unavailable:',error); }
  $('fullscreen').blur();
};
$('report').onclick=()=>{
  const report={build:'opensmash-melee-progressive-assets-20260909',date:new Date().toISOString(),
    engineSha256:state.engineSha256,browser:navigator.userAgent,isolated:crossOriginIsolated,phase:state.phase,
    errors:state.errors,assetPreparation:state.assetStats,frameGaps:state.frameGaps.slice(-600),samples:state.samples};
  $('report-text').value=JSON.stringify(report,null,2);$('report-status').textContent='';
  $('report-dialog').showModal();
};
$('copy-report').onclick=async()=>{
  try { await navigator.clipboard.writeText($('report-text').value);$('report-status').textContent='Copied.'; }
  catch { $('report-text').focus();$('report-text').select();$('report-status').textContent='Select and copy the report text.'; }
};
$('close-report').onclick=()=>{$('report-dialog').close();$('close-report').blur();$('report').blur();};
$('report-dialog').addEventListener('close',()=>$('report').blur());

function readSeat(seat,snapshot=adapter.snapshot()) {
  if(snapshot.owned)return meleePad(snapshot.ports[seat],adapter.origins[seat]);
  const s=input?.player(seat)?.state;
  return s?gameCubeInput(s):[0,0,0,0,0,0,0];
}
function sampleInput() {
  state.competitive.pollInput(input?.player(0)?.state);
  const snapshot=adapter.snapshot();
  if (state.module && input && !state.rollback?.active) for (let seat=0; seat<4; seat++) {
    const s=input.player(seat)?.state;
    if (!s) continue;
    state.module._melee_input(seat,...(state.assetBlocked?[0,0,0,0,0,0,0]:readSeat(seat,snapshot)));
  }
  requestAnimationFrame(sampleInput);
}
requestAnimationFrame(sampleInput);

if(new URLSearchParams(location.search).has('rollback')){
  const button=document.createElement('button');button.textContent='Start rollback lab';
  $('controls').before(button);
  button.onclick=async()=>{
    if(state.phase!=='running'||state.rollback?.active)return;
    button.disabled=true;
    try {
      state.rollbackLab=await startRollbackLab({engine:state.rollback,
        input:seat=>readSeat(seat),onError:fail});
      button.textContent='Exit lab';button.disabled=false;button.onclick=()=>location.reload();
    }catch(error){fail(error);}
  };
}

$('play').onclick=async()=>{
  $('play').disabled=true; $('play-label').textContent='Preparing the arena'; $('loading').hidden=false;
  try {
    if (!crossOriginIsolated || typeof SharedArrayBuffer==='undefined')
      throw Error('This player has not enabled the browser features Melee needs. Open the game in a compatible player with shared memory enabled.');
    if (!WebAssembly.Suspending || !WebAssembly.promising)
      throw Error('This development build needs a current version of Chrome with WebAssembly promise integration.');
    if (!('OffscreenCanvas' in window) || !new OffscreenCanvas(1,1).getContext('webgl2'))
      throw Error('Melee requires a browser with WebGL 2 and worker canvas support.');
    if (!window.YouGame?.input) throw Error('The YouGame controls could not load. Check your connection and reload.');
    audio=new AudioContext({sampleRate:48000,latencyHint:'interactive'});
    await audio.resume();
    state.phase='loading'; $('status').textContent='Loading Melee…';
    setupInput();
    const memory=new WebAssembly.Memory({initial:4096,maximum:32768,shared:true});
    const display=$('canvas').getContext('bitmaprenderer');
    state.module=await createMelee({canvas:$('canvas'),wasmMemory:memory,noInitialRun:true,
      onMeleeAssetRequest:index=>assetLoader.demand(index).catch(fail),
      onMeleeAssetSelection:(kind,id)=>assetLoader.selection(kind,id),
      onMeleeAssetMenu:()=>assetLoader.enterMenu(),
      onMeleeAssetMatch:(...args)=>assetLoader.match(...args).catch(fail),
      onMeleeRollback:(...args)=>state.rollback?.receive(...args),
      onMeleeFrame(bitmap) {
        const now=performance.now();
        if(lastFrame){state.frameGaps.push({time:now,ms:now-lastFrame});if(state.frameGaps.length>6000)state.frameGaps.shift();}
        lastFrame=now;
        state.renderSize=[bitmap.width,bitmap.height];
        display.transferFromImageBitmap(bitmap);
        state.displayedFrames++;
        state.module._melee_frame_ack();
      },
      instantiateWasm(imports,receiveInstance) {
        instantiateEngine(imports,(loaded,total)=>{
          $('status').textContent='Loading the engine';
          $('progress-bar').style.width=`${loaded/total*100}%`;
          $('progress-detail').textContent=`${Math.round(loaded/total*100)}%`;
        }).then(result=>{state.engineSha256=result.sha256;receiveInstance(result.instance,result.module);}).catch(fail);
        return {};
      },
      locateFile:name=>new URL('./engine/'+name,location.href).href,
      print:line=>{console.log(line);state.lastLog=line;},
      printErr:line=>{console.warn(line);state.lastWarning=line;},
      onAbort:reason=>fail('Melee stopped: '+reason)});
    state.shaderCache=createShaderCache(state.module,state.engineSha256);
    await state.shaderCache.restore();
    setInterval(()=>state.shaderCache.save(),30000);
    state.rollback=new NativeRollbackEngine(state.module);
    $('status').textContent='Loading the menus';
    state.phase='preparing';
    assetLoader=await createAssetLoader(state.module,memory,progress=>{
      state.assetStats=progress.stats;state.assetBlocked=progress.blocked;
      const active=!!progress.name||!!progress.error;
      $('download-status').hidden=!active;
      $('download-status').classList.toggle('blocking',progress.blocked);
      $('download-label').textContent=progress.error?'Download paused':progress.background?`Saving ${progress.name} for later`:`Downloading ${progress.name}…`;
      $('download-detail').textContent=progress.error?`${progress.error} Check your connection and retry.`:
        `${(progress.completed/1048576).toFixed(1)} / ${(progress.total/1048576).toFixed(1)} MB${progress.blocked?' · Play resumes when ready':''}`;
      $('download-progress').max=progress.total||1;$('download-progress').value=progress.completed;
      $('download-retry').hidden=!progress.error;
      if(state.phase==='preparing'){
        $('progress-bar').style.width=`${progress.completed/(progress.total||1)*100}%`;
        $('progress-detail').textContent=$('download-detail').textContent;
      }
    });
    state.assetStats=assetLoader.stats;
    $('download-retry').onclick=()=>assetLoader.retry();
    await assetLoader.group('menu',0);
    state.menuTransferBytes=assetLoader.stats.networkBytes;
    await audio.audioWorklet.addModule('./audio-worklet.js');
    node=new AudioWorkletNode(audio,'melee-audio',{outputChannelCount:[2],processorOptions:{memory,pointer:state.module._melee_audio_ring()}});
    node.connect(audio.destination);
    $('status').textContent='Starting Melee…'; $('play').blur();
    state.phase='booting'; state.startedAt=performance.now();
    const params=new URLSearchParams(location.search);
    if(params.get('rollback')==='boot')state.rollbackBoot=state.rollback.waitForBoot().catch(fail);
    state.module.callMain([new URL('./assets/',location.href).href,...(params.has('profile')?['profile']:[]),
      ...(params.has('native-resolution')?['native-resolution']:[]),...(params.has('rollback')?['rollback']:[]),...(params.get('rollback')==='boot'?['rollback-boot']:[])]);
    let previous=performance.now(), count=0;
    setInterval(()=>{
      const now=performance.now(), presents=state.module._melee_stats();
      const sample={time:now,presents,fps:(presents-count)*1000/(now-previous),heapBytes:memory.buffer.byteLength,
        displayedFrames:state.displayedFrames,speed:state.module._melee_speed(),vps:state.module._melee_vps(),
        renderSize:state.renderSize,assetMisses:state.module._melee_asset_misses(),shaderCount:state.module._melee_shader_count(),shaderMillis:state.module._melee_shader_millis(),shaderMaxMs:state.module._melee_shader_max(),downloadedBytes:state.module._melee_downloaded_bytes()};
      const ringPointer=state.module._melee_audio_ring();
      const ring=new Uint32Array(memory.buffer,ringPointer,4);
      const sound=new Int16Array(memory.buffer,ringPointer+16,8192*2);
      sample.audioProduced=Atomics.load(ring,0);sample.audioConsumed=Atomics.load(ring,1);
      sample.audioUnderruns=Atomics.load(ring,2);sample.audioState=audio.state;
      sample.audioPeak=sound.reduce((peak,value)=>Math.max(peak,Math.abs(value)),0)/32768;
      state.samples.push(sample); if(state.samples.length>3600)state.samples.shift();
      if(presents>1 && state.phase==='booting') { state.phase='running'; $('welcome').hidden=true; document.body.classList.add('playing');input.show(); }
      sample.maxFrameGapMs=Math.max(0,...state.frameGaps.filter(f=>f.time>previous).map(f=>f.ms));
      $('metrics').textContent=`${sample.fps.toFixed(1)} FPS · ${Math.round(sample.speed*100)}% speed · ${Math.round(sample.heapBytes/1048576)} MB`;
      if(state.rollbackLab){
        const t=state.rollbackLab.timeline;
        sample.rollback={frame:t.frame,confirmed:t.confirmed,rollbacks:t.rollbacks,replayed:t.replayedFrames};
        $('metrics').textContent+=` · ${t.rollbacks} rollbacks · ${t.replayedFrames} replayed`;
      }
      previous=now;count=presents;
    },1000);
  } catch(error) { fail(error); }
};
document.addEventListener('visibilitychange',()=>{
  if(document.hidden && state.module && !state.rollback?.active) for(let seat=0;seat<4;seat++){state.module._melee_input(seat,0,0,0,0,0,0,0);}
});
