import {validFighter,ACTIVE_PROFILE} from './game-profile.mjs';
export const COMPETITIVE_MODE=ACTIVE_PROFILE.mode;
export const FIGHTER_NAMES={0:'Mario',1:'Fox',2:'Donkey Kong',3:'Samus',4:'Luigi',5:'Link',6:'Yoshi',7:'Captain Falcon',8:'Kirby',9:'Pikachu',10:'Jigglypuff',11:'Ness',29:'Falco',30:'Ganondorf',31:'Young Link',32:'Dr. Mario',33:'Wario',52:'Bowser',55:'Wolf',56:'Conker',57:'Mewtwo',58:'Marth',59:'Sonic',62:'Sheik',63:'Marina',64:'Dedede',65:'Goemon',68:'Banjo & Kazooie',73:'Peach',72:'Crash',34:'Dark Samus',38:'Lucas',74:'Roy',75:'Dr. Luigi'};
export const STAGE_NAMES={0:'Peach’s Castle',1:'Sector Z',2:'Kongo Jungle',3:'Planet Zebes',4:'Hyrule Castle',5:'Yoshi’s Island',7:'Saffron City',8:'Mushroom Kingdom',6:'Dream Land',16:'Final Destination',9:'Frays Stage',10:'First Destination',11:'Pokémon Stadium',12:'Pokémon Stadium II',13:'Goomba Road',14:'Battlefield'};
export function gameSeed(seed,round,game){let h=2166136261;for(const c of JSON.stringify([seed,round,game]))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
export function stageFor(seed,round,game,ranked,profile=ACTIVE_PROFILE){
 if(ranked)return 6;
 const index=round+game-2,bag=[...profile.stages];let state=gameSeed(seed,Math.floor(index/bag.length),0);
 for(let i=bag.length-1;i>0;i--){state=(Math.imul(state,1664525)+1013904223)>>>0;const j=state%(i+1);[bag[i],bag[j]]=[bag[j],bag[i]];}
 return bag[index%bag.length];
}
// One platform round is a whole ranked set. Game results are independently
// derived from confirmed simulation, agreed by both peers, then accumulated.
export class CompetitiveSet {
 constructor({room,round,fighter,build,rotationSeed=room.seed,onChange,onGame,onError,profile=ACTIVE_PROFILE}){
  Object.assign(this,{room,round,build,rotationSeed,onChange,onGame,onError,profile});
  this.players=room.players.map(p=>p.id);this.seat=this.players.indexOf(room.me);
  if(this.players.length!==2||this.seat<0||!validFighter(fighter,this.profile))throw new Error('Invalid competitive room');
  this.peer=this.players[1-this.seat];this.ranked=room.ranked===true;this.target=this.ranked?2:1;
  this.game=1;this.wins=[0,0];this.fighters=[null,null];this.fighters[this.seat]=fighter;this.picks=[null,null];this.picks[this.seat]=fighter;
  this.phase='connecting';this.history=[];this.results=[null,null];this.lastProgress=Date.now();
  this.message=e=>{if(e.from!==this.peer||e.data?.p!==this.profile.mode||e.data.round!==round||this.closed)return;try{this.receive(e.data);}catch(err){this.fail(err.message);}};
  room.on('message',this.message);
  this.timer=setInterval(()=>{if(this.closed)return;if(Date.now()-this.lastProgress>120000&&this.phase!=='playing')return this.fail('Opponent did not finish set preparation.');if(this.game===1&&this.phase==='connecting')this.hello();},1000);
  this.publish();queueMicrotask(()=>{if(!this.closed)this.hello();});
 }
 send(data){this.room.send({p:this.profile.mode,round:this.round,...data},this.peer);}
 hello(){this.send({type:'hello',build:this.build,fighter:this.fighters[this.seat],ranked:this.ranked});}
 receive(d){
  if(d.type==='abort')throw new Error('Opponent could not continue the set.');
  if(d.type==='hello'){
   if(d.build!==this.build||d.ranked!==this.ranked||!validFighter(d.fighter,this.profile))throw new Error('Incompatible competitive rules or build.');
   if(this.initialPeer!==undefined&&this.initialPeer!==d.fighter)throw new Error('Opponent changed the locked fighter.');
   this.initialPeer=d.fighter;
   if(this.game===1&&this.phase==='connecting'){this.fighters[1-this.seat]=d.fighter;this.picks[1-this.seat]=d.fighter;if(!this.gotHello){this.gotHello=true;this.hello();}this.startGame();}return;
  }
  if(!Number.isInteger(d.game)||d.game<1||d.game>this.game)throw new Error('Invalid set game.');
  if(d.game<this.game)return;
  if(d.type==='pick'){this.applyPick(1-this.seat,d.fighter);return;}
  if(d.type==='result'){this.applyResult(1-this.seat,d.result);return;}
  throw new Error('Unknown competitive message.');
 }
 view(){return {phase:this.phase,round:this.round,game:this.game,ranked:this.ranked,wins:[...this.wins],fighters:[...this.fighters],picks:[...this.picks],seat:this.seat,turn:this.turn,stage:stageFor(this.rotationSeed,this.round,this.game,this.ranked,this.profile),history:structuredClone(this.history)};}
 publish(){this.onChange?.(this.view());}
 startGame(){
  if(this.picks.some(v=>v===null)||this.phase==='playing'||this.closed)return;
  this.fighters=[...this.picks];this.phase='playing';this.results=[null,null];this.lastProgress=Date.now();this.publish();
  this.onGame({game:this.game,fighters:[...this.fighters],stage:stageFor(this.rotationSeed,this.round,this.game,this.ranked,this.profile),seed:gameSeed(this.room.seed,this.round,this.game),stocks:this.profile.stocks});
 }
 choose(fighter){if(this.closed)return;this.applyPick(this.seat,fighter);this.send({type:'pick',game:this.game,fighter});}
 applyPick(seat,fighter){
  if(!validFighter(fighter,this.profile))throw new Error('Invalid fighter.');
  if(this.picks[seat]!==null){if(this.picks[seat]===fighter)return;throw new Error('Fighter choice is already locked.');}
  if(this.phase!=='counterpick'||this.turn!==seat)throw new Error('Wait for the preceding player to lock their fighter.');
  this.picks[seat]=fighter;this.fighters[seat]=fighter;this.lastProgress=Date.now();this.turn=1-seat;this.publish();this.startGame();
 }
 completeGame(result){if(this.closed)return;const game=this.game;this.applyResult(this.seat,result);this.send({type:'result',game,result});}
 applyResult(seat,result){
  if(!result||![0,1,2].includes(result.result)||!Number.isInteger(result.hash)||result.hash<0||result.hash>0xffffffff||!Array.isArray(result.stocks)||result.stocks.length!==2||!result.stocks.every(n=>Number.isInteger(n)&&n>=0&&n<=99))throw new Error('Invalid confirmed game result.');
  const clean={result:result.result,hash:result.hash,stocks:[...result.stocks]};
  if(this.results[seat]){if(JSON.stringify(this.results[seat])!==JSON.stringify(clean))throw new Error('Game result changed.');return;}
  if(!['playing','confirming'].includes(this.phase))throw new Error('No active game to finish.');
  this.results[seat]=clean;if(!this.results[this.seat])return;this.phase='confirming';this.publish();
  if(this.results.some(v=>!v))return;
  if(JSON.stringify(this.results[0])!==JSON.stringify(this.results[1]))throw new Error('Game results disagreed. The set was voided.');
  const winner=clean.result;this.history.push({game:this.game,winner,fighters:[...this.fighters],stage:stageFor(this.rotationSeed,this.round,this.game,this.ranked,this.profile)});
  if(winner<2)this.wins[winner]++;
  if(this.wins.some(n=>n>=this.target)||(!this.ranked&&winner===2)){
   this.phase='complete';this.publish();const report=winner===2?{draw:true}:{winner:this.players[winner]};report.scores=Object.fromEntries(this.players.map((id,i)=>[id,this.wins[i]]));
   queueMicrotask(async()=>{if(this.closed)return;try{await this.room.finish(report);}catch{this.fail('The set result could not be confirmed. Please reconnect.');}});return;
  }
  this.game++;this.lastProgress=Date.now();
  // Tied games replay with the same locked characters; no counterpick advantage.
  if(winner===2){this.phase='replay';this.publish();this.startGame();return;}
  this.phase='counterpick';this.picks=[null,null];this.turn=winner;this.publish();
 }
 fail(message){if(this.closed)return;try{this.send({type:'abort'});}catch{}this.destroy();queueMicrotask(async()=>{try{if(this.room.playing)await this.room.finish({void:true});}catch{}finally{this.onError?.(message);}});}
 destroy(){if(this.closed)return;this.closed=true;clearInterval(this.timer);this.room.off('message',this.message);}
}
export function ratingSummary(event){
 if(!event?.ranked||event.void)return '';
 const r=event.myRating;if(!r)return 'Your rank is managed by uGames.';
 const label=r.rank?.label||'Placement matches';
 if(r.rank?.placed===false)return label;
 if(!Number.isFinite(r.before)||!Number.isFinite(r.after))return label;
 return `${label} · ${r.before} → ${r.after} (${r.after-r.before>=0?'+':''}${r.after-r.before})`;
}
