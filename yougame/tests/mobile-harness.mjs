// Local-only engine fixture: exercise mobile controls against a real CPU battle.
import {engineAudioContext} from '../dist/audio-output.mjs';
import {createTouch} from '../dist/touch.mjs';
import {createInput} from '../dist/input.mjs';
let frame,testPad=null;
const touch=createTouch({wakeAudio:()=>engineAudioContext(frame?.contentWindow)?.resume().catch(()=>{}),leave:()=>location.reload()});
touch.context(false,22);
const input=createInput({allowStart:true,readTouch:()=>touch.read()});input.attach(window);
window.openSmashAttachEngine=win=>{
 input.attach(win);
 return {menuState:()=>({phase:0}),menuAction(){},ready(){},beforeTick(){document.getElementById('status').textContent='Native scene '+win.Module.nativeScene;return true;},afterTick(){},error:console.error,
 readPorts(ptr,H){const p=testPad||input.read();for(let i=0;i<4;i++){const b=(ptr>>2)+i*4;H[b]=i===0?2:1;H[b+1]=i===0?p[0]:0;H[b+2]=i===0?p[1]:0;H[b+3]=i===0?p[2]:0;}}
 };
};
frame=document.createElement('iframe');frame.title='Mobile control test';frame.src='../dist/engine/index.html?SSB64_YOUGAME_MUTE=1&'+(new URLSearchParams(location.search).has('menu')?'SSB64_START_SCENE=7':'SSB64_BOOT_BATTLE=0,8,6,1&SSB64_STOCKS=3');document.getElementById('game').append(frame);

if(new URLSearchParams(location.search).has('menu')){
 const bar=document.createElement('div');bar.style='position:fixed;top:0;left:0;z-index:10000';
 for(const [label,mask]of [['Select',32768],['Back',16384]]){
  const button=document.createElement('button');button.textContent=label;button.onclick=()=>{testPad=[mask,0,0];setTimeout(()=>{testPad=null;},100);};bar.append(button);
 }
 const stop=document.createElement('button');stop.textContent='Stop simulation';stop.onclick=()=>{frame.contentWindow.Module?.yougameDispose?.();frame.remove();};bar.append(stop);document.body.append(bar);
}
