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
  // Ports follow the console: a pad keeps the port it was given for as long as it stays
  // connected, and a newly connected pad takes the lowest free port. The browser's gamepad
  // index is not the port: Chrome numbers pads by first sighting, so a lone controller can sit
  // at index 1 (after another device came and went, or a controller that shows up twice), and
  // online only port 1 is this player's seat. Port 1 also carries the keyboard and touch.
  const portOf=new Map(); // browser gamepad index -> port
  function ports() {
    const pads=[...(navigator.getGamepads?.()||[])];
    // On YouGame the platform seats the pads (the player's Controls panel and seating plan, then
    // the console rule below); the lobby hands seat 1 to this player and seat 2 to a second local
    // player. Elsewhere the same rule runs here.
    const seats=globalThis.YouGame?.controllers?.seats?.();
    if(Array.isArray(seats)&&seats.length){
      const out=[null,null,null,null];
      seats.forEach((s,i)=>{const p=s&&pads[s.index];if(i<4&&p?.connected&&p.id===s.id)out[i]=p;});
      return out;
    }
    const live=new Map();
    for(const p of pads)if(p?.connected)live.set(p.index,p);
    for(const index of [...portOf.keys()])if(!live.has(index))portOf.delete(index);
    for(const index of [...live.keys()].sort((a,b)=>a-b)){
      if(portOf.has(index))continue;
      const taken=new Set(portOf.values());
      for(let port=0;port<4;port++)if(!taken.has(port)){portOf.set(index,port);break;}
    }
    const out=[null,null,null,null];
    for(const [index,port] of portOf)out[port]=live.get(index);
    return out;
  }
  function read(pad) {
    if(adapter?.owned)return n64Pad(adapter.snapshot().ports[0],adapter.origins[0],allowStart);
    if(pad===undefined)pad=ports()[0];
    let [b,x,y]=keyboard.read();
    const gamepad=readGamepad(pad,allowStart);b|=gamepad[0];
    if(gamepad[1])x=gamepad[1];if(gamepad[2])y=gamepad[2];
    const touch=readTouch();b|=touch[0];if(touch[1]||touch[2]){x=touch[1];y=touch[2];}
    return [allowStart?b:b & ~0x1000, Math.max(-80, Math.min(80,x)), Math.max(-80, Math.min(80,y))];
  }
  return {attach,destroy(){cleanups.forEach(f=>f());keyboard.clear();},read,
    readPorts(){
      if(!adapter?.owned){
        const [first,...rest]=ports();
        return [read(first||null),...rest.map(p=>p?readGamepad(p,allowStart):null)];
      }
      const snapshot=adapter.snapshot();
      return snapshot.ports.map((p,i)=>p.connected?n64Pad(p,adapter.origins[i],allowStart):null);
    }};
}

export function readGamepad(pad,allowStart=false){
  let b=0,x=0,y=0;
  if (pad?.connected) {
      const map = {0:0x8000,1:0x4000,2:8,3:8,4:0x2000,5:0x10,6:0x2000,7:0x10,9:0x1000};
      for (const [i, mask] of Object.entries(map)) if (pad.buttons[i]?.pressed) b |= mask;
      if (Math.abs(pad.axes[0] || 0) > .18) x = Math.round(pad.axes[0] * 80);
      if (Math.abs(pad.axes[1] || 0) > .18) y = Math.round(-pad.axes[1] * 80);
      if (pad.buttons[12]?.pressed) y = 80; if (pad.buttons[13]?.pressed) y = -80;
      if (pad.buttons[14]?.pressed) x = -80; if (pad.buttons[15]?.pressed) x = 80;
      if (pad.axes[2] > .5) b |= 1; if (pad.axes[2] < -.5) b |= 2;
      if (pad.axes[3] > .5) b |= 4; if (pad.axes[3] < -.5) b |= 8;
    }
  return [allowStart?b:b&~0x1000,Math.max(-80,Math.min(80,x)),Math.max(-80,Math.min(80,y))];
}
