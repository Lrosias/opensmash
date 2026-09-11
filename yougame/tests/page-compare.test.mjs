import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createPageComparator,loadPageComparator} from '../src/page-compare.mjs';
import {NativeCheckpoints} from '../src/checkpoints.mjs';
const module=await WebAssembly.compile(await readFile(new URL('../src/page-compare.wasm',import.meta.url)));

test('Wasm equality preserves every bit and handles partial pages and memory growth',()=>{
 const memory=new WebAssembly.Memory({initial:4,maximum:8});
 const compare=createPageComparator({memory,allocate:()=>65544},module);
 let words=new Uint32Array(memory.buffer);
 const old=new Uint32Array(4096);
 // Include signed zero and distinct NaN payloads, which float equality loses.
 const patterns=[0,0x80000000,0x7ff80000,0x7fffffff,0xffffffff,1,0xdeadbeef];
 for(let i=0;i<old.length;i++)old[i]=patterns[i%patterns.length];
 words.set(old);
 assert.equal(compare.samePage(old,0,old.length),true);
 // Every byte position, including the ends of the unrolled loop.
 const bytes=new Uint8Array(memory.buffer);
 for(let i=0;i<old.byteLength;i++){bytes[i]^=1;assert.equal(compare.samePage(old,0,old.length),false,'byte '+i);bytes[i]^=1;}
 for(const length of [0,1,2,3,7,8,9,4095,4096])assert.equal(compare.samePage(old.subarray(0,length),0,length),true);
 memory.grow(1);words=new Uint32Array(memory.buffer);words[old.length-1]^=1;
 assert.equal(compare.samePage(old,0,old.length),false);words[old.length-1]^=1;
 assert.equal(compare.samePage(old,0,old.length),true);
 assert.equal(compare.samePage(old,0,1),false);
});

test('accelerated checkpoints match the JS reference through exclusion changes and rewind',()=>{
 const memory=new WebAssembly.Memory({initial:4,maximum:8});
 const compare=createPageComparator({memory,allocate:()=>131080},module);
 let used=65540,excluded=[[16384,32768]];
 const driver={memory:()=>new Uint8Array(memory.buffer),used:()=>used,exclusions:()=>[...excluded,compare.range]};
 const fast=new NativeCheckpoints({...driver,comparePage:compare.samePage},{window:64});
 const reference=new NativeCheckpoints(driver,{window:64});
 let seed=42;const handles=[];
 for(let frame=0;frame<40;frame++){
  if(frame===12){memory.grow(1);used=200004;}
  if(frame===20)excluded=[];
  const bytes=new Uint8Array(memory.buffer);
  for(let j=0;j<100;j++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;bytes[seed%used]^=seed>>>24;}
  const state=[frame,seed];handles.push(fast.save(frame,state));reference.save(frame,state);
  assert.deepEqual(fast.pages,reference.pages);
 }
 for(const frame of [30,20,10,0]){
  fast.load(handles[frame]);const actual=driver.memory().slice(0,used);
  driver.memory().fill(123,0,used);reference.load(handles[frame]);
  const expected=driver.memory();
  for(let page=0;page<fast.pages.length;page++)if(fast.pages[page]){
   const begin=page*fast.pageBytes,end=begin+fast.pages[page].byteLength;
   assert.deepEqual(actual.slice(begin,end),expected.slice(begin,end));
  }
 }
});

test('only fully covered excluded pages are omitted, including overlapping and out-of-range spans',()=>{
 const bytes=new Uint8Array(256).fill(1);
 const store=new NativeCheckpoints({memory:()=>bytes,used:()=>bytes.length,exclusions:()=>[[1,129],[64,128],[1000,2000],[-100,0],[-128,-64]]},{pageBytes:64});
 store.save(0,[1]);assert.deepEqual(store.pages.map(Boolean),[true,false,true,true]);
});

test('optional helper failures leave the JS path available',async()=>{
 const memory=new WebAssembly.Memory({initial:4});
 assert.equal(createPageComparator({memory,allocate:()=>0},module),null);
 // Node cannot fetch file: URLs; this exercises the optional load failure.
 assert.equal(await loadPageComparator({memory,allocate:()=>65536}),null);
});
