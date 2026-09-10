import test from 'node:test';
import assert from 'node:assert/strict';
import {KeyboardState,keyboardKeys} from '../src/keyboard.mjs';
import {createInput} from '../src/input.mjs';

test('Slippi action bindings map to native Smash 64 actions, including quick taps',()=>{
 const mappings={KeyX:0x8000,KeyZ:0x4000,KeyC:8,KeyS:8,KeyQ:0x2000,KeyW:0x2000,KeyD:0x10,Enter:0x1000,KeyI:8,KeyK:4,KeyJ:2,KeyL:1,KeyT:0x800,KeyG:0x400,KeyF:0x200,KeyH:0x100};
 for(const [key,mask] of Object.entries(mappings)){
  const s=new KeyboardState();s.down(key);s.up(key);
  assert.deepEqual(s.read(),[mask,0,0],key);assert.deepEqual(s.read(),[0,0,0]);
 }
 for(const obsolete of ['KeyM','KeyO','Digit7','Digit2','KeyA','Space'])assert.equal(keyboardKeys[obsolete],undefined);
});
test('opposite directions cancel, and repeats do not change priority',()=>{
 const s=new KeyboardState();s.down('ArrowLeft');assert.deepEqual(s.read(),[0,-80,0]);
 s.down('ArrowRight');s.down('ArrowLeft');assert.deepEqual(s.read(),[0,0,0]);
 s.up('ArrowRight');assert.deepEqual(s.read(),[0,-80,0]);
 s.up('ArrowLeft');assert.deepEqual(s.read(),[0,0,0]);
 s.down('ArrowUp');s.down('ArrowDown');assert.deepEqual(s.read(),[0,0,0]);
});
test('Shift halves stick input for walking and tilts; diagonals preserve each axis',()=>{
 const s=new KeyboardState();s.down('ArrowRight');assert.deepEqual(s.read(),[0,80,0]);
 s.down('ShiftLeft');assert.deepEqual(s.read(),[0,40,0]);
 s.down('ArrowUp');assert.deepEqual(s.read(),[0,40,40]);
 s.up('ShiftLeft');assert.deepEqual(s.read(),[0,80,80]);
 s.up('ArrowRight');s.down('ShiftLeft');s.down('KeyX');assert.deepEqual(s.read(),[0x8000,0,40]);
});
test('a short direction tap reaches one tick without replaying cancelled input',()=>{
 const s=new KeyboardState();s.down('ArrowDown');s.up('ArrowDown');
 assert.deepEqual(s.read(),[0,0,-80]);assert.deepEqual(s.read(),[0,0,0]);
 s.down('ArrowLeft');s.up('ArrowLeft');s.down('ArrowRight');s.up('ArrowRight');
 assert.deepEqual(s.read(),[0,80,0]);assert.deepEqual(s.read(),[0,0,0]);
 s.down('ArrowLeft');s.down('ArrowRight');assert.deepEqual(s.read(),[0,0,0]);
});
test('shared jump keys release independently and Alt+Enter does not press Start',()=>{
 const s=new KeyboardState();s.down('KeyC');s.down('KeyS');s.read();s.up('KeyC');
 assert.deepEqual(s.read(),[8,0,0]);s.down('KeyS');s.up('KeyS');assert.deepEqual(s.read(),[0,0,0]);
 s.down('AltLeft');s.down('Enter');s.up('Enter');s.up('AltLeft');assert.deepEqual(s.read(),[0,0,0]);
 s.down('Enter');assert.deepEqual(s.read(),[0x1000,0,0]);
});
test('keyboard attachment clears on blur/background and filters Start online',()=>{
 const win=new EventTarget();win.document=new EventTarget();
 const key=(type,code)=>{const e=new Event(type,{cancelable:true});e.code=code;win.dispatchEvent(e);return e;};
 const input=createInput();input.attach(win);
 assert.ok(key('keydown','KeyX').defaultPrevented);key('keydown','Enter');assert.deepEqual(input.read(),[0x8000,0,0]);
 key('keydown','ArrowRight');win.dispatchEvent(new Event('blur'));assert.deepEqual(input.read(),[0,0,0]);
 key('keydown','KeyZ');win.document.hidden=true;win.document.dispatchEvent(new Event('visibilitychange'));assert.deepEqual(input.read(),[0,0,0]);input.destroy();
 assert.equal(key('keydown','KeyX').defaultPrevented,false);
 const menu=createInput({allowStart:true});menu.attach(win);key('keydown','Enter');assert.deepEqual(menu.read(),[0x1000,0,0]);menu.destroy();
});
