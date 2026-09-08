// Button taps are latched; stick axes always reflect the current held position.
export class TouchState {
  constructor(){this.buttons=new Map();this.axes=[0,0];this.taps=0;}
  press(id,mask){this.buttons.set(id,mask);this.taps|=mask;}
  release(id){this.buttons.delete(id);}
  move(x,y){
    const length=Math.hypot(x,y),scale=length>1?1/length:1;
    this.axes=length<.16?[0,0]:[Math.round(x*scale*80)||0,Math.round(-y*scale*80)||0];
  }
  center(){this.axes=[0,0];}
  clear(){this.buttons.clear();this.axes=[0,0];this.taps=0;}
  read(){
    let b=this.taps;for(const mask of this.buttons.values())b|=mask;
    this.taps=0;return [b,...this.axes];
  }
}
