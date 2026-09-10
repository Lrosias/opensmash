// Let the browser stream and decompress the hosted Wasm response. Legacy
// releases with separately compressed parts remain loadable as well.
export async function instantiateEngine(imports, onProgress) {
  const root=new URL('./engine/',import.meta.url);
  const response=await fetch(new URL('wasm.json',root));
  if(!response.ok)throw Error('The Melee engine manifest is unavailable.');
  const manifest=await response.json();
  if(manifest.codec==='http-gzip') {
    const binary=await fetch(new URL(manifest.path,root));
    if(!binary.ok)throw Error('The Melee engine download failed.');
    // Keep the real HTTP response (and URL) for streaming/code-cache support.
    // The host supplies Content-Encoding; do not decompress it a second time.
    // Do not tee the decoded 140 MB stream just for a progress counter: one
    // faster reader could force the browser to retain the other reader's data.
    onProgress?.(0,manifest.transferBytes);
    const result=await WebAssembly.instantiateStreaming(binary,imports);
    onProgress?.(manifest.transferBytes,manifest.transferBytes);
    return {...result,sha256:manifest.sha256};
  }
  if(manifest.codec!=='gzip'||!manifest.parts?.length)throw Error('Unrecognized Melee engine package.');
  let total=0, next=0;
  const pending=new Map();
  const fetchPart=index=>{
    const part=manifest.parts[index];
    return fetch(new URL(part.path,root)).then(async r=>{
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
