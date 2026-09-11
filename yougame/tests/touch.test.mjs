import test from 'node:test';
import assert from 'node:assert/strict';
import {TouchState} from '../src/touch-state.mjs';
import {TouchStick} from '../src/touch-stick.mjs';
import {createInput} from '../src/input.mjs';
test('fight flicks have immediate full input on touchdown, including in rotated landscape',()=>{
 for(const rotated of [false,true])for(const direction of [-1,1]){
  const s=new TouchState(),g=new TouchStick(),center={x:100,y:100};
  const x=rotated?100:100+40*direction,y=rotated?100+40*direction:100;
  s.move(...g.start(x,y,40,rotated,center));
  assert.deepEqual(s.read(),[0,80*direction,0]);
  s.move(...g.move(100,100));assert.deepEqual(s.read(),[0,0,0]);
  s.move(...g.move(rotated?100:100-40*direction,rotated?100-40*direction:100));
  assert.deepEqual(s.read(),[0,-80*direction,0]);
  s.move(...g.end());assert.deepEqual(s.read(),[0,0,0]);
 }
});
test('off-center touchdown then downward flick never generates an initial upward input',()=>{
 const s=new TouchState(),g=new TouchStick();
 // The recording shows a contact above the visible center before a down flick.
 s.move(...g.start(108,170,40));assert.deepEqual(s.read(),[0,0,0]);
 for(const y of [175,185,195,210]){
  s.move(...g.move(108,y));const [,x,axisY]=s.read();
  assert.equal(x,0);assert.ok(axisY<=0);
 }
 s.move(...g.end());assert.deepEqual(s.read(),[0,0,0]);
 s.move(...g.start(95,222,40));assert.deepEqual(s.read(),[0,0,0]);
 s.move(...g.move(95,182));assert.deepEqual(s.read(),[0,0,80]);
});
test('portrait landscape fallback maps all four screen directions to the same game axes',()=>{
 for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[.5,.5]]){
  const a=new TouchStick(),b=new TouchStick();a.start(100,200,40);b.start(200,100,40,true);
  const s=new TouchState(),t=new TouchState();
  s.move(...a.move(100+40*dx,200+40*dy));
  t.move(...b.move(200-40*dy,100+40*dx));
  assert.deepEqual(s.read(),t.read());
  t.move(...b.end());assert.deepEqual(t.read(),[0,0,0]);
 }
});
test('a held stick can deliberately reverse, while an ended gesture stays neutral',()=>{
 const s=new TouchState(),g=new TouchStick();g.start(100,100,40);
 s.move(...g.move(140,100));assert.deepEqual(s.read(),[0,80,0]);
 s.move(...g.move(60,100));assert.deepEqual(s.read(),[0,-80,0]);
 g.end();s.move(...g.move(180,100));assert.deepEqual(s.read(),[0,0,0]);
});
test('two thumbs can move, jump and attack together, with independent releases',()=>{
 const s=new TouchState();s.move(1,0);s.press(1,0x8000);s.press(2,8);
 assert.deepEqual(s.read(),[0x8008,80,0]);s.release(1);
 assert.deepEqual(s.read(),[8,80,0]);s.release(2);s.center();s.read();
 assert.deepEqual(s.read(),[0,0,0]);
});
test('fast taps survive between ticks but are not repeated',()=>{
 const s=new TouchState();s.press(1,0x8000);s.release(1);
 assert.deepEqual(s.read(),[0x8000,0,0]);assert.deepEqual(s.read(),[0,0,0]);
});
test('releasing a flick is immediately neutral, even before the next sample',()=>{
 for(const [x,y] of [[1,0],[-1,0],[0,1],[0,-1],[1,-1]]){
  const s=new TouchState();s.move(x,y);s.center();
  assert.deepEqual(s.read(),[0,0,0]);assert.deepEqual(s.read(),[0,0,0]);
  s.move(x,y);s.read();s.center();assert.deepEqual(s.read(),[0,0,0]);
 }
});
test('returning through the deadzone does not replay a direction or a rebound sample',()=>{
 const s=new TouchState();s.move(1,0);assert.deepEqual(s.read(),[0,80,0]);
 s.move(-.08,0);assert.deepEqual(s.read(),[0,0,0]);
 s.move(-.3,0);s.center();assert.deepEqual(s.read(),[0,0,0]);
 s.move(-1,0);assert.deepEqual(s.read(),[0,-80,0]);
});
test('X and Y can share Jump without releasing each other',()=>{
 const s=new TouchState();s.press(1,8);s.press(2,8);s.read();s.release(1);
 assert.deepEqual(s.read(),[8,0,0]);s.release(2);assert.deepEqual(s.read(),[0,0,0]);
});
test('each diagonal axis is bounded, deadzone is neutral, cancellation releases all input',()=>{
 const s=new TouchState();s.move(2,2);assert.deepEqual(s.read(),[0,80,-80]);
 s.move(.01,.01);assert.deepEqual(s.read(),[0,0,0]);
 s.press(7,0x2000);s.move(-1,0);s.clear();assert.deepEqual(s.read(),[0,0,0]);
});
test('outside-circle horizontal sweeps never amplify the vertical axis or arc upward',()=>{
 for(const rotated of [false,true])for(const offset of [-.5,-.1,0,.1,.5]){
  const s=new TouchState(),g=new TouchStick(),center={x:160,y:160},radius=40;
  const point=x=>rotated?[center.x-offset*radius,center.y+x*radius]:[center.x+x*radius,center.y+offset*radius];
  s.move(...g.start(...point(3),radius,rotated,center));
  const vertical=s.read()[2];
  for(const x of [3,2,1,.5,0,-.5,-1,-2,-3,0,3]){
   s.move(...g.move(...point(x)));
   assert.deepEqual(s.read(),[0,Math.round(Math.max(-1,Math.min(1,x))*80),vertical]);
  }
 }
});
test('outside-circle taps reset to neutral before the next opposite tap',()=>{
 const s=new TouchState(),g=new TouchStick(),center={x:160,y:160};
 for(const x of [280,40,280,40]){
  s.move(...g.start(x,156,40,false,center));
  assert.deepEqual(s.read(),[0,x>160?80:-80,0]);
  g.end();s.center();assert.deepEqual(s.read(),[0,0,0]);
  s.move(...g.move(x,100));assert.deepEqual(s.read(),[0,0,0]);
 }
});
test('touch goes through the same online controller filter as keyboard and gamepad',()=>{
 const s=new TouchState();s.press(1,0x1000|0x8000);s.move(1,0);
 const input=createInput({readTouch:()=>s.read()});
 assert.deepEqual(input.read(),[0x8000,80,0]);input.destroy();
 const menu=createInput({allowStart:true,readTouch:()=>[0x1000,0,0]});
 assert.deepEqual(menu.read(),[0x1000,0,0]);menu.destroy();
});
