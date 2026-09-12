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

test('the in-memory mirror compares live pages with no copy and matches the JS reference through growth, exclusions and rewind',()=>{
 const memory=new WebAssembly.Memory({initial:8,maximum:1024});
 // A bump allocator over the top of the "heap": the engine's malloc stands in here.
 let brk=65536*2;const allocate=n=>{const at=brk;brk+=n;while(brk>memory.buffer.byteLength)memory.grow(4);return at;};
 const freed=[];const compare=createPageComparator({memory,allocate,free:p=>freed.push(p)},module);
 let used=65540,excluded=[[16384,32768]];
 // used() reports the heap top, mirror allocations included, as the engine's allocator does.
 const driver={memory:()=>new Uint8Array(memory.buffer),used:()=>Math.max(used,brk),exclusions:()=>[...excluded,...compare.ranges()]};
 const mirrored=new NativeCheckpoints({...driver,comparePage:compare.samePage,mirror:compare.mirror},{window:64});
 const reference=new NativeCheckpoints(driver,{window:64});
 let seed=7;const handles=[];
 for(let frame=0;frame<60;frame++){
  if(frame===12){used=20<<20;}                 // the heap fills past the mirror's capacity: it must regrow (and copy itself)
  if(frame===20)excluded=[];
  if(frame===40){memory.grow(2);used=45<<20;}   // wasm memory itself grows and the heap fills again: a second regrow
  // Sizing the mirror moves the heap top; both stores must see the same top for this frame.
  compare.mirror.ensure(driver.used());
  const bytes=new Uint8Array(memory.buffer);
  // Live writes land anywhere in the heap except the comparator's own blocks (an engine never writes there).
  const inMirror=a=>compare.ranges().some(([b,e])=>a>=b&&a<e);
  for(let j=0;j<120;j++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const a=seed%used;if(!inMirror(a))bytes[a]^=seed>>>24;}
  const state=[frame,seed];handles.push(mirrored.save(frame,state));reference.save(frame,state);
  assert.deepEqual(mirrored.pages,reference.pages,'frame '+frame);
 }
 assert.ok(compare.mirror.generation>=2&&freed.length===compare.mirror.generation-1,`the mirror was replaced as the heap outgrew it, freeing each old block: ${compare.mirror.generation} blocks, ${freed.length} freed`);
 // Pages above the mirror block (allocated after it) have slots too: the steady-state check below counts the uncovered ones.
 const capacityAfter=compare.mirror.capacity;compare.mirror.ensure(driver.used());assert.equal(compare.mirror.capacity,capacityAfter,'a heap that only grew by the mirror itself never regrows it');
 // After a few frames every live page is compared against the mirror: the scratch path is idle.
 let scratchCompares=0;const spy={...driver,comparePage:(...a)=>{scratchCompares++;return compare.samePage(...a);},mirror:compare.mirror};
 const steady=new NativeCheckpoints(spy,{window:8});steady.save(0,[0]);scratchCompares=0;steady.save(1,[1]);
 // Only pages the mirror cannot hold (above its capacity, or partial) still take the copy-and-compare path.
 const uncovered=steady.pages.filter((p,i)=>p&&!(p.length===4096&&compare.mirror.covers(i*4096,p.length))).length;
 assert.ok(uncovered<=2&&scratchCompares===uncovered,`copy-and-compare only for the ${uncovered} page(s) the mirror cannot hold: ${scratchCompares}`);
 for(const frame of [50,30,20,10,0]){
  // The reference restores into clobbered memory first (the clobber reaches the mirror too, as a
  // stray write would); the mirrored store then restores over that and must land on the same bytes.
  driver.memory().fill(123,0,used);reference.load(handles[frame]);const expected=driver.memory().slice(0,driver.used());
  mirrored.load(handles[frame]);const actual=driver.memory();
  for(let page=0;page<mirrored.pages.length;page++)if(mirrored.pages[page]){
   const begin=page*mirrored.pageBytes,end=begin+mirrored.pages[page].byteLength;
   assert.deepEqual(actual.slice(begin,end),expected.slice(begin,end),'page '+page+' after rewind to '+frame);
  }
  // Restoring re-syncs the mirror, so the next save (of the heap as it was then) finds nothing changed.
  used=mirrored.frames.get(frame).bytes;brk=Math.max(brk,used);
  const before=mirrored.pages;mirrored.save(frame+1,[frame]);
  for(let page=0;page<before.length;page++)if(before[page])assert.equal(mirrored.pages[page],before[page],'page '+page+' unchanged after rewind to '+frame);
 }
});
