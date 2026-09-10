// Slippi Dolphin keyboard defaults, adapted by action to Smash 64 / Smash Remix.
// https://github.com/project-slippi/Ishiiruka/blob/slippi/Source/Core/Core/HW/GCPadEmu.cpp#L142
// The N64 has digital C buttons and shields, so these retain native behavior.
export const keyboardKeys=Object.freeze({
 ArrowUp:'up',ArrowLeft:'left',ArrowDown:'down',ArrowRight:'right',
 KeyX:0x8000,KeyZ:0x4000,KeyC:8,KeyS:8,
 KeyQ:0x2000,KeyW:0x2000,KeyD:0x10,Enter:0x1000,
 ShiftLeft:'half',AltLeft:'startalt',
 KeyI:8,KeyK:4,KeyJ:2,KeyL:1,
 KeyT:0x800,KeyG:0x400,KeyF:0x200,KeyH:0x100,
});

export class KeyboardState {
 constructor(){this.clear();}
 clear(){this.held=new Set();this.taps=0;this.pending=null;}
 down(code){
  const action=keyboardKeys[code];if(action===undefined)return false;
  if(!this.held.has(code)){
   this.held.add(code);
   if(typeof action==='number'&&!(code==='Enter'&&this.held.has('AltLeft')))this.taps|=action;
   if(['left','right','up','down','half'].includes(action)){
    const axes=this.axes();this.pending=axes[0]||axes[1]?axes:null;
   }
  }
  return true;
 }
 up(code){this.held.delete(code);}
 axes(){
  const actions=new Set([...this.held].map(code=>keyboardKeys[code]));
  const x=Number(actions.has('right'))-Number(actions.has('left'));
  const y=Number(actions.has('up'))-Number(actions.has('down'));
  const scale=actions.has('half')?40:80;
  return [x*scale||0,y*scale||0];
 }
 read(){
  let buttons=this.taps;this.taps=0;
  for(const key of this.held)if(typeof keyboardKeys[key]==='number')buttons|=keyboardKeys[key];
  if(this.held.has('AltLeft'))buttons&=~0x1000;
  let axes=this.axes();
  // Preserve a direction tap shorter than one simulation tick, without
  // replaying stale input after opposing directions cancel each other.
  if(!axes[0]&&!axes[1]&&this.pending)axes=this.pending;
  this.pending=null;
  return [buttons,...axes];
 }
}
