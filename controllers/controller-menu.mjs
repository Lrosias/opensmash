import {GC} from './gc-adapter.mjs';

// null permits the caller's existing keyboard/standard-gamepad menu path.
// An owned but empty/stale/suspended adapter returns neutral, never another pad.
// The caller owns press edges and must not advance gameplay behind its menu.
export function readAdapterMenu(adapter, port=0) {
  if(!Number.isInteger(port)||port<0||port>3)throw new RangeError('Invalid physical controller port');
  const sample=adapter?.snapshot();
  if(!sample?.owned)return null;
  const neutral={direction:0,select:false,back:false,start:false};
  const pad=sample.ports.find(p=>p.port===port);
  if(sample.stale||sample.suspended||!pad?.connected)return neutral;
  const origin=pad.origin||adapter.origins?.[port]||[128,128,128,128,0,0];
  const x=pad.axes[0]-origin[0],y=pad.axes[1]-origin[1],b=pad.buttons;
  const forward=!!(b&(GC.DOWN|GC.RIGHT))||x>44||y< -44;
  const backward=!!(b&(GC.UP|GC.LEFT))||x< -44||y>44;
  return {direction:forward?1:backward?-1:0,select:!!(b&GC.A),back:!!(b&GC.B),start:!!(b&GC.START)};
}
