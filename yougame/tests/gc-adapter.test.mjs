import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GameCubeAdapter,GC,decodeReport,meleePad,n64Pad} from '../../controllers/gc-adapter.mjs';
import {createInput} from '../src/input.mjs';
const packet=()=>{const b=new Uint8Array(37);b[0]=0x21;for(let i=0;i<4;i++){b[1+9*i]=0x10;b.set([128,128,128,128,0,0],4+9*i);}return b;};
const tick=()=>new Promise(r=>setImmediate(r));
class USB extends EventTarget {
  async requestDevice(options){this.filters=options.filters;return this.device;}
}
function device() {
  const d={vendorId:0x057e,productId:0x0337,opened:false,configuration:null,calls:[],pending:null,
    async open(){this.opened=true;this.calls.push('open');},
    async selectConfiguration(n){this.calls.push(['configuration',n]);this.configuration={interfaces:[{interfaceNumber:2,alternate:{alternateSetting:0},alternates:[{interfaceClass:255,alternateSetting:1,endpoints:[{direction:'in',type:'interrupt',endpointNumber:3,packetSize:37},{direction:'out',type:'interrupt',endpointNumber:4,packetSize:5}]}]}]};},
    async claimInterface(n){this.calls.push(['claim',n]);},
    async selectAlternateInterface(i,a){this.calls.push(['alternate',i,a]);},
    async transferOut(n,b){this.calls.push(['out',n,[...b]]);return {status:'ok',bytesWritten:b.length};},
    transferIn(n,size){assert.equal(this.pending,null,'only one read may be in flight');this.calls.push(['in',n,size]);return new Promise((resolve,reject)=>{this.pending={resolve,reject};});},
    deliver(b){const pending=this.pending;this.pending=null;pending.resolve({status:'ok',data:new DataView(b.buffer,b.byteOffset,b.byteLength)});},
    async close(){this.opened=false;this.calls.push('close');const p=this.pending;this.pending=null;p?.reject(Error('closed'));}
  };return d;
}
test('strict report validation including offset views; unsupported port types stay disconnected',()=>{
  const p=packet();assert.equal(decodeReport(p).length,4);
  assert.equal(decodeReport(p.slice(0,36)),null);assert.equal(decodeReport(new Uint8Array(38)),null);
  p[0]=0x20;assert.equal(decodeReport(p),null);p[0]=0x21;
  p[1]=4;p[10]=0x24;p[19]=0x30;
  const full=new Uint8Array(44);full.set(p,5);const rows=decodeReport(new DataView(full.buffer,5,37));
  assert.equal(rows[0].connected,false);assert.equal(rows[1].type,'wireless');assert.equal(rows[2].type,'wired');
  assert.deepEqual(rows.map(p=>p.port),[0,1,2,3]);
});
test('every hardware bit maps independently; trigger travel never invents a Melee click',()=>{
  const bits=[1,2,4,8,256,512,128,64,32,16,2048,1024];
  const expected=[1,2,4,8,256,512,128,64,32,16,2048,1024].map(b=>({1:1,2:2,4:4,8:8,256:32,512:16,128:64,64:128,32:512,16:256,2048:1024,1024:2048})[b]);
  for(let i=0;i<bits.length;i++){const b=packet();b[2]=bits[i]&255;b[3]=bits[i]>>8;assert.equal(meleePad(decodeReport(b)[0])[0],expected[i]);}
  const b=packet();b[8]=127;b[9]=254;let p=meleePad(decodeReport(b)[0]);assert.equal(p[0],0);assert.equal(p[5],127/255);assert.equal(p[6],254/255);
  b[3]=8;b[8]=0;p=meleePad(decodeReport(b)[0]);assert.equal(p[0],1024);assert.equal(p[5],0);
});
test('all 256 raw axis/trigger bytes survive the float bridge with no deadzone or radial shaping',()=>{
  for(let value=0;value<256;value++){
    const b=packet();b.fill(value,4,10);const p=meleePad(decodeReport(b)[0]);
    for(let i=1;i<=4;i++)assert.equal(Math.round(128+127*Math.fround(p[i])),value);
    for(let i=5;i<=6;i++)assert.equal(Math.round(255*Math.fround(p[i])),value);
  }
  const b=packet();b.set([208,188,129,127],4);const p=meleePad(decodeReport(b)[0]);
  assert.deepEqual(p.slice(1,5),[80/127,60/127,1/127,-1/127]);
});
test('four ports publish atomically, snapshots stay immutable, malformed input does not refresh freshness',()=>{
  let time=0;const a=new GameCubeAdapter({now:()=>time});a.owned=true;
  const b=packet();b[10]=0;a.accept(b);const old=a.snapshot();assert.equal(old.ports[1].connected,false);
  b[2]=1;a.accept(b);assert.equal(old.ports[0].buttons,0);assert.equal(a.sequence,2);
  assert.throws(()=>{old.ports[0].axes[0]=0;},TypeError);
  time=200;a.accept(new Uint8Array(2));assert.equal(a.sequence,2);assert.equal(a.invalidReports,1);
  time=251;assert.equal(a.snapshot().stale,true);assert(a.snapshot().ports.every(p=>!p.connected));
  assert.equal(a.owned,true,'stale input must not silently switch to an SDK controller');
});
test('explicit calibration leaves raw bytes untouched; disconnect/type change resets origins',()=>{
  const a=new GameCubeAdapter({now:()=>0}),b=packet();b.set([130,126,129,127,12,8],4);a.accept(b);a.suspend(true);a.accept(b);
  a.calibrate(0);assert.deepEqual(a.origins[0],[130,126,129,127,12,8]);
  assert.deepEqual(meleePad(a.snapshot({diagnostic:true}).ports[0],a.origins[0]),[0,0,0,0,0,0,0]);
  assert.equal(a.snapshot().ports[0].connected,false);a.suspend(false);assert.equal(a.snapshot().ports[0].axes[0],130);
  b[1]=0;a.accept(b);assert.deepEqual(a.origins[0],[128,128,128,128,0,0]);
});
test('N64 mapping has correct Y, C-stick, shield, grab, d-pad, Start filtering and independent axes',()=>{
  const b=packet();b[2]=GC.A|GC.X|GC.UP;b[3]=(GC.Z|GC.START)>>8;b.set([208,188,180,75,42,0],4);
  let p=n64Pad(decodeReport(b)[0],undefined,false);assert.deepEqual(p,[0x8000|8|0x800|0x10|1|4,80,60]);
  b[8]=43;p=n64Pad(decodeReport(b)[0]);assert(p[0]&0x2000);assert(p[0]&0x1000);
});
test('Smash64 and Remix input keep port holes and single online player reads without consuming samples',()=>{
  const a=new GameCubeAdapter({now:()=>0}),b=packet();a.owned=true;b[1]=0;b[11]=GC.A;a.accept(b);
  const input=createInput({adapter:a,allowStart:true});assert.deepEqual(input.read(),[0,0,0]);
  const ports=input.readPorts();assert.equal(ports[0],null);assert.equal(ports[1][0],0x8000);
  assert.deepEqual(input.readPorts(),ports);input.destroy();
});
test('WebUSB selects descriptors, initializes once and ignores late reports after close',async()=>{
  const usb=new USB();usb.device=device();const a=new GameCubeAdapter({usb,now:()=>0});await a.connect();
  assert.deepEqual(usb.filters,[{vendorId:0x057e,productId:0x0337}]);
  assert.deepEqual(usb.device.calls.slice(0,6),['open',['configuration',1],['claim',2],['alternate',2,1],['out',4,[0x13]],['in',3,37]]);
  usb.device.deliver(packet());await tick();assert.equal(a.sequence,1);
  const pending=usb.device.pending;usb.device.pending=null;await a.close();pending.resolve({status:'ok',data:new DataView(packet().buffer)});await tick();
  assert.equal(a.sequence,1);assert.equal(a.owned,false);assert.equal(usb.device.opened,false);await a.destroy();
});
test('descriptor discovery skips an interrupt endpoint too small for the report',async()=>{
  const usb=new USB();usb.device=device();await usb.device.selectConfiguration(1);
  usb.device.configuration.interfaces[0].alternates[0].endpoints.unshift({direction:'in',type:'interrupt',endpointNumber:7,packetSize:8});
  const a=new GameCubeAdapter({usb});await a.connect();assert.deepEqual(usb.device.calls.at(-1),['in',3,37]);await a.destroy();
});
test('claim failures close handles and chooser cancellation leaves regular controls available',async()=>{
  const usb=new USB();usb.device=device();usb.device.claimInterface=async()=>{throw Error('busy');};
  const a=new GameCubeAdapter({usb});await a.connect();assert.equal(a.state,'error');assert.equal(a.device,null);assert.equal(usb.device.opened,false);
  usb.requestDevice=async()=>{throw Object.assign(Error('cancel'),{name:'NotFoundError'});};await a.connect();assert.equal(a.owned,false);assert.equal(a.state,'idle');await a.destroy();
});
test('unplug neutralizes all seats and a permitted reconnect resumes the same physical port order',async()=>{
  const usb=new USB();usb.device=device();const a=new GameCubeAdapter({usb,now:()=>0});await a.connect();usb.device.deliver(packet());await tick();
  usb.dispatchEvent(Object.assign(new Event('disconnect'),{device:usb.device}));await tick();assert.equal(a.owned,true);assert(a.snapshot().ports.every(p=>!p.connected));
  usb.dispatchEvent(Object.assign(new Event('connect'),{device:usb.device}));await tick();usb.device.deliver(packet());await tick();assert.deepEqual(a.snapshot().ports.map(p=>p.port),[0,1,2,3]);await a.destroy();
});
test('cancellation during opening cleans a handle that resolves after teardown',async()=>{
  const usb=new USB();usb.device=device();let finish;
  usb.device.open=()=>new Promise(resolve=>{finish=()=>{usb.device.opened=true;resolve();};});
  const a=new GameCubeAdapter({usb}),opening=a.connect();await tick();await a.destroy();finish();await opening;
  assert.equal(usb.device.opened,false);assert.equal(a.owned,false);assert.equal(a.busy,false);
});
test('teardown while chooser is pending never opens the selected device',async()=>{
  const usb=new USB();usb.device=device();let choose;usb.requestDevice=()=>new Promise(r=>{choose=r;});
  const a=new GameCubeAdapter({usb}),pending=a.connect();await a.destroy();choose(usb.device);await pending;
  assert.equal(usb.device.opened,false);assert.equal(a.owned,false);
});
test('read failure closes the handle, neutralizes held input and retains explicit seat ownership',async()=>{
  const usb=new USB();usb.device=device();const a=new GameCubeAdapter({usb});await a.connect();usb.device.deliver(packet());await tick();
  const p=usb.device.pending;usb.device.pending=null;p.reject(Error('transfer failed'));await tick();
  assert.equal(a.state,'error');assert.equal(a.device,null);assert.equal(usb.device.opened,false);assert.equal(a.owned,true);assert(a.snapshot().ports.every(p=>!p.connected));await a.destroy();
});
