// Original OpenSmash flow implementation; external IDs match asset_groups.py.
export const COMPETITIVE_PROTOCOL='opensmash-melee-sets-v1';
export const FIGHTERS=['Captain Falcon','Donkey Kong','Fox','Mr. Game & Watch','Kirby','Bowser','Link','Luigi','Mario','Marth','Mewtwo','Ness','Peach','Pikachu','Ice Climbers','Jigglypuff','Samus','Yoshi','Zelda','Sheik','Falco','Young Link','Dr. Mario','Roy','Pichu','Ganondorf'].map((name,id)=>({id,name}));
export const STAGES=[
  {id:31,name:'Battlefield',tag:'Three platforms',color:'#6b77bc'},
  {id:32,name:'Final Destination',tag:'No platforms',color:'#ab69bf'},
  {id:28,name:'Dream Land',tag:'Wide blast zones',color:'#68a383'},
  {id:8,name:'Yoshi’s Story',tag:'Close quarters',color:'#d69369'},
  {id:2,name:'Fountain of Dreams',tag:'Moving platforms',color:'#788ecf'},
  {id:3,name:'Pokémon Stadium',tag:'Unfrozen · Counterpick',color:'#97ae65',counterpick:true},
];
export const MELEE_RULES=Object.freeze({id:'melee-ntsc102-bo3-v1',stocks:4,seconds:480,items:false,bestOf:3,stageStrike:'1–2–1',bans:1,dsr:'last-win',frozenStadium:false});
export const validFighter=id=>Number.isInteger(id)&&FIGHTERS.some(f=>f.id===id);
export const validSelection=p=>p&&validFighter(p.fighter)&&Number.isInteger(p.color)&&p.color>=0&&p.color<4;
const clone=v=>structuredClone(v);

export class CompetitiveSet {
  constructor({mode='ranked',seed=1,round=1,bag=null}={}) {
    if(!['ranked','casual','friends'].includes(mode)||!Number.isSafeInteger(round)||round<1||!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw Error('Invalid set configuration');
    this.state={protocol:COMPETITIVE_PROTOCOL,rules:MELEE_RULES.id,mode,round,seed,revision:0,game:1,phase:'characters',
      selections:[null,null],scores:[0,0],history:[],lastWin:[null,null],struck:[],strikeIndex:0,banned:null,stage:null,
      ready:[false,false],continued:[false,false],previousWinner:null,
      bag:bag?clone(bag):{remaining:[],seed:seed||0x6d2b79f5}};
    if(!Array.isArray(this.state.bag.remaining)||new Set(this.state.bag.remaining).size!==this.state.bag.remaining.length||
      this.state.bag.remaining.some(id=>!STAGES.some(s=>s.id===id))||!Number.isInteger(this.state.bag.seed))throw Error('Invalid stage bag');
  }
  get snapshot(){return clone(this.state);}
  get actor(){
    const s=this.state;
    if(s.phase==='striking')return [0,1,1,0][s.strikeIndex];
    if(s.phase==='ban'||s.phase==='winner-character')return s.previousWinner;
    if(s.phase==='counterpick'||s.phase==='loser-character')return 1-s.previousWinner;
    return null;
  }
  legalStages(){
    const s=this.state;
    if(s.phase==='striking')return STAGES.filter(t=>!t.counterpick&&!s.struck.includes(t.id));
    if(s.phase==='ban'||s.phase==='counterpick')return STAGES.filter(t=>t.id!==s.banned&&t.id!==s.lastWin[1-s.previousWinner]);
    return STAGES;
  }
  chooseRandomStage(){
    const bag=this.state.bag;
    if(!bag.remaining.length)bag.remaining=STAGES.map(s=>s.id);
    let x=bag.seed;x^=x<<13;x^=x>>>17;x^=x<<5;bag.seed=x>>>0;
    return bag.remaining.splice(bag.seed%bag.remaining.length,1)[0];
  }
  resolveColors(){
    const [a,b]=this.state.selections;
    // Zelda and Sheik share costume identity even with different starting forms.
    if(a&&b&&(a.fighter===b.fighter||([18,19].includes(a.fighter)&&[18,19].includes(b.fighter)))&&a.color===b.color)b.color=(b.color+1)%4;
  }
  apply(seat,action){
    const s=this.state;
    if(![0,1].includes(seat)||!action||typeof action.type!=='string')throw Error('Invalid set action');
    if(this.actor!==null&&seat!==this.actor)throw Error('It is the other player’s turn');
    if(action.type==='character'){
      if(!['characters','winner-character','loser-character'].includes(s.phase)||!validSelection(action.selection))throw Error('Invalid character selection');
      if(s.phase==='characters'&&s.selections[seat])throw Error('Character already locked');
      s.selections[seat]=clone(action.selection);
      if(s.phase==='winner-character')s.phase='loser-character';
      else if(s.phase==='loser-character'){this.resolveColors();s.phase='ready';}
      else if(s.selections.every(Boolean)){
        this.resolveColors();
        if(s.mode==='ranked')s.phase='striking';
        else {s.stage=this.chooseRandomStage();s.phase='ready';}
      }
    }else if(action.type==='stage'){
      if(!['striking','ban','counterpick'].includes(s.phase)||!this.legalStages().some(t=>t.id===action.stage))throw Error('That stage cannot be selected');
      if(s.phase==='striking'){
        s.struck.push(action.stage);s.strikeIndex++;
        if(s.strikeIndex===4){s.stage=this.legalStages()[0].id;s.phase='ready';}
      }else if(s.phase==='ban'){s.banned=action.stage;s.phase='counterpick';}
      else {s.stage=action.stage;s.phase='winner-character';}
    }else if(action.type==='ready'){
      if(s.phase!=='ready'||s.ready[seat])throw Error('Game is not awaiting preparation');
      s.ready[seat]=true;if(s.ready.every(Boolean))s.phase='playing';
    }else if(action.type==='continue'){
      if(s.phase!=='game-result'||s.continued[seat])throw Error('Game is not awaiting continuation');
      s.continued[seat]=true;
      if(s.continued.every(Boolean)){
        s.game++;s.ready=[false,false];s.continued=[false,false];s.banned=null;s.struck=[];
        // A tied game replays the same fighters/stage, without a counterpick advantage.
        s.phase=s.previousWinner===null?'ready':'ban';
      }
    }else throw Error('Unknown set action');
    s.revision++;
    return this.snapshot;
  }
  recordConfirmed({game,winner,frame,checksum}){
    const s=this.state;
    if(s.phase!=='playing'||game!==s.game||![0,1,null].includes(winner)||!Number.isSafeInteger(frame)||frame<0||typeof checksum!=='string'||!checksum.length||checksum.length>128)
      throw Error('Invalid confirmed game result');
    s.history.push({game,winner,frame,checksum,stage:s.stage,selections:clone(s.selections)});
    s.previousWinner=winner;
    if(winner!==null){s.scores[winner]++;s.lastWin[winner]=s.stage;}
    s.phase=s.mode!=='ranked'||s.scores.some(n=>n===2)?'complete':'game-result';s.revision++;
    return this.snapshot;
  }
  get launch(){
    const s=this.state;
    if(!['ready','playing'].includes(s.phase))return null;
    return {protocol:COMPETITIVE_PROTOCOL,rules:clone(MELEE_RULES),round:s.round,game:s.game,
      seed:(s.seed+Math.imul(s.game,0x9e3779b9))>>>0,stage:s.stage,selections:clone(s.selections)};
  }
}

// Display only platform-provided ranked data. Never infer placement or Elo locally.
export function rankPresentation(result){
  const rating=result?.ranked&&!result.void?result.myRating:null;
  if(!rating)return null;
  const rank=rating.rank;
  if(!rank||typeof rank.placed!=='boolean')return null;
  if(!rank.placed)return {label:'Placement sets',detail:'Your rank appears after 5 rated sets.',delta:null};
  if(typeof rank.label!=='string'||!Number.isFinite(rating.before)||!Number.isFinite(rating.after))return null;
  const delta=rating.after-rating.before;
  return {label:rank.label,detail:`${rating.after} rating · ${delta>=0?'+':''}${delta}`,delta};
}
