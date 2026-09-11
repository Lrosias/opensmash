// The browser owns I/O. Engine workers wait for verified, immutable disc blocks.
// Priorities: 0 blocks play (a demand read or the match gate), 1 a fighter or
// stage the game has picked, 2 planned prefetch decoded into memory, 3 planned
// prefetch kept compressed. Foreground work may abort planned downloads.
const CACHE='opensmash-melee-assets-v1';
const MB=1048576;
const LIMIT=4, PLANNED_LIMIT=3, RETRY_PAUSE=30000;
const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
// Decoded blocks live in Wasm memory beside the running game. The budget covers the
// menus, match essentials, the whole roster and the selectable tournament stages on
// an 8 GB machine; past it, planned blocks stay compressed until they are picked.
export function defaultDecodeBudget(deviceMemory=(typeof navigator!=='undefined'&&navigator.deviceMemory)||8) {
  return Math.min(192,Math.max(96,deviceMemory*24))*MB;
}
export class AssetLoader {
  constructor(manifest,catalog,{fetchBlock,commitBlock,onStatus=()=>{},background=true,decodeBudget=defaultDecodeBudget(),memoryStore=64*MB}={}) {
    this.manifest=manifest;this.catalog=catalog;this.fetchBlock=fetchBlock;this.commitBlock=commitBlock;this.onStatus=onStatus;
    this.module=null;this.memory=null;
    this.jobs=new Map();this.ready=new Set();this.saved=new Set();this.staged=new Map();this.encoded=new Map();this.encodedBytes=0;
    this.contexts=new Set();this.active=0;this.sequence=0;this.pausedUntil=0;this.pauseTimer=null;this.tickTimer=null;
    this.menu=false;this.background=background;this.plan=[...(catalog.plan||[])];this.selected=new Set();
    this.decodeBudget=decodeBudget;this.decodedPrefetch=0;this.memoryStore=memoryStore;
    this.stats={total:manifest.blocks.reduce((n,b)=>n+b.size,0),networkBytes:0,cachedBytes:0,decodedBytes:0,decodedPrefetchBytes:0,blocks:0,aborted:0,cacheAvailable:false,events:[],inflight:{}};
    this.files=new Map();
    for(const file of manifest.files)for(let i=file.first;i<file.first+file.blocks;i++)this.files.set(i,file);
    this.names=new Map();
    for(const [key,g] of Object.entries(catalog.groups))if(!key.startsWith('fighter:')&&!key.startsWith('stage:'))for(const i of g.blocks)this.names.set(i,g.name);
    for(const [key,g] of Object.entries(catalog.groups))if(key.startsWith('fighter:')||key.startsWith('stage:'))for(const i of g.blocks)this.names.set(i,g.name);
    this.planBlocks=new Set(this.plan.flatMap(key=>catalog.groups[key]?.blocks||[]));
    this.planBytes=[...this.planBlocks].reduce((n,i)=>n+manifest.blocks[i].size,0);
  }
  async attach(module,memory) {
    if(module._melee_prepare_assets()!==this.manifest.blocks.length)throw Error('The game data does not match this engine. Please reload.');
    this.module=module;this.memory=memory;
    for(const [index,{job,encoded}] of [...this.staged]) {
      this.staged.delete(index);
      try{await this.commit(job,encoded);this.finish(job);}catch(error){this.failJob(job,error);}
    }
    this.status();this.pump();
  }
  event(type,details={}) {this.stats.events.push({time:performance.now(),type,...details});if(this.stats.events.length>500)this.stats.events.shift();}
  loaded(index) {return this.saved.has(index)?this.manifest.blocks[index].size:this.stats.inflight[index]||0;}
  status() {
    const contexts=[...this.contexts].sort((a,b)=>a.priority-b.priority);
    const c=contexts[0];
    const failed=[...this.jobs.values()].find(j=>j.state==='failed');
    let report={name:undefined,kind:'idle',total:0,completed:0};
    if(c) {
      report={name:c.name,kind:contexts.some(x=>x.blocked)?'blocking':'selected',
        total:c.indices.reduce((n,i)=>n+this.manifest.blocks[i].size,0),completed:c.indices.reduce((n,i)=>n+this.loaded(i),0)};
    } else if(this.menu) {
      const job=[...this.jobs.values()].filter(j=>j.state==='loading').sort((a,b)=>a.sequence-b.sequence)[0];
      if(job)report={name:job.name||this.names.get(job.index)||'game data',kind:'preparing',total:this.planBytes,completed:[...this.planBlocks].reduce((n,i)=>n+this.loaded(i),0)};
    }
    this.onStatus({...report,background:report.kind==='preparing',blocked:report.kind==='blocking',error:failed?.error?.message,stats:this.stats});
  }
  tick() {if(!this.tickTimer){this.tickTimer=setTimeout(()=>{this.tickTimer=null;this.status();},120);this.tickTimer.unref?.();}}
  enqueue(index,priority,decode,name) {
    let job=this.jobs.get(index);
    if(job){job.priority=Math.min(priority,job.priority);job.decode||=decode;return job;}
    if(decode?this.ready.has(index):this.saved.has(index))return null;
    // Blocks pack several files, so a block can belong to more than one group;
    // name the job after the group that asked for it.
    job={index,priority,decode,name,state:'queued',sequence:this.sequence++};
    job.promise=new Promise(resolve=>job.resolve=resolve);this.jobs.set(index,job);return job;
  }
  request(index,priority=1,decode=true) {
    const job=this.enqueue(index,priority,decode);this.pump();
    return job?job.promise:Promise.resolve();
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
    await this.ensure(Array.from({length:file.blocks},(_,i)=>file.first+i),[...this.contexts].find(c=>c.priority<2&&c.indices.includes(index))?.name||this.names.get(index)||'game data',0,true,true);
  }
  selection(kind,id) {
    const key=(kind===0?'fighter:':'stage:')+id;
    if(!this.catalog.groups[key])return;
    this.selected.add(key);this.event('selection',{key});
    void this.group(key,1);
    // A placed token means a stage pick is near: the tournament stages move ahead
    // of the remaining roster, which other players may still be browsing.
    if(kind===0)this.promote(this.catalog.competitive||[]);
  }
  promote(keys) {
    const set=new Set(keys);
    this.plan=[...this.plan.filter(k=>set.has(k)),...this.plan.filter(k=>!set.has(k))];this.pump();
  }
  async match(ticket,stage,...fighters) {
    this.menu=false;this.event('match-wait',{ticket,stage,fighters});
    // Add all contexts together so the status can name the currently missing group.
    await Promise.all(['match',...new Set(fighters.filter(i=>i>=0).map(i=>'fighter:'+i)),'stage:'+stage].map(key=>this.group(key,0,true)));
    this.event('match-ready',{ticket,stage,fighters,networkBytes:this.stats.networkBytes});
    this.module._melee_asset_match_ready(ticket);this.status();
  }
  enterMenu() {this.menu=true;this.plan=[...(this.catalog.plan||[])];this.event('menu');this.pump();}
  retry() {
    for(const job of this.jobs.values())if(job.state==='failed'){job.state='queued';job.error=null;}
    this.pausedUntil=0;this.status();this.pump();
  }
  planned() {
    return this.menu&&this.background&&performance.now()>=this.pausedUntil&&![...this.jobs.values()].some(j=>j.state==='failed');
  }
  pump() {
    const jobs=[...this.jobs.values()];
    if(jobs.some(j=>j.state==='failed'))return;
    const queued=jobs.filter(j=>j.state==='queued').sort((a,b)=>a.priority-b.priority||a.sequence-b.sequence);
    const foreground=queued.filter(j=>j.priority<2).length;
    if(foreground>LIMIT-this.active) {
      const victims=jobs.filter(j=>j.state==='loading'&&j.priority>1&&!j.aborted).sort((a,b)=>b.priority-a.priority||b.sequence-a.sequence);
      for(const victim of victims.slice(0,foreground-(LIMIT-this.active))){victim.aborted=true;victim.controller.abort();}
    }
    const before=this.sequence;
    let started=0;
    for(const job of queued) {
      if(this.active>=LIMIT)break;
      if(job.priority>1&&(!this.planned()||this.active>=PLANNED_LIMIT))continue;
      this.start(job);started++;
    }
    if(this.planned())this.feedPlan();
    if(started||this.sequence!==before)this.tick();
  }
  start(job) {
    job.state='loading';job.aborted=false;this.active++;
    this.run(job).finally(()=>{this.active--;this.status();this.pump();});
  }
  feedPlan() {
    let pending=0;
    for(const job of this.jobs.values())if(job.priority>1&&job.decode&&job.state!=='failed')pending+=this.manifest.blocks[job.index].decodedSize;
    for(const key of this.plan) {
      const g=this.catalog.groups[key];if(!g)continue;
      for(const index of g.blocks) {
        if(this.active>=PLANNED_LIMIT)return;
        if(this.ready.has(index)||this.jobs.has(index))continue;
        const b=this.manifest.blocks[index];
        const decode=this.decodedPrefetch+pending+b.decodedSize<=this.decodeBudget;
        if(!decode&&(this.saved.has(index)||(!this.stats.cacheAvailable&&this.encodedBytes+b.size>this.memoryStore)))continue;
        if(decode)pending+=b.decodedSize;
        this.start(this.enqueue(index,decode?2:3,decode,g.name));
      }
    }
  }
  async commit(job,encoded) {
    const b=this.manifest.blocks[job.index];
    await this.commitBlock(job.index,b,encoded);
    this.ready.add(job.index);this.stats.decodedBytes+=b.decodedSize;this.stats.blocks++;
    // Every decoded block stays in Wasm memory, so all of them count against the budget.
    this.decodedPrefetch+=b.decodedSize;this.stats.decodedPrefetchBytes=this.decodedPrefetch;
    if(this.encoded.delete(job.index))this.encodedBytes-=b.size;
  }
  finish(job) {this.jobs.delete(job.index);job.resolve();}
  failJob(job,error) {
    delete this.stats.inflight[job.index];
    if(job.aborted){
      // Planned work re-enters through the plan order. A job that foreground work
      // joined after the abort was issued keeps its waiters: back in the queue.
      this.stats.aborted++;
      if(job.priority>1)this.jobs.delete(job.index);else{job.state='queued';job.aborted=false;}
      return;
    }
    this.event('download-error',{index:job.index,priority:job.priority,message:error.message});
    if(job.priority>1) {
      // Planned work never shows an error; try again later.
      this.jobs.delete(job.index);this.pausedUntil=performance.now()+RETRY_PAUSE;
      clearTimeout(this.pauseTimer);this.pauseTimer=setTimeout(()=>this.pump(),RETRY_PAUSE);this.pauseTimer.unref?.();
      return;
    }
    job.state='failed';job.error=error;
  }
  async run(job) {
    const b=this.manifest.blocks[job.index];
    job.controller=new AbortController();
    try {
      let encoded=this.encoded.get(job.index);
      if(!encoded)encoded=await this.fetchBlock(b,this.stats,job.controller.signal,loaded=>{this.stats.inflight[job.index]=loaded;this.tick();});
      delete this.stats.inflight[job.index];
      this.saved.add(job.index);
      if(job.decode&&!this.ready.has(job.index)) {
        if(!this.module){job.state='staged';this.staged.set(job.index,{job,encoded});return;}
        await this.commit(job,encoded);
      } else if(!job.decode&&!this.stats.cacheAvailable&&!this.encoded.has(job.index)&&this.encodedBytes+b.size<=this.memoryStore) {
        this.encoded.set(job.index,encoded);this.encodedBytes+=b.size;
      }
      this.finish(job);
    } catch(error) {this.failJob(job,error);}
  }
}
export async function createAssetLoader(module,memory,onStatus,options={}) {
  const responses=await Promise.all(['assets-manifest.json','asset-groups.json'].map(async path=>{
    const r=await fetch(new URL(path,location.href));if(!r.ok)throw Error(`Could not load game metadata (${r.status}).`);return r.json();
  }));
  const [manifest,catalog]=responses;
  if(manifest.codec!=='zlib')throw Error('The game data does not match this engine. Please reload.');
  let cache;try{cache=await caches.open(CACHE);}catch{/* Downloads still work without persistent storage. */}
  const cacheKey=b=>new URL(`/__melee_asset_cache__/${b.sha256}`,location.href).href;
  const loader=new AssetLoader(manifest,catalog,{onStatus,...options,
    async fetchBlock(block,stats,signal,onProgress){
      const key=cacheKey(block);let encoded;
      try{
        const saved=await cache?.match(key);
        if(saved){const bytes=await saved.arrayBuffer();if(bytes.byteLength===block.size&&await digest(bytes)===block.sha256){encoded=bytes;stats.cachedBytes+=bytes.byteLength;}else await cache.delete(key);}
      }catch{cache=undefined;stats.cacheAvailable=false;}
      if(!encoded){
        for(let attempt=0;attempt<3;attempt++){
          try{
            const timeout=AbortSignal.timeout(90000);
            const r=await fetch(new URL(block.path,location.href),{signal:signal?AbortSignal.any([signal,timeout]):timeout});
            if(!r.ok)throw Error(`Download interrupted (${r.status}).`);
            const bytes=new Uint8Array(block.size);let loaded=0;const reader=r.body.getReader();
            for(;;){
              const {value,done}=await reader.read();if(done)break;
              if(loaded+value.byteLength>block.size)throw Error('Download incomplete.');
              bytes.set(value,loaded);loaded+=value.byteLength;onProgress?.(loaded);
            }
            if(loaded!==block.size||await digest(bytes)!==block.sha256)throw Error('Download incomplete.');
            encoded=bytes.buffer;break;
          }catch(error){if(signal?.aborted||attempt===2)throw error;await new Promise(resolve=>setTimeout(resolve,500*(attempt+1)));}
        }
        stats.networkBytes+=encoded.byteLength;
        // A failed write (quota) stops planned compressed saves; reads of earlier blocks go on.
        if(stats.cacheAvailable)try{await cache?.put(key,new Response(encoded));}catch{stats.cacheAvailable=false;}
      }
      return encoded;
    },
    async commitBlock(index,block,encoded){
      const decoded=await new Response(new Blob([encoded]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer();
      if(decoded.byteLength!==block.decodedSize)throw Error('Game data decompression failed.');
      const pointer=loader.module._melee_asset_pointer(index,decoded.byteLength);if(!pointer)throw Error('Could not reserve game asset memory.');
      new Uint8Array(loader.memory.buffer).set(new Uint8Array(decoded),pointer);
      if(!loader.module._melee_asset_commit(index,decoded.byteLength,block.size))throw Error('Could not prepare game data.');
    }
  });
  loader.stats.cacheAvailable=!!cache;
  if(module)await loader.attach(module,memory);
  return loader;
}
