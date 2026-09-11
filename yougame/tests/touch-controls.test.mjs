import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {TouchState} from '../src/touch-state.mjs';
import {TouchStick} from '../src/touch-stick.mjs';

// Exercise the production pointer handlers, including releases outside the zone.
async function setup(rotated){
 const element=()=>({listeners:{},style:{setProperty(key,value){this[key]=value;}},classList:{
  values:new Set(),add(key){this.values.add(key);},remove(key){this.values.delete(key);},
  toggle(key,on){if(on)this.add(key);else this.remove(key);},contains(key){return this.values.has(key);}},
  addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);},
  dispatch(type,pointerId,x=160,y=160,extra={}){for(const fn of this.listeners[type]||[])fn({type,pointerId,clientX:x,clientY:y,preventDefault(){},...extra});},
  setPointerCapture(){},querySelectorAll:()=>[],
  getBoundingClientRect:()=>({left:100,top:100,width:120,height:120})});
 const elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);};
 const button=get('touch-start');button.dataset={mask:'4096'};
 get('touch-controls').querySelectorAll=selector=>selector==='[data-mask]'?[button]:[button].filter(b=>b.classList.contains('pressed'));
 const frames=[];
 const win=Object.assign(element(),{innerWidth:rotated?390:844,innerHeight:rotated?844:390,
  visualViewport:element(),requestAnimationFrame(fn){frames.push(fn);return frames.length;}});
 const document=Object.assign(element(),{body:element(),getElementById:get});
 document.documentElement={get clientWidth(){return win.innerWidth;},get clientHeight(){return win.innerHeight;}};
 let locks=0;const orientation=Object.assign(element(),{lock(){locks++;return Promise.resolve();}});
 const scope={TouchState,TouchStick,window:win,document,screen:{orientation},matchMedia:()=>({matches:true,addEventListener(){}}),
  location:{search:'?touch=1'},URLSearchParams,setTimeout,clearTimeout};
 const source=(await readFile(new URL('../src/touch.mjs',import.meta.url),'utf8'))
  .replace(/^import .*;\n/gm,'').replace('export function createTouch','function createTouch');
 vm.runInNewContext(source+'\nthis.touch=createTouch({wakeAudio(){},leave(){}});',scope);
 scope.touch.context(false,22);
 return {touch:scope.touch,zone:get('touch-stick-zone'),thumb:get('stick-thumb'),win,document,button,orientation,
  flush(){frames.splice(0).forEach(fn=>fn());},locks:()=>locks};
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
