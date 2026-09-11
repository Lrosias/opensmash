// Async host adapter. Only one command can own the native boundary at a time.
// Checkpoints stay in native storage; local handles are never sent to a peer.
export const neutralPad=()=>[0,0,0,0,0,0,0];
export function validPad(p) {
  return Array.isArray(p)&&p.length===7&&Number.isInteger(p[0])&&p[0]>=0&&p[0]<=4095&&
    p.slice(1,5).every(v=>Number.isFinite(v)&&v>=-128/127&&v<=1)&&p.slice(5).every(v=>Number.isFinite(v)&&v>=0&&v<=1);
}
export class NativeRollbackEngine {
  constructor(module,{timeout=30000}={}) {
    this.module=module;this.timeout=timeout;this.sequence=0;this.active=false;this.closed=false;
  }
  receive(sequence,status,frame,handle,hash,bytes,ms,active=0,outcome=0,stocks0=0,stocks1=0,percent0=0,percent1=0,seconds=0,gameFrame=0,packedConfig=-1,stocks2=0,stocks3=0,percent2=0,percent3=0,fighter2=0,fighter3=0,mask=3) {
    const pending=this.pending;
    if(!pending||pending.sequence!==sequence)return;
    clearTimeout(pending.timer);this.pending=null;
    if(status!==1){this.closed=true;pending.reject(Error(`Melee checkpoint operation failed (${status})`));return;}
    this.frame=frame;
    const slots=[0,1,2,3].filter(slot=>mask&(1<<slot));
    const stocks=[stocks0,stocks1,stocks2,stocks3],percent=[percent0,percent1,percent2,percent3];
    const fighters=[packedConfig&255,(packedConfig>>>8)&255,fighter2,fighter3];
    let result=null;
    if(active&&outcome){
      if(outcome!==1&&outcome!==2){pending.reject(Error('Melee ended without a competitive result.'));return;}
      const ranked=slots.slice().sort((a,b)=>stocks[b]-stocks[a]||percent[a]-percent[b]);
      const [a,b]=ranked;
      const winner=a===undefined||b===undefined||stocks[a]===stocks[b]&&percent[a]===percent[b]?null:a;
      result={winner,outcome,stocks:slots.map(i=>stocks[i]),percent:slots.map(i=>percent[i]),seconds,gameFrame};
    }
    pending.resolve({frame,handle,hash:hash>>>0,checksum:String(hash>>>0),bytes,ms,result,active:!!active,
      match:{slots,stocks:slots.map(i=>stocks[i]),percent:slots.map(i=>percent[i]),seconds,gameFrame,outcome,
        fighters:packedConfig<0?[]:slots.map(i=>fighters[i]),stage:packedConfig<0?-1:packedConfig>>>16}});
  }
  wait(sequence,send) {
    if(this.closed)return Promise.reject(Error('Melee rollback engine is closed'));
    if(this.pending)return Promise.reject(Error('Overlapping Melee frame commands'));
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{this.pending=null;this.closed=true;reject(Error('Melee frame command timed out; reload the engine'));},this.timeout);
      this.pending={sequence,resolve,reject,timer};
      try {if(!send())throw Error('Melee engine rejected the frame command');}
      catch(error){clearTimeout(timer);this.pending=null;reject(error);}
    });
  }
  async enable() {
    if(this.active)throw Error('Melee rollback is already active');
    this.active=true;
    try{return await this.wait(0,()=>this.module._melee_rb_enable());}
    catch(error){this.active=false;throw error;}
  }
  waitForBoot() {
    if(this.active)throw Error('Melee rollback is already active');
    this.active=true;
    return this.wait(0,()=>true);
  }
  command(op,arg=0,replaying=false) {
    if(!this.active)return Promise.reject(Error('Melee rollback is not active'));
    const seq=++this.sequence;
    return this.wait(seq,()=>this.module._melee_rb_command(seq,op,arg,replaying?1:0));
  }
  save(){return this.command(1);}
  load(checkpoint){
    if(!Number.isInteger(checkpoint?.handle)||checkpoint.handle<=0)return Promise.reject(Error('Invalid native checkpoint'));
    return this.command(2,checkpoint.handle);
  }
  step(inputs,{replaying=false}={}) {
    if(!this.active||this.closed)return Promise.reject(Error('Melee rollback is not active'));
    if(this.pending)return Promise.reject(Error('Overlapping Melee frame commands'));
    if(!Array.isArray(inputs)||inputs.length!==4||inputs.some(p=>!validPad(p)))
      return Promise.reject(Error('Expected four complete GameCube input samples'));
    inputs.forEach((pad,seat)=>this.module._melee_input(seat,...pad));
    return this.command(3,0,replaying);
  }
  inspect(){return this.command(5);}
  discard(checkpoint){
    if(!Number.isInteger(checkpoint?.handle)||checkpoint.handle<=0)return Promise.reject(Error('Invalid native checkpoint'));
    return this.command(6,checkpoint.handle);
  }
  async checkpointStats(){const result=await this.command(7);return {count:result.handle,scratchBytes:result.bytes};}
  manageCheckpoints(){return this.command(8);}
  async release(){const result=await this.command(4);this.active=false;return result;}
  destroy(){this.closed=true;if(this.pending){clearTimeout(this.pending.timer);this.pending.reject(Error('Melee rollback stopped'));this.pending=null;}}
}
