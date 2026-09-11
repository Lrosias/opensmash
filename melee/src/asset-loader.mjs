// The browser owns I/O. Engine workers wait for verified, immutable disc blocks.
const CACHE='opensmash-melee-assets-v1';
const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
export class AssetLoader {
  constructor(module,memory,manifest,catalog,{fetchBlock,commitBlock,onStatus=()=>{},background=true}={}) {
    this.module=module;this.memory=memory;this.manifest=manifest;this.catalog=catalog;
    this.fetchBlock=fetchBlock;this.commitBlock=commitBlock;this.onStatus=onStatus;
    this.jobs=new Map();this.ready=new Set();this.saved=new Set();this.contexts=new Set();this.active=0;
    this.menu=false;this.background=background;this.backgroundIndex=0;this.backgroundPending=false;
    this.stats={total:manifest.blocks.reduce((n,b)=>n+b.size,0),networkBytes:0,cachedBytes:0,decodedBytes:0,blocks:0,cacheAvailable:false,events:[]};
    this.files=new Map();
    for(const file of manifest.files)for(let i=file.first;i<file.first+file.blocks;i++)this.files.set(i,file);
    this.names=new Map();
    for(const [key,g] of Object.entries(catalog.groups))for(const i of g.blocks)if(key.startsWith('fighter:')||key.startsWith('stage:'))this.names.set(i,g.name);
  }
  event(type,details={}) {this.stats.events.push({time:performance.now(),type,...details});if(this.stats.events.length>500)this.stats.events.shift();}
  status() {
    const contexts=[...this.contexts].filter(c=>c.priority<100||this.menu).sort((a,b)=>a.priority-b.priority);
    const c=contexts[0];
    const failed=[...this.jobs.values()].find(j=>j.state==='failed'&&(j.priority<100||!c));
    const total=c?.indices.reduce((n,i)=>n+this.manifest.blocks[i].size,0)||0;
    const completed=c?.indices.reduce((n,i)=>n+((c.decode?this.ready:this.saved).has(i)?this.manifest.blocks[i].size:0),0)||0;
    this.onStatus({name:c?.name,background:c?.priority===100,blocked:contexts.some(c=>c.blocked),total,completed,error:failed?.error?.message,stats:this.stats});
  }
  request(index,priority=1,decode=true) {
    if((decode?this.ready:this.saved).has(index))return Promise.resolve();
    let job=this.jobs.get(index);
    if(job){job.priority=Math.min(priority,job.priority);job.decode||=decode;this.pump();return job.promise;}
    job={index,priority,decode,state:'queued'};
    job.promise=new Promise(resolve=>job.resolve=resolve);this.jobs.set(index,job);this.pump();return job.promise;
  }
  async ensure(indices,name,priority=1,decode=true,blocked=false) {
    indices=[...new Set(indices)];
    if(indices.every(i=>(decode?this.ready:this.saved).has(i)))return;
    const context={indices,name,priority,decode,blocked};this.contexts.add(context);this.status();
    try{await Promise.all(indices.map(i=>this.request(i,priority,decode)));}
    finally{this.contexts.delete(context);this.status();}
  }
  group(key,priority=1,blocked=false) {
    const g=this.catalog.groups[key];
    return g?this.ensure(g.blocks,g.name,priority,true,blocked):Promise.resolve();
  }
  async demand(index) {
    const file=this.files.get(index);
    if(!file)throw Error('Unknown game asset request.');
    this.event('demand',{file:file.path,menu:this.menu});
    await this.ensure(Array.from({length:file.blocks},(_,i)=>file.first+i),[...this.contexts].find(c=>c.priority<100&&c.indices.includes(index))?.name||this.names.get(index)||'game data',0,true,true);
  }
  selection(kind,id){const key=(kind===0?'fighter:':'stage:')+id;if(this.catalog.groups[key]){this.event('selection',{key});void this.group(key);}}
  async match(ticket,stage,...fighters) {
    this.menu=false;this.event('match-wait',{ticket,stage,fighters});
    // Add all contexts together so the status can name the currently missing group.
    await Promise.all(['match',...new Set(fighters.filter(i=>i>=0).map(i=>'fighter:'+i)),'stage:'+stage].map(key=>this.group(key,0,true)));
    this.event('match-ready',{ticket,stage,fighters,networkBytes:this.stats.networkBytes});
    this.module._melee_asset_match_ready(ticket);this.status();
  }
  enterMenu(){this.menu=true;this.event('menu');this.pump();}
  retry(){for(const job of this.jobs.values())if(job.state==='failed'){job.state='queued';job.error=null;}this.status();this.pump();}
  pump() {
    if([...this.jobs.values()].some(j=>j.state==='failed'&&j.priority<100))return;
    while(this.active<4){
      const job=[...this.jobs.values()].filter(j=>j.state==='queued'&&(j.priority<100||(this.menu&&this.active===0))).sort((a,b)=>a.priority-b.priority)[0];
      if(!job)break;
      job.state='loading';this.active++;
      this.run(job).finally(()=>{this.active--;this.status();this.pump();});
    }
    // One speculative block at a time, after foreground queues drain, only in menus.
    // Cache compressed bytes; do not inflate the entire game into Wasm memory.
    if(this.menu&&this.background&&this.stats.cacheAvailable&&!this.backgroundPending&&!this.active&&![...this.jobs.values()].some(j=>j.state==='failed')){
      while(this.backgroundIndex<this.catalog.background.length){
        const key=this.catalog.background[this.backgroundIndex],g=this.catalog.groups[key];
        const index=g.blocks.find(i=>!this.saved.has(i));
        if(index===undefined){this.backgroundIndex++;continue;}
        this.backgroundPending=true;
        this.ensure(g.blocks,g.name,100,false).finally(()=>{this.backgroundPending=false;this.pump();});
        break;
      }
    }
  }
  async run(job) {
    try {
      const b=this.manifest.blocks[job.index];
      const encoded=await this.fetchBlock(b,this.stats);
      this.saved.add(job.index);
      if(job.decode&&!this.ready.has(job.index)){
        await this.commitBlock(job.index,b,encoded);
        this.ready.add(job.index);this.stats.decodedBytes+=b.decodedSize;this.stats.blocks++;
      }
      this.jobs.delete(job.index);job.resolve();
    }catch(error){job.state='failed';job.error=error;this.event('download-error',{index:job.index,message:error.message});}
  }
}
export async function createAssetLoader(module,memory,onStatus) {
  const responses=await Promise.all(['assets-manifest.json','asset-groups.json'].map(async path=>{
    const r=await fetch(new URL(path,location.href));if(!r.ok)throw Error(`Could not load game metadata (${r.status}).`);return r.json();
  }));
  const [manifest,catalog]=responses;
  if(manifest.codec!=='zlib'||module._melee_prepare_assets()!==manifest.blocks.length)throw Error('The game data does not match this engine. Please reload.');
  let cache;try{cache=await caches.open(CACHE);}catch{/* Downloads still work without persistent storage. */}
  const cacheKey=b=>new URL(`/__melee_asset_cache__/${b.sha256}`,location.href).href;
  const loader=new AssetLoader(module,memory,manifest,catalog,{onStatus,
    async fetchBlock(block,stats){
      const key=cacheKey(block);let encoded;
      try{
        const saved=await cache?.match(key);
        if(saved){const bytes=await saved.arrayBuffer();if(bytes.byteLength===block.size&&await digest(bytes)===block.sha256){encoded=bytes;stats.cachedBytes+=bytes.byteLength;}else await cache.delete(key);}
      }catch{cache=undefined;stats.cacheAvailable=false;}
      if(!encoded){
        for(let attempt=0;attempt<3;attempt++){
          try{
            const r=await fetch(new URL(block.path,location.href),{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(`Download interrupted (${r.status}).`);
            const bytes=await r.arrayBuffer();if(bytes.byteLength!==block.size||await digest(bytes)!==block.sha256)throw Error('Download incomplete.');
            encoded=bytes;break;
          }catch(error){if(attempt===2)throw error;await new Promise(resolve=>setTimeout(resolve,500*(attempt+1)));}
        }
        stats.networkBytes+=encoded.byteLength;
        try{await cache?.put(key,new Response(encoded));}catch{cache=undefined;stats.cacheAvailable=false;}
      }
      return encoded;
    },
    async commitBlock(index,block,encoded){
      const decoded=await new Response(new Blob([encoded]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer();
      if(decoded.byteLength!==block.decodedSize)throw Error('Game data decompression failed.');
      const pointer=module._melee_asset_pointer(index,decoded.byteLength);if(!pointer)throw Error('Could not reserve game asset memory.');
      new Uint8Array(memory.buffer).set(new Uint8Array(decoded),pointer);
      if(!module._melee_asset_commit(index,decoded.byteLength,block.size))throw Error('Could not prepare game data.');
    }
  });
  loader.stats.cacheAvailable=!!cache;
  return loader;
}
