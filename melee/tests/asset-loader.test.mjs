import test from 'node:test';
import assert from 'node:assert/strict';
import {AssetLoader} from '../src/asset-loader.mjs';
const tick=()=>new Promise(r=>setImmediate(r));
function fixture(count=12){
 const pending=[],commits=[],acks=[],status=[];
 const manifest={blocks:Array.from({length:count},(_,i)=>({path:String(i),size:10,decodedSize:20})),files:Array.from({length:count},(_,i)=>({path:`file${i}`,first:i,blocks:1}))};
 const catalog={groups:{menu:{name:'menu',blocks:[0]},match:{name:'essentials',blocks:[1]},'fighter:2':{name:'Fox',blocks:[2,3]},'stage:31':{name:'Battlefield',blocks:[4,5]},'fighter:9':{name:'Marth',blocks:[6,7]}},background:['fighter:2','fighter:9']};
 const loader=new AssetLoader({_melee_asset_match_ready:id=>acks.push(id)},null,manifest,catalog,{onStatus:s=>status.push(s),fetchBlock:b=>new Promise((resolve,reject)=>pending.push({index:Number(b.path),resolve,reject})),commitBlock:async i=>{commits.push(i);}});
 return {loader,pending,commits,acks,status};
}
test('foreground selection jumps ahead of speculative work; duplicate requests share a load',async()=>{
 const {loader,pending,commits}=fixture();loader.stats.cacheAvailable=true;loader.enterMenu();
 assert.deepEqual(pending.map(x=>x.index),[2]);
 const a=loader.request(2,0,true),b=loader.request(2,1,true);
 assert.equal(a,b);pending.shift().resolve(new ArrayBuffer(0));await a;
 assert.deepEqual(commits,[2]);loader.menu=false;
 await tick();assert.ok(pending.length<=1);
});
test('match gate waits for every fighter/stage block and suspends background prefetch',async()=>{
 const {loader,pending,acks,commits}=fixture();
 const match=loader.match(7,31,2,-1,-1,-1);await tick();
 assert.equal(loader.menu,false);assert.deepEqual(acks,[]);
 while(pending.length){pending.shift().resolve(new ArrayBuffer(0));await tick();}
 await match;assert.deepEqual(acks,[7]);assert.deepEqual(commits.sort(),[1,2,3,4,5]);
});
test('failed urgent download keeps its wait pending until retry succeeds',async()=>{
 const {loader,pending,status}=fixture();let done=false;
 const wait=loader.demand(8).then(()=>done=true);
 pending.shift().reject(Error('offline'));await tick();
 assert.equal(done,false);assert.equal(status.at(-1).blocked,true);assert.equal(status.at(-1).error,'offline');
 loader.retry();pending.shift().resolve(new ArrayBuffer(0));await wait;
 assert.equal(done,true);assert.equal(status.at(-1).blocked,false);
});
test('background stores compressed data without allocating Wasm memory; a ready block is reused',async()=>{
 const {loader,pending,commits}=fixture();
 const cached=loader.ensure([2],'Fox',100,false);assert.equal(pending.length,0);
 loader.enterMenu();pending.shift().resolve(new ArrayBuffer(0));await cached;
 assert.deepEqual(commits,[]);assert.equal(loader.saved.has(2),true);
 const decoded=loader.request(2);pending.shift().resolve(new ArrayBuffer(0));await decoded;
 await loader.request(2);assert.deepEqual(commits,[2]);assert.equal(pending.length,0);
});
test('corrupt cached bytes are replaced; the next visit uses verified cache without network',async()=>{
 const {createAssetLoader}=await import('../src/asset-loader.mjs');
 const {deflateSync}=await import('node:zlib');
 const {createHash}=await import('node:crypto');
 const original={fetch:globalThis.fetch,caches:globalThis.caches,location:globalThis.location};
 const bytes=Buffer.from('verified game block'),encoded=deflateSync(bytes),sha256=createHash('sha256').update(encoded).digest('hex');
 let saved=Buffer.from('corrupt'),downloads=0;
 const cache={match:async()=>new Response(saved),delete:async()=>{saved=null;},put:async(k,r)=>{saved=Buffer.from(await r.arrayBuffer());}};
 const manifest={codec:'zlib',blocks:[{path:'assets/a.bin',size:encoded.length,decodedSize:bytes.length,sha256}],files:[{path:'files/a.dat',first:0,blocks:1}]};
 const catalog={groups:{menu:{name:'menus',blocks:[0]}},background:[]};
 globalThis.location={href:'https://game.yougame.co/v/build/'};globalThis.caches={open:async()=>cache};
 globalThis.fetch=async url=>{if(url.pathname.endsWith('assets-manifest.json'))return Response.json(manifest);if(url.pathname.endsWith('asset-groups.json'))return Response.json(catalog);downloads++;return new Response(encoded);};
 try{
  for(let visit=0;visit<2;visit++){
   const memory={buffer:new ArrayBuffer(128)};
   const module={_melee_prepare_assets:()=>1,_melee_asset_pointer:()=>32,_melee_asset_commit:()=>1};
   const loader=await createAssetLoader(module,memory,()=>{});await loader.group('menu');
   assert.equal(Buffer.from(memory.buffer,32,bytes.length).toString(),bytes.toString());
   assert.equal(downloads,1);assert.equal(loader.stats.networkBytes,visit?0:encoded.length);
  }
 }finally{Object.assign(globalThis,original);}
});
