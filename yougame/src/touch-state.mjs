// Button taps are latched; stick axes always reflect the current held position.
export class TouchState {
  constructor(){this.buttons=new Map();this.axes=[0,0];this.taps=0;}
  press(id,mask){this.buttons.set(id,mask);this.taps|=mask;}
  release(id){this.buttons.delete(id);}
  move(x,y){
    // Keep Cartesian axes independent. Radial normalization makes a horizontal
    // sweep above center arc upward as X approaches zero, triggering tap-jump.
    const axis=value=>Math.abs(value)<.16?0:Math.round(Math.max(-1,Math.min(1,value))*80)||0;
    this.axes=[axis(x),axis(-y)];
    return this.axes;
  }
  center(){this.axes=[0,0];}
  clear(){this.buttons.clear();this.axes=[0,0];this.taps=0;}
  read(){
    let b=this.taps;for(const mask of this.buttons.values())b|=mask;
    this.taps=0;return [b,...this.axes];
  }
}
