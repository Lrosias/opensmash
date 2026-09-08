import test from 'node:test';
import assert from 'node:assert/strict';
import {KeyboardState} from '../src/keyboard.mjs';
import {createInput} from '../src/input.mjs';

test('B0XX action bindings map to the corresponding Smash 64 actions',()=>{
 const mappings={KeyM:0x8000,KeyO:0x4000,KeyP:8,Digit0:8,KeyQ:0x2000,Digit9:0x2000,BracketLeft:0x10,Digit7:0x1000,Minus:0x2000,Equal:0x2000,KeyK:8,Space:4,KeyN:2,Comma:1};
 for(const [key,mask] of Object.entries(mappings)){
  const s=new KeyboardState();s.down(key);s.up(key);
  assert.deepEqual(s.read(),[mask,0,0],key);assert.deepEqual(s.read(),[0,0,0]);
 }
});
test('keyboard direction changes are immediate and release never replays stale input',()=>{
 const s=new KeyboardState();s.down('Digit2');assert.deepEqual(s.read(),[0,-80,0]);
 s.down('Digit4');assert.deepEqual(s.read(),[0,80,0]);
 s.down('Digit2');assert.deepEqual(s.read(),[0,80,0]); // OS repeat of held key
 s.up('Digit4');assert.deepEqual(s.read(),[0,0,0]); // no reactivation
 s.up('Digit2');s.down('Digit2');assert.deepEqual(s.read(),[0,-80,0]);
 s.up('Digit2');assert.deepEqual(s.read(),[0,0,0]);
 s.down('BracketRight');assert.deepEqual(s.read(),[0,0,80]);
 s.down('Digit3');assert.deepEqual(s.read(),[0,0,-80]);
 s.up('Digit3');assert.deepEqual(s.read(),[0,0,0]);
});
test('V/B modifiers enable walk and tilt magnitudes while default movement can dash',()=>{
 const s=new KeyboardState();s.down('Digit4');assert.deepEqual(s.read(),[0,80,0]);
 s.down('KeyV');assert.deepEqual(s.read(),[0,53,0]); // below native dash threshold 56
 s.down('BracketRight');assert.deepEqual(s.read(),[0,59,25]);
 s.up('KeyV');s.down('KeyB');assert.deepEqual(s.read(),[0,25,59]);
 s.up('BracketRight');assert.deepEqual(s.read(),[0,27,0]);
 s.up('KeyB');assert.deepEqual(s.read(),[0,80,0]);
 s.up('Digit4');s.down('BracketRight');s.down('KeyV');
 assert.deepEqual(s.read(),[0,0,43]); // below native tap-jump threshold 53
 s.down('KeyM');assert.deepEqual(s.read(),[0x8000,0,43]);
});
test('movement aliases do not amplify or distort diagonals',()=>{
 const s=new KeyboardState();for(const k of ['Digit4','KeyD','ArrowRight','KeyW'])s.down(k);
 assert.deepEqual(s.read(),[0,56,56]);s.up('KeyD');s.up('Digit4');
 assert.deepEqual(s.read(),[0,56,56]);s.up('ArrowRight');assert.deepEqual(s.read(),[0,0,80]);
});
test('a short direction tap reaches one tick, without mixing it with an older direction',()=>{
 const s=new KeyboardState();s.down('Digit3');s.up('Digit3');
 assert.deepEqual(s.read(),[0,0,-80]);assert.deepEqual(s.read(),[0,0,0]);
 s.down('Digit2');s.up('Digit2');s.down('Digit4');s.up('Digit4');
 assert.deepEqual(s.read(),[0,80,0]);assert.deepEqual(s.read(),[0,0,0]);
});
test('held action repeats do not queue another tap, and shared jump keys release independently',()=>{
 const s=new KeyboardState();s.down('KeyP');s.down('Digit0');s.read();s.up('KeyP');
 assert.deepEqual(s.read(),[8,0,0]);s.down('Digit0');s.up('Digit0');
 assert.deepEqual(s.read(),[0,0,0]);
});
test('keyboard attachment clears on blur/background and filters Start online',()=>{
 const win=new EventTarget();win.document=new EventTarget();
 const key=(type,code)=>{const e=new Event(type,{cancelable:true});e.code=code;win.dispatchEvent(e);return e;};
 const input=createInput();input.attach(win);
 assert.ok(key('keydown','KeyM').defaultPrevented);key('keydown','Digit7');
 assert.deepEqual(input.read(),[0x8000,0,0]);
 key('keydown','Digit4');win.dispatchEvent(new Event('blur'));
 assert.deepEqual(input.read(),[0,0,0]);
 key('keydown','KeyO');win.document.hidden=true;win.document.dispatchEvent(new Event('visibilitychange'));
 assert.deepEqual(input.read(),[0,0,0]);input.destroy();
 assert.equal(key('keydown','KeyM').defaultPrevented,false);
 const menu=createInput({allowStart:true});menu.attach(win);key('keydown','Digit7');
 assert.deepEqual(menu.read(),[0x1000,0,0]);menu.destroy();
});
