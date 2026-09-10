import {createInput} from './input.mjs';
const input=createInput({allowStart:true});input.attach(window);
let engine;
window.marthSamples=[];
window.marthState=()=>{
 if(!engine?.Module?._port_marth_probe||engine.Module.nativeScene!==22)return [];
 const at=engine.Module._port_marth_probe()>>2;
 const words=Array.from(engine.HEAP32.slice(at,at+32));
 return [words.slice(0,16),words.slice(16,32)];
};
window.openSmashAttachEngine=win=>{
 engine=win;input.attach(win);
 return {menuState:()=>({phase:0}),menuAction(){},ready(){},afterTick(){},
  beforeTick(){
   const rows=window.marthState();
   if(rows.length){window.marthSamples.push(rows);if(window.marthSamples.length>3600)window.marthSamples.shift();}
   return true;
  },
  error(e){document.querySelector('#error').textContent=e;console.error(e);},
  readPorts(ptr,H){const p=input.read();for(let i=0;i<4;i++){const b=(ptr>>2)+i*4;H[b]=i===0?2:1;H[b+1]=i===0?p[0]:0;H[b+2]=i===0?p[1]:0;H[b+3]=i===0?p[2]:0;}}
 };
};
const frame=document.createElement('iframe');frame.title='Marth in Open Smash';
const practice=new URLSearchParams(location.search).has('practice');
frame.src=`engine/play.html?SSB64_REMIX_MARTH=1&SSB64_BOOT_BATTLE=${practice?'1,8,16,0':'1,8,6,1'}&SSB64_VS_INTRO=0&SSB64_STOCKS=3`;
document.querySelector('#game').append(frame);
document.querySelector('#restart').onclick=()=>location.reload();
