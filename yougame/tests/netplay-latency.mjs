// Deterministic transport timing fixture using the actual production SDK.
// No live rooms. Run with YOUGAME_SDK_PATH=/path/to/downloaded/sdk.js.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const sdk=readFileSync(process.env.YOUGAME_SDK_PATH,'utf8');
const source=sdk.slice(sdk.indexOf('  function canon('),sdk.indexOf('  // A hidden tab'))+
 sdk.slice(sdk.indexOf('  function matchConnectionIds('),sdk.indexOf('  /* ---------- asynchronous rollback'));
assert.ok(source.includes('function makeSync'));
export function measure({delay,latency,seconds=20,jitter=0}){
 let now=0;const loops=[],network=[],syncs=[],states=[[],[]],values=[0,0],last=[0,0],presented=[0,0],errors=[];
 const makeSync=vm.runInNewContext(source+';makeSync',{window:{console},console,Date,performance:{now:()=>now},fixedStep(o){let active=false;loops.push(()=>{if(active)o.update();});return {start(){active=true;},stop(){active=false;}};}});
 const rooms=[0,1].map(i=>({me:'p'+i,latency,players:[{id:'p0'},{id:'p1'}],on(){},off(){},send(data){network.push({at:now+latency+(data.f%5)*jitter/4,to:1-i,from:this.me,data:structuredClone(data)});}}));
 for(let i=0;i<2;i++)syncs.push(makeSync(rooms[i],{hz:60,delay,checksumEvery:30,input:f=>[f%7,i],checksum:()=>values[i],step(f,inputs){assert.equal(f,states[i].length);values[i]=(Math.imul(values[i],31)+(inputs.p0?.[0]||0)*13+(inputs.p1?.[0]||0))>>>0;states[i].push(values[i]);}},false).on('desync',e=>errors.push(e)).start());
 let nextTick=1000/60;
 for(now=0;now<seconds*1000;now++){
  for(let n=0;n<network.length;){const p=network[n];if(p.at>now){n++;continue;}network.splice(n,1);syncs[p.to].receive(p.from,p.data);}
  if(now>=nextTick){for(const tick of loops)tick();for(let i=0;i<2;i++){if(states[i].length>last[i])presented[i]++;last[i]=states[i].length;}nextTick+=1000/60;}
 }
 const confirmed=Math.min(...states.map(s=>s.length));assert.deepEqual(states[0].slice(0,confirmed),states[1].slice(0,confirmed));assert.deepEqual(errors,[]);
 const result={latencyMs:latency,jitterMs:jitter,delay,actualDelay:syncs.map(s=>s.delay),simFps:states.map(s=>s.length/seconds),presentationOpportunitiesFps:presented.map(n=>n/seconds),stalls:syncs.map(s=>s.stalls),confirmedFrames:confirmed,agreement:true};syncs.forEach(s=>s.stop());return result;
}
if(import.meta.url===pathToFileURL(process.argv[1]).href){
 const results=[];for(const latency of [0,30,60,100,160,250,500,800])for(const delay of [2,'auto'])results.push(measure({delay,latency}));
 console.log(JSON.stringify({sdkSha256:createHash('sha256').update(sdk).digest('hex'),note:'latencyMs is simulated one-way peer delivery, and separately the supplied room RTT estimate; render opportunities are 60Hz observations, not physical scanout.',results},null,2));
}
