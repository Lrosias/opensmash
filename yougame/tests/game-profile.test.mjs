import test from 'node:test';import assert from 'node:assert/strict';
import {PROFILES,engineParams,validFighter,validStage} from '../src/game-profile.mjs';
import {CompetitiveSet,stageFor} from '../src/competitive-set.mjs';
import {RollbackDuelSession} from '../src/rollback-session.mjs';
test('original and Remix use separate native flags, rosters, stage pools and wire identities',()=>{
 const a=PROFILES.original,b=PROFILES.remix;
 assert.equal(b.stocks,4);
 assert.notEqual(a.mode,b.mode);assert.notEqual(a.protocol,b.protocol);
 assert.equal(a.fighters.length,12);assert.equal(b.fighters.length,34);
 for(const p of [a,b]){const params=engineParams({profile:p,battle:{fighters:[0,8],stage:6},seed:123});assert.equal(params.has('SSB64_REMIX_MAIN'),p.remix);assert.equal(params.get('SSB64_STOCKS'),String(p.stocks));assert.equal(params.get('SSB64_YOUGAME_SEED'),'123');assert.equal(engineParams({profile:p}).has('SSB64_REMIX_MAIN'),p.remix);}
 assert.equal(validFighter(58,a),false);assert.equal(validFighter(58,b),true);assert.equal(validStage(16,a),false);assert.equal(validStage(16,b),true);
 for(const p of [a,b]){const bag=Array.from({length:p.stages.length},(_,i)=>stageFor('seed',i+1,1,false,p));assert.deepEqual([...bag].sort((a,b)=>a-b),[...p.stages].sort((a,b)=>a-b));}
});
for(const profile of Object.values(PROFILES))test(`${profile.title}: complete three-game ranked set keeps rules and one settlement`,async()=>{
 const events=[[],[]],wire=[],games=[[],[]],reports=[[],[]],errors=[];
 const rooms=[0,1].map(i=>({me:`p${i}`,players:[{id:'p0'},{id:'p1'}],ranked:true,playing:true,seed:'seed',on(_,f){events[i].push(f);},off(){},send(data){wire.push({to:1-i,from:`p${i}`,data:structuredClone(data)});},async finish(r){reports[i].push(r);}}));
 const sets=rooms.map((room,i)=>new CompetitiveSet({room,round:1,fighter:i,build:'same',profile,onGame:c=>games[i].push(c),onError:e=>errors.push(e)}));
 function flush(){while(wire.length){const e=wire.shift();for(const f of events[e.to])f(e);}}
 try{await Promise.resolve();flush();for(const winner of [0,1,0]){for(const s of sets)s.completeGame({result:winner,hash:100+games[0].length,stocks:winner===0?[2,0]:[0,1]});flush();if(sets[0].phase==='counterpick'){sets[winner].choose(profile.fighters.at(-1));flush();sets[1-winner].choose(8);flush();}}
 await Promise.resolve();assert.deepEqual(errors,[]);assert.equal(games[0].length,3);assert.deepEqual(games[0],games[1]);assert.ok(games[0].every(g=>g.stage===6&&g.stocks===profile.stocks));assert.deepEqual(reports,[[{winner:'p0',scores:{p0:2,p1:1}}],[{winner:'p0',scores:{p0:2,p1:1}}]]);
 }finally{sets.forEach(s=>s.destroy());}
});
test('original online rejects Remix fighters in the locked native handshake',()=>{
 const room={me:'p0',players:[{id:'p0'},{id:'p1'}]};
 assert.throws(()=>new RollbackDuelSession({room,round:1,fighter:0,expectedFighters:[0,58],profile:PROFILES.original}),/Invalid agreed/);
 assert.throws(()=>new CompetitiveSet({room,round:1,fighter:58,profile:PROFILES.original}),/Invalid competitive/);
});
