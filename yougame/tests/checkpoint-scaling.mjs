// Local bounded scaling measurement: actual comparator Wasm and checkpoint code,
// a fixed-size heap, and controlled numbers of dirty pages. No game or network.
import {readFile} from 'node:fs/promises';
import {createPageComparator} from '../src/page-compare.mjs';
import {NativeCheckpoints} from '../src/checkpoints.mjs';
const module=await WebAssembly.compile(await readFile(new URL('../src/page-compare.wasm',import.meta.url)));
const results=[];
for(const stride of [256,16,4,1]){
 const liveBytes=40<<20,pageBytes=16384,memory=new WebAssembly.Memory({initial:1600});let used=liveBytes,covers=0;
 const allocate=n=>{const ptr=used;used+=n;return ptr;};
 const comparator=createPageComparator({memory,allocate},module);
 const cover=comparator.mirror.covers;comparator.mirror.covers=(...args)=>{covers++;return cover(...args);};
 const driver={memory:()=>new Uint8Array(memory.buffer),used:()=>used,exclusions:()=>comparator.ranges(),comparePage:comparator.samePage,mirror:comparator.mirror};
 const store=new NativeCheckpoints(driver),words=new Uint32Array(memory.buffer);
 store.save(0,[0]);store.save(1,[1]);const samples=[];
 for(let frame=2;frame<5;frame++){
  for(let at=0;at<liveBytes;at+=pageBytes*stride)words[at/4]++;
  covers=0;const start=performance.now();store.save(frame,[frame]);samples.push({ms:performance.now()-start,covers});
 }
 results.push({liveMiB:liveBytes/(1<<20),heapMiB:used/(1<<20),dirtyPages:Math.ceil(liveBytes/pageBytes/stride),samples});
 store.destroy();
}
console.log(JSON.stringify(results,null,2));
