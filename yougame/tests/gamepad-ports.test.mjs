import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createInput,readGamepad} from '../src/input.mjs';
const pad=(buttons=[],axes=[0,0,0,0])=>({connected:true,axes,buttons:Array.from({length:16},(_,i)=>({pressed:buttons.includes(i)}))});
test('each standard gamepad supplies an independent local player port',()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'navigator');let pads=[pad([0]),pad([1]),pad([2]),pad([9])];Object.defineProperty(globalThis,'navigator',{configurable:true,value:{getGamepads:()=>pads}});
 try{const input=createInput({allowStart:true});assert.deepEqual(input.readPorts().map(p=>p[0]),[32768,16384,8,4096]);pads[0]=null;assert.deepEqual(input.readPorts().map(p=>p?.[0]),[0,16384,8,4096]);pads[2]=null;assert.equal(input.readPorts()[2],null);input.destroy();}finally{if(original)Object.defineProperty(globalThis,'navigator',original);else delete globalThis.navigator;}
});
test('stick, shoulder and special controls remain independent',()=>{
 assert.deepEqual(readGamepad(pad([1,4],[.5,-.5,0,0])),[0x6000,40,40]);assert.equal(readGamepad(pad([9]))[0],0);assert.equal(readGamepad(pad([9]),true)[0],4096);
});
function withPads(pads,run){
 const original=Object.getOwnPropertyDescriptor(globalThis,'navigator');
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{getGamepads:()=>pads}});
 try{run(pads);}finally{if(original)Object.defineProperty(globalThis,'navigator',original);else delete globalThis.navigator;}
}
function keyboardWindow(){
 const win=new EventTarget();win.document=new EventTarget();
 win.key=(type,code)=>win.dispatchEvent(Object.assign(new Event(type,{cancelable:true}),{code}));
 return win;
}
test('local seats stay fixed through disconnected flags and reconnect; online read still finds first controller',()=>withPads([null,pad([1]),pad([0]),pad([9])],pads=>{
 const input=createInput({allowStart:true});
 try{
  assert.deepEqual(input.read(),[0x4000,0,0]);
  assert.deepEqual(input.readPorts().map(p=>p?.[0]),[0,0x4000,0x8000,0x1000]);
  pads[1].connected=false;
  assert.deepEqual(input.readPorts().map(p=>p?.[0]),[0,undefined,0x8000,0x1000]);
  pads[1]=pad([2]);assert.deepEqual(input.readPorts().map(p=>p?.[0]),[0,8,0x8000,0x1000]);
 }finally{input.destroy();}
}));
test('keyboard enabled guard and touch precedence survive multiport input',()=>withPads([null,pad([1])],()=>{
 let enabled=true,touch=[0,0,0];const win=keyboardWindow();
 const input=createInput({enabled:()=>enabled,readTouch:()=>touch});input.attach(win);
 try{
  win.key('keydown','KeyX');win.key('keydown','ArrowRight');
  assert.deepEqual(input.readPorts(),[[0x8000,80,0],[0x4000,0,0],null,null]);
  enabled=false;win.key('keydown','KeyZ');
  assert.deepEqual(input.readPorts(),[[0,0,0],[0x4000,0,0],null,null],'disabled keydown clears pending/held keyboard input only');
  enabled=true;win.key('keydown','ArrowRight');touch=[0x2000,-40,20];
  assert.deepEqual(input.readPorts(),[[0x2000,-40,20],[0x4000,0,0],null,null]);
  touch=[0,0,0];win.dispatchEvent(new Event('blur'));
  assert.deepEqual(input.readPorts()[0],[0,0,0]);
 }finally{input.destroy();}
}));
test('Start filtering applies independently to every local controller',()=>withPads(Array.from({length:4},()=>pad([9])),()=>{
 const gameplay=createInput(),menu=createInput({allowStart:true});
 try{
  assert.deepEqual(gameplay.readPorts().map(p=>p[0]),[0,0,0,0]);
  assert.deepEqual(menu.readPorts().map(p=>p[0]),[0x1000,0x1000,0x1000,0x1000]);
 }finally{gameplay.destroy();menu.destroy();}
}));
test('raw adapter ownership excludes browser and touch inputs including empty and stale ports',()=>withPads(Array.from({length:4},()=>pad([0])),()=>{
 const neutral=port=>({port,connected:false,buttons:0,axes:[128,128,128,128],triggers:[0,0]});
 let ports=Array.from({length:4},(_,i)=>neutral(i));ports[2]={...ports[2],connected:true,buttons:2};
 const adapter={owned:true,origins:Array.from({length:4},()=>[128,128,128,128,0,0]),snapshot:()=>({ports})};
 let touchReads=0;const input=createInput({adapter,readTouch:()=>{touchReads++;return [0x8000,80,80];}});
 try{
  assert.deepEqual(input.readPorts(),[null,null,[0x4000,0,0],null]);assert.deepEqual(input.read(),[0,0,0]);
  ports=Array.from({length:4},(_,i)=>neutral(i));assert.deepEqual(input.readPorts(),[null,null,null,null]);
  assert.equal(touchReads,0);adapter.owned=false;
  assert.deepEqual(input.readPorts(),[[0x8000,80,80],[0x8000,0,0],[0x8000,0,0],[0x8000,0,0]]);
 }finally{input.destroy();}
}));

test('a gamepad axis overrides only that keyboard axis, preserving existing blended input',()=>withPads([pad([],[.5,0,0,0])],()=>{
 const win=keyboardWindow(),input=createInput();input.attach(win);
 try{win.key('keydown','ArrowUp');assert.deepEqual(input.readPorts()[0],[0,40,80]);}
 finally{input.destroy();}
}));
