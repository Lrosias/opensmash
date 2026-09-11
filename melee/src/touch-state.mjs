// Button taps are latched until the engine reads them; stick axes always reflect the
// held position. The pad has gameCubeInput's shape: [buttons, mainX, mainY, cX, cY, L, R],
// axes in -1..1 (127 GameCube units), the triggers 0 or 1.
export const A=1,B=2,X=4,Y=8,Z=16,START=32,DUP=64,DDOWN=128,DLEFT=256,DRIGHT=512,L=1024,R=2048;
// Hold L+R+A and press Start: the native paused-match reset.
export const RESET_CHORD=L|R|A|START;
export const NEUTRAL=Object.freeze([0,0,0,0,0,0,0]);
// Keep Cartesian axes independent. Radial normalization makes a horizontal sweep
// above center arc upward as X approaches zero, triggering tap-jump.
const axis=value=>Math.abs(value)<.16?0:Math.round(Math.max(-1,Math.min(1,value))*100)/100||0;
export class TouchState {
  constructor(){this.buttons=new Map();this.main=[0,0];this.c=[0,0];this.taps=0;}
  press(id,mask){this.buttons.set(id,mask);this.taps|=mask;}
  release(id){this.buttons.delete(id);}
  move(x,y){this.main=[axis(x),axis(-y)];return this.main;}
  aim(x,y){this.c=[axis(x),axis(-y)];return this.c;}
  center(){this.main=[0,0];}
  centerAim(){this.c=[0,0];}
  clear(){this.buttons.clear();this.main=[0,0];this.c=[0,0];this.taps=0;}
  // A peek reports pending taps without consuming them, for a reader that is not
  // the engine the player is driving right now.
  read(peek=false){
    let b=this.taps;for(const mask of this.buttons.values())b|=mask;
    if(!peek)this.taps=0;
    return [b,...this.main,...this.c,b&L?1:0,b&R?1:0];
  }
}
