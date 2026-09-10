import test from 'node:test';
import assert from 'node:assert/strict';
import {CompetitiveSet,COMPETITIVE_MODE,stageFor,ratingSummary} from '../src/competitive-set.mjs';
import {REMIX_STAGES} from '../src/remix-roster.mjs';
function pair(ranked=true){
 const events=[new Set(),new Set()],messages=[],games=[[],[]],reports=[[],[]],errors=[];
 const rooms=[0,1].map(i=>({me:`p${i}`,players:[{id:'p0'},{id:'p1'}],ranked,playing:true,seed:'seed',on(_,fn){events[i].add(fn);},off(_,fn){events[i].delete(fn);},send(data){messages.push({to:1-i,from:`p${i}`,data:structuredClone(data)});},finish(r){reports[i].push(r);return Promise.resolve(r);}}));
 const sets=rooms.map((room,i)=>new CompetitiveSet({room,round:1,fighter:i,build:'same',onChange(){},onGame:c=>games[i].push(c),onError:e=>errors.push(e)}));
 const flush=()=>{let guard=100;while(messages.length){if(--guard<0)throw new Error('Message loop');const e=messages.shift();for(const fn of events[e.to])fn(e);}};
 const start=()=>{sets.forEach(s=>s.hello());flush();};
 const game=(winner)=>{for(const s of sets)s.completeGame({result:winner,hash:12345,stocks:[2,0]});flush();};
 return{sets,rooms,messages,games,reports,errors,flush,start,game,close:()=>sets.forEach(s=>s.destroy())};
}
test('ranked BO3 settles once, winner character first, loser counterpicks second',async()=>{
 const p=pair();try{p.start();assert.deepEqual(p.games[0],p.games[1]);assert.equal(p.games[0][0].stage,6);
 p.game(0);assert.deepEqual(p.reports,[[],[]]);assert.equal(p.sets[0].phase,'counterpick');
 assert.throws(()=>p.sets[1].choose(58),/Wait/);p.sets[0].choose(29);p.flush();p.sets[1].choose(58);p.flush();
 assert.deepEqual(p.games[0][1].fighters,[29,58]);p.game(1);p.sets[1].choose(74);p.flush();p.sets[0].choose(30);p.flush();p.game(0);await Promise.resolve();
 assert.deepEqual(p.games[0],p.games[1]);assert.deepEqual(p.reports,[[{winner:'p0',scores:{p0:2,p1:1}}],[{winner:'p0',scores:{p0:2,p1:1}}]]);assert.deepEqual(p.errors,[]);
 }finally{p.close();}
});
test('a tie replays locked characters without a win or a counterpick advantage',()=>{const p=pair();try{p.start();p.game(2);assert.deepEqual(p.sets[0].wins,[0,0]);assert.equal(p.games[0].length,2);assert.deepEqual(p.games[0][0].fighters,p.games[0][1].fighters);}finally{p.close();}});
test('casual stage bag uses every curated stage once before repeating',()=>{for(const seed of ['a','b','c']){const bag=Array.from({length:8},(_,i)=>stageFor(seed,i+1,1,false));assert.deepEqual([...bag].sort((a,b)=>a-b),[...REMIX_STAGES].sort((a,b)=>a-b));assert.equal(stageFor(seed,1,1,true),6);}});
test('disagreed hashes cannot award a set winner',async()=>{const p=pair();try{p.start();p.sets[0].completeGame({result:0,hash:1,stocks:[3,0]});p.sets[1].completeGame({result:0,hash:2,stocks:[3,0]});p.flush();await Promise.resolve();assert.ok(p.sets.every(s=>s.closed));assert.deepEqual(p.reports,[[{void:true}],[{void:true}]]);}finally{p.close();}});
test('duplicate and stale protocol messages cannot advance a set twice',()=>{const p=pair();try{p.start();p.game(0);const stale={p:COMPETITIVE_MODE,round:1,type:'result',game:1,result:{result:0,hash:12345,stocks:[2,0]}};p.sets[0].receive(stale);assert.deepEqual(p.sets[0].wins,[1,0]);assert.throws(()=>p.sets[0].receive({...stale,game:3}),/Invalid/);}finally{p.close();}});
test('rank display uses platform labels and never exposes casual ratings',()=>{const e={ranked:true,myRating:{before:1000,after:1015,rank:{label:'Placement 3 of 5'}}};assert.match(ratingSummary(e),/Placement 3 of 5/);assert.equal(ratingSummary({...e,ranked:false}),'');assert.equal(ratingSummary({...e,void:true}),'');});
test('opponent result arriving first does not interrupt the local running simulation',()=>{const p=pair();try{p.start();p.sets[0].completeGame({result:0,hash:123,stocks:[2,0]});p.flush();assert.equal(p.sets[1].phase,'playing');assert.equal(p.sets[0].phase,'confirming');p.sets[1].completeGame({result:0,hash:123,stocks:[2,0]});p.flush();assert.equal(p.sets[0].phase,'counterpick');assert.equal(p.sets[1].phase,'counterpick');}finally{p.close();}});

test('provisional placements hide numeric rating until the platform marks them placed',()=>{
 const e={ranked:true,myRating:{before:1000,after:1100,rank:{placed:false,label:'Placement 3 of 5'}}};assert.equal(ratingSummary(e),'Placement 3 of 5');assert.match(ratingSummary({...e,myRating:{...e.myRating,rank:{placed:true,label:'Gold IV'}}}),/1000 → 1100/);
});
test('platform settlement failure always surfaces an error without unhandled rejections',async()=>{
 const p=pair(false);try{for(const room of p.rooms)room.finish=async()=>{throw new Error('Disconnected');};p.start();p.game(0);for(let i=0;i<6;i++)await Promise.resolve();assert.equal(p.errors.length,2);assert.ok(p.sets.every(s=>s.closed));assert.ok(p.errors.every(e=>e.includes('could not be confirmed')));}finally{p.close();}
});
