// A one-page scratch buffer lets Wasm compare immutable JS history with live
// engine memory using exact integer loads. No hashes, SIMD, or shared-memory
// threads. The allocation lasts for this engine's lifetime; its aligned payload
// must be excluded from checkpoints, while allocator metadata stays captured.
export function createPageComparator({memory,allocate},module,pageBytes=16384){
 if(!Number.isInteger(pageBytes)||pageBytes<8||pageBytes%8)throw new Error('Invalid comparison page size');
 const instance=new WebAssembly.Instance(module,{env:{memory}});
 const allocation=allocate(pageBytes*2);
 if(!allocation) return null;
 const scratch=Math.ceil(allocation/pageBytes)*pageBytes;
 let words=new Uint32Array(memory.buffer);
 return {
  range:[scratch,scratch+pageBytes],
  samePage(old,start,length){
   if(length!==old.length||length*4>pageBytes)return false;
   if(words.buffer!==memory.buffer)words=new Uint32Array(memory.buffer);
   words.set(old,scratch/4);
   return instance.exports.equal(start*4,scratch,length*4)!==0;
  }
 };
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
