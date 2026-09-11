import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';
import {CompetitiveSet} from '../src/competitive-set.mjs';import {RollbackDuelSession} from '../src/rollback-session.mjs';
test('three games reuse one SDK round and settle only the confirmed set',{skip:!process.env.YOUGAME_SDK_PATH},async()=>{
 const sdk=readFileSync(process.env.YOUGAME_SDK_PATH,'utf8'),loops=[],wire=[],events=[new Map(),new Map()],reports=[[],[]],errors=[],series=[],sessions=[],launches=[[],[]];let now=0;
 const source=sdk.slice(sdk.indexOf('  function canon('),sdk.indexOf('  // A hidden tab'))+sdk.slice(sdk.indexOf('  function matchConnectionIds(')>=0?sdk.indexOf('  function matchConnectionIds('):sdk.indexOf('  function makeSync('),sdk.indexOf('  /* ---------- host-authoritative kit:'));
 const makeSync=vm.runInNewContext(source+';makeSync',{console,window:{console},Date,performance,fixedStep(o){let active=false;loops.push(()=>{if(active)o.update();});return{start(){active=true;},stop(){active=false;}};}});
 const rooms=[0,1].map(i=>({me:`p${i}`,players:[{id:'p0'},{id:'p1'}],ranked:true,playing:true,seed:'seed',on(e,f){if(!events[i].has(e))events[i].set(e,new Set());events[i].get(e).add(f);},off(e,f){events[i].get(e)?.delete(f);},send(data){wire.push({at:now+(data._ls?2:0),to:1-i,from:`p${i}`,data:structuredClone(data)});},rollback(o){return makeSync(this,o,true);},finish(r){reports[i].push(r);return Promise.resolve(r);}}));
 const deliver=()=>{let count=0;for(let j=0;j<wire.length;){if(++count>2000)throw new Error('Message loop');const e=wire[j];if(e.at>now){j++;continue;}wire.splice(j,1);if(e.data._ls)rooms[e.to]._sync?.receive(e.from,e.data);else for(const f of [...(events[e.to].get('message')||[])])f(e);}};
 try{for(let i=0;i<2;i++)series[i]=new CompetitiveSet({room:rooms[i],round:1,fighter:i,build:'test',onChange(){},onError:e=>errors.push(e),onGame:c=>{
  sessions[i]?.destroy();launches[i].push(c);let frame=0;
  sessions[i]=new RollbackDuelSession({room:rooms[i],round:1,game:c.game,expectedFighters:c.fighters,fighter:c.fighters[i],stage:c.stage,seed:c.seed,build:'test',readInput:()=>[0,0,0],status(){},stop:e=>errors.push(e),onGameResult:r=>series[i].completeGame(r),launch:(_,s)=>s.attach({save:()=>({frame}),load:v=>{frame=v.frame;},step:()=>{frame++;return[frame,frame>=24?(c.game===2?1:0):-1,2,0,frame];},destroy(){}})});
  clearInterval(sessions[i].timer);
 }});
 await Promise.resolve();
 for(now=0;now<400&&!reports[0].length;now++){
  deliver();for(const s of sessions){if(!s.closed){s.lastHello=0;s.pulse();}}for(const tick of loops)tick();deliver();await Promise.resolve();deliver();
  for(const s of series)if(s.phase==='counterpick'&&s.turn===s.seat)s.choose(s.seat===0?58:74);
  deliver();await Promise.resolve();
 }
 assert.deepEqual(errors,[]);assert.deepEqual(launches[0],launches[1]);assert.equal(launches[0].length,3,JSON.stringify({series:series.map(s=>s.view()),sessions:sessions.map(s=>({frame:s.frame,terminal:s.terminal,reported:s.reported,started:s.started,peerReady:s.peerReady,syncFrame:s.sync.frame}))}));assert.deepEqual(reports,[[{winner:'p0',scores:{p0:2,p1:1}}],[{winner:'p0',scores:{p0:2,p1:1}}]]);
 }finally{series.forEach(s=>s.destroy());sessions.forEach(s=>s.destroy());}
});
