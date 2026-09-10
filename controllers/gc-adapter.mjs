// Nintendo Wii U protocol, independently implemented from the documented wire
// layout. Source references and platform contract: docs/gamecube-adapter-handoff.md.
export const ADAPTER_FILTER = Object.freeze({vendorId:0x057e, productId:0x0337});
export const GC = Object.freeze({A:1,B:2,X:4,Y:8,LEFT:16,RIGHT:32,DOWN:64,UP:128,
  START:256,Z:512,R:1024,L:2048});
export function decodeReport(data) {
  const bytes=data instanceof DataView?new Uint8Array(data.buffer,data.byteOffset,data.byteLength):data;
  if (!(bytes instanceof Uint8Array) || bytes.length!==37 || bytes[0]!==0x21) return null;
  return Array.from({length:4},(_,port)=>{
    const i=1+9*port,type=bytes[i]&0x10?'wired':bytes[i]&0x20?'wireless':null;
    return Object.freeze({port,connected:!!type,type,status:bytes[i],
      buttons:type?bytes[i+1]|((bytes[i+2]&15)<<8):0,
      axes:Object.freeze(type?Array.from(bytes.slice(i+3,i+7)):[128,128,128,128]),
      triggers:Object.freeze(type?Array.from(bytes.slice(i+7,i+9)):[0,0])});
  });
}
const neutral=port=>Object.freeze({port,connected:false,type:null,status:0,buttons:0,
  axes:Object.freeze([128,128,128,128]),triggers:Object.freeze([0,0])});
const matches=d=>d?.vendorId===ADAPTER_FILTER.vendorId&&d.productId===ADAPTER_FILTER.productId;

// One owner and one in-flight read for one four-port adapter. Sampling never
// consumes edges or mutates reports: rollback records the result once per frame.
export class GameCubeAdapter {
  constructor({usb=globalThis.navigator?.usb,now=()=>performance.now(),staleMs=250}={}) {
    this.usb=usb;this.now=now;this.staleMs=staleMs;this.device=null;this.claimed=null;
    this.owned=false;this.busy=false;this.opening=false;this.generation=0;this.sequence=0;this.receivedAt=-Infinity;
    this.ports=Array.from({length:4},(_,i)=>neutral(i));this.origins=Array.from({length:4},()=>[128,128,128,128,0,0]);
    this.state='idle';this.message='Use a Wii U / Switch mode adapter. Ports 1–4 map to players 1–4.';
    this.invalidReports=0;this.suspended=false;this.listeners=new Set();this.autoConnect=true;
    this.onDisconnect=e=>{if(e.device===this.device){void this.close(false);this.setStatus('disconnected','Adapter unplugged. Reconnect it or choose Use regular controls.');}};
    this.onConnect=e=>{if(this.autoConnect&&!this.device&&!this.busy&&matches(e.device))void this.open(e.device).catch(e=>this.error(e));};
    usb?.addEventListener('disconnect',this.onDisconnect);usb?.addEventListener('connect',this.onConnect);
    this.ready=this.restoreGranted();
  }
  subscribe(fn){this.listeners.add(fn);return ()=>this.listeners.delete(fn);}
  setStatus(state,message){this.state=state;this.message=message;for(const fn of this.listeners)fn();}
  async restoreGranted() {
    if(!this.usb?.getDevices)return;
    const generation=this.generation;
    try {
      const devices=await this.usb.getDevices();
      if(!this.autoConnect||generation!==this.generation||this.busy||this.opening||this.device)return;
      const device=devices.find(matches);
      if(device)await this.open(device);
    } catch { /* Permission policy can block enumeration; never launch a chooser here. */ }
  }
  error(error){if(error.code==='WUP028_NATIVE_REQUIRED'){this.setStatus('native-required',error.message);return;}this.setStatus('error',`Adapter unavailable: ${error.message}. Close Slippi/Dolphin or other adapter apps, check the adapter mode and USB driver, then retry.`);}
  async connect() {
    if(this.busy||this.opening||this.device)return;
    if(!this.usb)throw Error('This browser does not provide WebUSB. Use desktop Chrome/Edge, or regular controller mode');
    this.autoConnect=true;this.busy=true;const generation=this.generation;
    try {
      // Call the chooser directly in the click gesture, before any await.
      const device=await this.usb.requestDevice({filters:[ADAPTER_FILTER]});
      if(generation!==this.generation)return;
      this.busy=false;await this.open(device);
    } catch(e) {this.busy=false;if(e.name==='NotFoundError')this.setStatus('idle','No adapter selected. Regular controls are unchanged.');else this.error(e);}
  }
  async open(device) {
    if(this.busy||this.opening||this.device)return;
    if(!matches(device))throw Error('Unsupported adapter');
    this.busy=true;this.opening=true;const generation=++this.generation;this.device=device;
    const check=()=>{if(generation!==this.generation)throw Error('Connection cancelled');};
    this.setStatus('opening','Opening adapter…');
    try {
      await device.open();check();
      if(!device.configuration){await device.selectConfiguration(1);check();}
      const candidates=device.configuration.interfaces.flatMap(i=>i.alternates.map(a=>({i,a})));
      // Never claim a HID/storage/etc interface based only on a product name.
      const match=candidates.find(({a})=>a.interfaceClass===255&&
        a.endpoints.some(e=>e.direction==='in'&&e.type==='interrupt'&&e.packetSize>=37)&&
        a.endpoints.some(e=>e.direction==='out'&&e.type==='interrupt'));
      if(!match){
        if(candidates.some(({a})=>a.interfaceClass===3))
          throw Object.assign(Error('GameCube adapter detected. This WUP-028 uses an HID interface that this browser cannot access through WebUSB. Open this game in the YouGame desktop app for native adapter support.'),{code:'WUP028_NATIVE_REQUIRED'});
        throw Error('No supported GameCube USB interface found');
      }
      await device.claimInterface(match.i.interfaceNumber);check();this.claimed=match.i.interfaceNumber;
      if(match.i.alternate?.alternateSetting!==match.a.alternateSetting)
        await device.selectAlternateInterface(this.claimed,match.a.alternateSetting);
      check();
      const input=match.a.endpoints.find(e=>e.direction==='in'&&e.type==='interrupt'&&e.packetSize>=37);
      const output=match.a.endpoints.find(e=>e.direction==='out'&&e.type==='interrupt');
      const init=await device.transferOut(output.endpointNumber,new Uint8Array([0x13]));
      if(init.status!=='ok'||init.bytesWritten!==1)throw Error('Adapter initialization failed');
      if(generation!==this.generation){await device.close();return;}
      this.owned=true;this.busy=false;this.receivedAt=-Infinity;
      this.setStatus('connected','Adapter connected. Release sticks and triggers before calibrating.');
      void this.readLoop(device,input.endpointNumber,generation);
    } catch(e) {if(generation===this.generation){await this.close(false);this.error(e);}else if(device.opened)try{await device.close();}catch{}}
    finally {this.opening=false;this.busy=false;}
  }
  accept(data) {
    const report=decodeReport(data);
    if(!report){this.invalidReports++;return false;}
    for(let i=0;i<4;i++)if(!report[i].connected||report[i].type!==this.ports[i].type)this.origins[i]=[128,128,128,128,0,0];
    this.ports=Object.freeze(report);this.sequence++;this.receivedAt=this.now();return true;
  }
  async readLoop(device,endpoint,generation) {
    try {
      while(generation===this.generation) {
        const result=await device.transferIn(endpoint,37);
        if(generation!==this.generation)return;
        if(result.status!=='ok')throw Error(`USB read ${result.status}`);
        this.accept(result.data);
      }
    } catch(e) {if(generation===this.generation){await this.close(false);this.error(e);}}
  }
  snapshot({diagnostic=false}={}) {
    const stale=this.now()-this.receivedAt>this.staleMs;
    return Object.freeze({sequence:this.sequence,receivedAt:this.receivedAt,stale,suspended:this.suspended,
      owned:this.owned,ports:stale||(this.suspended&&!diagnostic)?Object.freeze(Array.from({length:4},(_,i)=>neutral(i))):this.ports});
  }
  suspend(value){this.suspended=value;if(value)this.receivedAt=-Infinity;}
  calibrate(port) {
    const p=this.snapshot({diagnostic:true}).ports[port];if(!p?.connected)throw Error('No fresh controller report on this port');
    this.origins[port]=[...p.axes,...p.triggers];
  }
  resetCalibration(){this.origins=Array.from({length:4},()=>[128,128,128,128,0,0]);}
  async close(releaseOwnership=true) {
    ++this.generation;const device=this.device;
    this.device=null;this.claimed=null;this.busy=false;this.receivedAt=-Infinity;this.resetCalibration();
    if(releaseOwnership){this.owned=false;this.autoConnect=false;}
    // close() cancels a pending transferIn; releaseInterface can wait behind it.
    if(device?.opened)try {await device.close();}catch{}
    if(releaseOwnership)this.setStatus('idle','Regular keyboard, touch and browser controllers enabled.');
  }
  async destroy(){this.usb?.removeEventListener('disconnect',this.onDisconnect);this.usb?.removeEventListener('connect',this.onConnect);this.listeners.clear();await this.close();}
}

const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
export function meleePad(port,origin=[128,128,128,128,0,0]) {
  if(!port?.connected)return [0,0,0,0,0,0,0];
  const b=port.buttons,mask=(b&15)|((b&GC.Z)?16:0)|((b&GC.START)?32:0)|
    ((b&GC.UP)?64:0)|((b&GC.DOWN)?128:0)|((b&GC.LEFT)?256:0)|((b&GC.RIGHT)?512:0)|
    ((b&GC.L)?1024:0)|((b&GC.R)?2048:0);
  // Existing Dolphin Touch override runs after deadzone/gate processing and
  // maps units around 128 with radius 127. The native bridge allows -128/127
  // to preserve byte zero too. No radial or SDK remapping here.
  return [mask,...port.axes.map((v,i)=>clamp((v-origin[i])/127,-128/127,1)),
    ...port.triggers.map((v,i)=>clamp((v-origin[i+4])/255,0,1))];
}
export function n64Pad(port,origin=[128,128,128,128,0,0],allowStart=true) {
  if(!port?.connected)return [0,0,0];
  const b=port.buttons,axis=port.axes.map((v,i)=>v-origin[i]);
  let mask=((b&GC.A)?0x8000:0)|((b&GC.B)?0x4000:0)|((b&(GC.X|GC.Y))?8:0)|
    ((b&GC.Z)?0x10:0)|((b&(GC.L|GC.R))||port.triggers.some((v,i)=>v-origin[i+4]>=43)?0x2000:0)|
    (allowStart&&(b&GC.START)?0x1000:0)|((b&GC.UP)?0x800:0)|((b&GC.DOWN)?0x400:0)|
    ((b&GC.LEFT)?0x200:0)|((b&GC.RIGHT)?0x100:0);
  if(axis[2]>40)mask|=1;if(axis[2]<-40)mask|=2;if(axis[3]<-40)mask|=4;if(axis[3]>40)mask|=8;
  return [mask,clamp(axis[0],-80,80),clamp(axis[1],-80,80)];
}
