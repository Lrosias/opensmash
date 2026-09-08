import {TouchState} from './touch-state.mjs';
import {TouchStick} from './touch-stick.mjs';
export function createTouch({wakeAudio,leave}){
 const state=new TouchState(),root=document.getElementById('touch-controls');
 const gesture=new TouchStick();
 const stick=document.getElementById('touch-stick'),thumb=document.getElementById('stick-thumb');
 const stickZone=document.getElementById('touch-stick-zone');
 const coarse=matchMedia('(any-pointer: coarse)');
 const forced=new URLSearchParams(location.search).get('touch')==='1';
 let stickPointer=null,context='',holdTimer=null,rotated=false,lockPending=false,gameplay=false;
 const active=()=>forced||coarse.matches;
 function clear(){
  state.clear();gesture.end();stickPointer=null;thumb.style.transform='';
  root.querySelectorAll('.pressed').forEach(b=>b.classList.remove('pressed'));
  clearTimeout(holdTimer);document.getElementById('touch-leave').classList.remove('holding');
 }
 function layout(){
  const mobile=active(),w=window.innerWidth,h=window.innerHeight;
  rotated=mobile&&h>w;
  document.body.classList.toggle('touch',mobile);
  document.body.classList.toggle('rotated',rotated);
  document.body.classList.toggle('compact',Math.min(w,h)<=360);
  document.body.style.setProperty('--play-width',`${rotated?h:w}px`);
  document.body.style.setProperty('--play-height',`${rotated?w:h}px`);
  document.body.style.setProperty('--play-vw',`${(rotated?h:w)/100}px`);
  clear();
 }
 // YouGame owns fullscreen. Prefer native orientation locking if the browser
 // permits it; the rotated surface is usable immediately if it rejects.
 async function lockLandscape(){
  if(!active()||lockPending||!screen.orientation?.lock)return;
  lockPending=true;
  try{await screen.orientation.lock('landscape');}catch{}finally{lockPending=false;}
 }
 coarse.addEventListener('change',()=>{layout();lockLandscape();});
 window.addEventListener('blur',clear);window.addEventListener('resize',layout);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();});
 root.addEventListener('contextmenu',e=>e.preventDefault());
 function applyStick(x,y){
  const radius=gesture.origin.radius;
  state.move(x,y);const limit=Math.max(1,Math.hypot(x,y));
  thumb.style.transform=`translate(${x/limit*radius}px,${y/limit*radius}px)`;
 }
 function point(e){applyStick(...gesture.move(e.clientX,e.clientY));}
 stickZone.addEventListener('pointerdown',e=>{
  if(stickPointer!==null)return;e.preventDefault();wakeAudio();stickPointer=e.pointerId;
  stickZone.setPointerCapture(e.pointerId);
  const r=stick.getBoundingClientRect();
  const center=gameplay?{x:r.left+r.width/2,y:r.top+r.height/2}:null;
  applyStick(...gesture.start(e.clientX,e.clientY,r.width*.36,rotated,center));
 });
 stickZone.addEventListener('pointermove',e=>{if(e.pointerId===stickPointer){e.preventDefault();point(e);}});
 function releaseStick(e){if(e.pointerId===stickPointer){stickPointer=null;gesture.end();state.center();thumb.style.transform='';}}
 for(const event of ['pointerup','pointercancel','lostpointercapture'])stickZone.addEventListener(event,releaseStick);
 for(const button of root.querySelectorAll('[data-mask]')){
  const pressed=new Set();
  button.addEventListener('pointerdown',e=>{
   if(button.disabled)return;e.preventDefault();wakeAudio();button.setPointerCapture(e.pointerId);
   pressed.add(e.pointerId);state.press(e.pointerId,Number(button.dataset.mask));button.classList.add('pressed');
  });
  for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,e=>{
   pressed.delete(e.pointerId);state.release(e.pointerId);if(!pressed.size)button.classList.remove('pressed');
   if(event==='pointercancel')state.taps&=~Number(button.dataset.mask);
  });
 }
 document.addEventListener('fullscreenchange',()=>{layout();lockLandscape();});
 const quit=document.getElementById('touch-leave');
 quit.addEventListener('pointerdown',e=>{
  e.preventDefault();clear();quit.setPointerCapture(e.pointerId);quit.classList.add('holding');
  holdTimer=setTimeout(()=>{clear();leave();},1200);
 });
 for(const event of ['pointerup','pointercancel','lostpointercapture'])quit.addEventListener(event,()=>{clearTimeout(holdTimer);quit.classList.remove('holding');});
 layout();lockLandscape();
 return {
  read:()=>active()?state.read():[0,0,0],clear,active,
  context(online,scene){
   gameplay=online||[22,52,53,54].includes(scene);
   const key=`${online}:${gameplay}`;if(key===context)return;context=key;clear();
   root.classList.toggle('gameplay',gameplay);
   document.getElementById('touch-a-label').textContent=gameplay?'Attack':'Select';
   document.getElementById('touch-b-label').textContent=gameplay?'Special':'Back';
   document.getElementById('touch-start').hidden=online;
   quit.hidden=!online;
  }
 };
}
