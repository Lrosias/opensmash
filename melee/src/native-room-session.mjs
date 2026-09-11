// One native VS machine per peer, from character select through results. The
// platform owns membership; its global slots never become client-relative P1.
import {neutralPad as neutral,validPad} from './rollback-engine.mjs';
export const NATIVE_MENU_PROTOCOL='opensmash-melee-native-menu-v1';
export function nativeRoster(participants){
 const result=(participants||[]).map(({id,connectionId,slot,localIndex})=>({id,connectionId,slot,localIndex})).sort((a,b)=>a.slot-b.slot);
 if(result.length>4||result.some(p=>typeof p.id!=='string'||typeof p.connectionId!=='string'||!Number.isInteger(p.slot)||p.slot<0||p.slot>3||!Number.isInteger(p.localIndex)||p.localIndex<0||p.localIndex>3)||new Set(result.map(p=>p.slot)).size!==result.length||new Set(result.map(p=>p.id)).size!==result.length||new Set(result.map(p=>`${p.connectionId}:${p.localIndex}`)).size!==result.length)throw Error('Invalid native controller roster');
 return result;
}
// The SDK caps each JSON input at 256 characters. Four analog controllers
// exceed it as decimal arrays. Encode exactly the float32 values accepted by C:
// 4 × (uint16 buttons + 6 float32 axes), little endian, 140 base64 characters.
export function encodeNativePads(pads){
 if(!Array.isArray(pads)||pads.length!==4||pads.some(p=>!validPad(p)))throw Error('Invalid native controller inputs');
 const bytes=new Uint8Array(104),view=new DataView(bytes.buffer);
 pads.forEach((p,i)=>{view.setUint16(i*26,p[0],true);for(let j=1;j<7;j++)view.setFloat32(i*26+2+(j-1)*4,p[j],true);});
 return btoa(String.fromCharCode(...bytes));
}
export function decodeNativePads(value){
 if(typeof value!=='string'||value.length!==140)throw Error('Invalid native controller packet');
 let text;try{text=atob(value);}catch{throw Error('Invalid native controller packet');}
 if(text.length!==104)throw Error('Invalid native controller packet');
 const bytes=Uint8Array.from(text,c=>c.charCodeAt(0)),view=new DataView(bytes.buffer);
 const pads=Array.from({length:4},(_,i)=>[view.getUint16(i*26,true),...Array.from({length:6},(_,j)=>view.getFloat32(i*26+2+j*4,true))]);
 // The valid -128/127 endpoint rounds slightly below its JS double value.
 const valid=p=>p[0]<=4095&&p.slice(1,5).every(v=>Number.isFinite(v)&&v>=Math.fround(-128/127)&&v<=1)&&p.slice(5).every(v=>Number.isFinite(v)&&v>=0&&v<=1);
 if(pads.some(p=>!valid(p)))throw Error('Invalid native controller packet');
 // Preserve that legal endpoint through the engine driver's double-range check.
 return pads.map(p=>p.map((v,i)=>i>=1&&i<=4?Math.max(-128/127,v):v));
}
export function nativePads(participants,inputs){
 const pads=Array.from({length:4},neutral);
 for(const connection of new Set(participants.map(p=>p.connectionId))){
  const owned=participants.filter(p=>p.connectionId===connection),samples=decodeNativePads(inputs[connection]);
  if(!Array.isArray(samples)||samples.length!==4||samples.some(p=>!validPad(p)))throw Error('Invalid native controller inputs');
  owned.forEach(p=>pads[p.slot]=samples[p.localIndex]);
 }
 return pads;
}
// The engine publishes this only after native rankings (including Sudden Death)
// are final. Legacy per-battle stock/timer observations are never results here.
export function nativeResultReceipt(meta,participants,lastBattle){
 const r=meta.receipt;if(!r)return null;
 if(!Number.isSafeInteger(r.battleId)||r.battleId<1||!['winner','unscored'].includes(r.kind)||!Number.isInteger(r.participantsMask)||r.participantsMask<0||r.participantsMask>15||!Number.isInteger(r.humanMask)||r.humanMask<0||r.humanMask>15||(r.humanMask&~r.participantsMask)||typeof r.teamBattle!=='boolean'||typeof r.noContest!=='boolean'||!Array.isArray(r.places)||r.places.length!==4||!r.places.every(Number.isInteger))throw Error('Invalid completed native result receipt');
 if(r.battleId!==meta.battleId||!Number.isInteger(r.outcome)||!Number.isInteger(r.matchKind)||!Number.isInteger(r.extraParticipants)||r.extraParticipants<0)throw Error('Invalid completed Melee result metadata');
 if(r.battleId<=lastBattle)return null;
 const unscored=r.kind==='unscored',mask=participants.reduce((bits,p)=>bits|(1<<p.slot),0);
 const winner=unscored?null:participants.find(p=>p.slot===r.winnerSlot)?.id;
 if(!unscored&&(!winner||r.participantsMask!==mask||r.humanMask!==mask||r.teamBattle||r.noContest||r.extraParticipants!==0))throw Error('Native winner receipt does not match the active human roster');
 return {frame:meta.frame,battleId:r.battleId,hash:meta.hash>>>0,winner,unscored,receipt:{kind:r.kind,winnerSlot:unscored?null:r.winnerSlot,participantsMask:r.participantsMask,humanMask:r.humanMask,teamBattle:r.teamBattle,noContest:r.noContest,outcome:r.outcome,matchKind:r.matchKind,extraParticipants:r.extraParticipants,places:[...r.places]}};
}
// The initial controlled VI is itself agreed before any menu input advances.
// Holes receive neutral samples; native connection state comes from immutable slots.
export function nativeMetadata(output){
 const meta=output?.nativeSession;
 if(!meta||!Number.isSafeInteger(output.frame)||output.frame<0||!Number.isInteger(output.hash)||!Number.isInteger(meta.phase)||meta.phase<0||meta.phase>6||!Number.isSafeInteger(meta.battleId)||meta.battleId<0||!Number.isInteger(meta.seatMask)||meta.seatMask<1||meta.seatMask>15)throw Error('Melee native session metadata is unavailable');
 return {...meta,frame:output.frame,hash:output.hash};
}
export class MeleeNativeRoomSession {
 constructor({room,build,createEngine,readPorts,onStatus=()=>{},onError=()=>{}}){
  Object.assign(this,{room,build,createEngine,readPorts,onStatus,onError});this.drained=Promise.resolve();this.nativeMenu=true;this.listeners=[];this.peers=new Map();this.reports=new Map();this.round=room.round;this.sequence=0;this.lastBattle=0;
  this.listen('message',event=>this.receive(event));
  for(const event of ['lobby','participants','roster','join','settings'])this.listen(event,()=>this.refresh());
  this.listen('ready',()=>this.started());
  this.listen('leave',player=>{if(this.running&&this.participants.some(p=>p.connectionId===player?.id))this.fail('A player left the native game.');else this.refresh();});
  this.listen('close',()=>this.fail('Connection closed.'));
  this.listen('result',event=>this.settled(event));
  this.timer=setInterval(()=>this.pulse(),500);this.refresh();
 }
 listen(event,fn){this.room.on(event,fn);this.listeners.push([event,fn]);}
 guard(fn){if(this.closed)return;try{return fn();}catch(error){this.fail(error.message);}}
 refresh(){return this.guard(()=>{
  if(this.terminal||this.settling||this.draining)return;
  if(this.room.playing){if(!this.running)this.started();return;}
  const participants=nativeRoster(this.room.participants),key=JSON.stringify(participants),changed=key!==this.rosterKey;
  if(changed){
   // Invalidate old boots and agreements even when a departure drops the room
   // below minimum. A late engine attach cannot begin with the departed roster.
   this.stopSync();this.bootAbort?.abort();this.engine?.destroy();this.engine=null;this.meta=null;this.rosterKey=key;this.participants=participants;this.connections=[...new Set(participants.map(p=>p.connectionId))];this.peers.clear();this.reports.clear();this.lastBattle=0;
   this.bootToken=(this.bootToken||0)+1;
  }
  this.round=this.room.round;this.revision=this.room.revision;this.prepareKey=JSON.stringify([this.build,this.round,this.revision,this.rosterKey]);
  if(participants.length<2){this.preparing=false;this.onStatus('WAITING FOR ANOTHER PLAYER');return;}
  if(changed){this.preparing=true;this.seed=this.room.seed;this.launch(this.bootToken);}
  this.pulse();
 });}
 async launch(token){
  const abort=this.bootAbort=new AbortController();
  try{
   await this.drained;
   if(this.closed||token!==this.bootToken)return;
   const engine=await this.createEngine({slots:this.participants.map(p=>p.slot)},status=>this.onStatus(status),abort.signal);
   if(this.closed||token!==this.bootToken){engine.destroy();return;}
   this.engine=engine;this.meta=nativeMetadata(engine.initial);
   if(this.meta.seatMask!==this.participants.reduce((mask,p)=>mask|(1<<p.slot),0))throw Error('Melee connected the wrong native controller ports');
   this.preparing=false;engine.show?.();this.pulse();
  }catch(error){if(!this.closed&&token===this.bootToken)this.fail(error.message);}
 }
 checkpoint(){const m=this.meta;return m?JSON.stringify([m.frame,m.phase,m.battleId,m.hash,m.seatMask]):null;}
 pulse(broadcast=true){return this.guard(()=>{
  if(!this.participants||this.participants.length<2)return;
  if(this.terminal){this.room.send({p:NATIVE_MENU_PROTOCOL,type:'native-terminal',scope:this.scope,terminal:this.terminal});this.finishIfAgreed();return;}
  if(this.room.playing){
   if(!this.sync)this.started();
   if(this.sync){this.room.send({p:NATIVE_MENU_PROTOCOL,type:'native-armed',scope:this.scope});this.startIfArmed();}
   return;
  }
  if(!this.engine||this.settling||this.draining)return;
  if(broadcast)this.room.send({p:NATIVE_MENU_PROTOCOL,type:'native-prepared',key:this.prepareKey,checkpoint:this.checkpoint()});
  if(this.room.isHost&&!this.beginning&&this.connections.filter(id=>id!==this.room.me).every(id=>this.peers.get(id)?.key===this.prepareKey&&this.peers.get(id)?.checkpoint===this.checkpoint())){
   this.beginning=true;const key=this.prepareKey;
   Promise.resolve(this.room.beginMatch({revision:this.revision})).catch(error=>{if(!this.closed&&key===this.prepareKey)this.fail(error.message);}).finally(()=>{this.beginning=false;});
  }
 });}
 receive({from,data:d}){return this.guard(()=>{
  if(from===this.room.me||!this.connections?.includes(from)||d?.p!==NATIVE_MENU_PROTOCOL)return;
  if(d.type==='native-prepared'&&!this.room.playing&&!this.terminal&&!this.settling&&d.key===this.prepareKey){
   if(this.engine&&d.checkpoint!==this.checkpoint())throw Error('Native menus prepared different states');
   this.peers.set(from,{key:d.key,checkpoint:d.checkpoint});this.pulse(false);
  }else if(d.type==='native-armed'&&d.scope===this.scope){this.peers.set(from,{armed:d.scope});this.startIfArmed();}
  else if(d.type==='native-terminal'&&d.scope===this.scope){this.reports.set(from,JSON.stringify(d.terminal));this.finishIfAgreed();}
 });}
 started(){return this.guard(()=>{
  if(!this.room.playing||this.sync||this.settling||this.terminal||this.draining)return;
  const frozen=nativeRoster(this.room.matchParticipants||this.room.participants);
  if(!frozen.some(p=>p.connectionId===this.room.me)){this.waitingRound=this.room.round;this.onStatus('WAITING FOR THE NEXT GAME');return;}
  if(!this.engine||JSON.stringify(frozen)!==this.rosterKey)throw Error('Native controller roster changed before start');
  this.round=this.room.round;this.scope=JSON.stringify([this.build,this.round,this.room.matchId,this.rosterKey,this.checkpoint()]);this.peers.clear();this.reports.clear();this.terminal=null;this.reported=false;this.frame=0;
  this.baseFrame=this.meta.frame;
  this.sync=this.room.rollbackAsync({protocol:NATIVE_MENU_PROTOCOL,round:this.round,checksumFormat:'melee-main-ram-crc32-v1',hz:60,delay:3,maxRollback:0,neutral:encodeNativePads(Array.from({length:4},neutral)),checksumEvery:30,catchUp:4,engineTimeout:30000,stallTimeout:30000,
   input:()=>{const ports=this.readPorts();return encodeNativePads(Array.from({length:4},(_,i)=>ports[i]||neutral()));},
   step:(frame,inputs,options)=>this.step(frame,inputs,options)});
  const send=this.room.send,scope=this.scope,receive=this.sync.receive.bind(this.sync);
  this.scopedSend=(data,...args)=>send.call(this.room,data?._ra===1?{...data,nativeScope:scope}:data,...args);this.room.send=this.scopedSend;
  this.restoreSend=()=>{if(this.room.send===this.scopedSend)this.room.send=send;};
  this.sync.receive=(from,data)=>{if(!this.closed&&data.nativeScope===scope)receive(from,data);};
  this.sync.on('error',error=>this.fail(error.message));
  for(const event of ['stall','resume','overload','recovered'])this.sync.on(event,details=>this.onStatus({event,...details}));
  for(const event of ['desync','timeout'])this.sync.on(event,()=>this.fail('The native game could not stay synchronized.'));
  this.pulse();
 });}
 startIfArmed(){if(this.sync&&!this.running&&this.connections.filter(id=>id!==this.room.me).every(id=>this.peers.get(id)?.armed===this.scope)){this.running=true;this.onStatus('ONLINE - 3 FRAME INPUT BUFFER');this.sync.start();}}
 async step(frame,inputs,{replaying=false}={}){
  if(this.terminal||this.closed)throw Error('Melee native timeline is stopped');
  if(replaying)throw Error('Melee native menu replay is not qualified');
  if(frame!==this.frame||this.engine.frame!==this.baseFrame+frame)throw Error('Native timeline advanced out of order');
  const output=await this.engine.step(nativePads(this.participants,inputs),{replaying:false});
  if(this.closed)return {checksum:output.hash};
  this.meta=nativeMetadata(output);this.frame++;
  if(this.meta.frame!==this.baseFrame+this.frame)throw Error('Native engine completed an unexpected frame');
  const terminal=nativeResultReceipt(this.meta,this.participants,this.lastBattle);
  if(terminal){
   this.lastBattle=terminal.battleId;this.terminal=terminal;
   // Stop synchronously to prevent the SDK issuing a second native command.
   // Never await stop from inside its own step: drain after this step returns.
   this.stopSync();this.onStatus('CONFIRMING GAME RESULT');
   this.drained.then(()=>{if(!this.closed)this.pulse();});
  }
  return {checksum:this.meta.hash,engineFrame:this.meta.frame};
 }
 finishIfAgreed(){
  if(!this.terminal||this.reported||this.draining)return;
  const value=JSON.stringify(this.terminal);
  for(const report of this.reports.values())if(report!==value){this.fail('Players disagree on the native result');return;}
  if(!this.connections.filter(id=>id!==this.room.me).every(id=>this.reports.get(id)===value))return;
  this.reported=true;const report=this.terminal.unscored?{void:true}:{winner:this.terminal.winner};
  // Teams, CPUs and no-contests have no honest single-winner platform score.
  // Close that platform round neutrally without inventing a draw/game report.
  const recorded=this.terminal.unscored?Promise.resolve():Promise.resolve(this.room.reportGame({id:`native-${this.terminal.battleId}`,...report}));
  recorded.then(()=>{if(!this.closed)return this.room.finish(report);}).catch(error=>this.fail(error.message));
 }
 settled(event){
  if(this.closed||event.round!==this.round||this.settling)return;
  // A connection joining an active game owns no frozen native ports yet. It
  // observes settlement without reporting and boots only the next roster epoch.
  if(this.waitingRound===event.round&&!this.engine){this.waitingRound=null;queueMicrotask(()=>this.refresh());return;}
  const expectedVoid=this.reported&&this.terminal?.unscored===true;
  if(!this.terminal||!this.reported||!!event.void!==expectedVoid||(!expectedVoid&&(event.draw||event.ranking?.[0]!==this.terminal.winner))){this.fail('Native game ended without its agreed result');return;}
  this.stopSync();this.settling=true;
  // Let the SDK finish dispatching result (which stops its old controller)
  // before registering a new round. The native machine stays at its exact tick.
  queueMicrotask(()=>{this.drained.then(()=>{if(this.closed)return;this.terminal=null;this.peers.clear();this.reports.clear();this.settling=false;this.refresh();});});
 }
 stopSync(){
  const sync=this.sync;this.sync=null;this.running=false;this.restoreSend?.();this.restoreSend=null;
  if(sync){this.draining=true;const prior=this.drained;this.drained=Promise.all([prior,sync.stop()]).then(()=>{this.draining=false;});}
  return this.drained;
 }
 stop(){return this.destroy();}
 fail(message){if(this.closed)return;const playing=this.room.playing;this.destroy();if(playing)Promise.resolve(this.room.finish({void:true})).catch(()=>{});this.onError(message);}
 destroy(){if(this.closed)return;this.closed=true;clearInterval(this.timer);this.stopSync();this.bootAbort?.abort();this.engine?.destroy();for(const [event,fn]of this.listeners)this.room.off(event,fn);return this.drained;}
}
