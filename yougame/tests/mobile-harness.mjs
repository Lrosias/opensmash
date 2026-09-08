// Local-only engine fixture: exercise mobile controls against a real CPU battle.
import {createTouch} from '../dist/touch.mjs';
import {createInput} from '../dist/input.mjs';
let frame;
const touch=createTouch({wakeAudio:()=>frame?.contentWindow.SDL2?.audioContext?.resume().catch(()=>{}),leave:()=>location.reload()});
touch.context(false,22);
const input=createInput({allowStart:true,readTouch:()=>touch.read()});input.attach(window);
window.openSmashAttachEngine=win=>{
 input.attach(win);
 return {menuState:()=>({phase:0}),menuAction(){},ready(){},beforeTick:()=>true,afterTick(){},error:console.error,
 readPorts(ptr,H){const p=input.read();for(let i=0;i<4;i++){const b=(ptr>>2)+i*4;H[b]=i===0?2:1;H[b+1]=i===0?p[0]:0;H[b+2]=i===0?p[1]:0;H[b+3]=i===0?p[2]:0;}}
 };
};
frame=document.createElement('iframe');frame.title='Mobile control test';frame.src='../dist/engine/index.html?SSB64_BOOT_BATTLE=0,8,6,1&SSB64_STOCKS=3';document.getElementById('game').append(frame);
