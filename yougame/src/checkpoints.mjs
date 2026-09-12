// Local binary checkpoints for a native Wasm engine. The SDK JSON value is a
// deterministic handle plus the engine's canonical diagnostic, while immutable
// memory pages stay local. A checkpoint is never transmitted to another client.
export class NativeCheckpoints {
 constructor(driver,{window=14,pageBytes=16384}={}){
  this.driver=driver;this.window=window;this.pageBytes=pageBytes;
  this.pages=[];this.frames=new Map();this.zero=new Uint32Array(pageBytes/4);
  // mirrorOf[i] is the page object whose exact content the driver's mirror holds for page i, so a
  // live page is compared against the mirror (no copy) only while that is the page it would be
  // compared against anyway; anything else takes the compare-a-copy path.
  this.mirrorOf=[];this.mirrorGeneration=0;
 }
 save(frame,state){
  // Initial mirror allocation may grow Wasm memory and detach earlier views.
  // Later game growth keeps this fixed mirror; uncovered pages use the fallback.
  const bytes=this.driver.used();if(this.driver.mirror)this.driver.mirror.ensure(bytes);
  const mirror=this.driver.mirror&&this.driver.mirror.capacity?this.driver.mirror:null;
  // A replaced mirror holds nothing yet: forget which pages it had.
  if(mirror&&mirror.generation!==this.mirrorGeneration){this.mirrorGeneration=mirror.generation;this.mirrorOf=[];}
  const memory=this.driver.memory(),words=new Uint32Array(memory.buffer,0,Math.ceil(bytes/4));
  const pages=[],size=this.pageBytes/4,excluded=new Uint8Array(Math.ceil(words.length/size));
  for(const [begin,end] of this.driver.exclusions?.()||[])
   excluded.fill(1,Math.max(0,Math.ceil(begin/this.pageBytes)),Math.max(0,Math.min(excluded.length,Math.floor(end/this.pageBytes))));
  const total=Math.ceil(words.length/size);
  // A page is "mirrored" while the mirror provably holds its previous version: those pages are
  // compared in runs, one Wasm call per run, and the run stops at the first page that changed.
  const mirrored=index=>{const old=this.pages[index];return !!(mirror&&old&&!excluded[index]&&old.length===size&&(index+1)*size<=words.length&&this.mirrorOf[index]===old&&mirror.covers(index*size,size));};
  let mirroredEnd=0;
  for(let index=0;index<total;index++){
   const start=index*size,end=Math.min(start+size,words.length);
   if(excluded[index]){pages.push(null);continue;}
   if(mirrored(index)){
    // Validate a run once. Finding a changed page only updates that page; the
    // remaining pages still have their original mirror identities. Rewalking
    // that suffix after every change makes busy frames quadratic in page count.
    if(index>=mirroredEnd){mirroredEnd=index+1;while(mirroredEnd<total&&mirrored(mirroredEnd))mirroredEnd++;}
    const stop=mirroredEnd;
    const at=mirror.firstDifference(start,(stop-index)*size);
    const changed=at<0?stop:index+Math.floor(at/size);
    for(let i=index;i<changed;i++)pages.push(this.pages[i]);
    if(changed>=stop){index=stop-1;continue;}
    const s=changed*size,e=Math.min(s+size,words.length),copy=words.slice(s,e);
    pages.push(copy);mirror.sync(s,e-s);this.mirrorOf[changed]=copy;index=changed;continue;
   }
   const old=this.pages[index]||this.zero;
   let same=old.length===end-start;
   if(same&&this.driver.comparePage){same=this.driver.comparePage(old,start,end-start);}
   else if(same){
    const length=end-start;let j=0;
    // Compare eight words per branch; unchanged pages dominate each frame.
    for(;j+8<=length;j+=8){const i=start+j;
     if((words[i]^old[j])|(words[i+1]^old[j+1])|(words[i+2]^old[j+2])|(words[i+3]^old[j+3])|
        (words[i+4]^old[j+4])|(words[i+5]^old[j+5])|(words[i+6]^old[j+6])|(words[i+7]^old[j+7])){same=false;break;}
    }
    if(same)for(;j<length;j++)if(words[start+j]!==old[j]){same=false;break;}
   }
   const page=same?old:words.slice(start,end);
   pages.push(page);
   // From now on the mirror holds this page (an all-zero page that matched `zero` included).
   if(mirror&&mirror.covers(start,end-start)){mirror.sync(start,end-start);this.mirrorOf[index]=page;}
  }
  const checkpoint={pages,bytes,state:[...state]};this.pages=pages;this.frames.set(frame,checkpoint);
  for(const f of this.frames.keys())if(f<frame-this.window)this.frames.delete(f);
  return {frame,state:[...state]};
 }
 load(handle){
  const checkpoint=this.frames.get(handle?.frame);
  if(!checkpoint||JSON.stringify(checkpoint.state)!==JSON.stringify(handle.state))throw new Error('Native rollback checkpoint expired or mismatched');
  const memory=this.driver.memory(),mirror=this.driver.mirror&&this.driver.mirror.capacity?this.driver.mirror:null;
  if(mirror&&mirror.generation!==this.mirrorGeneration){this.mirrorGeneration=mirror.generation;this.mirrorOf=[];}
  for(let i=0;i<checkpoint.pages.length;i++)if(checkpoint.pages[i]){
   const page=checkpoint.pages[i];
   memory.set(new Uint8Array(page.buffer,page.byteOffset,page.byteLength),i*this.pageBytes);
  }
  // Second pass: with every page restored, the mirror takes them (a restored page that lands
  // inside the mirror block must never overwrite a slot already synced in the same pass).
  if(mirror)for(let i=0;i<checkpoint.pages.length;i++){const page=checkpoint.pages[i];if(page&&mirror.covers(i*this.pageBytes/4,page.length)){mirror.sync(i*this.pageBytes/4,page.length);this.mirrorOf[i]=page;}}
  this.pages=checkpoint.pages;
  for(const f of this.frames.keys())if(f>handle.frame)this.frames.delete(f);
  return [...checkpoint.state];
 }
 // A new timeline reuses the frame numbers; the diff base stays valid.
 reset(){this.frames.clear();}
 destroy(){this.frames.clear();this.pages=[];this.mirrorOf=[];}
}
