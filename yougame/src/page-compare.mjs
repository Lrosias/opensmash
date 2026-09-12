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
   // The mirror sits inside the heap it mirrors, so live addresses map to slots by skipping the
   // mirror's own block: address a is slot a below the block and slot a - block above it. A
   // block that no longer fits is replaced (not copied): `generation` tells the checkpoint store
   // to forget which pages the mirror held, and one frame of slow compares refills it.
   generation:0,
   ensure(need){
    const own=mirrorCap&&mirrorRaw<need?Math.min(need,mirrorRaw+mirrorCap+pageBytes)-mirrorRaw:0;
    if(need-own<=mirrorCap)return true;
    const cap=Math.ceil((need-own+(8<<20))/pageBytes)*pageBytes,raw=allocate(cap+pageBytes);
    if(!raw)return false;
    refresh();
    if(mirrorRaw&&free)free(mirrorRaw);
    mirrorRaw=raw;mirrorAt=Math.ceil(raw/pageBytes)*pageBytes;mirrorCap=cap;comparator.mirror.generation++;
    return true;
   },
   // The mirror slot (byte offset) of live byte `a`, or -1 inside the mirror's own block.
   slot(a){const end=mirrorRaw+mirrorCap+pageBytes;return a<mirrorRaw?a:a>=end?a-(end-mirrorRaw):-1;},
   // Whether live words [start, start+length) have a slot in the mirror.
   covers(start,length){const a=start*4,b=(start+length)*4,end=mirrorRaw+mirrorCap+pageBytes;if(a<mirrorRaw&&b>mirrorRaw)return false;const s=comparator.mirror.slot(a);return s>=0&&s+(b-a)<=mirrorCap;},
   // The word offset (from start) of the first difference in [start, start+length), or -1: one call per run of pages.
   firstDifference(start,length){refresh();const at=instance.exports.first_diff(start*4,mirrorAt+comparator.mirror.slot(start*4),length*4)>>>0;return at===0xFFFFFFFF?-1:at>>2;},
   // The mirror takes the live words [start, start+length).
   sync(start,length){refresh();const s=mirrorAt+comparator.mirror.slot(start*4);bytes.copyWithin(s,start*4,start*4+length*4);},
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
