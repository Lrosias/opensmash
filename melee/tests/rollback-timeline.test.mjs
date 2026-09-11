import test from 'node:test';
import assert from 'node:assert/strict';
import {AsyncRollbackTimeline} from '../src/rollback-timeline.mjs';

test('async engines converge through reordered, duplicated and lost bundles without overlap',async()=>{
  let time=0;const network=[],errors=[],pairs=[];
  for(let i=0;i<2;i++){
    let state={frame:0,x:0},busy=false;
    const invoke=async fn=>{assert.equal(busy,false,'engine operations must be serialized');busy=true;await new Promise(r=>setImmediate(r));try{return fn();}finally{busy=false;}};
    const confirmations=new Map();
    const engine={save:()=>invoke(()=>structuredClone(state)),load:s=>invoke(()=>{state=structuredClone(s);}),
      step:(inputs)=>invoke(()=>{state.x+=inputs.a-inputs.b;state.frame++;return {...state};})};
    const timeline=new AsyncRollbackTimeline({players:['a','b'],me:['a','b'][i],engine,neutral:0,input:()=>time%9<4?i+1:-i-1,
      send:entries=>{if(time%7===0)return;network.push({to:1-i,from:['a','b'][i],entries,at:time+2+time%4});if(time%3===0)network.push({to:1-i,from:['a','b'][i],entries,at:time+5});},
      onConfirm:(f,s)=>confirmations.set(f,s),onError:e=>errors.push(e.message)});
    pairs.push({timeline,confirmations});
  }
  for(time=0;time<200;time++){
    for(const p of pairs)p.timeline.tick();
    for(let j=network.length-1;j>=0;j--)if(network[j].at<=time){const [e]=network.splice(j,1);pairs[e.to].timeline.receive(e.from,e.entries);}
    await Promise.all(pairs.map(p=>p.timeline.running));
  }
  assert.deepEqual(errors,[]);assert.ok(pairs.every(p=>p.timeline.rollbacks>0));
  const last=Math.min(...pairs.map(p=>p.timeline.confirmed));assert.ok(last>100);
  for(let f=0;f<=last;f++)assert.deepEqual(pairs[0].confirmations.get(f),pairs[1].confirmations.get(f),`confirmed frame ${f}`);
  for(const p of pairs){assert.ok(p.timeline.states.size<=10);p.timeline.stop();}
});

test('an input arriving during an awaited step corrects before confirmation',async()=>{
  let finish,state=0;const confirmed=[],errors=[];
  const t=new AsyncRollbackTimeline({players:['a','b'],me:'a',neutral:0,input:()=>0,send:()=>{},delay:0,
    engine:{save:async()=>state,load:async s=>{state=s;},step:async inputs=>{if(!finish)await new Promise(r=>{finish=r;});state+=inputs.b;return state;}},
    onConfirm:(f,s)=>confirmed.push([f,s]),onError:e=>errors.push(e.message)});
  t.tick();await new Promise(r=>setImmediate(r));t.receive('b',[[0,9]]);finish();await t.running;
  assert.equal(t.rollbacks,1);assert.deepEqual(confirmed,[[0,9]]);assert.deepEqual(errors,[]);t.stop();
});

test('peer cannot rewrite a received input and a stalled engine has bounded recording lead',async()=>{
  const errors=[];let state=0;
  const t=new AsyncRollbackTimeline({players:['a','b'],me:'a',neutral:0,input:()=>1,send:()=>{},delay:0,maxRollback:1,
    engine:{save:async()=>state,load:async s=>{state=s;},step:async()=>++state},onError:e=>errors.push(e.message)});
  for(let i=0;i<100;i++)await t.tick();
  assert.ok(t.recorded<=3);t.receive('b',[[0,2]]);await t.running;t.receive('b',[[0,3]]);
  assert.ok(t.closed);assert.match(errors[0],/changed/);
});
