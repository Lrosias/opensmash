import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PlatformGameCubeAdapter} from '../../controllers/platform-adapter.mjs';
import {GameCubeAdapter,GC,meleePad} from '../../controllers/gc-adapter.mjs';
import {readAdapterMenu} from '../../controllers/controller-menu.mjs';

function host(){
  const calls=[],listeners=new Map();let fallback=0;
  const raw={owned:true,stale:false,suspended:false,sequence:1,receivedAt:1,state:'connected',
    ports:Array.from({length:4},(_,port)=>({port,seat:3-port,connected:port!==1,type:port!==1?'wired':null,
      buttons:0,axes:[128,128,128,128],triggers:[0,0],origin:[128,128,128,128,0,0]}))};
  const sdk={mode:'hosted',controllers:{capabilities:()=>({host:true}),snapshot:()=>raw,
    on:(e,f)=>{listeners.set(e,f);return()=>listeners.delete(e);},
    connect:async o=>calls.push(['connect',o]),disconnect:async()=>{calls.push(['disconnect']);raw.owned=false;},
    calibrate:async p=>{calls.push(['calibrate',p]);raw.ports[p].origin=[...raw.ports[p].axes,...raw.ports[p].triggers];},
    resetCalibration:async()=>{calls.push(['reset']);raw.ports.forEach(p=>p.origin=[128,128,128,128,0,0]);}}};
  const adapter=new PlatformGameCubeAdapter({sdk,fallbackFactory:()=>{fallback++;throw Error('Duplicate owner');}});
  return {adapter,sdk,raw,calls,listeners,fallback:()=>fallback};
}
test('host facade selects one acquisition owner and awaits the platform commands',async()=>{
  const h=host();await h.adapter.connect();h.raw.ports[2].axes=[130,129,127,126];await h.adapter.calibrate(2);
  assert.deepEqual(h.adapter.origins[2],[130,129,127,126,0,0]);await h.adapter.resetCalibration();
  assert.deepEqual(h.adapter.snapshot().ports.map(p=>p.port),[0,1,2,3]);assert.equal(h.adapter.snapshot().ports[1].connected,false);
  assert.equal(h.fallback(),0);await h.adapter.close();assert.equal(h.adapter.owned,false);
  assert.deepEqual(h.calls,[['connect',{kind:'gamecube-adapter'}],['calibrate',2],['reset'],['disconnect']]);
  await h.adapter.destroy();assert.equal(h.listeners.size,0);
});
test('host facade preserves every raw byte and independent trigger clicks',()=>{
  const h=host();for(let byte=0;byte<256;byte++){
    h.raw.ports[0].axes.fill(byte);h.raw.ports[0].triggers.fill(byte);
    const pad=h.adapter.snapshot().ports[0];assert.deepEqual(pad.axes,[byte,byte,byte,byte]);
    assert.deepEqual(pad.triggers,[byte,byte]);assert.equal(meleePad(pad)[0],0);
  }
});
test('raw menu uses physical ports, calibration and GameCube Y orientation',()=>{
  const h=host(),p=h.raw.ports[0];p.axes=[130,208,128,128];p.origin[0]=130;p.buttons=GC.A|GC.START;
  assert.deepEqual(readAdapterMenu(h.adapter),{direction:-1,select:true,back:false,start:true});
  p.axes[1]=48;p.buttons=GC.B;assert.deepEqual(readAdapterMenu(h.adapter),{direction:1,select:false,back:true,start:false});
  assert.equal(readAdapterMenu(h.adapter,1).select,false,'port 2 must not migrate into empty port 1');
  p.axes[1]=128;p.buttons=GC.LEFT;assert.equal(readAdapterMenu(h.adapter).direction,-1);
  p.buttons=GC.DOWN;assert.equal(readAdapterMenu(h.adapter).direction,1);
});
test('owned neutral states never fall through to another menu controller',()=>{
  const h=host();h.raw.ports[0].buttons=GC.A;
  for(const flag of ['stale','suspended']){h.raw[flag]=true;assert.equal(readAdapterMenu(h.adapter).select,false);h.raw[flag]=false;}
  h.adapter.suspend(true);assert.equal(readAdapterMenu(h.adapter).select,false);
  assert.equal(h.adapter.snapshot({diagnostic:true}).ports[0].buttons,GC.A);
  h.adapter.suspend(false);h.raw.owned=false;assert.equal(readAdapterMenu(h.adapter),null);
  assert.equal(readAdapterMenu(null),null);assert.throws(()=>readAdapterMenu(h.adapter,4),RangeError);
});
test('direct fallback still supports menus and is never constructed during SDK handshake',async()=>{
  const sdk={mode:'connecting',controllers:{capabilities:()=>({host:false}),on:()=>()=>{}}};
  let created=0;const direct=new GameCubeAdapter({usb:null,now:()=>1});
  const adapter=new PlatformGameCubeAdapter({sdk,fallbackFactory:()=>{created++;return direct;}});
  assert.equal(adapter.owned,false);assert.equal(created,0);sdk.mode='standalone';adapter.snapshot();assert.equal(created,1);
  const packet=new Uint8Array(37);packet[0]=0x21;packet[1]=0x10;packet[2]=GC.A;packet.set([208,128,128,128],4);
  direct.accept(packet);direct.owned=true;assert.equal(readAdapterMenu(adapter).direction,1);assert.equal(readAdapterMenu(adapter).select,true);
  await adapter.destroy();assert.equal(direct.owned,false);
});
test('host command failures propagate to the UI and release pending state',async()=>{
  const h=host();h.sdk.controllers.connect=async()=>{throw Error('transport down');};
  await assert.rejects(h.adapter.connect(),/transport down/);assert.equal(h.adapter.busy,false);
  h.sdk.controllers.calibrate=async()=>{throw Error('no fresh report');};await assert.rejects(h.adapter.calibrate(0),/no fresh report/);
});
