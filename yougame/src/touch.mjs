import {TouchState} from './touch-state.mjs';
import {TouchStick} from './touch-stick.mjs';
export function createTouch({wakeAudio,leave}){
 const state=new TouchState(),root=document.getElementById('touch-controls');
 const gesture=new TouchStick();
 const stick=document.getElementById('touch-stick'),thumb=document.getElementById('stick-thumb');
 const stickZone=document.getElementById('touch-stick-zone');
 const coarse=matchMedia('(any-pointer: coarse)');
 const forced=new URLSearchParams(location.search).get('touch')==='1';
 let stickPointer=null,quitPointer=null,context='',holdTimer=null,rotated=false,gameplay=false,layoutFrame=null,layoutKey='',contactGeometry='';
 const quit=document.getElementById('touch-leave');
 const reset=document.getElementById('touch-reset');
 const buttons=[...root.querySelectorAll('[data-mask]')],pressed=new Map();
 const controlGroups=[...new Set(buttons.map(b=>b.parentElement).filter(Boolean))];
 const active=()=>forced||coarse.matches;
 function releaseCapture(target,id){try{target.releasePointerCapture(id);}catch{}}
 function clear(){
  const captures=[...pressed];
  if(stickPointer!==null)captures.push([stickPointer,stickZone]);
  if(quitPointer!==null)captures.push([quitPointer,quit]);
  state.clear();gesture.end();stickPointer=null;quitPointer=null;thumb.style.transform='';
  pressed.clear();contactGeometry='';
  // Drop logical ownership first: releasing capture can dispatch lostpointercapture.
  for(const [id,target] of captures)releaseCapture(target,id);
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
 function geometry(){
  // Groups are unaffected by the pressed button's decorative scale transform.
  return [rotated,...[stick,...controlGroups].map(el=>{
   const r=el.getBoundingClientRect();return `${r.left}:${r.top}:${r.width}:${r.height}`;
  })].join(':');
 }
 function syncContacts(){
  layout();
  // WebKit can settle iframe/safe-area geometry after the orientation/resize
  // event. Never consume a held contact against its previous visible origin.
  if(contactGeometry&&contactGeometry!==geometry())clear();
 }
 coarse.addEventListener('change',scheduleLayout);
 window.addEventListener('blur',clear);window.addEventListener('pagehide',clear);
 window.addEventListener('resize',scheduleLayout);
 window.addEventListener('orientationchange',scheduleLayout);
 screen.orientation?.addEventListener('change',scheduleLayout);
 window.visualViewport?.addEventListener('resize',scheduleLayout);
 window.visualViewport?.addEventListener('scroll',scheduleLayout);
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
 // The zone owns every stick pointer (its children have pointer-events:none).
 // offsetX/Y and offsetLeft/Top share the zone's untransformed layout space.
 // Keep input independent of viewport/client-coordinate agreement during
 // standalone transitions. Native hit testing already
 // accounts for the surface rotation, so do not rotate these local axes again.
 function point(e){applyStick(...gesture.move(e.offsetX,e.offsetY));}
 stickZone.addEventListener('pointerdown',e=>{
  syncContacts();if(stickPointer!==null)return;e.preventDefault();wakeAudio();
  try{stickZone.setPointerCapture(e.pointerId);}catch{return;}
  stickPointer=e.pointerId;contactGeometry=geometry();
  const center={x:stick.offsetLeft+stick.offsetWidth/2,y:stick.offsetTop+stick.offsetHeight/2};
  applyStick(...gesture.start(e.offsetX,e.offsetY,stick.offsetWidth*.36,false,center));
 });
 stickZone.addEventListener('pointermove',e=>{syncContacts();if(e.pointerId===stickPointer){
  if(e.buttons===0){releaseStick(e);return;}e.preventDefault();point(e);
 }});
 function releaseStick(e){if(e.pointerId===stickPointer){stickPointer=null;gesture.end();state.center();thumb.style.transform='';releaseCapture(stickZone,e.pointerId);}}
 for(const event of ['pointerup','pointercancel','lostpointercapture'])stickZone.addEventListener(event,releaseStick);
 // Releases anywhere in the page also end the gesture if capture was interrupted.
 for(const event of ['pointerup','pointercancel'])window.addEventListener(event,releaseStick,true);
 function releaseButton(e){
  const button=pressed.get(e.pointerId);if(!button)return;
  pressed.delete(e.pointerId);state.release(e.pointerId);
  releaseCapture(button,e.pointerId);
  if(![...pressed.values()].includes(button))button.classList.remove('pressed');
  if(e.type==='pointercancel')state.taps&=~Number(button.dataset.mask);
 }
 for(const event of ['pointerup','pointercancel'])window.addEventListener(event,releaseButton,true);
 for(const button of buttons){
  button.addEventListener('pointerdown',e=>{
   if(button.disabled||button.hidden)return;e.preventDefault();wakeAudio();syncContacts();
   // The native paused-match shortcut is A+B+Z+R. Release Start and other
   // fingers first: a simultaneous Start edge would resume instead of reset.
   if(button===reset)clear();
   try{button.setPointerCapture(e.pointerId);}catch{return;}
   contactGeometry=geometry();pressed.set(e.pointerId,button);state.press(e.pointerId,Number(button.dataset.mask));button.classList.add('pressed');
  });
  for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,releaseButton);
 }
 for(const event of ['fullscreenchange','webkitfullscreenchange'])document.addEventListener(event,scheduleLayout);
 quit.addEventListener('pointerdown',e=>{
  e.preventDefault();clear();try{quit.setPointerCapture(e.pointerId);}catch{return;}
  quitPointer=e.pointerId;contactGeometry=geometry();quit.classList.add('holding');
  holdTimer=setTimeout(()=>{clear();leave();},1200);
 });
 for(const event of ['pointerup','pointercancel','lostpointercapture'])quit.addEventListener(event,e=>{
  if(e.pointerId!==quitPointer)return;quitPointer=null;releaseCapture(quit,e.pointerId);clearTimeout(holdTimer);quit.classList.remove('holding');
 });
 layout();
 return {
  read:()=>{if(!active())return [0,0,0];if(stickPointer!==null||quitPointer!==null||pressed.size)syncContacts();return state.read();},clear,active,
  context(online,scene){
   gameplay=online||[22,52,53,54].includes(scene);
   // VS, 1P and bonus battles use the native reset chord. Training has its own menu.
   const canReset=!online&&[22,52,53].includes(scene);
   const key=`${online}:${gameplay}:${canReset}`;if(key===context)return;context=key;clear();
   root.classList.toggle('gameplay',gameplay);
   document.getElementById('touch-a-label').textContent=gameplay?'Attack':'Select';
   document.getElementById('touch-b-label').textContent=gameplay?'Special':'Back';
   document.getElementById('touch-start').hidden=online;
   reset.hidden=!canReset;
   quit.hidden=!online;
  }
 };
}
