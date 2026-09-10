import {CompetitiveSet,COMPETITIVE_PROTOCOL,MELEE_RULES,validSelection} from './competitive-rules.mjs';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);

// One SDK round is one BO3 set (one game in Casual/Friends). This controls menus,
// not rollback: the injected adapter must return only confirmed engine outcomes.
export class MeleeCompetitiveRoom {
  constructor({room,build,selection,adapter,bag=null,onChange=()=>{},onError=()=>{},onResult=()=>{}}){
    this.room=room;this.build=build;this.adapter=adapter;this.onChange=onChange;this.onError=onError;this.onResult=onResult;
    this.players=room.players.map(p=>p.id);this.seat=this.players.indexOf(room.me);this.round=room.round;
    if(this.players.length!==2||new Set(this.players).size!==2||this.seat<0||!validSelection(selection)||!build||!adapter?.prepare||!adapter?.play||!adapter?.stop)
      throw Error('Competitive play requires two players and a confirmed-result engine adapter');
    this.host=this.players[0];this.local={build,rules:MELEE_RULES.id,selection,bag};this.queued=[];this.requests=0;this.seen=[0,0];this.reports=[null,null];
    this.message=e=>{try{this.receive(e);}catch(e){this.fail(e);}};
    this.leave=player=>this.opponentLeft(player);
    this.close=()=>this.fail(Error('The connection closed. Return to the online menu.'));
    this.result=result=>{if(!this.settled&&result?.round===this.round){this.settled=true;this.stop();this.onResult(result);}};
    room.on('message',this.message);room.on('leave',this.leave);room.on('close',this.close);room.on('result',this.result);
    this.timer=setInterval(()=>{if(!this.model)this.hello();},1000);
    this.deadline=setTimeout(()=>{if(!this.model)this.fail(Error('Both players could not finish set setup.'));},30000);
    this.hello();
  }
  send(kind,data){this.room.send({p:COMPETITIVE_PROTOCOL,round:this.round,kind,data},this.players[1-this.seat]);}
  hello(){if(!this.closed)this.send('hello',{...this.local,ack:!!this.peer});}
  receive({from,data:d}){
    if(this.closed||from!==this.players[1-this.seat]||d?.p!==COMPETITIVE_PROTOCOL||d.round!==this.round)return;
    if(d.kind==='hello'){
      const p=d.data;
      if(!p||p.build!==this.build||p.rules!==MELEE_RULES.id||!validSelection(p.selection)||!same(p.bag,this.local.bag))throw Error('Opponent has an incompatible build, ruleset or stage rotation.');
      const value={build:p.build,rules:p.rules,selection:p.selection,bag:p.bag};
      if(this.peer&&!same(this.peer,value))throw Error('Opponent changed their locked selection.');
      const first=!this.peer;this.peer=value;if(first)this.hello();
      if(!p.ack||this.model)return;
      this.model=new CompetitiveSet({mode:this.room.ranked?'ranked':this.room.queue==='private'?'friends':'casual',seed:this.room.seed>>>0,round:this.round,bag:this.local.bag});
      const choices=this.seat===0?[this.local.selection,this.peer.selection]:[this.peer.selection,this.local.selection];
      choices.forEach((selection,seat)=>this.model.apply(seat,{type:'character',selection}));
      clearInterval(this.timer);clearTimeout(this.deadline);
      this.hello();
      for(const event of this.queued.splice(0))this.receive(event);
      this.changed();return;
    }
    if(!this.model){if(this.queued.length>=64)throw Error('Too many setup messages');this.queued.push({from,data:d});return;}
    if(d.kind==='request'&&this.seat===0)this.accept(1,d.data);
    else if(d.kind==='commit'&&from===this.host){
      const {revision,seat,action}=d.data;
      if(revision<=this.model.state.revision)return;
      if(revision!==this.model.state.revision+1)throw Error('Set actions arrived out of order');
      this.model.apply(seat,action);this.changed();
    }else if(d.kind==='report'&&this.seat===0)this.report(1,d.data);
    else if(d.kind==='game-result'&&from===this.host){
      const {revision,result}=d.data;
      if(revision<=this.model.state.revision)return;
      if(revision!==this.model.state.revision+1||!same(this.reports[this.seat],result))throw Error('Players disagree on the confirmed game result');
      this.model.recordConfirmed(result);this.reports=[null,null];this.changed();
    }else if(d.kind==='abort')this.fail(Error('Your opponent could not continue this set.'),false);
  }
  action(action){
    if(this.closed||!this.model)return;
    const s=this.model.state,data={id:++this.requests,game:s.game,phase:s.phase,action};
    if(this.seat===0)this.accept(0,data);else this.send('request',data);
  }
  accept(seat,data){
    if(!data||!Number.isSafeInteger(data.id)||data.id<1)throw Error('Invalid action sequence');
    if(data.id<=this.seen[seat])return;
    this.seen[seat]=data.id;
    const s=this.model.state;
    if(data.game!==s.game||data.phase!==s.phase)return; // a double click from the previous screen
    this.model.apply(seat,data.action);
    this.send('commit',{revision:s.revision,seat,action:data.action});this.changed();
  }
  report(seat,result){
    if(this.closed)return;
    const s=this.model.state;
    if(!result||result.game!==s.game||s.phase!=='playing')return;
    if(this.reports[seat]){if(!same(this.reports[seat],result))throw Error('A confirmed result changed');return;}
    this.reports[seat]=result;
    if(!this.reports.every(Boolean))return;
    if(!same(this.reports[0],this.reports[1]))throw Error('Players disagree on the confirmed game result');
    this.model.recordConfirmed(result);this.reports=[null,null];
    this.send('game-result',{revision:this.model.state.revision,result});this.changed();
  }
  changed(){
    if(this.closed)return;
    const s=this.model.snapshot;this.onChange(s,this.model);
    if(s.phase==='ready'&&this.preparing!==s.game){
      this.preparing=s.game;const launch=this.model.launch;
      Promise.resolve().then(()=>this.adapter.prepare(launch)).then(()=>{
        if(!this.closed&&this.model.state.game===launch.game&&this.model.state.phase==='ready')this.action({type:'ready'});
      }).catch(e=>this.fail(e));
    }
    if(s.phase==='playing'&&this.playing!==s.game){
      this.playing=s.game;const launch=this.model.launch;
      Promise.resolve().then(()=>this.adapter.play(launch)).then(result=>{
        if(this.closed)return;
        if(result?.confirmed!==true)throw Error('Engine returned a speculative result');
        const report={game:launch.game,winner:result.winner,frame:result.frame,checksum:result.checksum};
        if(this.seat===0)this.report(0,report);
        else {this.reports[1]=report;this.send('report',report);}
      }).catch(e=>this.fail(e));
    }
    if(s.phase==='complete'&&!this.finishing){
      this.finishing=true;
      const winner=s.scores[0]===s.scores[1]?null:this.players[s.scores[0]>s.scores[1]?0:1];
      const result={...(winner===null?{draw:true}:{winner}),scores:Object.fromEntries(this.players.map((id,i)=>[id,s.scores[i]]))};
      Promise.resolve().then(()=>this.room.finish(result)).then(this.result).catch(e=>this.fail(e));
    }
  }
  opponentLeft(player){
    if(this.closed||this.settled||player?.id!==this.players[1-this.seat])return;
    if(!this.room.playing)return this.fail(Error('Your opponent left before the round started.'),false);
    // A real platform departure is a forfeit, not an engine or transport failure.
    // Stop immediately; a previously submitted completed set keeps its result.
    this.stop();
    if(this.finishing)return;
    this.finishing=true;
    Promise.resolve().then(()=>this.room.finish({winner:this.room.me})).then(this.result).catch(error=>this.onError(error));
  }
  fail(error,notify=true){if(this.closed)return;if(notify){try{this.send('abort',{});}catch{}}this.stop();if(!this.settled&&!this.finishing){this.finishing=true;Promise.resolve(this.room.finish({void:true})).catch(()=>{});}this.onError(error);}
  stop(){if(this.closed)return this.stopping;this.closed=true;clearInterval(this.timer);clearTimeout(this.deadline);this.room.off('message',this.message);this.room.off('leave',this.leave);this.room.off('close',this.close);this.room.off('result',this.result);return this.stopping=Promise.resolve(this.adapter.stop()).catch(()=>{});}
}
