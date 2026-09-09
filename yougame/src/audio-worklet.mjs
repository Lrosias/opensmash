import {AudioRing} from './audio-ring.mjs';
class OpenSmashAudio extends AudioWorkletProcessor {
 constructor(options){super();this.ring=new AudioRing(options.processorOptions);}
 process(_inputs,outputs){const out=outputs[0];if(out?.length>=2)this.ring.render(out[0],out[1],sampleRate);return true;}
}
registerProcessor('opensmash-audio',OpenSmashAudio);
