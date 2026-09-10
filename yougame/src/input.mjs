import {KeyboardState} from './keyboard.mjs';
import {n64Pad} from '../../controllers/gc-adapter.mjs';
export function createInput({allowStart=false,readTouch=()=>[0,0,0],adapter=null,enabled=()=>true}={}) {
  const keyboard=new KeyboardState(),cleanups=[];
  function attach(win) {
    const down=e=>{if(!enabled()){keyboard.clear();return;}if(keyboard.down(e.code))e.preventDefault();};
    const up=e=>keyboard.up(e.code);
    const clear=()=>keyboard.clear();
    win.addEventListener('keydown', down,true); win.addEventListener('keyup', up,true); win.addEventListener('blur', clear);
    const hide=()=>{if(win.document?.hidden)clear();};
    win.document?.addEventListener('visibilitychange',hide);
    cleanups.push(() => { win.removeEventListener('keydown', down,{capture:true}); win.removeEventListener('keyup', up,{capture:true}); win.removeEventListener('blur', clear);win.document?.removeEventListener('visibilitychange',hide); });
  }
  function read() {
    if(adapter?.owned)return n64Pad(adapter.snapshot().ports[0],adapter.origins[0],allowStart);
    let [b,x,y]=keyboard.read();
    const pad = [...(navigator.getGamepads?.() || [])].find(p => p?.connected);
    if (pad) {
      const map = {0:0x8000,1:0x4000,2:8,3:8,4:0x2000,5:0x10,6:0x2000,7:0x10,9:0x1000};
      for (const [i, mask] of Object.entries(map)) if (pad.buttons[i]?.pressed) b |= mask;
      if (Math.abs(pad.axes[0] || 0) > .18) x = Math.round(pad.axes[0] * 80);
      if (Math.abs(pad.axes[1] || 0) > .18) y = Math.round(-pad.axes[1] * 80);
      if (pad.buttons[12]?.pressed) y = 80; if (pad.buttons[13]?.pressed) y = -80;
      if (pad.buttons[14]?.pressed) x = -80; if (pad.buttons[15]?.pressed) x = 80;
      if (pad.axes[2] > .5) b |= 1; if (pad.axes[2] < -.5) b |= 2;
      if (pad.axes[3] > .5) b |= 4; if (pad.axes[3] < -.5) b |= 8;
    }
    const touch=readTouch();b|=touch[0];if(touch[1]||touch[2]){x=touch[1];y=touch[2];}
    return [allowStart?b:b & ~0x1000, Math.max(-80, Math.min(80,x)), Math.max(-80, Math.min(80,y))];
  }
  return {attach,destroy(){cleanups.forEach(f=>f());keyboard.clear();},read,
    readPorts(){
      if(!adapter?.owned)return [read(),null,null,null];
      const snapshot=adapter.snapshot();
      return snapshot.ports.map((p,i)=>p.connected?n64Pad(p,adapter.origins[i],allowStart):null);
    }};
}
