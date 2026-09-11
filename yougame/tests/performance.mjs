import {engineAudioContext} from '../src/audio-output.mjs';
// Local-only comparison of the shipped offline clock and the optimized build.
// No snapshots, networking, or rollback controller participate in either variant.
const $=id=>document.getElementById(id);let frame,win,tickStart=0,ticks=0,record=null,rafPrevious=0,rafTick=0,ready=false,logs=[];
const logSize=()=>{try{return win.FS.stat('/libsdl/BattleShip/ssb64.log').size;}catch{return 0;}};
const samples=[];window.performanceResults=samples;
const percentile=(a,p)=>{if(!a.length)return 0;const s=[...a].sort((x,y)=>x-y);return +s[Math.min(s.length-1,Math.floor(s.length*p))].toFixed(2);};
const describe=a=>({n:a.length,p50:percentile(a,.5),p95:percentile(a,.95),p99:percentile(a,.99),max:a.length?+Math.max(...a).toFixed(2):0,over25:a.filter(x=>x>25).length,over50:a.filter(x=>x>50).length});
window.openSmashAttachEngine=w=>{win=w;
 // Keep audio processing representative while silencing the test's output.
 const connect=w.AudioNode.prototype.connect, sinks=new WeakMap();
 w.AudioNode.prototype.connect=function(target,...args){
  if(target===this.context.destination){let sink=sinks.get(this.context);if(!sink){sink=this.context.createGain();sink.gain.value=0;connect.call(sink,target);sinks.set(this.context,sink);}return connect.call(this,sink,...args);}
  return connect.call(this,target,...args);
 };
 for(const type of ['longtask','long-animation-frame'])try{new w.PerformanceObserver(list=>{if(record)record.long.push(...list.getEntries().map(e=>({type,start:+e.startTime.toFixed(1),duration:+e.duration.toFixed(1),blocking:e.blockingDuration,scripts:e.scripts?.map(s=>({duration:s.duration,source:s.sourceURL,fn:s.sourceFunctionName,invoker:s.invoker}))})));}).observe({type,buffered:false});}catch{}
 return {menuState:()=>({phase:0}),menuAction(){},error:e=>{$('report').textContent='ERROR: '+e;},
 ready(){
 const expand=w.MEMFS.expandFileStorage;w.MEMFS.expandFileStorage=function(node,capacity){
  const growing=capacity>(node.contents?.length||0),start=performance.now();const result=expand.call(this,node,capacity);
  if(record&&growing)record.growth.push({file:node.name,at:+(start-record.started).toFixed(1),capacity:node.contents?.length,duration:+(performance.now()-start).toFixed(2)});return result;
 };
 
 w.Module.onGameTick=()=>{const now=performance.now();ticks++;if(record){record.spans.push(now-tickStart);if(now-tickStart>25)record.slow.push({at:+(now-record.started).toFixed(1),duration:+(now-tickStart).toFixed(1),heap:win.HEAPU8?.byteLength});if(record.lastTick)record.intervals.push(now-record.lastTick);record.lastTick=now;}};
 const prior=w.Module.printErr;w.Module.printErr=t=>{if(t.includes('PROF'))logs.push(t);else prior(t);};
 ready=true;$('run').disabled=false;$('report').textContent='Ready. Audio muted; processing remains active. Allow battle to warm up, then measure.';},
 beforeTick(){tickStart=performance.now();return true;},afterTick(){},readPorts(ptr,H){for(let i=0;i<4;i++){const b=(ptr>>2)+i*4;H[b]=i===0?2:1;H[b+1]=H[b+2]=H[b+3]=0;}}};};
$('load').onclick=()=>{record=null;ready=false;$('run').disabled=true;win?.Module?.yougameDispose?.();frame?.remove();frame=document.createElement('iframe');frame.allow='autoplay; fullscreen';frame.src=($('variant').value==='baseline'?'../test-results/v1.7':'../dist')+'/engine/index.html?SSB64_YOUGAME_MUTE=1&SSB64_BOOT_BATTLE=0,8,6,1&SSB64_STOCKS=99&SSB64_FRAME_PROFILE=1'+($('variant').value==='fallback'?'&SSB64_YOUGAME_AUDIO=SDL':'');$('game').append(frame);$('report').textContent='Loading…';};
$('stop').onclick=()=>{record=null;ready=false;win?.Module?.yougameDispose?.();frame?.remove();$('run').disabled=true;};
$('full').onclick=()=>document.documentElement.requestFullscreen();
$('run').onclick=async()=>{if(!ready)return;await engineAudioContext(win)?.resume();$('run').disabled=true;logs=[];const mem=win.HEAPU8?.byteLength;
 record={variant:$('variant').value,started:performance.now(),startTicks:ticks,intervals:[],spans:[],raf:[],zero:0,multi:0,observations:0,long:[],slow:[],growth:[],logStart:logSize(),hidden:0,memoryStart:mem,audioStart:win.Module.yougameAudio?.stats()};
 $('report').textContent='Measuring 30 seconds…';setTimeout(()=>{const r=record;if(!r)return;record=null;const seconds=(performance.now()-r.started)/1000;
 try{logs=win.FS.readFile('/libsdl/BattleShip/ssb64.log',{encoding:'utf8'}).split('\n').filter(l=>l.includes('PROF'));}catch{}
 const result={variant:r.variant,seconds:+seconds.toFixed(2),fullscreen:!!document.fullscreenElement,viewport:[innerWidth,innerHeight],audio:engineAudioContext(win)?.state,simFps:+((ticks-r.startTicks)/seconds).toFixed(2),tickSpanMs:describe(r.spans),tickIntervalMs:describe(r.intervals),rafIntervalMs:describe(r.raf),rafCallbacks:r.observations,rafWithoutTick:r.zero,rafWithMultipleTicks:r.multi,hiddenCallbacks:r.hidden,fileGrowth:r.growth,logStart:r.logStart,logEnd:logSize(),longTasks:r.long,slowTicks:r.slow,muted:true,memoryStart:r.memoryStart,memoryEnd:win.HEAPU8?.byteLength,heapUsed:win.Module._port_heap_used(),scratchBytes:win.Module.yougameTextureScratch?.reduce((a,b)=>b-a),audioStart:r.audioStart,audioOutput:win.Module.yougameAudio?.stats()||{mode:"SDL"},profile:logs.slice(-9)};
 samples.push(result);$('report').textContent=JSON.stringify(result);$('run').disabled=false;},30000);};
try{new PerformanceObserver(list=>{if(record)record.long.push(...list.getEntries().map(e=>({start:+e.startTime.toFixed(1),duration:+e.duration.toFixed(1)})));}).observe({type:'longtask',buffered:false});}catch{}
function observe(t){if(record){if(rafPrevious)record.raf.push(t-rafPrevious);const n=ticks-rafTick;record.observations++;if(!n)record.zero++;if(n>1)record.multi++;if(document.hidden)record.hidden++;}rafPrevious=t;rafTick=ticks;requestAnimationFrame(observe);}requestAnimationFrame(observe);
