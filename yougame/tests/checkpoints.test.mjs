import test from 'node:test';
import assert from 'node:assert/strict';
import {NativeCheckpoints} from '../src/checkpoints.mjs';

test('native checkpoints restore changed pages, retain old versions and omit scratch',()=>{
 const memory=new Uint8Array(256);let exclusions=[[64,128]];
 const store=new NativeCheckpoints({memory:()=>memory,used:()=>memory.length,exclusions:()=>exclusions},{pageBytes:64,window:14});
 memory[0]=1;memory[64]=8;memory[128]=3;const first=store.save(0,[1,-1,3,3,1]);
 memory[0]=2;memory[64]=9;const second=store.save(1,[2,-1,3,3,2]);
 assert.equal(store.frames.get(0).pages[2],store.frames.get(1).pages[2]);
 store.load(JSON.parse(JSON.stringify(first)));assert.equal(memory[0],1);assert.equal(memory[64],9);assert.equal(memory[128],3);
 assert.throws(()=>store.load(second),/expired/);
 // A previously excluded stack page becomes live and must now be captured.
 exclusions=[];const live=store.save(1,[3,-1,3,3,2]);memory[64]=42;store.load(live);assert.equal(memory[64],9);
 store.destroy();assert.throws(()=>store.load(live),/expired/);
});

test('checkpoint history remains bounded and detects mismatched handles',()=>{
 const memory=new Uint8Array(128),store=new NativeCheckpoints({memory:()=>memory,used:()=>128},{pageBytes:64,window:14});
 let latest;for(let f=0;f<100;f++){memory[0]=f;latest=store.save(f,[f,-1,3,3,f]);}
 assert.equal(store.frames.size,15);assert.throws(()=>store.load({frame:0,state:[0]}),/expired/);
 assert.throws(()=>store.load({...latest,state:[8]}),/mismatched/);
});

test('released timeline reset discards old handles while retaining the diff base',()=>{
 const memory=new Uint8Array(128),store=new NativeCheckpoints({memory:()=>memory,used:()=>128},{pageBytes:64});
 memory[0]=7;const old=store.save(0,[0]),pages=store.pages;
 store.reset();assert.equal(store.frames.size,0);assert.equal(store.pages,pages);assert.throws(()=>store.load(old),/expired/);
 const next=store.save(0,[1]);assert.equal(store.pages[0],pages[0]);memory[0]=9;store.load(next);assert.equal(memory[0],7);
});
