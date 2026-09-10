import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeResultArgs} from '../src/native-results.mjs';
import {PROFILES} from '../src/game-profile.mjs';
const view={fighters:[58,59],seat:0};
test('settled results preserve global fighter and winner seats on both peers',()=>{
 assert.deepEqual(nativeResultArgs({won:true},view,{stocks:[2,0]}),[58,59,0,2,0]);
 assert.deepEqual(nativeResultArgs({won:false},{...view,seat:1},{stocks:[2,0]}),[58,59,0,2,0]);
 assert.deepEqual(nativeResultArgs({won:false},view,{stocks:[0,1]}),[58,59,1,0,1]);
 assert.deepEqual(nativeResultArgs({won:true},{...view,seat:1},{stocks:[0,1]}),[58,59,1,0,1]);
});
test('void and draw override won; platform set wins never become native stocks',()=>{
 assert.deepEqual(nativeResultArgs({void:true,won:true,scores:{a:2,b:1}},view),[58,59,-2,0,0]);
 assert.deepEqual(nativeResultArgs({draw:true,won:false},view,{stocks:[1,1]}),[58,59,-1,1,1]);
 assert.deepEqual(nativeResultArgs({won:true},view,{stocks:[-1,NaN]}),[58,59,0,0,0]);
});
test('unknown selections/outcomes and original edition retain the HTML fallback',()=>{
 assert.equal(nativeResultArgs({won:true},{...view,fighters:[58,null]}),null);
 assert.equal(nativeResultArgs({won:true},{...view,seat:-1}),null);
 assert.equal(nativeResultArgs({},view),null);
 assert.equal(nativeResultArgs({won:true},view,null,PROFILES.original),null);
});
