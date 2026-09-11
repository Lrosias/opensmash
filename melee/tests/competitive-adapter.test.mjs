import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {MeleeMatchAdapter} from '../src/competitive-adapter.mjs';
const sdkPath=process.env.YOUGAME_SDK_PATH;
const launch={round:1,game:1,seed:77,stage:31,selections:[{fighter:2,color:0},{fighter:20,color:0}],rules:{stocks:4,seconds:480}};
function pair({maxRollback=0,mismatch=false,ports=false}={}) {
  const sdk=readFileSync(sdkPath,'utf8');
  const code=sdk.slice(sdk.indexOf('  function matchConnectionIds('),sdk.indexOf('  function makeSync('))+sdk.slice(sdk.indexOf('  function canon('),sdk.indexOf('  // A hidden tab'))+
    sdk.slice(sdk.indexOf('  function makeAsyncRollback('),sdk.indexOf('  /* ---------- host-authoritative kit:'));
  const make=vm.runInNewContext(code+';makeAsyncRollback',{console,window:{console},performance,setInterval,clearInterval});
  const rooms=[],adapters=[],engines=[],packets=[];
  for(let i=0;i<2;i++){
    const handlers=new Map();
    rooms.push({me:['a','b'][i],players:[{id:'a'},{id:'b'}],round:1,
      on(e,f){if(!handlers.has(e))handlers.set(e,new Set());handlers.get(e).add(f);},off(e,f){handlers.get(e)?.delete(f);},
      send(data){packets.push(structuredClone(data));setTimeout(()=>{const peer=rooms[1-i];if(data._ra)peer._sync?.receive(this.me,data);else peer.emit('message',{from:this.me,data});},data._ra?(i?35:4):0);},
      emit(e,d){for(const f of handlers.get(e)??[])f(d);},rollbackAsync(o){return make(this,o);}});
  }
  if(ports)for(const room of rooms){room.lifecycle='game';room.playing=true;room.matchConnections=room.activeConnections=['a','b'];room.matchParticipants=room.activeParticipants=room.participants=Array.from({length:4},(_,slot)=>({id:'p'+slot,slot,localIndex:slot%2,connectionId:slot<2?'a':'b'}));room.players.push({id:'late'});}
  for(let i=0;i<2;i++)adapters.push(new MeleeMatchAdapter({room:rooms[i],build:'test-build',maxRollback,delay:1,input:(frame,localIndex=0)=>[i+1+localIndex*8+(frame%2)*4,0,0,0,0,0,0],
    createEngine:async launch=>{
      let frame=0,sum=0;const owned=new Set();
      const engine={initial:{checksum:mismatch&&i?'different':'same',match:{stage:launch.stage,slots:launch.slots??[0,1],fighters:launch.selections.map(s=>s.fighter)}},active:true,closed:false,get frame(){return frame;},async checkpointStats(){return {count:owned.size};},async manageCheckpoints(){},saves:0,loads:0,cacheSaves:0,destroyed:false,show(){},async saveCache(){this.cacheSaves++;},
        async save(){this.saves++;const token={frame,sum};owned.add(token);return token;},
        async load(token){assert.ok(owned.has(token));this.loads++;({frame,sum}=token);},
        async discard(token){assert.ok(owned.delete(token));},
        async step(inputs){await new Promise(r=>setTimeout(r,1));frame++;sum+=inputs.reduce((n,p)=>n+p[0],0);return {frame,checksum:`${frame}:${sum}`,result:frame>=20?{winner:0}:null};},
        destroy(){this.destroyed=true;assert.equal(owned.size,0);}};
      engines.push(engine);return engine;
    }}));
  return {adapters,engines,packets,stop:()=>Promise.all(adapters.map(a=>a.stop()))};
}
for(const maxRollback of [0,7])test(`real SDK async controller confirms matching native-adapter results (window ${maxRollback})`,{skip:!sdkPath,timeout:10000},async()=>{
  const p=pair({maxRollback});try{
    await Promise.all(p.adapters.map(a=>a.prepare(launch)));
    const result=await Promise.all(p.adapters.map(a=>a.play()));
    assert.deepEqual(result[0],result[1]);assert.equal(result[0].confirmed,true);assert.equal(result[0].frame,19);
    assert.ok(p.packets.some(p=>p._ra&&p.protocol.includes(':1:1')));
    if(maxRollback)assert.ok(p.engines.some(e=>e.loads>0));else assert.ok(p.engines.every(e=>e.saves===0));
    await Promise.all(p.adapters.map(a=>a.prepare({...launch,game:2})));
    const again=await Promise.all(p.adapters.map(a=>a.play()));assert.deepEqual(again[0],again[1]);
    assert.ok(p.packets.some(p=>p._ra&&p.protocol.includes(':1:2')));
    assert.ok(p.engines.slice(0,2).every(e=>e.cacheSaves===1&&e.destroyed));
  }finally{await p.stop();}
});
test('mismatched independent engine starts fail before simulation',{skip:!sdkPath,timeout:10000},async()=>{
  const p=pair({mismatch:true});try{
    const results=await Promise.allSettled(p.adapters.map(a=>a.prepare(launch)));
    assert.ok(results.every(r=>r.status==='rejected'));assert.ok(p.engines.every(e=>e.saves===0));
  }finally{await p.stop();}
});

test('four participants across two connections share deterministic inputs despite a late lobby arrival',{skip:!sdkPath,timeout:10000},async()=>{
  const p=pair({ports:true});const four={...launch,slots:[0,1,2,3],selections:[{fighter:2,color:0},{fighter:20,color:0},{fighter:9,color:0},{fighter:19,color:0}]};
  try{
    await Promise.all(p.adapters.map(a=>a.prepare(four)));
    assert.ok(p.adapters.every(a=>a.players.length===2&&a.participants.length===4));
    const result=await Promise.all(p.adapters.map(a=>a.play()));assert.deepEqual(result[0],result[1]);
    assert.ok(p.engines.every(e=>e.saves===0));
    const bundle=p.packets.find(p=>p._ra&&p.entries?.some(e=>e[1]?.length===4));assert.ok(bundle,'four local input channels travel in one connection bundle');
  }finally{await p.stop();}
});
