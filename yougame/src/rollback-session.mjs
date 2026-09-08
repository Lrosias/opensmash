import {validPad, neutral} from './lockstep.mjs';

export const ROLLBACK_PROTOCOL='opensmash-rollback-v1';
export const MAX_ROLLBACK=10;

// YouGame owns the input timeline. The engine owns its checkpoint format.
// No result may escape from the speculative part of that timeline.
export class RollbackDuelSession {
  constructor({room,round,fighter,build,readInput,launch,status,stop,seed}) {
    Object.assign(this,{room,round,fighter,build,readInput,launch,status,stop,seed});
    this.players=room.players.map(p=>p.id);this.seat=this.players.indexOf(room.me);
    if(this.players.length!==2||this.seat<0)throw new Error('A duel requires two human players');
    if(typeof room.rollback!=='function')throw new Error('YouGame rollback is unavailable. Reload the game.');
    this.peer=this.players[1-this.seat];this.frame=0;this.terminal=null;this.lastHello=0;
    this.startedAt=Date.now();this.lastMessage=this.startedAt;
    this.sync=room.rollback({hz:60,delay:2,maxRollback:MAX_ROLLBACK,checksumEvery:30,stallTimeout:10000,
      input:()=>this.guard(()=>{const p=this.readInput();if(!validPad(p))throw new Error('Invalid local controller input');return p;},neutral()),
      step:(f,inputs)=>this.guard(()=>this.step(f,inputs)),save:()=>this.guard(()=>this.save(),{failed:true}),load:s=>this.guard(()=>this.load(s))});
    this.sync.on('desync',()=>this.fail('Game states diverged. The match has been ended as a draw.',true));
    this.sync.on('timeout',()=>this.fail('Connection stalled. The match has been ended as a draw.',true));
    this.sync.on('stall',()=>this.status('WAITING FOR OPPONENT'));
    this.message=e=>{if(this.closed||e.from!==this.peer||e.data?.round!==this.round)return;
      try{this.receive(e.data);}catch(error){this.fail(error.message);}};
    room.on('message',this.message);
    this.timer=setInterval(()=>{try{this.pulse();}catch(error){this.fail(error.message);}},250);
    this.pulse();
  }
  guard(fn,fallback){if(this.closed)return fallback;try{return fn();}catch(e){this.fail(e.message);return fallback;}}
  send(data){this.room.send({p:ROLLBACK_PROTOCOL,round:this.round,...data},this.peer);}
  receive(d){
    if(d.p!==ROLLBACK_PROTOCOL)throw new Error('Opponent is using an incompatible game version');
    this.lastMessage=Date.now();
    if(d.type==='abort')return this.fail('Opponent could not continue the match',d.draw===true);
    if(d.type!=='hello')return;
    if(d.build!==this.build||d.seed!==this.seed||!Number.isInteger(d.fighter)||d.fighter<0||d.fighter>11)
      throw new Error('Both players must use the same game build and match seed');
    if(this.otherFighter!==undefined&&this.otherFighter!==d.fighter)throw new Error('Opponent changed fighter during the round');
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
    if(now-this.lastHello>=1000){this.lastHello=now;this.send({type:'hello',build:this.build,seed:this.seed,fighter:this.fighter,ready:!!this.engineReady});}
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
      queueMicrotask(()=>{if(!this.closed)this.room.finish(result).catch(e=>this.fail('Result could not be confirmed: '+e.message));});
    }
  }
  fail(message,draw=false){
    if(this.closed)return;
    draw=draw||!!this.started;
    try{this.send({type:'abort',draw});}catch{}
    this.destroy();
    // Complete settlement before leaving; a synchronous leave here could
    // turn a local runtime/desync failure into an opponent's forfeit win.
    queueMicrotask(async()=>{
      try{if(draw&&this.room.playing)await this.room.finish({draw:true});}catch{}
      this.stop(message);
    });
  }
  destroy(){if(this.closed)return;this.closed=true;clearInterval(this.timer);this.room.off('message',this.message);this.sync.stop();this.engine?.destroy?.();}
}
