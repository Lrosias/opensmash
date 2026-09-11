// One native VS machine per peer, from character select through results. The
// platform owns membership; its global slots never become client-relative P1.
const neutral=()=>[0,0,0];
const validPad=p=>Array.isArray(p)&&p.length===3&&p.every(Number.isInteger)&&p[0]>=0&&p[0]<=65535&&Math.abs(p[1])<=80&&Math.abs(p[2])<=80;
export function nativeRoster(participants){
 const result=(participants||[]).map(({id,connectionId,slot,localIndex})=>({id,connectionId,slot,localIndex})).sort((a,b)=>a.slot-b.slot);
 if(result.length>4||result.some(p=>typeof p.id!=='string'||typeof p.connectionId!=='string'||!Number.isInteger(p.slot)||p.slot<0||p.slot>3||!Number.isInteger(p.localIndex)||p.localIndex<0||p.localIndex>3)||new Set(result.map(p=>p.slot)).size!==result.length||new Set(result.map(p=>p.id)).size!==result.length||new Set(result.map(p=>`${p.connectionId}:${p.localIndex}`)).size!==result.length)throw Error('Invalid native controller roster');
 return result;
}
export function nativePads(participants,inputs){
 const pads=Array(4).fill(null);
 for(const connection of new Set(participants.map(p=>p.connectionId))){
  const owned=participants.filter(p=>p.connectionId===connection),samples=inputs[connection]??owned.map(neutral);
  if(!Array.isArray(samples)||samples.length!==owned.length||samples.some(p=>!validPad(p)))throw Error('Invalid native controller inputs');
  owned.forEach((p,i)=>pads[p.slot]=samples[i]);
 }
 return pads;
}
export function nativeSessionParams({participants,seed,profile}){
 const slots=Array(4).fill('o');for(const p of nativeRoster(participants))slots[p.slot]='h';
 return new URLSearchParams({SSB64_YOUGAME_SESSION:'1',SSB64_YOUGAME:'1',SSB64_YOUGAME_ROLLBACK:'1',SSB64_YOUGAME_SEED:String(seed),SSB64_START_SCENE:'16',
  // -1 is the engine's explicit unselected-menu bootstrap, never a battle.
  SSB64_BOOT_BATTLE:'-1,-1,6,0,-1,-1',SSB64_BOOT_SLOTS:slots.join(''),SSB64_STOCKS:String(profile.stocks),SSB64_VS_INTRO:'0',...(profile.remix?{SSB64_REMIX_MAIN:'1'}:{})});
}
export async function prepareNativeSessionEngine(raw,{owner,getState,getMeta,setPads,cancelled=()=>owner.closed}){
 const advance=pads=>{setPads(pads);owner.stepping=true;try{raw.step();}finally{owner.stepping=false;}};
 const pads=nativePads(owner.participants,{});raw.silence?.(true);
 let stable=0;
 for(let attempts=0;stable<2;attempts++){
  if(cancelled())return null;
  if(attempts>=900)throw Error('Native character select did not finish loading');
  const before=getMeta()?.frame;advance(pads);const meta=getMeta();
  stable=meta?.scene===16&&Number.isInteger(meta.frame)&&meta.frame!==before?stable+1:0;
  if(attempts%16===15)await new Promise(resolve=>setTimeout(resolve,0));
 }
 raw.silence?.(false);
 return {metadata:()=>({...getMeta()}),step(pads){advance(pads);return {state:[...getState()],meta:{...getMeta()}};},destroy(){}};
}
export class NativeRoomSession {
 constructor({room,build,profile,launch,readPorts,onStatus=()=>{},onError=()=>{}}){
  Object.assign(this,{room,build,profile,launch,readPorts,onStatus,onError});this.nativeMenu=true;this.listeners=[];this.peers=new Map();this.reports=new Map();this.round=room.round;this.sequence=0;this.lastBattle=0;
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
  if(this.terminal||this.settling)return;
  if(this.room.playing){if(!this.running)this.started();return;}
  const participants=nativeRoster(this.room.participants),key=JSON.stringify(participants),changed=key!==this.rosterKey;
  if(changed){
   // Invalidate old boots and agreements even when a departure drops the room
   // below minimum. A late engine attach cannot begin with the departed roster.
   this.stopSync();this.engine?.destroy();this.engine=null;this.rosterKey=key;this.participants=participants;this.connections=[...new Set(participants.map(p=>p.connectionId))];this.peers.clear();this.reports.clear();this.lastBattle=0;
   this.bootToken=(this.bootToken||0)+1;
  }
  this.round=this.room.round;this.revision=this.room.revision;this.prepareKey=JSON.stringify([this.build,this.round,this.revision,this.rosterKey]);
  if(participants.length<2){this.preparing=false;this.onStatus('WAITING FOR ANOTHER PLAYER');return;}
  if(changed){this.preparing=true;this.seed=this.room.seed;this.launch(this,this.bootToken);}
  this.pulse();
 });}
 attach(engine,token){if(this.closed||token!==this.bootToken){engine?.destroy();return;}this.engine=engine;this.preparing=false;this.preparedAt=Date.now();this.pulse();}
 checkpoint(){const m=this.engine?.metadata();return m?JSON.stringify([m.frame,m.scene,m.battleId,m.hash,m.seatMask]):null;}
 pulse(broadcast=true){return this.guard(()=>{
  if(!this.participants||this.participants.length<2)return;
  if(this.terminal){this.room.send({p:this.profile.protocol,type:'native-terminal',scope:this.scope,terminal:this.terminal});this.finishIfAgreed();return;}
  if(this.room.playing){
   if(!this.sync)this.started();
   if(this.sync){this.room.send({p:this.profile.protocol,type:'native-armed',scope:this.scope});this.startIfArmed();}
   return;
  }
  if(!this.engine||this.settling)return;
  if(broadcast)this.room.send({p:this.profile.protocol,type:'native-prepared',key:this.prepareKey,checkpoint:this.checkpoint()});
  if(this.room.isHost&&!this.beginning&&this.connections.filter(id=>id!==this.room.me).every(id=>this.peers.get(id)?.key===this.prepareKey&&this.peers.get(id)?.checkpoint===this.checkpoint())){
   this.beginning=true;const key=this.prepareKey;
   Promise.resolve(this.room.beginMatch({revision:this.revision})).catch(error=>{if(!this.closed&&key===this.prepareKey)this.fail(error.message);}).finally(()=>{this.beginning=false;});
  }
 });}
 receive({from,data:d}){return this.guard(()=>{
  if(from===this.room.me||!this.connections?.includes(from)||d?.p!==this.profile.protocol)return;
  if(d.type==='native-prepared'&&d.key===this.prepareKey){
   if(this.engine&&d.checkpoint!==this.checkpoint())throw Error('Native menus prepared different states');
   this.peers.set(from,{key:d.key,checkpoint:d.checkpoint});this.pulse(false);
  }else if(d.type==='native-armed'&&d.scope===this.scope){this.peers.set(from,{armed:d.scope});this.startIfArmed();}
  else if(d.type==='native-terminal'&&d.scope===this.scope){this.reports.set(from,JSON.stringify(d.terminal));this.finishIfAgreed();}
 });}
 started(){return this.guard(()=>{
  if(!this.room.playing||this.sync||this.settling||this.terminal)return;
  const frozen=nativeRoster(this.room.matchParticipants||this.room.participants);
  if(!frozen.some(p=>p.connectionId===this.room.me)){this.onStatus('WAITING FOR THE NEXT GAME');return;}
  if(!this.engine||JSON.stringify(frozen)!==this.rosterKey)throw Error('Native controller roster changed before start');
  this.round=this.room.round;this.scope=JSON.stringify([this.build,this.round,this.room.matchId,this.rosterKey,this.checkpoint()]);this.peers.clear();this.reports.clear();this.terminal=null;this.reported=false;this.frame=0;
  const local=frozen.filter(p=>p.connectionId===this.room.me);
  this.sync=this.room.lockstep({hz:60,delay:2,players:this.connections,checksumEvery:30,stallTimeout:10000,
   input:()=>{const ports=this.readPorts();return local.map(p=>ports[p.localIndex]||neutral());},
   step:(frame,inputs)=>this.guard(()=>this.step(frame,inputs)),checksum:()=>this.engine.metadata().hash});
  const send=this.room.send,scope=this.scope,receive=this.sync.receive.bind(this.sync);
  this.scopedSend=(data,...args)=>send.call(this.room,data?._ls===1?{...data,nativeScope:scope}:data,...args);this.room.send=this.scopedSend;
  this.restoreSend=()=>{if(this.room.send===this.scopedSend)this.room.send=send;};
  this.sync.receive=(from,data)=>{if(!this.closed&&data.nativeScope===scope)receive(from,data);};
  for(const event of ['desync','timeout'])this.sync.on(event,()=>this.fail('The native game could not stay synchronized.'));
  this.pulse();
 });}
 startIfArmed(){if(this.sync&&!this.running&&this.connections.filter(id=>id!==this.room.me).every(id=>this.peers.get(id)?.armed===this.scope)){this.running=true;this.onStatus('ONLINE · 2-FRAME INPUT BUFFER');this.sync.start();}}
 step(frame,inputs){
  if(this.terminal||this.closed)return;
  if(frame!==this.frame)throw Error('Native timeline advanced out of order');
  const {state,meta}=this.engine.step(nativePads(this.participants,inputs));this.frame++;
  if(!Number.isInteger(meta.frame)||state.length!==8)throw Error('Native session metadata is unavailable');
  const result=state[1];
  if(meta.scene===22&&meta.battleId>this.lastBattle&&meta.battleTicks>0&&result>=0){
   const winner=result===4?null:this.participants.find(p=>p.slot===result)?.id;
   if(result!==4&&!winner)throw Error('Native game returned an unoccupied winner');
   this.lastBattle=meta.battleId;this.terminal={frame:meta.frame,battleId:meta.battleId,hash:state[0]>>>0,winner,draw:result===4};this.stopSync();this.onStatus('CONFIRMING GAME RESULT');this.pulse();
  }
 }
 finishIfAgreed(){
  if(!this.terminal||this.reported)return;
  const value=JSON.stringify(this.terminal);
  for(const report of this.reports.values())if(report!==value){this.fail('Players disagree on the native result');return;}
  if(!this.connections.filter(id=>id!==this.room.me).every(id=>this.reports.get(id)===value))return;
  this.reported=true;const report=this.terminal.draw?{draw:true}:{winner:this.terminal.winner};
  Promise.resolve(this.room.reportGame({id:`native-${this.terminal.battleId}`,...report})).then(()=>{if(!this.closed)return this.room.finish(report);}).catch(error=>this.fail(error.message));
 }
 settled(event){
  if(this.closed||event.round!==this.round||this.settling)return;
  this.stopSync();this.settling=true;
  // Let the SDK finish dispatching result (which stops its old controller)
  // before registering a new round. The native machine stays at its exact tick.
  queueMicrotask(()=>{if(this.closed)return;if(event.void){this.fail('Native game ended without a confirmed result');return;}this.terminal=null;this.peers.clear();this.reports.clear();this.settling=false;this.refresh();});
 }
 stopSync(){this.sync?.stop();this.sync=null;this.running=false;this.restoreSend?.();this.restoreSend=null;}
 fail(message){if(this.closed)return;const playing=this.room.playing;this.destroy();if(playing)Promise.resolve(this.room.finish({void:true})).catch(()=>{});this.onError(message);}
 destroy(){if(this.closed)return;this.closed=true;clearInterval(this.timer);this.stopSync();this.engine?.destroy();for(const [event,fn]of this.listeners)this.room.off(event,fn);}
}
