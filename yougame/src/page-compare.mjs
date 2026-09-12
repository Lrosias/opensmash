// Wasm helpers for the rollback checkpoint: exact integer page equality (SIMD, no hashes, no
// floating-point semantics) and a mirror of the engine's memory kept inside that same memory, so
// the previous checkpoint is compared against live pages with no copy at all. Without a mirror the
// one-page scratch buffer still lets Wasm compare an immutable JS page. Every allocation lasts for
// this engine's lifetime and is excluded from checkpoints (ranges()), while allocator metadata
// stays captured.
export function createPageComparator({memory,allocate,free},module,pageBytes=16384){
 if(!Number.isInteger(pageBytes)||pageBytes<8||pageBytes%8)throw new Error('Invalid comparison page size');
 const instance=new WebAssembly.Instance(module,{env:{memory}});
 const allocation=allocate(pageBytes*2);
 if(!allocation) return null;
 const scratch=Math.ceil(allocation/pageBytes)*pageBytes;
 let words=new Uint32Array(memory.buffer),bytes=new Uint8Array(memory.buffer);
 const refresh=()=>{if(words.buffer!==memory.buffer){words=new Uint32Array(memory.buffer);bytes=new Uint8Array(memory.buffer);}};
 let mirrorAt=0,mirrorCap=0,mirrorRaw=0;
 const comparator={
  range:[scratch,scratch+pageBytes],
  ranges(){return mirrorCap?[comparator.range,[mirrorAt,mirrorAt+mirrorCap]]:[comparator.range];},
  samePage(old,start,length){
   if(length!==old.length||length*4>pageBytes)return false;
   refresh();
   words.set(old,scratch/4);
   return instance.exports.equal(start*4,scratch,length*4)!==0;
  },
  mirror:{
   // Room for `need` bytes of live memory; grows in steps so a heap that fills during loading is
   // covered by one or two allocations (the old block is freed when the engine lets us).
   ensure(need){
    if(need<=mirrorCap)return true;
    const cap=Math.ceil((need+(8<<20))/pageBytes)*pageBytes,raw=allocate(cap+pageBytes);
    if(!raw)return false;
    refresh();
    const at=Math.ceil(raw/pageBytes)*pageBytes;
    if(mirrorCap)bytes.copyWithin(at,mirrorAt,mirrorAt+mirrorCap);
    if(mirrorRaw&&free)free(mirrorRaw);
    mirrorAt=at;mirrorCap=cap;mirrorRaw=raw;
    return true;
   },
   // Live words [start, start+length) against the mirror's copy of them.
   same(start,length){refresh();return instance.exports.equal(start*4,mirrorAt+start*4,length*4)!==0;},
   // The mirror takes the live words [start, start+length).
   sync(start,length){refresh();bytes.copyWithin(mirrorAt+start*4,start*4,start*4+length*4);},
   get capacity(){return mirrorCap;},
  },
 };
 return comparator;
}

export async function loadPageComparator(options){
 try{
  const response=await fetch(new URL('./page-compare.wasm',import.meta.url));
  if(!response.ok)return null;
  return createPageComparator(options,await WebAssembly.compile(await response.arrayBuffer()));
 }catch{
  // Checkpoint correctness never depends on this optional accelerator.
  return null;
 }
}
