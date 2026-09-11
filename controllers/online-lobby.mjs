// Game-owned selection and readiness. YouGame carries membership and opaque messages.
const copy=value=>structuredClone(value);
export class GameLobby {
 constructor({room,protocol,validSelection,onChange=()=>{},onStart=()=>{},onError=()=>{}}){
  Object.assign(this,{room,protocol,validSelection,onChange,onStart,onError});
  this.choices=new Map();this.sequence=0;this.seen=new Map();this.revision=room.revision;this.round=room.round;this.listeners=[];
  this.listen('message',e=>this.receive(e));
  for(const event of ['lobby','join','leave','participants','roster','settings'])this.listen(event,()=>this.refresh());
  this.listen('ready',()=>this.started());
  this.timer=setInterval(()=>{if(!this.closed){this.refresh();this.send();}},750);
  this.refresh();
 }
 listen(event,fn){this.room.on(event,fn);this.listeners.push([event,fn]);}
 get members(){return this.room.participants||[];}
 get activeHere(){return this.room.playing&&(this.room.matchParticipants||[]).some(p=>p.connectionId===this.room.me);}
 refresh(){
  if(this.closed)return;
  if(this.revision!==this.room.revision||this.round!==this.room.round){
   this.revision=this.room.revision;this.round=this.room.round;this.seen.clear();this.starting=false;
   if(!this.activeHere)for(const choice of this.choices.values())choice.ready=false;
  }
  const ids=new Set(this.members.map(p=>p.id));for(const id of this.choices.keys())if(!ids.has(id))this.choices.delete(id);
  this.publish();
 }
 view(){
  const participants=this.members.slice().sort((a,b)=>a.slot-b.slot).map(p=>({...p,...copy(this.choices.get(p.id)||{selection:null,ready:false}),local:p.connectionId===this.room.me}));
  return {participants,capacity:this.room.capacity||this.room.maxPlayers||this.room.size||4,revision:this.revision,
   canStart:!this.room.playing&&!this.starting&&participants.length>=(this.room.lobby?.minPlayers||this.room.minPlayers||2)&&participants.every(p=>p.ready&&this.validSelection(p.selection)),
   host:this.room.isHost,starting:this.starting,playing:this.room.playing,waitingNext:this.room.playing&&!this.activeHere};
 }
 publish(){const view=this.view(),signature=JSON.stringify(view);if(signature!==this.lastView){this.lastView=signature;this.onChange(view);}}
 local(id){return this.members.find(p=>p.id===id&&p.connectionId===this.room.me);}
 pick(id,selection){
  if(this.closed||this.activeHere||this.starting)return;
  if(!this.local(id)||!this.validSelection(selection))throw Error('Invalid local fighter selection');
  this.choices.set(id,{selection:copy(selection),ready:false});this.send();this.publish();
 }
 toggleReady(id){
  if(this.closed||this.activeHere||this.starting)return;
  const choice=this.choices.get(id);if(!this.local(id)||!choice||!this.validSelection(choice.selection))throw Error('Select a fighter first');
  choice.ready=!choice.ready;this.send();this.publish();
 }
 send(){
  if(this.closed||this.activeHere)return;
  const choices=this.members.filter(p=>p.connectionId===this.room.me).map(p=>({id:p.id,...copy(this.choices.get(p.id)||{selection:null,ready:false})}));
  this.room.send({p:this.protocol,type:'lobby',revision:this.room.revision,round:this.room.round,sequence:++this.sequence,choices});
 }
 receive({from,data:d}){
  if(this.closed||this.activeHere||from===this.room.me||d?.p!==this.protocol||d.type!=='lobby'||d.revision!==this.room.revision||d.round!==this.room.round)return;
  if(!Number.isSafeInteger(d.sequence)||d.sequence<1||d.sequence<=(this.seen.get(from)||0)||!Array.isArray(d.choices))return;
  const owned=this.members.filter(p=>p.connectionId===from);
  if(d.choices.length!==owned.length||new Set(d.choices.map(c=>c.id)).size!==owned.length)return;
  if(d.choices.some(c=>!owned.some(p=>p.id===c.id)||typeof c.ready!=='boolean'||(c.selection!==null&&!this.validSelection(c.selection))||(c.ready&&c.selection===null)))return;
  this.seen.set(from,d.sequence);for(const c of d.choices)this.choices.set(c.id,{selection:copy(c.selection),ready:c.ready});this.publish();
 }
 async start(){
  this.refresh();if(!this.room.isHost||!this.view().canStart)return;
  this.starting=true;this.publish();
  try{await this.room.beginMatch({revision:this.revision});}catch(error){this.starting=false;this.onError(error);this.refresh();}
 }
 started(){
  if(this.closed||this.startedRound===this.room.round)return;
  const frozen=this.room.matchParticipants||this.members;
  if(!frozen.some(p=>p.connectionId===this.room.me))return;
  const participants=frozen.slice().sort((a,b)=>a.slot-b.slot).map(p=>({...p,...copy(this.choices.get(p.id)||{selection:null,ready:false}),local:p.connectionId===this.room.me}));
  if(participants.length<2||participants.some(p=>!p.ready||!this.validSelection(p.selection))){this.room.finish({void:true}).catch(()=>{});this.onError(Error('Lobby selections changed before the match started.'));return;}
  this.startedRound=this.room.round;this.starting=false;this.onStart(participants);
 }
 resume(){this.lastView=null;for(const c of this.choices.values())c.ready=false;this.starting=false;this.refresh();this.send();}
 destroy(){if(this.closed)return;this.closed=true;clearInterval(this.timer);for(const [event,fn]of this.listeners)this.room.off(event,fn);}
}
