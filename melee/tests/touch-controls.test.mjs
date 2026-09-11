import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {TouchState,NEUTRAL,RESET_CHORD} from '../src/touch-state.mjs';
import {TouchStick} from '../src/touch-stick.mjs';

// Exercise the production pointer handlers against a minimal DOM, as OpenSmash64's test does.
async function setup(rotated=false,pads=[]){
 const element=()=>({listeners:{},style:{setProperty(key,value){this[key]=value;}},classList:{
  values:new Set(),add(key){this.values.add(key);},remove(key){this.values.delete(key);},
  toggle(key,on){if(on)this.add(key);else this.remove(key);},contains(key){return this.values.has(key);}},
  addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);},
  dispatch(type,pointerId,x=160,y=160,extra={}){
   // Pointer offsets are zone-local; the knob sits at offset 100,100 (120 px) in both zones.
   const knob=this===get('touch-c-zone')?get('touch-c'):get('touch-stick'),r=knob.getBoundingClientRect(),turn=document.body.classList.contains('rotated');
   const dx=x-r.left-r.width/2,dy=y-r.top-r.height/2;
   const offsetX=knob.offsetLeft+knob.offsetWidth/2+(turn?dy:dx);
   const offsetY=knob.offsetTop+knob.offsetHeight/2+(turn?-dx:dy);
   for(const fn of this.listeners[type]||[])fn({type,pointerId,target:this,clientX:x,clientY:y,offsetX,offsetY,buttons:1,preventDefault(){},...extra});
  },
  captures:new Set(),setPointerCapture(id){this.captures.add(id);},releasePointerCapture(id){this.captures.delete(id);},querySelectorAll:()=>[],
  getBoundingClientRect:()=>({left:100,top:100,width:120,height:120})});
 const elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);};
 for(const id of ['touch-stick','touch-c'])Object.assign(get(id),{offsetLeft:100,offsetTop:100,offsetWidth:120,offsetHeight:120});
 const buttons=[];const button=(id,mask,group)=>{const b=get(id);b.dataset={mask:String(mask)};b.parentElement=get(group);buttons.push(b);return b;};
 const start=button('touch-start',32,'touch-top'),reset=button('touch-reset',RESET_CHORD,'touch-top');
 const a=button('a',1,'touch-actions'),b=button('b',2,'touch-actions'),shield=button('shield',2048,'touch-actions'),grab=button('grab',16,'touch-actions'),jump=button('jump',4,'touch-actions'),taunt=button('touch-taunt',64,'touch-controls');
 get('touch-controls').querySelectorAll=selector=>selector==='[data-mask]'?buttons:buttons.filter(x=>x.classList.contains('pressed'));
 const frames=[];
 const win=Object.assign(element(),{innerWidth:rotated?390:844,innerHeight:rotated?844:390,visualViewport:element(),requestAnimationFrame(fn){frames.push(fn);return frames.length;}});
 const document=Object.assign(element(),{body:element(),getElementById:get});
 document.documentElement={get clientWidth(){return win.innerWidth;},get clientHeight(){return win.innerHeight;}};
 const clock={now:1e6};
 const scope={TouchState,TouchStick,NEUTRAL,window:win,document,screen:{orientation:element()},matchMedia:()=>({matches:true,addEventListener(){}}),
  location:{search:'?touch=1'},URLSearchParams,setTimeout,clearTimeout,navigator:{getGamepads:()=>pads},owned:false,Date:{now:()=>clock.now},left:0};
 const source=(await readFile(new URL('../src/touch.mjs',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'').replace('export function createTouch','function createTouch');
 vm.runInNewContext(source+'\nthis.touch=createTouch({wakeAudio(){},leave(){this.left++;},controller:()=>this.owned});',scope);
 scope.touch.context(false);
 return {touch:scope.touch,zone:get('touch-stick-zone'),cZone:get('touch-c-zone'),thumb:get('stick-thumb'),cThumb:get('c-thumb'),win,document,start,reset,a,b,shield,grab,jump,taunt,quit:get('touch-leave'),pads,
  flush(){frames.splice(0).forEach(fn=>fn());},own(value){scope.owned=value;scope.touch.sync();},advance(ms){clock.now+=ms;},left:()=>scope.left};
}
const read=(touch,peek)=>[...touch.read(peek)];

test('buttons carry Melee masks; shield also raises the analog trigger; taps latch once',async()=>{
 const {touch,a,b,shield,grab,jump,taunt,start}=await setup();
 a.dispatch('pointerdown',1);assert.deepEqual(read(touch),[1,0,0,0,0,0,0]);
 b.dispatch('pointerdown',2);jump.dispatch('pointerdown',3);grab.dispatch('pointerdown',4);
 assert.deepEqual(read(touch),[1|2|4|16,0,0,0,0,0,0]);
 shield.dispatch('pointerdown',5);assert.deepEqual(read(touch),[1|2|4|16|2048,0,0,0,0,0,1]);
 for(const [button,id] of [[a,1],[b,2],[jump,3],[grab,4],[shield,5]])button.dispatch('pointerup',id);
 assert.deepEqual(read(touch),[...NEUTRAL]);
 // A tap shorter than one engine read is still delivered exactly once.
 taunt.dispatch('pointerdown',6);taunt.dispatch('pointerup',6);
 assert.deepEqual(read(touch),[64,0,0,0,0,0,0]);assert.deepEqual(read(touch),[...NEUTRAL]);
 start.dispatch('pointerdown',7);start.dispatch('pointerup',7);
 assert.deepEqual(read(touch,true),[32,0,0,0,0,0,0],'a peek reports the tap');
 assert.deepEqual(read(touch),[32,0,0,0,0,0,0],'and leaves it for the consuming read');
 assert.deepEqual(read(touch),[...NEUTRAL]);
});

for(const rotated of [false,true])test(`both sticks read straight sweeps in -1..1 and release to neutral (${rotated?'rotated':'landscape'})`,async()=>{
 const {touch,zone,cZone,thumb,cThumb,win}=await setup(rotated),radius=120*.36;
 const point=x=>rotated?[160+radius*.4,160+x*radius]:[160+x*radius,160-radius*.4];
 for(const [target,knob,index] of [[zone,thumb,1],[cZone,cThumb,3]]){
  target.dispatch('pointerdown',1,...point(3));
  const expected=[...NEUTRAL];expected[index]=1;expected[index+1]=.4;
  assert.deepEqual(read(touch),expected);
  const vertical=knob.style.transform.split(',')[1];
  for(const x of [2,1,.5,0,-.5,-1,-2,-3]){
   target.dispatch('pointermove',1,...point(x));
   assert.equal(read(touch)[index+1],.4);
   assert.equal(knob.style.transform.split(',')[1],vertical);
  }
  assert.equal(read(touch)[index],-1);
  win.dispatch('pointerup',1,...point(-3));
  assert.deepEqual(read(touch),[...NEUTRAL]);assert.equal(knob.style.transform,'');
  for(const release of ['pointerup','pointercancel','lostpointercapture']){
   target.dispatch('pointerdown',3,...point(-3));assert.equal(read(touch)[index],-1);
   target.dispatch(release,3,...point(-3));assert.deepEqual(read(touch),[...NEUTRAL]);
  }
 }
 // The two sticks are independent contacts.
 zone.dispatch('pointerdown',5,...point(3));cZone.dispatch('pointerdown',6,...point(-3));
 const both=read(touch);assert.equal(both[1],1);assert.equal(both[3],-1);
 win.dispatch('pointercancel',5);assert.equal(read(touch)[1],0);assert.equal(read(touch)[3],-1);
 win.dispatch('pointercancel',6);assert.deepEqual(read(touch),[...NEUTRAL]);
});

test('reset sends L+R+A+Start with the triggers, alone, and only offline',async()=>{
 const {touch,zone,start,reset,quit}=await setup();
 assert.equal(reset.hidden,false);assert.equal(quit.hidden,true);
 start.dispatch('pointerdown',1);zone.dispatch('pointerdown',2,280,160);
 reset.dispatch('pointerdown',3);
 assert.equal(start.captures.size,0);assert.equal(zone.captures.size,0);
 assert.deepEqual(read(touch),[RESET_CHORD,0,0,0,0,1,1]);
 reset.dispatch('pointerup',3);assert.deepEqual(read(touch),[...NEUTRAL]);
 reset.dispatch('pointerdown',4);reset.dispatch('pointerup',4);
 assert.deepEqual(read(touch),[RESET_CHORD,0,0,0,0,1,1]);assert.deepEqual(read(touch),[...NEUTRAL]);
 reset.dispatch('pointerdown',5);touch.context(true);
 assert.equal(reset.hidden,true);assert.equal(quit.hidden,false);assert.equal(reset.captures.size,0);
 reset.dispatch('pointerdown',6);assert.deepEqual(read(touch),[...NEUTRAL],'a hidden reset does nothing online');
 touch.context(false);assert.equal(reset.hidden,false);assert.equal(quit.hidden,true);
});

test('the leave hold fires after 1.2 s and a released hold never fires',async()=>{
 const {touch,quit,left}=await setup();touch.context(true);
 quit.dispatch('pointerdown',1);quit.dispatch('pointerup',1);
 await new Promise(r=>setTimeout(r,1300));assert.equal(left(),0);
 quit.dispatch('pointerdown',2);await new Promise(r=>setTimeout(r,1300));assert.equal(left(),1);
});

test('a controller giving input hides the overlay; touching the picture brings it back',async()=>{
 const {touch,zone,document,pads,own,advance,a}=await setup();
 zone.dispatch('pointerdown',1,280,160);assert.equal(read(touch)[1],1);
 pads.push({connected:true,buttons:[{pressed:false}],axes:[0,0,0,0]});touch.sync();
 assert.equal(document.body.classList.contains('pad'),false,'an idle pad leaves the overlay');
 pads[0].buttons[0].pressed=true;advance(60);
 assert.deepEqual(read(touch),[...NEUTRAL]);assert.equal(document.body.classList.contains('pad'),true);
 assert.equal(zone.captures.size,0,'the held stick is dropped');
 pads[0].buttons[0].pressed=false;advance(60);read(touch);
 assert.equal(document.body.classList.contains('pad'),true,'an idle connected pad keeps the scheme');
 a.dispatch('pointerdown',2);assert.deepEqual(read(touch),[...NEUTRAL],'hidden buttons read nothing');
 a.dispatch('pointerup',2);
 touch.touched();assert.equal(document.body.classList.contains('pad'),false);
 a.dispatch('pointerdown',3);assert.deepEqual(read(touch),[1,0,0,0,0,0,0]);a.dispatch('pointerup',3);
 pads.length=0;pads.push({connected:true,buttons:[{pressed:true}],axes:[0,0,0,0]});advance(60);read(touch);
 assert.equal(document.body.classList.contains('pad'),true);
 pads.length=0;touch.sync();assert.equal(document.body.classList.contains('pad'),false,'the pad going away hands back');
 // The page's own GameCube adapter counts as a controller; touching the picture does not override it.
 own(true);assert.equal(document.body.classList.contains('pad'),true);touch.touched();assert.equal(document.body.classList.contains('pad'),true);
 own(false);assert.equal(document.body.classList.contains('pad'),false);
});

test('rotation and layout changes drop held contacts and re-measure the surface',async()=>{
 const {touch,zone,win,document,flush}=await setup(true);
 assert.equal(document.body.classList.contains('rotated'),true);
 assert.equal(document.body.style['--play-width'],'844px');
 zone.dispatch('pointerdown',1,160,40);assert.equal(read(touch)[1],-1);
 win.innerWidth=844;win.innerHeight=390;win.visualViewport.dispatch('resize');assert.deepEqual(read(touch),[...NEUTRAL]);flush();
 assert.equal(document.body.classList.contains('rotated'),false);
 assert.equal(document.body.style['--play-width'],'844px');assert.equal(document.body.style['--play-height'],'390px');
 zone.dispatch('pointerdown',2,280,160);assert.deepEqual(read(touch),[0,1,0,0,0,0,0]);
 document.dispatch('webkitfullscreenchange');assert.deepEqual(read(touch),[...NEUTRAL]);
});
