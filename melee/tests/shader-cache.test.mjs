import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizePipelineCache,createShaderCache} from '../src/shader-cache.mjs';
const size=16,format=(8<<16)|size;
function cache(count,extra=0){const b=new Uint8Array(8+count*size+extra),v=new DataView(b.buffer);v.setUint32(0,0x44495550,true);v.setUint32(4,8,true);for(let i=0;i<count;i++)v.setUint32(8+i*size,i,true);return b;}
test('rejects wrong format and handles a partial final record without inventing a UID',()=>{
 assert.equal(normalizePipelineCache(cache(1),(9<<16)|size),null);
 assert.equal(normalizePipelineCache(new Uint8Array(7),format),null);
 assert.deepEqual(normalizePipelineCache(cache(3,7),format),cache(3));
});
test('bounds startup work while preserving common and recent pipelines',()=>{
 const result=normalizePipelineCache(cache(600),format),v=new DataView(result.buffer);
 assert.equal(result.length,8+512*size);
 assert.equal(v.getUint32(8+63*size,true),63);
 assert.equal(v.getUint32(8+64*size,true),152);
 assert.equal(v.getUint32(8+511*size,true),599);
});
test('learned cache restores only under the same engine identity; storage failure is optional',async()=>{
 const values=new Map(),files=new Map();
 const storage={open:async()=>({match:async k=>values.get(k)?.clone(),put:async(k,v)=>values.set(k,v)})};
 const module={_melee_shader_cache_format:()=>format,FS:{mkdirTree(){},readFile:p=>files.get(p),writeFile:(p,b)=>files.set(p,b)}};
 files.set('/user/Cache/GALE01.uidcache',cache(4));
 const first=createShaderCache(module,'one',{storage,base:'https://test.invalid/'});await first.save();assert.equal(first.stats.saved,4);
 files.clear();const second=createShaderCache(module,'one',{storage,base:'https://test.invalid/'});await second.restore();assert.equal(second.stats.restored,4);
 const other=createShaderCache(module,'two',{storage,base:'https://test.invalid/'});await other.restore();assert.equal(other.stats.restored,0);
 const unavailable=createShaderCache(module,'one',{storage:{open:async()=>{throw Error('unavailable');}},base:'https://test.invalid/'});
 await unavailable.restore();await unavailable.save();assert.equal(unavailable.stats.available,false);
});
