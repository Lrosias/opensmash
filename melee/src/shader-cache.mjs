// Persist portable pipeline descriptions, never driver-specific program binaries.
// The engine regenerates and compiles these shaders on its own graphics context.
const FILE='/user/Cache/GALE01.uidcache';
const CACHE='opensmash-melee-pipelines-v1';
const LIMIT=512;
export function normalizePipelineCache(input,format) {
  const bytes=input instanceof Uint8Array?input:new Uint8Array(input);
  const size=format&0xffff,version=format>>>16;
  if(!size||bytes.length<8||bytes.length>4*1024*1024)return null;
  const header=new DataView(bytes.buffer,bytes.byteOffset,8);
  if(header.getUint32(0,true)!==0x44495550||header.getUint32(4,true)!==version)return null;
  // A reader may observe the writer between records; retain complete records.
  const count=Math.floor((bytes.length-8)/size);
  if(!count)return null;
  const retained=Math.min(count,LIMIT),result=new Uint8Array(8+retained*size);
  result.set(bytes.subarray(0,8));
  if(count<=LIMIT)result.set(bytes.subarray(8,8+count*size),8);
  else {
    // Keep common boot/menu pipelines and the most recently learned variants.
    result.set(bytes.subarray(8,8+64*size),8);
    result.set(bytes.subarray(8+(count-(LIMIT-64))*size,8+count*size),8+64*size);
  }
  return result;
}
export function createShaderCache(module,engineSha256,{storage=globalThis.caches,base=location.href}={}) {
  const format=module._melee_shader_cache_format();
  const key=new URL(`./shader-cache/${engineSha256}`,base).href;
  const stats={restored:0,saved:0,available:true};
  let previous='',saving=false;
  async function restore(seed) {
    let data=null;
    try {
      const cached=await (await storage.open(CACHE)).match(key);
      if(cached)data=normalizePipelineCache(await cached.arrayBuffer(),format);
    } catch {stats.available=false;}
    if(!data&&seed)data=normalizePipelineCache(seed,format);
    if(!data)return;
    module.FS.mkdirTree('/user/Cache');
    module.FS.writeFile(FILE,data);
    stats.restored=(data.length-8)/(format&0xffff);
  }
  async function save() {
    if(saving||!stats.available)return;
    saving=true;
    try {
      let bytes;
      try {bytes=module.FS.readFile(FILE);}catch{return;}
      const data=normalizePipelineCache(bytes,format);
      if(!data)return;
      const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),n=>n.toString(16).padStart(2,'0')).join('');
      if(digest===previous)return;
      await (await storage.open(CACHE)).put(key,new Response(data,{headers:{'Content-Type':'application/octet-stream'}}));
      previous=digest;stats.saved=(data.length-8)/(format&0xffff);
    } catch {stats.available=false;}
    finally {saving=false;}
  }
  return {restore,save,stats};
}
