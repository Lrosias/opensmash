import {validFighter,validStage,ACTIVE_PROFILE} from './game-profile.mjs';
import {validPad, neutral} from './lockstep.mjs';

export const ROLLBACK_PROTOCOL=ACTIVE_PROFILE.protocol;
export const MAX_ROLLBACK=10;

// YouGame owns the input timeline. The engine owns its checkpoint format.
// No result may escape from the speculative part of that timeline.
export class RollbackDuelSession {
  constructor({room,round,fighter,stage=6,build,readInput,launch,status,stop,seed,onGameResult,game=1,expectedFighters,profile=ACTIVE_PROFILE}) {
    Object.assign(this,{room,round,fighter,stage,build,readInput,launch,status,stop,seed,onGameResult,game,expectedFighters,profile});
    this.stagePreference=stage;this.players=room.players.map(p=>p.id);this.seat=this.players.indexOf(room.me);
    if(this.players.length!==2||this.seat<0)throw new Error('A duel requires two human players');
    if(expectedFighters&&(!Array.isArray(expectedFighters)||expectedFighters.length!==2||!expectedFighters.every(id=>validFighter(id,profile))||expectedFighters[this.seat]!==fighter))throw new Error('Invalid agreed fighter selection');
    if(typeof room.rollback!=='function')throw new Error('YouGame rollback is unavailable. Reload the game.');
    this.peer=this.players[1-this.seat];this.frame=0;this.terminal=null;this.lastHello=0;
    this.startedAt=Date.now();this.lastMessage=this.startedAt;
    this.sync=room.rollback({hz:60,delay:2,maxRollback:MAX_ROLLBACK,checksumEvery:30,stallTimeout:10000,
      input:()=>this.guard(()=>{const p=this.readInput();if(!validPad(p))throw new Error('Invalid local controller input');return p;},neutral()),
      step:(f,inputs)=>this.guard(()=>this.step(f,inputs)),save:()=>this.guard(()=>this.save(),{failed:true}),load:s=>this.guard(()=>this.load(s))});
    // The synchronous SDK's input packets have no subgame identity. Scope its
    // public send/receive boundary so delayed packets cannot contaminate a new
    // game within the same platform round (or a later rematch).
    const send=room.send,receive=this.sync.receive?.bind(this.sync);
    this.scopedSend=(data,...args)=>send.call(room,data?._ls===1?{...data,os:[profile.protocol,round,game]}:data,...args);
    room.send=this.scopedSend;this.restoreSend=()=>{if(room.send===this.scopedSend)room.send=send;};
    if(receive)this.sync.receive=(from,data)=>{if(!this.closed&&Array.isArray(data?.os)&&data.os[0]===profile.protocol&&data.os[1]===round&&data.os[2]===game)return receive(from,data);};
    this.sync.on('desync',()=>this.fail('Game states diverged. The match has been voided.',true));
    this.sync.on('timeout',()=>this.fail('Connection stalled. The match has been voided.',true));
    this.sync.on('stall',()=>this.status('WAITING FOR OPPONENT'));
    this.message=e=>{if(this.closed||e.from!==this.peer||e.data?.round!==this.round||e.data?.p!==this.profile.protocol||(e.data?.game??1)!==this.game)return;
      try{this.receive(e.data);}catch(error){this.fail(error.message);}};
    room.on('message',this.message);
    this.timer=setInterval(()=>{try{this.pulse();}catch(error){this.fail(error.message);}},250);
    this.pulse();
  }
  guard(fn,fallback){if(this.closed)return fallback;try{return fn();}catch(e){this.fail(e.message);return fallback;}}
  send(data){this.room.send({p:this.profile.protocol,round:this.round,game:this.game,...data},this.peer);}
  receive(d){
    if(d.p!==this.profile.protocol)throw new Error('Opponent is using an incompatible game version');
    this.lastMessage=Date.now();
    if(d.type==='abort')return this.fail('Opponent could not continue the match',d.draw===true);
    if(d.type!=='hello')return;
    if(d.build!==this.build||d.seed!==this.seed||!validFighter(d.fighter,this.profile)||!validStage(d.stage??6,this.profile))
      throw new Error('Both players must use the same game build and match seed');
    if(this.otherFighter!==undefined&&this.otherFighter!==d.fighter)throw new Error('Opponent changed fighter during the round');
    if(this.otherStage!==undefined&&this.otherStage!==(d.stage??6))throw new Error('Opponent changed stage during the round');
    if(this.expectedFighters&&(d.fighter!==this.expectedFighters[1-this.seat]||(d.stage??6)!==this.stagePreference))throw new Error('Opponent changed the agreed fighter or stage');
    this.otherStage=d.stage??6;
    if(this.seat===1)this.stage=this.otherStage;
    this.otherFighter=d.fighter;this.peerReady=d.ready===true;
    if(!this.launched){this.launched=true;this.launch(this.seat===0?[this.fighter,d.fighter]:[d.fighter,this.fighter],this);}
    this.startIfReady();
  }
  attach(engine){
    if(this.closed){engine.destroy?.();return;}
    this.engine=engine;this.engineReady=true;this.lastHello=0;this.pulse();this.startIfReady();
  }
  startIfReady(){if(!this.closed&&!this.started&&this.engineReady&&this.peerReady){this.started=true;this.sync.start();}}
  pulse(){
    if(this.closed)return;const now=Date.now();
    if(!this.started&&now-this.startedAt>45000)return this.fail('The match could not finish loading');
    // Keep the ready handshake alive after our own start so the slower peer
    // also learns that both engines finished loading.
    if(now-this.lastHello>=1000){this.lastHello=now;this.send({type:'hello',build:this.build,seed:this.seed,fighter:this.fighter,stage:this.stagePreference,ready:!!this.engineReady});}
  }
  save(){return {version:1,frame:this.frame,terminal:this.terminal?structuredClone(this.terminal):null,engine:this.engine.save(this.frame)};}
  load(s){
    if(s?.version!==1||!Number.isInteger(s.frame)||s.frame<0)throw new Error('Invalid rollback checkpoint');
    this.engine.load(s.engine);this.frame=s.frame;this.terminal=s.terminal?structuredClone(s.terminal):null;
  }
  step(frame,inputs){
    if(this.closed)return;
    if(frame!==this.frame)throw new Error('Rollback simulation frame is out of order');
    const pads=this.players.map(id=>inputs[id]??neutral());
    if(!pads.every(validPad))throw new Error('Invalid remote controller input');
    if(!this.terminal){
      const [hash,result,stock0,stock1,ticks]=this.engine.step(pads);
      this.status(`Round ${this.round} · P${this.seat+1} · ${Math.max(0,480-Math.floor(ticks/60))}s remaining`);
      if(result>=0)this.terminal={frame,result,stocks:[stock0,stock1],hash};
    }
    this.frame=frame+1;
    // The SDK stalls before it can lead confirmed inputs by more than its
    // rollback window. Running past this guard proves the KO is confirmed.
    // Keep servicing inputs while holding the terminal engine state, so a
    // predicted KO can still be undone by load() before settlement.
    if(this.terminal&&frame-this.terminal.frame>MAX_ROLLBACK+2&&!this.reported){
      this.reported=true;
      const t=this.terminal,result=t.result===2?{draw:true}:{winner:this.players[t.result]};
      result.scores=Object.fromEntries(this.players.map((id,i)=>[id,Math.max(0,t.stocks[i])]));
      queueMicrotask(()=>{if(this.closed)return;if(this.onGameResult){this.sync.stop();this.onGameResult({result:t.result,hash:t.hash>>>0,stocks:t.stocks.map(n=>Math.max(0,n))});}else this.room.finish(result).catch(e=>this.fail('Result could not be confirmed: '+e.message));});
    }
  }
  fail(message,draw=false){
    if(this.closed)return;
    // Ready has already started the platform round even while native assets load.
    // Every technical failure is neutral, including failures before engine startup.
    draw=true;
    try{this.send({type:'abort',draw});}catch{}
    this.destroy();
    // Complete settlement before leaving; a synchronous leave here could
    // turn a local runtime/desync failure into an opponent's forfeit win.
    queueMicrotask(async()=>{
      try{if(draw&&this.room.playing)await this.room.finish({void:true});}catch{}
      this.stop(message);
    });
  }
  destroy(){if(this.closed)return;this.closed=true;clearInterval(this.timer);this.room.off('message',this.message);this.sync.stop();this.restoreSend?.();this.engine?.destroy?.();}
}

// A connection sends all its local participants together. Only the server's
// frozen participant roster can map those samples to native controller ports.
export class RollbackPartySession {
 constructor({room,round,participants,game=1,expectedFighters,stage,seed,build,readPorts,readInput,launch,status,stop,onGameResult,profile=ACTIVE_PROFILE}){
  Object.assign(this,{room,round,participants,game,expectedFighters,stage,seed,build,readPorts,readInput,launch,status,stop,onGameResult,profile});
  this.connections=[...new Set(participants.map(p=>p.connectionId))];this.local=participants.filter(p=>p.connectionId===room.me);this.frame=0;this.peers=new Map();this.startedAt=Date.now();this.terminal=null;
  if(!this.local.length||participants.length<2||participants.length>4||participants.some((p,i)=>!validFighter(expectedFighters[i],profile)))throw Error('Invalid player ports');
  this.signature=JSON.stringify({build,round,game,seed,stage,ports:participants.map((p,i)=>[p.id,p.connectionId,p.slot,p.localIndex,expectedFighters[i]])});
  this.sync=room.rollback({hz:60,delay:2,maxRollback:MAX_ROLLBACK,checksumEvery:30,stallTimeout:10000,
   input:()=>this.guard(()=>{const ports=this.local.length===1&&this.local[0].localIndex===0&&this.readInput?[this.readInput()]:this.readPorts();return this.local.map(p=>{const pad=ports[p.localIndex]||neutral();if(!validPad(pad))throw Error('Invalid local controller');return pad;});},this.local.map(()=>neutral())),
   step:(frame,inputs)=>this.guard(()=>this.step(frame,inputs)),save:()=>this.guard(()=>this.save(),{failed:true}),load:state=>this.guard(()=>this.load(state))});
  const send=room.send,receive=this.sync.receive?.bind(this.sync);
  this.scopedSend=(data,...args)=>send.call(room,data?._ls===1?{...data,os:[profile.protocol,round,game]}:data,...args);room.send=this.scopedSend;
  this.restoreSend=()=>{if(room.send===this.scopedSend)room.send=send;};
  if(receive)this.sync.receive=(from,data)=>{if(!this.closed&&data?.os?.[0]===profile.protocol&&data.os[1]===round&&data.os[2]===game)return receive(from,data);};
  for(const event of ['desync','timeout'])this.sync.on(event,()=>this.fail('The game could not stay synchronized.'));
  this.message=({from,data:d})=>{if(this.closed||from===room.me||!this.connections.includes(from)||d?.p!==profile.protocol||d.round!==round||d.game!==game)return;
   if(d.type==='abort')return this.fail('Another device could not continue the game.');
   if(d.type!=='ports-ready')return;
   if(d.signature!==this.signature)return this.fail('Players prepared different fighters or controller ports.');
   this.peers.set(from,d.ready===true);this.startIfReady();};
  room.on('message',this.message);this.timer=setInterval(()=>this.pulse(),500);
  this.launch(expectedFighters,this);this.pulse();
 }
 guard(fn,fallback){if(this.closed)return fallback;try{return fn();}catch(error){this.fail(error.message);return fallback;}}
 pulse(){if(this.closed)return;if(!this.started&&Date.now()-this.startedAt>90000)return this.fail('The game could not finish loading.');this.room.send({p:this.profile.protocol,round:this.round,game:this.game,type:'ports-ready',signature:this.signature,ready:!!this.engine});}
 attach(engine){if(this.closed)return engine.destroy?.();this.engine=engine;this.pulse();this.startIfReady();}
 startIfReady(){if(!this.started&&!this.closed&&this.engine&&this.connections.filter(id=>id!==this.room.me).every(id=>this.peers.get(id))){this.started=true;this.sync.start();}}
 save(){return {frame:this.frame,terminal:this.terminal?structuredClone(this.terminal):null,engine:this.engine.save(this.frame)};}
 load(state){if(!Number.isInteger(state?.frame))throw Error('Invalid checkpoint');this.engine.load(state.engine);this.frame=state.frame;this.terminal=state.terminal?structuredClone(state.terminal):null;}
 step(frame,inputs){
  if(frame!==this.frame)throw Error('Simulation frame is out of order');
  const pads=Array.from({length:4},()=>neutral());
  for(const connection of this.connections){const owned=this.participants.filter(p=>p.connectionId===connection);const samples=inputs[connection]??owned.map(()=>neutral());if(!Array.isArray(samples)||samples.length!==owned.length||samples.some(p=>!validPad(p)))throw Error('Invalid controller port bundle');owned.forEach((p,i)=>pads[p.slot]=samples[i]);}
  if(!this.terminal){const [hash,result,s0,s1,ticks,s2,s3,mask]=this.engine.step(pads);if(mask===undefined)throw Error('The game engine does not support online player slots.');
   this.status(`Game ${this.game} · ${Math.max(0,480-Math.floor(ticks/60))}s remaining`);
   if(result>=0){const winner=result===4?this.participants.length:this.participants.findIndex(p=>p.slot===result);if(winner<0)throw Error('The engine returned an unoccupied winning slot');this.terminal={frame,result:winner,stocks:this.participants.map(p=>[s0,s1,s2,s3][p.slot]),hash};}}
  this.frame=frame+1;
  if(this.terminal&&frame-this.terminal.frame>MAX_ROLLBACK+2&&!this.reported){this.reported=true;const t=this.terminal;queueMicrotask(()=>{if(!this.closed){this.sync.stop();this.onGameResult({result:t.result,hash:t.hash>>>0,stocks:t.stocks.map(n=>Math.max(0,n))});}});}
 }
 fail(message){if(this.closed)return;try{this.room.send({p:this.profile.protocol,round:this.round,game:this.game,type:'abort'});}catch{}this.destroy();Promise.resolve(this.room.finish({void:true})).catch(()=>{}).finally(()=>this.stop(message));}
 destroy(){if(this.closed)return;this.closed=true;clearInterval(this.timer);this.room.off('message',this.message);this.sync.stop();this.restoreSend?.();this.engine?.destroy?.();}
}
