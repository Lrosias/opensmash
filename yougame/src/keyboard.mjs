// B0XX-AHK default bindings, adapted to the N64 controller's actions.
// https://github.com/agirardeau/b0xx-ahk/blob/master/hotkeys.ini
// C-stick keys drive native N64 C buttons (jump / costume selection), and
// both shoulder/light-shield keys use Smash 64's digital shield.
export const keyboardKeys=Object.freeze({
 Digit2:'left',Digit3:'down',Digit4:'right',BracketRight:'up',
 KeyM:0x8000,KeyO:0x4000,KeyP:8,Digit0:8,
 KeyQ:0x2000,Digit9:0x2000,BracketLeft:0x10,Digit7:0x1000,
 KeyV:'modX',KeyB:'modY',KeyK:8,Space:4,KeyN:2,Comma:1,
 Minus:0x2000,Equal:0x2000,
 // Convenient browser alternatives; do not override the B0XX bindings.
 KeyW:'up',KeyA:'left',KeyS:'down',KeyD:'right',
 ArrowUp:'up',ArrowLeft:'left',ArrowDown:'down',ArrowRight:'right',Enter:0x1000
});

export class KeyboardState {
 constructor(){this.clear();}
 clear(){this.held=new Set();this.recentX=null;this.recentY=null;this.taps=0;this.pending=null;}
 down(code){
  const action=keyboardKeys[code];if(action===undefined)return false;
  if(!this.held.has(code)){
   this.held.add(code);
   if(typeof action==='number')this.taps|=action;
   else if(action==='left'||action==='right')this.recentX=action;
   else if(action==='up'||action==='down')this.recentY=action;
   const axes=this.axes();if(axes[0]||axes[1])this.pending=axes;
  }
  return true;
 }
 up(code){this.held.delete(code);}
 axes(){
  const actions=new Set([...this.held].map(code=>keyboardKeys[code]));
  // Match B0XX-AHK's most-recent direction without reactivating the opposite
  // held key on release. Key repeat never changes directional priority.
  const sx=actions.has(this.recentX)?(this.recentX==='right'?1:-1):0;
  const sy=actions.has(this.recentY)?(this.recentY==='up'?1:-1):0;
  const mx=actions.has('modX'),my=actions.has('modY');
  let x=80,y=80;
  // Basic B0XX stick coordinates scaled to N64 +/-80. The Melee-specific
  // airdodge/Firefox angle routines are not part of this Smash 64 mapping.
  if(mx&&!my){[x,y]=sx&&sy?[59,25]:[53,43];}
  else if(my&&!mx){[x,y]=sx&&sy?[25,59]:[27,59];}
  else if(sx&&sy){x=y=56;}
  return [sx*x||0,sy*y||0];
 }
 read(){
  let buttons=this.taps;this.taps=0;
  for(const key of this.held)if(typeof keyboardKeys[key]==='number')buttons|=keyboardKeys[key];
  let axes=this.axes();
  // Preserve a keyboard tap shorter than one simulation tick. Consume only
  // the newest intended direction; never sum it with an old released key.
  if(!axes[0]&&!axes[1]&&this.pending)axes=this.pending;
  this.pending=null;
  return [buttons,...axes];
 }
}
