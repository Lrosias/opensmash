// Transport-independent asynchronous rollback. Network reception and sampling
// keep running while the engine worker owns one awaited operation at a time.
const copy=value=>structuredClone(value);
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export class AsyncRollbackTimeline {
  constructor({players,me,engine,neutral,input,send,onConfirm=()=>{},onError=()=>{},maxRollback=7,delay=2}) {
    if(players.length!==2||!players.includes(me))throw Error('Rollback requires two distinct peers');
    if(new Set(players).size!==2||!Number.isInteger(maxRollback)||maxRollback<1||maxRollback>7||!Number.isInteger(delay)||delay<0||delay>15)
      throw Error('Invalid rollback configuration');
    Object.assign(this,{players:[...players],me,engine,neutral,input,send,onConfirm,onError,maxRollback,delay});
    this.frame=0;this.clock=0;this.recorded=delay-1;this.confirmed=-1;this.rollbacks=0;this.replayedFrames=0;
    this.inputs=new Map(players.map(id=>[id,new Map()]));this.known=new Map(players.map(id=>[id,delay-1]));
    for(const map of this.inputs.values())for(let f=0;f<delay;f++)map.set(f,copy(neutral));
    this.states=new Map();this.used=new Map();this.outputs=new Map();this.dirty=Infinity;this.closed=false;
  }
  minimumKnown(){return Math.min(...this.known.values());}
  tick() {
    if(this.closed)return;
    try {
    // Bound recording lead even when simulation is overloaded or a tab resumes.
    if(this.clock-this.frame<2){
      this.clock++;const f=++this.recorded,local=this.inputs.get(this.me);
      local.set(f,copy(this.input()));this.known.set(this.me,f);
    }
    const map=this.inputs.get(this.me),start=Math.max(0,this.recorded-31),entries=[];
    for(let f=start;f<=this.recorded;f++)if(map.has(f))entries.push([f,copy(map.get(f))]);
    this.send(entries);
    return this.drain();
    }catch(error){this.fail(error);}
  }
  receive(peer,entries) {
    if(this.closed||peer===this.me||!this.inputs.has(peer))return;
    try {
      if(!Array.isArray(entries)||entries.length>32)throw Error('Invalid input bundle');
      const map=this.inputs.get(peer);
      for(const entry of entries){
        if(!Array.isArray(entry)||entry.length!==2)throw Error('Invalid input entry');
        const [f,value]=entry;
        if(!Number.isSafeInteger(f)||f<0||f>this.recorded+120)throw Error('Input frame is outside the receive window');
        if(f<this.frame-this.maxRollback-32)continue;
        if(map.has(f)&&!equal(map.get(f),value))throw Error('Peer changed an already received input');
        map.set(f,copy(value));
        const predicted=this.used.get(f)?.[peer];
        if(predicted!==undefined&&!equal(predicted,value))this.dirty=Math.min(this.dirty,f);
      }
      let known=this.known.get(peer);while(map.has(known+1))known++;
      this.known.set(peer,known);
      return this.drain();
    }catch(error){this.fail(error);}
  }
  frameInputs(f) {
    return Object.fromEntries(this.players.map(id=>{
      const map=this.inputs.get(id);let value=map.get(f);
      if(value===undefined){let previous=f-1;while(previous>=0&&!map.has(previous))previous--;value=map.get(previous)??this.neutral;}
      return [id,copy(value)];
    }));
  }
  drain() {
    if(this.running)return this.running;
    this.running=this.run().catch(error=>this.fail(error)).finally(()=>{this.running=null;});
    return this.running;
  }
  async simulate(replaying) {
    const f=this.frame;
    const state=await this.engine.save();
    if(this.closed)return;
    this.states.set(f,state);
    const inputs=this.frameInputs(f);this.used.set(f,copy(inputs));
    const result=await this.engine.step(inputs,{frame:f,replaying});
    if(this.closed)return;
    this.outputs.set(f,result);this.frame=f+1;
  }
  async run() {
    while(!this.closed) {
      if(this.dirty<this.frame){
        const from=this.dirty,target=this.frame,state=this.states.get(from);this.dirty=Infinity;
        if(from<=this.confirmed||!this.states.has(from)||target-from>this.maxRollback+1)throw Error('Correction is outside retained history');
        await this.engine.load(state);if(this.closed)return;
        this.frame=from;this.rollbacks++;this.replayedFrames+=target-from;
        for(let f=from;f<target&&!this.closed;f++)await this.simulate(true);
        continue;
      }
      // Confirmation cannot run while an asynchronous step is still in flight.
      const confirmed=Math.min(this.frame-1,this.minimumKnown());
      while(this.confirmed<confirmed){
        const f=++this.confirmed;this.onConfirm(f,this.outputs.get(f));
      }
      const floor=this.frame-this.maxRollback-2;
      for(const map of [this.states,this.used,this.outputs])for(const f of map.keys())if(f<floor)map.delete(f);
      for(const map of this.inputs.values())for(const f of map.keys())if(f<floor-32)map.delete(f);
      if(this.frame>=this.clock||this.frame>this.minimumKnown()+this.maxRollback)return;
      await this.simulate(false);
    }
  }
  fail(error){if(this.closed)return;this.closed=true;this.onError(error);}
  stop(){this.closed=true;}
}
