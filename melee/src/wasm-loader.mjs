// Let the browser stream and decompress the hosted Wasm response. Legacy
// releases with separately compressed parts remain loadable as well.
// The decoded engine is kept in CacheStorage so the next visit, and a page-load
// prefetch before Play, skip the 20 MB download and start from disk.
const CACHE='opensmash-melee-engine-v1';
let prefetching=null;
const listeners=new Set();
const notify=(loaded,total)=>{for(const listener of listeners)listener(loaded,total);};
const root=()=>new URL('./engine/',import.meta.url);
async function readManifest() {
  const response=await fetch(new URL('wasm.json',root()));
  if(!response.ok)throw Error('The Melee engine manifest is unavailable.');
  return response.json();
}
async function openCache() {try{return await caches.open(CACHE);}catch{return null;}}
const keyFor=manifest=>new URL(manifest.path+'?sha256='+manifest.sha256,root()).href;
function counted(response,onProgress,total) {
  let loaded=0;
  const body=response.body.pipeThrough(new TransformStream({transform(chunk,controller){loaded+=chunk.byteLength;onProgress?.(loaded,total);controller.enqueue(chunk);}}));
  return new Response(body,{headers:{'Content-Type':'application/wasm'}});
}
async function download(manifest) {
  const response=await fetch(new URL(manifest.path,root()),{signal:AbortSignal.timeout(600000)});
  if(!response.ok||!/wasm|octet-stream|gzip/.test(response.headers.get('content-type')||''))throw Error('The Melee engine download failed.');
  return response;
}
async function prune(cache,key) {for(const request of await cache.keys())if(request.url!==key)await cache.delete(request);}
export function prefetchEngine(onProgress) {
  if(onProgress)listeners.add(onProgress);
  if(prefetching)return prefetching;
  prefetching=(async()=>{
    const manifest=await readManifest();
    if(manifest.codec!=='http-gzip')return false;
    const cache=await openCache();if(!cache)return false;
    const key=keyFor(manifest);
    if(await cache.match(key)){notify(manifest.decodedBytes,manifest.decodedBytes);return true;}
    await cache.put(key,counted(await download(manifest),notify,manifest.decodedBytes));
    await prune(cache,key);
    return true;
  })().catch(error=>{console.warn('Engine prefetch skipped:',error);prefetching=null;return false;});
  return prefetching;
}
export async function instantiateEngine(imports,onProgress) {
  const manifest=await readManifest();
  if(manifest.codec==='http-gzip') {
    onProgress?.(0,manifest.decodedBytes);
    const cache=await openCache();const key=keyFor(manifest);
    if(onProgress)listeners.add(onProgress);
    try {
      if(prefetching)await prefetching;
      const cached=cache?await cache.match(key):null;
      if(cached) {
        try {
          const result=await WebAssembly.instantiateStreaming(counted(cached,onProgress,manifest.decodedBytes),imports);
          onProgress?.(manifest.decodedBytes,manifest.decodedBytes);
          return {...result,sha256:manifest.sha256};
        } catch(error) {
          // A poisoned entry (captive portal, truncated write) must not brick every reload.
          console.warn('Cached Melee engine rejected; downloading again:',error);
          await cache.delete(key).catch(()=>{});
        }
      }
      const binary=await download(manifest);
      // Keep the decoded engine for next time. Both readers run together, so the
      // browser retains only the gap between compiling and writing to disk.
      const saving=cache?cache.put(key,binary.clone()).then(()=>prune(cache,key)).catch(()=>{}):null;
      const result=await WebAssembly.instantiateStreaming(counted(binary,onProgress,manifest.decodedBytes),imports);
      onProgress?.(manifest.decodedBytes,manifest.decodedBytes);
      await saving;
      return {...result,sha256:manifest.sha256};
    } finally {if(onProgress)listeners.delete(onProgress);}
  }
  if(manifest.codec!=='gzip'||!manifest.parts?.length)throw Error('Unrecognized Melee engine package.');
  let total=0, next=0;
  const pending=new Map();
  const fetchPart=index=>{
    const part=manifest.parts[index];
    return fetch(new URL(part.path,root())).then(async r=>{
      if(!r.ok)throw Error(`Engine download failed (${r.status}).`);
      const bytes=await r.arrayBuffer();
      if(bytes.byteLength!==part.size)throw Error('An engine download was incomplete.');
      return {part,bytes};
    });
  };
  function prefetch() {
    while(next<manifest.parts.length&&pending.size<3) {
      const index=next++;
      // Retain failures until the stream reaches that part without an unhandled rejection.
      pending.set(index,fetchPart(index).then(value=>({value}),error=>({error})));
    }
  }
  let index=0, reader=null, current=null, decoded=0;
  const stream=new ReadableStream({
    start() {prefetch();},
    async pull(controller) {
      try {
        for(;;) {
          if(!reader) {
            if(index===manifest.parts.length) {controller.close();return;}
            const {value,error}=await pending.get(index);pending.delete(index);prefetch();
            if(error)throw error;
            current=value.part;decoded=0;
            reader=new Blob([value.bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
          }
          const {value,done}=await reader.read();
          if(!done) {decoded+=value.byteLength;controller.enqueue(value);return;}
          if(decoded!==current.decodedSize)throw Error('The engine package has an invalid part size.');
          total+=current.size;onProgress?.(total,manifest.transferBytes);
          reader=null;current=null;index++;
        }
      } catch(error) {controller.error(error);}
    }
  });
  const result=await WebAssembly.instantiateStreaming(new Response(stream,{headers:{'Content-Type':'application/wasm'}}),imports);
  return {...result,sha256:manifest.sha256};
}
