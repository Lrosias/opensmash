import test from 'node:test';
import assert from 'node:assert/strict';
import {createInput} from '../src/input.mjs';

// A standard-mapping pad as Chrome reports it, holding A and the stick right.
const pad=(index,pressed=true)=>({index,id:`Pad ${index}`,connected:true,mapping:'standard',axes:[pressed?0.9:0,0,0,0],buttons:Array.from({length:17},(_,i)=>({pressed:pressed&&i===0,value:pressed&&i===0?1:0}))});
const A=0x8000;
function withPads(list,fn){
  const previous=Object.getOwnPropertyDescriptor(globalThis,'navigator');
  Object.defineProperty(globalThis,'navigator',{value:{getGamepads:()=>list.slice()},configurable:true,writable:true});
  try{return fn();}finally{if(previous)Object.defineProperty(globalThis,'navigator',previous);else delete globalThis.navigator;}
}
test('a lone controller drives port 1 whatever its browser index',()=>{
  for(const index of [0,1,2,3]){
    const input=createInput();
    const list=[null,null,null,null];list[index]=pad(index);
    const ports=withPads(list,()=>input.readPorts());
    assert.equal(ports[0][0]&A,A,`index ${index} reaches port 1`);
    assert.equal(ports[0][1],72);
    assert.deepEqual(ports.slice(1),[null,null,null]);
    assert.equal(withPads(list,()=>input.read())[0]&A,A,'read() follows port 1');
  }
});
test('ports stay put while a pad is connected and new pads take the lowest free port',()=>{
  const input=createInput();
  let ports=withPads([pad(0),pad(1),null,null],()=>input.readPorts());
  assert.equal(ports[0][0]&A,A);assert.equal(ports[1][0]&A,A);assert.deepEqual(ports.slice(2),[null,null]);
  // Pad 0 unplugs: pad 1 keeps port 2 instead of sliding into port 1.
  ports=withPads([null,pad(1),null,null],()=>input.readPorts());
  assert.equal(ports[0][0],0);assert.equal(ports[1][0]&A,A);
  // A pad that appears at index 3 now takes the free port 1.
  ports=withPads([null,pad(1),null,pad(3)],()=>input.readPorts());
  assert.equal(ports[0][0]&A,A);assert.equal(ports[1][0]&A,A);assert.deepEqual(ports.slice(2),[null,null]);
  // Once every pad is gone the next one starts over at port 1.
  withPads([null,null,null,null],()=>input.readPorts());
  ports=withPads([null,null,pad(2),null],()=>input.readPorts());
  assert.equal(ports[0][0]&A,A);assert.deepEqual(ports.slice(1),[null,null,null]);
});
test('the keyboard still belongs to port 1 next to a pad on another index',()=>{
  const input=createInput();
  const win={listeners:{},addEventListener(type,fn){this.listeners[type]=fn;},removeEventListener(){}};
  input.attach(win);
  win.listeners.keydown({code:'KeyZ',preventDefault(){}});
  const ports=withPads([null,pad(1,false),null,null],()=>input.readPorts());
  assert.equal(ports[0][0],0x4000,'B from the keyboard on port 1');
  assert.deepEqual(ports.slice(1),[null,null,null],'the idle pad on index 1 is port 1, not port 2');
});
