import {neutralPad,validPad} from './rollback-engine.mjs';
import {createMeleeSync} from './rollback-sdk.mjs';

// One native engine belongs to one game. The SDK owns input confirmation and
// checkpoint lifetimes; the set controller owns scoring and counterpicks.
export class MeleeMatchAdapter {
  constructor({room,build,createEngine,input,onStatus=()=>{},maxRollback=0,delay=3}) {
    this.room=room;this.build=build;this.createEngine=createEngine;this.input=input;
    this.onStatus=onStatus;this.maxRollback=maxRollback;this.delay=delay;
    this.players=room.players.map(p=>p.id);this.round=room.round;
    if(typeof room.rollbackAsync!=='function')throw Error('Update the uGames player to enable Melee online.');
  }
  async prepare(launch) {
    await this.endGame();
    if(this.closed)throw Error('Set has ended.');
    this.launch=launch;this.cacheSaved=false;
    this.protocol=`melee-native-v1:${this.build}:${this.round}:${launch.game}`;
    this.signature=JSON.stringify(launch);
    this.peer=null;this.initial=null;
    this.bootAbort=new AbortController();
    this.barrier=new Promise((resolve,reject)=>{this.barrierResolve=resolve;this.barrierReject=reject;});
    // Install before the local download/boot: the other player may already be ready.
    this.message=({from,data})=>{
      if(!this.players.includes(from)||from===this.room.me||data?.p!==this.protocol||data.kind!=='engine-ready')return;
      if(data.signature!==this.signature||typeof data.checksum!=='string')return this.barrierReject(Error('Players prepared different match configurations.'));
      if(this.peer&&this.peer.checksum!==data.checksum)return this.barrierReject(Error('Opponent changed their initial game state.'));
      const first=!this.peer;this.peer=data;
      if(this.initial&&data.checksum!==this.initial)return this.barrierReject(Error('The two engines did not start in the same state.'));
      if(first)this.hello();
      if(this.initial&&data.ack)this.barrierResolve();
    };
    this.room.on('message',this.message);
    this.barrierTimer=setInterval(()=>this.hello(),500);
    this.barrierDeadline=setTimeout(()=>this.barrierReject(Error('Match preparation timed out. No result will be recorded.')),120000);
    // Attach immediately so an early peer failure cannot become an unhandled rejection.
    const barrier=this.barrier;barrier.catch(()=>{});
    try {
      this.engine=await this.createEngine(launch,this.onStatus,this.bootAbort.signal);
      if(this.closed){await this.engine.destroy();throw Error('Set has ended.');}
      const match=this.engine.initial.match;
      if(!match||match.stage!==launch.stage||JSON.stringify(match.fighters)!==JSON.stringify(launch.selections.map(s=>s.fighter)))
        throw Error('The engine started with different fighters or stage than the locked selections.');
      this.initial=String(this.engine.initial.checksum);
      if(this.peer&&this.peer.checksum!==this.initial)throw Error('The two engines did not start in the same state.');
      this.hello();await barrier;
    } finally {
      clearInterval(this.barrierTimer);clearTimeout(this.barrierDeadline);
      this.room.off('message',this.message);this.message=null;
    }
    // Register before either player can leave the menus, retaining early inputs.
    this.bridge=await createMeleeSync({room:this.room,engine:this.engine,protocol:this.protocol,
      delay:this.delay,maxRollback:this.maxRollback,
      input:frame=>{const pad=this.input(frame);return validPad(pad)?pad.map((v,i)=>i?Math.round(v*100000)/100000:v):neutralPad();}});
    this.sync=this.bridge.sync;
  }
  hello(){
    if(!this.initial||this.closed)return;
    this.room.send({p:this.protocol,kind:'engine-ready',signature:this.signature,checksum:this.initial,ack:!!this.peer});
  }
  play() {
    if(!this.sync||this.closed)return Promise.reject(Error('Melee is not ready.'));
    return new Promise((resolve,reject)=>{
      this.playReject=reject;let ending=false;
      const fail=error=>{if(ending)return;ending=true;reject(error instanceof Error?error:Error('The match connection ended. No result will be recorded.'));};
      for(const event of ['error','desync','timeout','leave'])this.sync.on(event,fail);
      for(const event of ['stall','resume','overload','recovered'])this.sync.on(event,()=>this.onStatus({event}));
      this.sync.on('confirmed',({frame,output})=>{
        if(ending||!output.result)return;
        const {winner}=output.result;
        if(![0,1,null].includes(winner)){fail(Error('Engine returned an invalid match result.'));return;}
        ending=true;
        // Stop finishes any in-flight operation and releases all opaque checkpoints.
        this.sync.stop().then(()=>this.persistCache()).then(()=>resolve({confirmed:true,winner,frame,checksum:String(output.checksum)}),reject);
      });
      this.engine.show();this.sync.start();
    });
  }
  async endGame() {
    clearInterval(this.barrierTimer);clearTimeout(this.barrierDeadline);
    if(this.message)this.room.off('message',this.message);
    this.message=null;
    this.barrierReject?.(Error('Set has ended.'));
    if(!this.engine)this.bootAbort?.abort();
    await this.sync?.stop();this.sync=null;
    await this.persistCache();
    this.bootAbort?.abort();this.bootAbort=null;
    await this.engine?.destroy();this.engine=null;
  }
  async persistCache(){
    if(!this.engine?.saveCache||this.engine.closed||this.cacheSaved)return;
    this.cacheSaved=true;
    // Cache persistence is optional and bounded; it cannot trap Leave or rematch.
    let timer;
    try{await Promise.race([this.engine.saveCache(),new Promise(resolve=>{timer=setTimeout(resolve,1000);})]);}
    catch{}finally{clearTimeout(timer);}
  }
  stop(){
    if(this.closed)return this.stopping;
    this.closed=true;this.playReject?.(Error('Set has ended.'));
    // Explicit departure/failure terminates an in-flight native operation now.
    // The SDK then drains ownership against a closed engine without issuing RPCs.
    this.bootAbort?.abort();this.engine?.destroy();
    return this.stopping=this.endGame();
  }
}
