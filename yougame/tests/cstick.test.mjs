import test from 'node:test';
import assert from 'node:assert/strict';
import {readGamepad,createInput} from '../src/input.mjs';
import {n64Pad,n64CStick,GC} from '../../controllers/gc-adapter.mjs';

const vectors=[[1,0,0x41],[-1,0,0x42],[0,1,0x40],[0,-1,0x44],[.8,.9,0x40],[-.9,.8,0x42],[1,-1,0x44]];
test('browser and calibrated GameCube C-sticks agree and preserve main stick and jump',()=>{
 for(const [x,y,mask] of vectors){
  const pad={connected:true,axes:[.5,-.25,x,-y],buttons:[{pressed:true},null,{pressed:true}]};
  assert.deepEqual(readGamepad(pad),[0x8008|mask,40,20]);
  const origin=[125,130,120,135,0,0];
  const raw={connected:true,buttons:GC.A|GC.X,axes:[165,150,120+x*80,135+y*80],triggers:[0,0]};
  assert.deepEqual(n64Pad(raw,origin),[0x8008|mask,40,20]);
 }
 assert.equal(n64CStick(.5,-.5),0);
 assert.equal(n64CStick(40,-40,40),0);
 assert.deepEqual(readGamepad({connected:false}),[0,0,0]);
});
test('all browser ports retain independent C-stick samples, including repeated reads',()=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,'navigator');
 const pads=vectors.slice(0,4).map(([x,y],index)=>({connected:true,index,axes:[0,0,x,-y],buttons:[]}));
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{getGamepads:()=>pads}});
 const input=createInput();
 try{
  const expected=vectors.slice(0,4).map(v=>[v[2],0,0]);
  assert.deepEqual(input.readPorts(),expected);
  assert.deepEqual(input.readPorts(),expected,'sampling must not consume edges before the simulation');
  pads[2].connected=false;assert.equal(input.readPorts()[2],null);
 }finally{input.destroy();if(previous)Object.defineProperty(globalThis,'navigator',previous);else delete globalThis.navigator;}
});
