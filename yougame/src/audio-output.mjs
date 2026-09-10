import {AudioRing,createAudioRing,C} from './audio-ring.mjs';
export async function createAudioOutput({muted=false}={}){
 const Context=globalThis.AudioContext||globalThis.webkitAudioContext;
 if(!globalThis.crossOriginIsolated||!globalThis.SharedArrayBuffer||!Context||!globalThis.AudioWorkletNode)return null;
 let context;
 try{
  context=new Context({latencyHint:'interactive'});
  await context.audioWorklet.addModule(new URL('./audio-worklet.mjs',import.meta.url));
  const buffers=createAudioRing(),ring=new AudioRing(buffers),node=new AudioWorkletNode(context,'opensmash-audio',{numberOfInputs:0,numberOfOutputs:1,outputChannelCount:[2],processorOptions:buffers});
  const gain=context.createGain();gain.gain.value=muted?0:1;node.connect(gain);gain.connect(context.destination);
  let failed=false,channels=2;
  node.onprocessorerror=()=>{failed=true;ring.flush();};
  return {context,ring,mode:'worklet',
   configure(rate,count){if(count<1||count>2||rate<8000||rate>192000)return false;channels=count;Atomics.store(ring.control,C.RATE,rate);return true;},
   buffered(){return context.state==='running'&&!failed?ring.buffered():0;},
   push(heap,ptr,bytes){if(context.state!=='running'||failed)return;ring.push(heap.subarray(ptr>>1,(ptr+bytes)>>1),channels);},
   flush(){ring.flush();},
   close(){node.disconnect();gain.disconnect();return context.close().catch(()=>{});},
   stats(){return {mode:'worklet',buffered:ring.buffered(),underruns:Atomics.load(ring.control,C.UNDERRUN),overflows:Atomics.load(ring.control,C.OVERFLOW),failed};}
  };
 }catch{await context?.close().catch(()=>{});return null;}
}
export function engineAudioContext(win){return win?.Module?.yougameAudio?.context||win?.Module?.SDL2?.audioContext||win?.SDL2?.audioContext;}
// Used only by silent test fixtures, including the SDL fallback.
export function muteEngineOutput(win){
 const connect=win.AudioNode?.prototype.connect;if(!connect)return;
 const sinks=new WeakMap();win.AudioNode.prototype.connect=function(target,...args){
  if(target===this.context.destination){let sink=sinks.get(this.context);if(!sink){sink=this.context.createGain();sink.gain.value=0;connect.call(sink,target);sinks.set(this.context,sink);}return connect.call(this,sink,...args);}
  return connect.call(this,target,...args);
 };
}
