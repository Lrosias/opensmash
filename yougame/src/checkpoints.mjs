// Local binary checkpoints for a native Wasm engine. The SDK JSON value is a
// deterministic handle plus the engine's canonical diagnostic, while immutable
// memory pages stay local. A checkpoint is never transmitted to another client.
export class NativeCheckpoints {
 constructor(driver,{window=14,pageBytes=16384}={}){
  this.driver=driver;this.window=window;this.pageBytes=pageBytes;
  this.pages=[];this.frames=new Map();this.zero=new Uint32Array(pageBytes/4);
 }
 save(frame,state){
  const memory=this.driver.memory(),bytes=this.driver.used(),words=new Uint32Array(memory.buffer,0,Math.ceil(bytes/4));
  const pages=[],size=this.pageBytes/4,excluded=new Uint8Array(Math.ceil(words.length/size));
  for(const [begin,end] of this.driver.exclusions?.()||[])
   excluded.fill(1,Math.max(0,Math.ceil(begin/this.pageBytes)),Math.max(0,Math.min(excluded.length,Math.floor(end/this.pageBytes))));
  for(let start=0,index=0;start<words.length;start+=size,index++){
   if(excluded[index]){pages.push(null);continue;}
   const end=Math.min(start+size,words.length),old=this.pages[index]||this.zero;
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
   pages.push(same?old:words.slice(start,end));
  }
  const checkpoint={pages,bytes,state:[...state]};this.pages=pages;this.frames.set(frame,checkpoint);
  for(const f of this.frames.keys())if(f<frame-this.window)this.frames.delete(f);
  return {frame,state:[...state]};
 }
 load(handle){
  const checkpoint=this.frames.get(handle?.frame);
  if(!checkpoint||JSON.stringify(checkpoint.state)!==JSON.stringify(handle.state))throw new Error('Native rollback checkpoint expired or mismatched');
  const memory=this.driver.memory();
  for(let i=0;i<checkpoint.pages.length;i++)if(checkpoint.pages[i])memory.set(new Uint8Array(checkpoint.pages[i].buffer,checkpoint.pages[i].byteOffset,checkpoint.pages[i].byteLength),i*this.pageBytes);
  this.pages=checkpoint.pages;
  for(const f of this.frames.keys())if(f>handle.frame)this.frames.delete(f);
  return [...checkpoint.state];
 }
 destroy(){this.frames.clear();this.pages=[];}
}
