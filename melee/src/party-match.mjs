import {MELEE_RULES} from './competitive-rules.mjs';

// Friend play uses the occupied controller ports, including local guests. New
// lobby members remain outside this match's immutable participant snapshot.
export class MeleePartyMatch {
  constructor({room,participants,adapter,onChange=()=>{},onError=()=>{},onResult=()=>{}}){
    Object.assign(this,{room,participants:structuredClone(participants),adapter,onChange,onError,onResult});
    this.round=room.round;
    this.connections=new Set(participants.map(p=>p.connectionId));
    this.result=event=>{if(!this.closed&&!this.settled&&event.round===this.round){this.settled=true;this.stop();onResult(event);}};
    this.leave=player=>{if(this.connections.has(player.id)&&!this.settled)this.fail(Error('A player left the game.'));};
    this.close=()=>{if(!this.settled)this.fail(Error('The lobby connection closed.'));};
    room.on('result',this.result);room.on('leave',this.leave);room.on('close',this.close);
    this.run().catch(error=>this.fail(error));
  }
  async run(){
    this.onChange('preparing');
    const launch={round:this.round,game:1,seed:this.room.seed>>>0,stage:31,rules:MELEE_RULES,
      selections:this.participants.map(p=>p.selection),slots:this.participants.map(p=>p.slot)};
    await this.adapter.prepare(launch);if(this.closed)return;
    this.onChange('playing');
    const result=await this.adapter.play();if(this.closed)return;
    if(result?.confirmed!==true)throw Error('The engine result has not been confirmed.');
    const winner=result.winner===null?null:this.participants.find(p=>p.slot===result.winner)?.id;
    if(result.winner!==null&&!winner)throw Error('The engine reported an unoccupied winning port.');
    const outcome=winner?{winner}:{draw:true};
    this.onChange('confirming');
    await this.room.reportGame({id:'game-1',...outcome});if(this.closed)return;
    const accepted=await this.room.completeMatch(outcome);if(!this.closed)this.result(accepted);
  }
  fail(error){
    if(this.closed)return;
    this.stop();
    if(!this.settled&&this.room.playing)this.room.completeMatch({void:true}).catch(()=>{});
    this.onError(error);
  }
  stop(){
    if(this.closed)return this.stopping;
    this.closed=true;this.room.off('result',this.result);this.room.off('leave',this.leave);this.room.off('close',this.close);
    return this.stopping=Promise.resolve(this.adapter.stop()).catch(()=>{});
  }
}
