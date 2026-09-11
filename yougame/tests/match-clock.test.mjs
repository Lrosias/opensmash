import test from 'node:test';import assert from 'node:assert/strict';
import {clockText,clockPosition} from '../src/match-clock.mjs';
test('match countdown uses simulation seconds including timeout and last-minute boundaries',()=>{assert.equal(clockText(480),'8:00');assert.equal(clockText(479),'7:59');assert.equal(clockText(60),'1:00');assert.equal(clockText(30),'0:30');assert.equal(clockText(0),'0:00');assert.equal(clockText(-1),'0:00');});
test('clock stays inside desktop, landscape and rotated-surface bounds clear of reserved host controls',()=>{
 for(const [width,height]of [[1440,900],[844,390],[812,375],[375,812]]){
  for(const reserved of [[{left:0,top:0,width:72,height:72},{left:width-192,top:height-60,width:192,height:60}],[{left:width/2-60,top:0,width:120,height:72}]]){
   const p=clockPosition(width,height,reserved);assert.ok(p.left>=0&&p.left+88<=width&&p.top>=0&&p.top+36<=height);for(const r of reserved)assert.ok(p.left>=r.left+r.width||p.left+88<=r.left||p.top>=r.top+r.height||p.top+36<=r.top);
  }
 }
});
