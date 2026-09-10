import {TouchState} from './touch-state.mjs';
import {TouchStick} from './touch-stick.mjs';
export function createTouch({wakeAudio,leave}){
 const state=new TouchState(),root=document.getElementById('touch-controls');
 const gesture=new TouchStick();
 const stick=document.getElementById('touch-stick'),thumb=document.getElementById('stick-thumb');
 const stickZone=document.getElementById('touch-stick-zone');
 const coarse=matchMedia('(any-pointer: coarse)');
 const forced=new URLSearchParams(location.search).get('touch')==='1';
 let stickPointer=null,context='',holdTimer=null,rotated=false,gameplay=false,layoutFrame=null,layoutKey='';
 const buttons=[...root.querySelectorAll('[data-mask]')],pressed=new Map();
 const active=()=>forced||coarse.matches;
 function clear(){
  state.clear();gesture.end();stickPointer=null;thumb.style.transform='';
  pressed.clear();
  root.querySelectorAll('.pressed').forEach(b=>b.classList.remove('pressed'));
  clearTimeout(holdTimer);document.getElementById('touch-leave').classList.remove('holding');
 }
 function layout(){
  // innerWidth can include the previous landscape surface's overflow while a
  // mobile browser rotates, feeding an inflated size back into the next layout.
  const mobile=active(),w=document.documentElement.clientWidth,h=document.documentElement.clientHeight;
  const key=`${mobile}:${w}:${h}`;
  if(key===layoutKey)return;layoutKey=key;
  rotated=mobile&&h>w;
  document.body.classList.toggle('touch',mobile);
  document.body.classList.toggle('rotated',rotated);
  document.body.classList.toggle('compact',Math.min(w,h)<=360);
  document.body.style.setProperty('--play-width',`${rotated?h:w}px`);
  document.body.style.setProperty('--play-height',`${rotated?w:h}px`);
  document.body.style.setProperty('--play-vw',`${(rotated?h:w)/100}px`);
  clear();
 }
 // The host owns native fullscreen/orientation. Only rotate a portrait viewport;
 // requesting a native lock here can turn it again in an installed browser app.
 // Orientation events can precede resize; measure again on the next frame and
 // on viewport resize so the transform and input axes use the same geometry.
 function scheduleLayout(){
  clear();
  if(layoutFrame!==null)return;
  layoutFrame=window.requestAnimationFrame(()=>{layoutFrame=null;layout();});
 }
 coarse.addEventListener('change',scheduleLayout);
 window.addEventListener('blur',clear);window.addEventListener('pagehide',clear);
 window.addEventListener('resize',scheduleLayout);
 window.addEventListener('orientationchange',scheduleLayout);
 screen.orientation?.addEventListener('change',scheduleLayout);
 window.visualViewport?.addEventListener('resize',scheduleLayout);
 window.addEventListener('pageshow',scheduleLayout);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();else scheduleLayout();});
 // Some mobile interruptions end the touch stream without a usable pointerup.
 for(const event of ['touchend','touchcancel'])window.addEventListener(event,e=>{
  if(e.touches.length===0){
   const taps=event==='touchend'?state.taps:0;clear();state.taps=taps;
  }
 },{capture:true,passive:true});
 root.addEventListener('contextmenu',e=>e.preventDefault());
 function applyStick(x,y){
  const radius=gesture.origin.radius;
  const [axisX,axisY]=state.move(x,y);
  thumb.style.transform=`translate(${axisX/80*radius}px,${-axisY/80*radius}px)`;
 }
 function point(e){applyStick(...gesture.move(e.clientX,e.clientY));}
 stickZone.addEventListener('pointerdown',e=>{
  if(stickPointer!==null)return;e.preventDefault();wakeAudio();layout();
  try{stickZone.setPointerCapture(e.pointerId);}catch{return;}
  stickPointer=e.pointerId;
  const r=stick.getBoundingClientRect();
  const center={x:r.left+r.width/2,y:r.top+r.height/2};
  applyStick(...gesture.start(e.clientX,e.clientY,r.width*.36,rotated,center));
 });
 stickZone.addEventListener('pointermove',e=>{if(e.pointerId===stickPointer){
  if(e.buttons===0){releaseStick(e);return;}e.preventDefault();point(e);
 }});
 function releaseStick(e){if(e.pointerId===stickPointer){stickPointer=null;gesture.end();state.center();thumb.style.transform='';}}
 for(const event of ['pointerup','pointercancel','lostpointercapture'])stickZone.addEventListener(event,releaseStick);
 // Releases anywhere in the page also end the gesture if capture was interrupted.
 for(const event of ['pointerup','pointercancel'])window.addEventListener(event,releaseStick,true);
 function releaseButton(e){
  const button=pressed.get(e.pointerId);if(!button)return;
  pressed.delete(e.pointerId);state.release(e.pointerId);
  if(![...pressed.values()].includes(button))button.classList.remove('pressed');
  if(e.type==='pointercancel')state.taps&=~Number(button.dataset.mask);
 }
 for(const event of ['pointerup','pointercancel'])window.addEventListener(event,releaseButton,true);
 for(const button of buttons){
  button.addEventListener('pointerdown',e=>{
   if(button.disabled)return;e.preventDefault();wakeAudio();
   try{button.setPointerCapture(e.pointerId);}catch{return;}
   pressed.set(e.pointerId,button);state.press(e.pointerId,Number(button.dataset.mask));button.classList.add('pressed');
  });
  for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,releaseButton);
 }
 for(const event of ['fullscreenchange','webkitfullscreenchange'])document.addEventListener(event,scheduleLayout);
 const quit=document.getElementById('touch-leave');
 quit.addEventListener('pointerdown',e=>{
  e.preventDefault();clear();quit.setPointerCapture(e.pointerId);quit.classList.add('holding');
  holdTimer=setTimeout(()=>{clear();leave();},1200);
 });
 for(const event of ['pointerup','pointercancel','lostpointercapture'])quit.addEventListener(event,()=>{clearTimeout(holdTimer);quit.classList.remove('holding');});
 layout();
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
