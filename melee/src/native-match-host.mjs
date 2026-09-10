import {createAssetLoader} from './asset-loader.mjs';
import {instantiateEngine} from './wasm-loader.mjs';
import {createShaderCache} from './shader-cache.mjs';
import {NativeRollbackEngine} from './rollback-engine.mjs';
import {STAGES,validSelection} from './competitive-rules.mjs';
let module,engine,loader,audio,port,booted=false,shaderCache,engineSha256,failed;
const status=value=>port.postMessage({status:value});
async function boot(launch) {
  if(booted)throw Error('A Melee match can only boot once.');booted=true;
  if(!launch||!STAGES.some(s=>s.id===launch.stage)||launch.selections?.length!==2||!launch.selections.every(validSelection))throw Error('Invalid Melee match configuration.');
  if(!crossOriginIsolated||!WebAssembly.Suspending||!WebAssembly.promising)throw Error('Online Melee requires Chrome with shared memory and WebAssembly promise integration.');
  const canvas=document.getElementById('canvas'),display=canvas.getContext('bitmaprenderer');
  const memory=new WebAssembly.Memory({initial:4096,maximum:32768,shared:true});
  let rejectBoot;failed=new Promise((_,reject)=>{rejectBoot=reject;});failed.catch(()=>{});
  const fatal=error=>{engine?.destroy();rejectBoot(error instanceof Error?error:Error(String(error)));};
  module=await Promise.race([failed,createMelee({canvas,wasmMemory:memory,noInitialRun:true,
    onMeleeAssetRequest:index=>loader.demand(index).catch(fatal),
    onMeleeAssetSelection:(kind,id)=>loader.selection(kind,id),onMeleeAssetMenu:()=>loader.enterMenu(),
    onMeleeAssetMatch:(...args)=>loader.match(...args).catch(fatal),
    onMeleeRollback:(...args)=>engine?.receive(...args),
    onMeleeFrame:bitmap=>{display.transferFromImageBitmap(bitmap);module._melee_frame_ack();},
    instantiateWasm(imports,receive){instantiateEngine(imports,(loaded,total)=>status({event:'download',name:'Melee engine',loaded,total}))
      .then(result=>{engineSha256=result.sha256;receive(result.instance,result.module);}).catch(fatal);return {};},
    locateFile:name=>new URL('./engine/'+name,location.href).href,print:console.log,printErr:console.warn,onAbort:fatal})]);
  engine=new NativeRollbackEngine(module,{timeout:120000});
  shaderCache=createShaderCache(module,engineSha256);await shaderCache.restore();
  loader=await createAssetLoader(module,memory,p=>status({event:'download',name:p.name,loaded:p.completed,total:p.total,error:p.error}));
  loader.background=false;
  await Promise.race([failed,Promise.all(['menu','match','stage:'+launch.stage,...launch.selections.map(s=>'fighter:'+s.fighter)].map(key=>loader.group(key,0)))]);
  const [a,b]=launch.selections;
  if(!module._melee_match_configure(launch.seed,launch.stage,a.fighter,a.color,b.fighter,b.color))throw Error('The Melee engine rejected the match rules.');
  audio=new AudioContext({sampleRate:48000,latencyHint:'interactive'});
  await audio.audioWorklet.addModule('./audio-worklet.js');
  new AudioWorkletNode(audio,'melee-audio',{outputChannelCount:[2],processorOptions:{memory,pointer:module._melee_audio_ring()}}).connect(audio.destination);
  // Autoplay permission must never hold the simulation's startup barrier.
  void audio.resume().then(()=>status({event:'audio',running:audio.state==='running'})).catch(()=>{});
  status({event:'audio',running:audio.state==='running'});
  status({event:'boot',name:'Starting your match'});
  const initial=engine.enable();
  module.callMain([new URL('./assets/',location.href).href,'rollback']);
  return Promise.race([initial,failed]);
}
window.addEventListener('message',event=>{
  if(event.source!==parent||event.origin!==location.origin||event.data?.kind!=='melee-native-port'||port)return;
  port=event.ports[0];
  port.onmessage=async({data})=>{
    try {
      if(!['boot','save','load','discard','step','checkpointStats','manageCheckpoints','cache','audio'].includes(data.method))throw Error('Unknown engine operation.');
      let value;
      if(data.method==='boot')value=await boot(...data.args);
      else if(data.method==='audio'){void audio?.resume().then(()=>status({event:'audio',running:audio.state==='running'}));value=true;}
      else if(data.method==='cache')value=await shaderCache?.save();
      else value=await Promise.race([failed,engine[data.method](...data.args)]);
      port.postMessage({id:data.id,value});
    }catch(error){port.postMessage({id:data.id,error:error.message});}
  };
});
