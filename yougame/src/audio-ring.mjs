// One producer (game), one consumer (AudioWorklet). Control counters are uint32
// frame positions. Flush is acknowledged by the consumer: the producer never
// rewinds its read pointer while it is consuming a block.
export const C={WRITE:0,READ:1,FLUSH:2,GEN:3,ACK:4,RATE:5,UNDERRUN:6,OVERFLOW:7};
export function createAudioRing(frames=8192){
 if(frames<4||(frames&(frames-1)))throw new Error('Audio ring size must be a power of two');
 return {control:new SharedArrayBuffer(32),pcm:new SharedArrayBuffer(frames*4)};
}
export class AudioRing {
 constructor(buffers){this.control=new Int32Array(buffers.control);this.pcm=new Int16Array(buffers.pcm);this.capacity=this.pcm.length/2;this.mask=this.capacity-1;this.phase=0;this.generation=Atomics.load(this.control,C.GEN);}
 buffered(){const c=this.control,r=Atomics.load(c,Atomics.load(c,C.ACK)!==Atomics.load(c,C.GEN)?C.FLUSH:C.READ)>>>0;return Math.min(this.capacity,(Atomics.load(c,C.WRITE)-r)>>>0);}
 flush(){const c=this.control;Atomics.store(c,C.FLUSH,Atomics.load(c,C.WRITE));Atomics.add(c,C.GEN,1);}
 push(samples,channels=2){
  const c=this.control,frames=Math.floor(samples.length/channels),count=Math.min(frames,this.capacity-this.buffered()),w=Atomics.load(c,C.WRITE)>>>0;
  for(let i=0;i<count;i++){const j=((w+i)&this.mask)*2;this.pcm[j]=samples[i*channels];this.pcm[j+1]=samples[i*channels+(channels>1?1:0)];}
  Atomics.store(c,C.WRITE,(w+count)|0);if(count<frames)Atomics.add(c,C.OVERFLOW,1);return count;
 }
 render(left,right,outputRate){
  const c=this.control,gen=Atomics.load(c,C.GEN);let r=Atomics.load(c,C.READ)>>>0;
  if(gen!==this.generation){r=Atomics.load(c,C.FLUSH)>>>0;this.phase=0;this.generation=gen;Atomics.store(c,C.READ,r|0);Atomics.store(c,C.ACK,gen);}
  const w=Atomics.load(c,C.WRITE)>>>0,rate=Atomics.load(c,C.RATE)||outputRate,ratio=rate/outputRate;let missing=false;
  for(let i=0;i<left.length;i++){
   const available=(w-r)>>>0,advance=Math.floor(this.phase+ratio);
   if(available<Math.max(2,advance+1)){left[i]=right[i]=0;missing=true;continue;}
   const a=(r&this.mask)*2,b=((r+1)&this.mask)*2,t=this.phase;
   left[i]=(this.pcm[a]+(this.pcm[b]-this.pcm[a])*t)/32768;
   right[i]=(this.pcm[a+1]+(this.pcm[b+1]-this.pcm[a+1])*t)/32768;
   this.phase+=ratio;const consumed=Math.floor(this.phase);this.phase-=consumed;r=(r+consumed)>>>0;
  }
  // A rollback may invalidate samples while this block is being read.
  if(Atomics.load(c,C.GEN)!==gen){left.fill(0);right.fill(0);return;}
  Atomics.store(c,C.READ,r|0);if(missing)Atomics.add(c,C.UNDERRUN,1);
 }
}
