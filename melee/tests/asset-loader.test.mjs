import test from 'node:test';
import assert from 'node:assert/strict';
import {AssetLoader} from '../src/asset-loader.mjs';
const tick=()=>new Promise(r=>setImmediate(r));
const settle=async(n=4)=>{for(let i=0;i<n;i++)await tick();await new Promise(r=>setTimeout(r,130));};
function fixture({count=14,decodeBudget=1e9,module}={}){
 const pending=[],commits=[],acks=[],status=[];
 if(module===undefined)module={_melee_prepare_assets:()=>count,_melee_asset_match_ready:id=>acks.push(id)};
 const manifest={blocks:Array.from({length:count},(_,i)=>({path:String(i),size:10,decodedSize:20})),files:Array.from({length:count},(_,i)=>({path:`file${i}`,first:i,blocks:1}))};
 const catalog={groups:{menu:{name:'menus',blocks:[0]},match:{name:'match essentials',blocks:[1]},'fighter:2':{name:'Fox',blocks:[2,3]},'fighter:9':{name:'Marth',blocks:[6,7]},'fighter:5':{name:'Bowser',blocks:[10,11]},'stage:31':{name:'Battlefield',blocks:[4,5]},'stage:32':{name:'Final Destination',blocks:[12,13]}},
  plan:['match','fighter:2','fighter:9','stage:31','fighter:5','stage:32'],competitive:['stage:31']};
 const loader=new AssetLoader(manifest,catalog,{onStatus:s=>status.push(s),decodeBudget,
  fetchBlock:(b,stats,signal)=>new Promise((resolve,reject)=>{const entry={index:Number(b.path),resolve,reject};pending.push(entry);signal?.addEventListener('abort',()=>{const i=pending.indexOf(entry);if(i>=0)pending.splice(i,1);reject(new DOMException('aborted','AbortError'));});}),
  commitBlock:async i=>{commits.push(i);}});
 loader.stats.cacheAvailable=true;
 if(module){loader.module=module;loader.memory={};}
 const finish=async(index,rounds=4)=>{const i=pending.findIndex(p=>p.index===index);assert.ok(i>=0,`block ${index} not in flight: ${pending.map(p=>p.index)}`);pending.splice(i,1)[0].resolve(new ArrayBuffer(0));await settle(rounds);};
 const fail=async(index,message='offline')=>{const i=pending.findIndex(p=>p.index===index);assert.ok(i>=0,`block ${index} not in flight`);pending.splice(i,1)[0].reject(Error(message));await settle();};
 return {loader,pending,commits,acks,status,finish,fail,inFlight:()=>pending.map(p=>p.index).sort((a,b)=>a-b)};
}
test('the plan starts in menus: match essentials first, up to three at once, decoded',async()=>{
 const {loader,pending,commits,finish,inFlight}=fixture();
 assert.deepEqual(inFlight(),[]);
 loader.enterMenu();
 assert.deepEqual(inFlight(),[1,2,3]);
 await finish(1);assert.deepEqual(commits,[1]);assert.deepEqual(inFlight(),[2,3,6]);
 loader.menu=false;await finish(2);await finish(3);await finish(6);
 assert.deepEqual(inFlight(),[],'no planned work outside menus');
 assert.equal(pending.length,0);
});
test('a picked fighter goes ahead of the plan and shares in-flight work; stages move up next',async()=>{
 const {loader,commits,finish,inFlight}=fixture();
 loader.enterMenu();assert.deepEqual(inFlight(),[1,2,3]);
 loader.selection(0,5);
 await settle();
 assert.deepEqual(inFlight(),[1,10,11],'planned downloads were aborted for Bowser');
 assert.equal(loader.stats.aborted,2);
 const shared=loader.request(10,1),again=loader.request(10,0);assert.equal(shared,again);
 await finish(10);await finish(11);await finish(1);
 assert.deepEqual(commits.sort(),[1,10,11]);
 assert.deepEqual(inFlight(),[2,4,5],'the tournament stage comes before the remaining fighters');
});
test('foreground work that joins a planned download after its abort still completes',async()=>{
 const {loader,acks,finish,inFlight}=fixture();
 loader.enterMenu();await settle();
 assert.deepEqual(inFlight(),[1,2,3]);
 // Marth's blocks abort planned job 3; Fox's request joins job 3 in the same turn.
 const match=loader.match(7,31,9,2,-1,-1);await settle();
 assert.equal(loader.stats.aborted,1);
 for(const i of [1,2,6,7]){if(inFlight().includes(i))await finish(i);}
 for(const i of [3,4,5]){if(!inFlight().includes(i))await settle();await finish(i);}
 while(inFlight().length)await finish(inFlight()[0]);
 await match;assert.deepEqual(acks,[7]);
});
test('the match gate waits for every fighter/stage block and suspends planned work',async()=>{
 const {loader,acks,commits,finish,inFlight}=fixture();
 loader.enterMenu();
 const match=loader.match(7,31,2,-1,-1,-1);await settle();
 assert.equal(loader.menu,false);assert.deepEqual(acks,[]);
 assert.deepEqual(inFlight(),[1,2,3,4],'gate blocks use every slot; plan block 6 is not started');
 for(const i of [1,2,3,4])await finish(i);
 await finish(5);
 await match;assert.deepEqual(acks,[7]);assert.deepEqual(commits.sort(),[1,2,3,4,5]);
 assert.deepEqual(inFlight(),[]);
});
test('a failed urgent download keeps its wait pending until retry succeeds; a failed planned one is dropped quietly',async()=>{
 const {loader,status,finish,fail,inFlight}=fixture();
 loader.enterMenu();
 await fail(2);
 assert.equal(status.at(-1).error,undefined,'planned failures show no error');
 assert.equal(loader.planned(),false,'planned work pauses after a failure');
 assert.deepEqual(inFlight(),[1,3],'no new planned downloads while paused');
 loader.pausedUntil=0;
 let done=false;
 const wait=loader.demand(8).then(()=>done=true);await settle();
 await fail(8);
 assert.equal(done,false);assert.equal(status.at(-1).blocked,true);assert.equal(status.at(-1).error,'offline');
 loader.retry();await settle();await finish(8);await wait;
 assert.equal(done,true);assert.equal(status.at(-1).blocked,false);
});
test('planned prefetch decodes within the budget, then keeps compressed data; a saved block decodes on request',async()=>{
 const {loader,commits,finish,inFlight}=fixture({decodeBudget:40});
 loader.enterMenu();assert.deepEqual(inFlight(),[1,2,3]);
 await finish(1);await finish(2);
 assert.deepEqual(commits,[1,2]);
 await finish(3);await finish(6);await finish(7);
 assert.deepEqual(commits,[1,2],'over budget: later blocks stay compressed');
 assert.equal(loader.saved.has(6),true);assert.equal(loader.ready.has(6),false);
 loader.menu=false;await settle();
 const decoded=loader.request(6);await settle();await finish(6);await decoded;
 assert.deepEqual(commits,[1,2,6]);
 await loader.request(6);
});
test('menu blocks fetched before the engine exists are committed at attach',async()=>{
 const {loader,commits,finish,pending}=fixture({module:null});
 let ready=false;const wait=loader.group('menu',0).then(()=>ready=true);
 await settle();await finish(0);
 assert.equal(ready,false);assert.deepEqual(commits,[]);assert.equal(loader.staged.size,1);
 const later=loader.group('menu',0);
 await loader.attach({_melee_prepare_assets:()=>14},{});
 await wait;await later;
 assert.equal(ready,true);assert.deepEqual(commits,[0]);assert.equal(pending.length,0);
});
test('status names the current work: blocking, selected, preparing',async()=>{
 const {loader,status,finish}=fixture();
 loader.enterMenu();await settle();
 assert.equal(status.at(-1).kind,'preparing');assert.equal(status.at(-1).name,'match essentials');
 void loader.group('fighter:5',1);await settle();
 assert.equal(status.at(-1).kind,'selected');assert.equal(status.at(-1).name,'Bowser');assert.equal(status.at(-1).total,20);
 void loader.demand(12);await settle();
 assert.equal(status.at(-1).kind,'blocking');assert.equal(status.at(-1).name,'Final Destination');
 await finish(12);await finish(10);await finish(11);await finish(1);
});
test('corrupt cached bytes are replaced; the next visit uses verified cache without network',async()=>{
 const {createAssetLoader}=await import('../src/asset-loader.mjs');
 const {deflateSync}=await import('node:zlib');
 const {createHash}=await import('node:crypto');
 const original={fetch:globalThis.fetch,caches:globalThis.caches,location:globalThis.location};
 const bytes=Buffer.from('verified game block'),encoded=deflateSync(bytes),sha256=createHash('sha256').update(encoded).digest('hex');
 let saved=Buffer.from('corrupt'),downloads=0;
 const cache={match:async()=>saved&&new Response(saved),delete:async()=>{saved=null;},put:async(k,r)=>{saved=Buffer.from(await r.arrayBuffer());}};
 const manifest={codec:'zlib',blocks:[{path:'assets/a.bin',size:encoded.length,decodedSize:bytes.length,sha256}],files:[{path:'files/a.dat',first:0,blocks:1}]};
 const catalog={groups:{menu:{name:'menus',blocks:[0]}},plan:[]};
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
