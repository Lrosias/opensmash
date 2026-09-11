import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {TouchState} from '../src/touch-state.mjs';
import {TouchStick} from '../src/touch-stick.mjs';

// Exercise the production pointer handlers, including releases outside the zone.
async function setup(rotated,pads=[]){
 const element=()=>({listeners:{},style:{setProperty(key,value){this[key]=value;}},classList:{
  values:new Set(),add(key){this.values.add(key);},remove(key){this.values.delete(key);},
  toggle(key,on){if(on)this.add(key);else this.remove(key);},contains(key){return this.values.has(key);}},
  addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);},
  dispatch(type,pointerId,x=160,y=160,extra={}){
   const stick=get('touch-stick'),r=stick.getBoundingClientRect(),turn=document.body.classList.contains('rotated');
   const dx=x-r.left-r.width/2,dy=y-r.top-r.height/2;
   const offsetX=stick.offsetLeft+stick.offsetWidth/2+(turn?dy:dx);
   const offsetY=stick.offsetTop+stick.offsetHeight/2+(turn?-dx:dy);
   for(const fn of this.listeners[type]||[])fn({type,pointerId,target:this,clientX:x,clientY:y,offsetX,offsetY,preventDefault(){},...extra});
  },
  captures:new Set(),setPointerCapture(id){this.captures.add(id);},releasePointerCapture(id){this.captures.delete(id);},querySelectorAll:()=>[],
  getBoundingClientRect:()=>({left:100,top:100,width:120,height:120})});
 const elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);};
 Object.assign(get('touch-stick'),{offsetLeft:100,offsetTop:100,offsetWidth:120,offsetHeight:120});
 const button=get('touch-start');button.dataset={mask:'4096'};button.parentElement=get('touch-top');
 const reset=get('touch-reset');reset.dataset={mask:'57360'};reset.parentElement=get('touch-top');
 get('touch-controls').querySelectorAll=selector=>selector==='[data-mask]'?[button,reset]:[button,reset].filter(b=>b.classList.contains('pressed'));
 const frames=[];
 const win=Object.assign(element(),{innerWidth:rotated?390:844,innerHeight:rotated?844:390,
  visualViewport:element(),requestAnimationFrame(fn){frames.push(fn);return frames.length;}});
 const document=Object.assign(element(),{body:element(),getElementById:get});
 document.documentElement={get clientWidth(){return win.innerWidth;},get clientHeight(){return win.innerHeight;}};
 let locks=0;const orientation=Object.assign(element(),{lock(){locks++;return Promise.resolve();}});
 const clock={now:1e6};
 const scope={TouchState,TouchStick,window:win,document,screen:{orientation},matchMedia:()=>({matches:true,addEventListener(){}}),
  location:{search:'?touch=1'},URLSearchParams,setTimeout,clearTimeout,navigator:{getGamepads:()=>pads},owned:false,Date:{now:()=>clock.now}};
 const source=(await readFile(process.env.TOUCH_SOURCE||new URL('../src/touch.mjs',import.meta.url),'utf8'))
  .replace(/^import .*;\n/gm,'').replace('export function createTouch','function createTouch');
 vm.runInNewContext(source+'\nthis.touch=createTouch({wakeAudio(){},leave(){},controller:()=>this.owned});',scope);
 scope.touch.context(false,22);
 return {touch:scope.touch,zone:get('touch-stick-zone'),stick:get('touch-stick'),thumb:get('stick-thumb'),win,document,button,reset,group:get('touch-top'),quit:get('touch-leave'),orientation,pads,
  flush(){frames.splice(0).forEach(fn=>fn());},locks:()=>locks,own(value){scope.owned=value;scope.touch.sync();},advance(ms){clock.now+=ms;}};
}

for(const rotated of [false,true])test(`pointer sweeps and release stay straight and neutral (${rotated?'rotated':'landscape'})`,async()=>{
 const {touch,zone,thumb,win}=await setup(rotated),radius=120*.36;
 const point=x=>rotated?[160+radius*.4,160+x*radius]:[160+x*radius,160-radius*.4];
 const event=(target,type,id,x)=>target.dispatch(type,id,...point(x));
 event(zone,'pointerdown',1,3);
 assert.deepEqual(touch.read(),[0,80,32]);
 const vertical=thumb.style.transform.split(',')[1];
 for(const x of [2,1,.5,0,-.5,-1,-2,-3]){
  event(zone,'pointermove',1,x);
  assert.equal(touch.read()[2],32);
  assert.equal(thumb.style.transform.split(',')[1],vertical);
 }
 event(win,'pointerup',1,-3);
 assert.deepEqual(touch.read(),[0,0,0]);assert.equal(thumb.style.transform,'');
 event(zone,'pointermove',1,3);assert.deepEqual(touch.read(),[0,0,0]);
 event(zone,'pointerdown',2,3);assert.deepEqual(touch.read(),[0,80,32]);
 event(zone,'lostpointercapture',1,3);assert.deepEqual(touch.read(),[0,80,32]);
 event(win,'pointercancel',2,3);assert.deepEqual(touch.read(),[0,0,0]);
 for(const release of ['pointerup','pointercancel','lostpointercapture']){
  event(zone,'pointerdown',3,-3);assert.deepEqual(touch.read(),[0,-80,32]);
  event(zone,release,3,-3);assert.deepEqual(touch.read(),[0,0,0]);
 }
});

test('mobile reset sends the native chord without held Start or stick input',async()=>{
 const {touch,zone,button,reset}=await setup(false);
 button.dispatch('pointerdown',1);zone.dispatch('pointerdown',2,280,160);
 reset.dispatch('pointerdown',3);
 assert.equal(button.captures.size,0);assert.equal(zone.captures.size,0);
 assert.deepEqual(touch.read(),[0xe010,0,0]);
 reset.dispatch('pointerup',3);assert.deepEqual(touch.read(),[0,0,0]);
 // A quick tap is still consumed exactly once by the game.
 reset.dispatch('pointerdown',4);reset.dispatch('pointerup',4);
 assert.deepEqual(touch.read(),[0xe010,0,0]);assert.deepEqual(touch.read(),[0,0,0]);
});

test('mobile reset is local-battle-only and cannot leak across context changes',async()=>{
 const {touch,reset}=await setup(false);
 for(const scene of [22,52,53]){
  touch.context(false,scene);assert.equal(reset.hidden,false);
  reset.dispatch('pointerdown',1);touch.context(true,scene);
  assert.equal(reset.hidden,true);assert.equal(reset.captures.size,0);
  reset.dispatch('pointerdown',2);assert.deepEqual(touch.read(),[0,0,0]);
 }
 for(const scene of [7,9,16,21,24,54]){
  touch.context(false,scene);assert.equal(reset.hidden,true);
  reset.dispatch('pointerdown',3);assert.deepEqual(touch.read(),[0,0,0]);
 }
 touch.context(false,22);reset.dispatch('pointerdown',4);
 touch.context(false,54);assert.equal(reset.captures.size,0);
 assert.deepEqual(touch.read(),[0,0,0]);
});

for(const rotated of [false,true])test(`outside-circle taps work in all scenes (${rotated?'portrait':'landscape'})`,async()=>{
 const {touch,zone}=await setup(rotated);
 for(const scene of [7,9,10,22,52,53,54,99]){
  touch.context(false,scene);
  for(const direction of [-1,1]){
   zone.dispatch('pointerdown',1,rotated?160:160+direction*120,rotated?160+direction*120:160);
   assert.deepEqual(touch.read(),[0,80*direction,0]);
   zone.dispatch('pointerup',1);assert.deepEqual(touch.read(),[0,0,0]);
  }
 }
});

test('fullscreen and physical rotation share viewport geometry without a native lock',async()=>{
 const h=await setup(true),{touch,zone,win,document,orientation,flush}=h;
 assert.equal(document.body.classList.contains('rotated'),true);
 zone.dispatch('pointerdown',1,160,40);assert.equal(touch.read()[1],-80);
 // A standalone browser can report orientation before delivering new dimensions.
 orientation.dispatch('change');assert.deepEqual(touch.read(),[0,0,0]);flush();
 win.innerWidth=844;win.innerHeight=390;win.visualViewport.dispatch('resize');flush();
 assert.equal(document.body.classList.contains('rotated'),false);
 assert.equal(document.body.style['--play-width'],'844px');
 zone.dispatch('pointerdown',2,280,160);assert.deepEqual(touch.read(),[0,80,0]);
 document.dispatch('webkitfullscreenchange');flush();assert.deepEqual(touch.read(),[0,0,0]);
 // The opposite landscape orientation has the same viewport size.
 zone.dispatch('pointerdown',3,40,160);win.dispatch('orientationchange');flush();
 assert.deepEqual(touch.read(),[0,0,0]);
 win.innerWidth=390;win.innerHeight=844;win.dispatch('resize');document.dispatch('fullscreenchange');flush();
 assert.equal(document.body.classList.contains('rotated'),true);
 zone.dispatch('pointerdown',4,160,280);assert.deepEqual(touch.read(),[0,80,0]);
 assert.equal(h.locks(),0);
});

test('interrupted movement clears and the next contact works',async()=>{
 const {touch,zone,win,document,flush}=await setup(false);
 for(const event of ['blur','pagehide','pageshow','touchend','touchcancel']){
  zone.dispatch('pointerdown',1,40,160);assert.deepEqual(touch.read(),[0,-80,0]);
  win.dispatch(event,1,40,160,{touches:[]});flush();
  assert.deepEqual(touch.read(),[0,0,0]);
 }
 zone.dispatch('pointerdown',2,40,160);
 zone.dispatch('pointermove',2,40,160,{buttons:0});assert.deepEqual(touch.read(),[0,0,0]);
 zone.dispatch('pointerdown',3,40,160);document.hidden=true;document.dispatch('visibilitychange');
 assert.deepEqual(touch.read(),[0,0,0]);
 zone.setPointerCapture=()=>{throw new Error('Pointer is no longer active');};
 zone.dispatch('pointerdown',4,40,160);assert.deepEqual(touch.read(),[0,0,0]);
});

test('rotation ignores innerWidth inflated by the previous landscape surface',async()=>{
 const {document,win,flush}=await setup(false);
 document.documentElement={clientWidth:393,clientHeight:852};
 win.innerWidth=852;win.innerHeight=1848;
 win.dispatch('resize');flush();
 assert.equal(document.body.classList.contains('rotated'),true);
 assert.equal(document.body.style['--play-width'],'852px');
 assert.equal(document.body.style['--play-height'],'393px');
});

test('touch fallback preserves quick button taps and independent fingers',async()=>{
 const {touch,zone,button,win}=await setup(false);
 zone.dispatch('pointerdown',1,40,160);button.dispatch('pointerdown',2);
 button.dispatch('pointerup',2);win.dispatch('touchend',2,0,0,{touches:[{}]});
 assert.deepEqual(touch.read(),[4096,-80,0]);
 win.dispatch('touchend',1,0,0,{touches:[]});assert.deepEqual(touch.read(),[0,0,0]);
 button.dispatch('pointerdown',3);win.dispatch('pointerup',3);win.dispatch('touchend',3,0,0,{touches:[]});
 assert.deepEqual(touch.read(),[4096,0,0]);assert.deepEqual(touch.read(),[0,0,0]);
 button.dispatch('pointerdown',4);win.dispatch('touchcancel',4,0,0,{touches:[]});
 assert.deepEqual(touch.read(),[0,0,0]);assert.equal(button.classList.contains('pressed'),false);
 button.dispatch('pointerdown',5);win.dispatch('blur');button.dispatch('pointerdown',6);
 button.dispatch('pointerup',6);assert.equal(button.classList.contains('pressed'),false);
});

test('late geometry settlement cancels held stick/buttons and releases capture before resuming',async()=>{
 for(const rotated of [false,true]){
  const {touch,zone,stick,button,orientation,flush}=await setup(rotated);
  orientation.dispatch('change');flush(); // Browser event precedes final layout.
  zone.dispatch('pointerdown',1,rotated?160:280,rotated?280:160);
  button.dispatch('pointerdown',2);
  assert.deepEqual(touch.read(),[4096,80,0]);
  assert.equal(zone.captures.has(1),true);assert.equal(button.captures.has(2),true);
  // Same viewport, later safe-area/compositor layout; no second resize event.
  stick.getBoundingClientRect=()=>({left:150,top:120,width:120,height:120});
  assert.deepEqual(touch.read(),[0,0,0]);
  assert.equal(zone.captures.size,0);assert.equal(button.captures.size,0);
  zone.dispatch('pointermove',1,210,180,{buttons:1});
  assert.deepEqual(touch.read(),[0,0,0]);
  zone.dispatch('pointerdown',3,210,180);assert.deepEqual(touch.read(),[0,0,0]);
  zone.dispatch('pointermove',3,rotated?210:330,rotated?300:180,{buttons:1});
  assert.deepEqual(touch.read(),[0,80,0]);
 }
});

test('a pointermove before the queued resize frame cannot use the previous rotation',async()=>{
 const {touch,zone,win}=await setup(true);
 zone.dispatch('pointerdown',1,160,280);assert.deepEqual(touch.read(),[0,80,0]);
 win.innerWidth=844;win.innerHeight=390;
 zone.dispatch('pointermove',1,280,160,{buttons:1});
 assert.deepEqual(touch.read(),[0,0,0]);
 assert.equal(zone.captures.size,0);
 zone.dispatch('pointerdown',2,280,160);assert.deepEqual(touch.read(),[0,80,0]);
});

test('rotation recovery accepts full down immediately without a center tap',async()=>{
 for(const rotated of [false,true]){
  const {touch,zone,stick,orientation,flush}=await setup(rotated);
  zone.dispatch('pointerdown',1,rotated?160:280,rotated?280:160);
  assert.deepEqual(touch.read(),[0,80,0]);
  orientation.dispatch('change');flush();
  assert.deepEqual(touch.read(),[0,0,0]);
  // Geometry settles after the event; the first new touch is at full down,
  // with no intervening center contact to repair the gesture's origin.
  stick.getBoundingClientRect=()=>({left:150,top:120,width:120,height:120});
  zone.dispatch('pointermove',1,210,180,{buttons:1});
  assert.deepEqual(touch.read(),[0,0,0]);
  zone.dispatch('pointerup',1);
  zone.dispatch('pointerdown',2,rotated?90:210,rotated?180:300);
  assert.deepEqual(touch.read(),[0,0,-80]);
  zone.dispatch('pointerup',2);assert.deepEqual(touch.read(),[0,0,0]);
 }
});

test('same-size turns, viewport scroll, fullscreen exit/reentry cancel every owned pointer',async()=>{
 const {touch,zone,button,orientation,document,win,flush}=await setup(false);
 for(let turn=0;turn<3;turn++)for(const [target,event] of [[orientation,'change'],[win,'orientationchange'],[win.visualViewport,'scroll'],[document,'fullscreenchange'],[document,'webkitfullscreenchange']]){
  zone.dispatch('pointerdown',1,280,160);button.dispatch('pointerdown',2);
  assert.deepEqual(touch.read(),[4096,80,0]);
  target.dispatch(event);flush();
  assert.deepEqual(touch.read(),[0,0,0]);
  assert.equal(zone.captures.size,0);assert.equal(button.captures.size,0);
  assert.equal(button.classList.contains('pressed'),false);
 }
});

test('new stick contact cannot adopt a button held across delayed right-side layout',async()=>{
 const {touch,zone,button,group}=await setup(false);
 button.dispatch('pointerdown',1);assert.deepEqual(touch.read(),[4096,0,0]);
 group.getBoundingClientRect=()=>({left:150,top:100,width:120,height:120});
 zone.dispatch('pointerdown',2,160,160);
 assert.deepEqual(touch.read(),[0,0,0]);assert.equal(button.captures.size,0);
 zone.dispatch('pointermove',2,280,160,{buttons:1});assert.deepEqual(touch.read(),[0,80,0]);
});

test('rotation cancels leave hold and releases its capture without throwing on lost contact',async()=>{
 const {touch,quit,orientation,flush}=await setup(false);
 quit.dispatch('pointerdown',9);assert.equal(quit.captures.has(9),true);
 orientation.dispatch('change');flush();
 assert.equal(quit.captures.size,0);assert.equal(quit.classList.contains('holding'),false);
 quit.setPointerCapture=()=>{throw Error('Contact already ended');};
 assert.doesNotThrow(()=>quit.dispatch('pointerdown',10));touch.clear();
});

test('fresh Home Screen contacts retain full down and straight sides despite a viewport coordinate offset',async()=>{
 for(const rotated of [false,true]){
  const {touch,zone,orientation,flush}=await setup(rotated),radius=120*.36,bias=40;
  orientation.dispatch('change');flush();
  for(const [dx,dy] of [[0,0],[0,1],[1,0],[-1,0],[0,-1]]){
   // Model the reported mismatch, not a physically reproduced WebKit defect:
   // viewport/client coordinates disagree, but target-local hit coordinates do not.
   const local={offsetX:160+dx*radius,offsetY:160+dy*radius};
   const x=rotated?160-dy*radius+bias:160+dx*radius;
   const y=rotated?160+dx*radius:160+dy*radius-bias;
   zone.dispatch('pointerdown',1,x,y,local);
   assert.deepEqual(touch.read(),[0,dx*80||0,-dy*80||0]);
   zone.dispatch('pointerup',1);assert.deepEqual(touch.read(),[0,0,0]);
  }
 }
});

test('the last input picks the scheme: pad input hides the overlay, a touch brings it back',async()=>{
 const {touch,zone,button,document,win,pads,own,advance}=await setup(false);
 assert.equal(touch.pad,false);
 // An idle pad (phantom remote, or one nobody has touched) leaves the controls alone.
 pads.push({connected:true,buttons:[{pressed:false}],axes:[0,0,0,0]});win.dispatch('gamepadconnected');assert.equal(touch.pad,false);
 zone.dispatch('pointerdown',1,280,160);assert.deepEqual([...touch.read()],[0,80,0]);
 // The first press takes over: the held stick is released with its capture, nothing latched survives.
 pads[0].buttons[0].pressed=true;advance(60);
 assert.deepEqual([...touch.read()],[0,0,0]);
 assert.equal(touch.pad,true);assert.equal(document.body.classList.contains('pad'),true);
 assert.equal(zone.captures.size,0);
 // Releasing the button keeps the pad in charge; overlay contacts are ignored.
 pads[0].buttons[0].pressed=false;advance(60);
 zone.dispatch('pointerdown',2,280,160);button.dispatch('pointerdown',3);button.dispatch('pointerup',3);
 assert.deepEqual([...touch.read()],[0,0,0]);assert.equal(touch.pad,true);
 // A touch on the picture makes touch the last input again, with nothing replayed.
 touch.touched();assert.equal(touch.pad,false);assert.equal(document.body.classList.contains('pad'),false);
 assert.deepEqual([...touch.read()],[0,0,0]);
 zone.dispatch('pointerdown',4,280,160);assert.deepEqual([...touch.read()],[0,80,0]);zone.dispatch('pointerup',4);
 // A stick deflection counts as pad input too.
 pads[0].axes=[0,-.8,0,0];advance(60);assert.deepEqual([...touch.read()],[0,0,0]);assert.equal(touch.pad,true);
 // A pad that goes away without an event is noticed on the next polled read.
 pads.length=0;assert.deepEqual([...touch.read()],[0,0,0]);assert.equal(touch.pad,true);
 advance(60);assert.deepEqual([...touch.read()],[0,0,0]);assert.equal(touch.pad,false);
 // A disconnected entry never counts.
 pads.push({connected:false,buttons:[{pressed:true}],axes:[]});win.dispatch('gamepadconnected');assert.equal(touch.pad,false);
 // An owned GameCube adapter takes over without any gamepad event, through sync(),
 // and a touch cannot bring the overlay back while it owns the ports.
 own(true);assert.equal(touch.pad,true);touch.touched();assert.equal(touch.pad,true);
 own(false);assert.equal(touch.pad,false);
});

test('context changes and layout events re-check the controller while nothing reads',async()=>{
 const {touch,win,pads,flush}=await setup(false);
 pads.push({connected:true,buttons:[{pressed:true}],axes:[]});
 touch.context(true,22);assert.equal(touch.pad,true);
 pads.length=0;
 touch.context(false,9);assert.equal(touch.pad,false);
 pads.push({connected:true,buttons:[{pressed:true}],axes:[]});
 win.dispatch('resize');flush();assert.equal(touch.pad,true);
});

test('a controller already in use at load hides the overlay from the first frame',async()=>{
 const {touch,document}=await setup(true,[{connected:true,buttons:[{pressed:true}],axes:[]}]);
 assert.equal(touch.pad,true);assert.equal(document.body.classList.contains('pad'),true);
 assert.equal(document.body.classList.contains('rotated'),true);
});
