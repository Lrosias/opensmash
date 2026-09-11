import {CompetitiveSet,FIGHTERS,STAGES,MELEE_RULES,COMPETITIVE_PROTOCOL,rankPresentation} from './competitive-rules.mjs';
import {MeleeCompetitiveRoom} from './competitive-room.mjs';
import {MeleePartyMatch} from './party-match.mjs';
import {NATIVE_MENU_PROTOCOL} from './native-room-session.mjs';
import {GameLobby} from '../../controllers/online-lobby.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fighter=id=>FIGHTERS.find(f=>f.id===id)?.name??'Choosing…';
const button=(label,action,value='',extra='')=>`<button data-action="${action}" data-value="${value}" data-key="${action}-${value}" ${extra}>${label}</button>`;
function stageArt(stage){
  const platforms=stage.id===32?'':stage.id===3?'<path d="M45 65h42m66 0h42"/>':'<path d="M35 66h48m74 0h48m-108-29h46"/>';
  return `<svg viewBox="0 0 240 120" aria-hidden="true"><circle cx="184" cy="34" r="25" fill="${stage.color}" opacity=".23"/><path d="M22 93h196l-22 17H44Z" fill="${stage.color}"/><g stroke="${stage.color}" stroke-width="7" stroke-linecap="round">${platforms}</g></svg>`;
}

export class MeleeCompetitiveUI {
  constructor({root,sdk,readMenu,onLocal=()=>{}}){
    this.root=root;this.sdk=sdk;this.readMenu=readMenu;this.onLocal=onLocal;this.selection={fighter:2,color:0};this.screen='queues';this.preview=false;this.names=['You','Practice opponent'];
    root.addEventListener('click',event=>{const b=event.target.closest('[data-action]');if(b&&!b.disabled)this.handle(b.dataset.action,b.dataset.value).catch(e=>{this.notice=e.message;this.render();});});
    root.addEventListener('keydown',event=>{
      const direction={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];
      if(direction){event.preventDefault();this.moveFocus(...direction);}
      if(event.key==='Escape'){event.preventDefault();this.handle('back','');}
    });

    if(sdk?.ready)Promise.resolve(sdk.ready()).then(()=>{if(sdk.multiplayer?.invite){this.invited=true;this.show();if(this.adapterFactory)this.connect('friends');}}).catch(()=>{});
  }
  // Production wiring is explicit: an awaited SDK alone cannot initialize Melee.
  setAdapter(factory,build){if(typeof factory!=='function'||typeof build!=='string'||!build)throw Error('Supply a match adapter and exact build identity');this.adapterFactory=factory;this.build=build;this.render();if(this.invited&&!this.room)this.connect('friends');}
  setNativeAdapter(factory){if(typeof factory!=='function')throw Error('Supply a native menu adapter');this.nativeFactory=factory;}
  show(){this.root.hidden=false;this.render();this.root.querySelector('h1')?.focus();}
  hide(){this.root.hidden=true;this.onLocal();}
  moveFocus(dx,dy){
    const buttons=[...this.root.querySelectorAll('button:not(:disabled)')].filter(b=>b.getClientRects().length);
    const current=document.activeElement;if(!buttons.includes(current)){buttons[0]?.focus();return;}
    const a=current.getBoundingClientRect(),x=a.x+a.width/2,y=a.y+a.height/2;
    const candidates=buttons.filter(b=>b!==current).map(b=>{const r=b.getBoundingClientRect(),rx=r.x+r.width/2-x,ry=r.y+r.height/2-y;
      return {b,along:rx*dx+ry*dy,across:Math.abs(rx*dy-ry*dx)};}).filter(c=>c.along>8).sort((a,b)=>(a.along+a.across*3)-(b.along+b.across*3));
    candidates[0]?.b.focus();
  }
  pollInput(s){
    const raw=this.readMenu?.()??null;
    if(this.root.hidden||(raw===null&&s?.source!=='gamepad')){this.padA=false;this.padB=false;this.padAt=0;return;}
    if(raw!==null){
      if(raw.select&&!this.padA){if(this.root.contains(document.activeElement))document.activeElement.click?.();else this.moveFocus(0,1);}
      if(raw.back&&!this.padB)this.handle('back','');
      this.padA=raw.select;this.padB=raw.back;
      const now=performance.now();
      if(!raw.direction)this.padAt=0;
      else if(!this.padAt||now-this.padAt>220){
        const buttons=[...this.root.querySelectorAll('button:not(:disabled)')].filter(b=>b.getClientRects().length);
        const current=buttons.indexOf(document.activeElement);
        buttons[current<0?0:(current+raw.direction+buttons.length)%buttons.length]?.focus();this.padAt=now;
      }
      return;
    }
    if(s.a&&!this.padA){if(this.root.contains(document.activeElement))document.activeElement.click?.();else this.moveFocus(0,1);}
    if(s.b&&!this.padB)this.handle('back','');
    this.padA=!!s.a;this.padB=!!s.b;
    const x=s.move?.x??0,y=s.move?.y??0,now=performance.now();
    if(Math.max(Math.abs(x),Math.abs(y))<.5)this.padAt=0;
    else if(!this.padAt||now-this.padAt>220){this.moveFocus(Math.abs(x)>Math.abs(y)?Math.sign(x):0,Math.abs(y)>=Math.abs(x)?Math.sign(y):0);this.padAt=now;}
  }
  render(){
    if(this.screen==='native'){this.root.innerHTML='';this.root.hidden=true;return;}
    const focused=this.root.contains(document.activeElement)?document.activeElement.dataset.key:null;
    let body;
    if(this.screen==='setup')body=this.setup();
    else if(this.screen==='queues')body=this.queues();
    else if(this.screen==='lobby')body=this.lobbyScreen();
    else if(this.screen==='party')body=this.partyScreen();
    else body=this.setScreen();
    this.root.innerHTML=`<div class="comp-shell"><nav class="comp-nav"><div class="comp-brand">OPENSMASH <span>MELEE</span></div>${button(this.room?'Leave lobby':'Local play','back')}</nav>
      ${this.preview?'<div class="comp-preview">FLOW PREVIEW <span>You control both sides. No online match or rating changes.</span></div>':''}
      ${this.notice?`<p class="comp-notice" role="status">${esc(this.notice)}</p>`:''}${body}
      <footer class="comp-footer"><span>4 stocks · 8 minutes · No items</span><span>NTSC 1.02 · Unfrozen Stadium</span></footer></div>`;
    if(focused)this.root.querySelector(`[data-key="${CSS.escape(focused)}"]`)?.focus({preventScroll:true});
  }
  roster(selected,action='fighter'){
    return `<div class="comp-roster" aria-label="Fighters">${FIGHTERS.map(f=>button(`<span class="comp-monogram" aria-hidden="true">${esc(f.name.split(' ').map(w=>w[0]).join('').slice(0,2))}</span><span>${esc(f.name)}</span>`,action,f.id,`aria-pressed="${f.id===selected}" class="comp-fighter"`)).join('')}</div>`;
  }
  setup(){return `<div class="comp-heading"><p class="comp-eyebrow">ONLINE / FIGHTER SELECT</p><h1 tabindex="-1">Choose your fighter.</h1><p>${this.invited?'Choose a fighter to accept your friend’s invitation.':'Lock in your fighter, then find your next opponent.'}</p></div>
    <div class="comp-columns"><main>${this.roster(this.selection.fighter)}</main><aside class="comp-panel"><p class="comp-eyebrow">YOUR PICK</p><h2>${esc(fighter(this.selection.fighter))}</h2><p>Costume</p><div class="comp-colors">${[0,1,2,3].map(i=>button(String(i+1),'color',i,`aria-label="Costume ${i+1}" aria-pressed="${i===this.selection.color}"`)).join('')}</div>
    <p class="comp-muted">Zelda and Sheik select your starting form. Matching costumes are separated automatically.</p>${button('Lock fighter →','lock','','class="comp-primary"')}<p class="comp-muted">You can change characters between games. In Ranked, the previous winner chooses first.</p></aside></div><div class="comp-mobile-pick"><span>${esc(fighter(this.selection.fighter))}</span>${button('Continue with '+esc(fighter(this.selection.fighter)),'lock','','class="comp-primary"')}</div>`;}
  rankCard(){const rank=rankPresentation(this.platformResult);return `<aside class="comp-panel comp-rank"><p class="comp-eyebrow">YOUR RANK</p><h2>${esc(rank?.label??'Make your mark.')}</h2><p>${esc(rank?.detail??'Complete 5 rated sets to earn your first rank. Your existing rank is available on the uGames ladder.')}</p><p class="comp-muted">Bronze → Silver → Gold → Platinum → Diamond → Challenger</p><p class="comp-muted">Ranked sets affect your rating once. Casual and Friends never show a competitive rating.</p></aside>`;}
  queues(){const unavailable=!this.adapterFactory;return `<div class="comp-heading"><p class="comp-eyebrow">ONLINE / FIND A MATCH</p><h1 tabindex="-1">Your next set starts here.</h1><p>Join a lobby, then choose your fighters together.</p></div>
    <div class="comp-columns"><main><div class="comp-modes">${[
      ['casual','Casual','Find your rhythm.','Choose fighters, rules and stages in Melee. Keep playing through its normal results screen.'],
      ['ranked','Ranked','Play the set.','Best of three. Stage strikes, counterpicks, and a rating that follows your results.'],
      ['friends','Friends','Run it back together.','Invite a friend through uGames. Private games never change your rating.'],
    ].map(([id,name,line,detail])=>`<article class="comp-mode"><p class="comp-eyebrow">${name.toUpperCase()}</p><h2>${line}</h2><p>${detail}</p>${button(name,'queue',id,`class="comp-primary" ${unavailable||this.connecting?'disabled':''}`)}</article>`).join('')}</div>
    ${unavailable?'<p class="comp-notice">Online play is being upgraded. Explore the full competitive flow below while the match connection is prepared.</p>':''}
    <div class="comp-preview-actions">${button('Preview Ranked flow','preview','ranked')}</div></main>${this.rankCard()}</div>`;}
  playerCards(s){return `<div class="comp-players">${s.selections.map((p,i)=>`<article class="comp-player ${this.model?.actor===i?'is-turn':''}"><div><p class="comp-eyebrow">P${i+1}${this.preview?' · PREVIEW':''}</p><h2>${esc(this.names[i])}</h2><p>${esc(fighter(p?.fighter))}${p?` · Costume ${p.color+1}`:''}</p></div><strong aria-label="${esc(this.names[i])} wins">${s.scores[i]}</strong></article>`).join('')}</div>`;}
  setScreen(){
    if(this.roundResult&&(this.roundResult.void||this.model?.state.phase!=='complete')){
      const result=this.roundResult,title=result.void?'Set void.':result.draw?'Set drawn.':result.won?'Set won.':'Set lost.';
      const explanation=result.void?'This set did not produce a rated result.':'The set ended before all games were completed. uGames confirmed the outcome.';
      return `<div class="comp-heading"><p class="comp-eyebrow">ONLINE / RESULT</p><h1 tabindex="-1">${title}</h1><p>${explanation}</p><p>Return to character selection, or find another match.</p>${button(this.room?.queue==='ranked'?'Back to Online':'Return to lobby','return-lobby','','class="comp-primary"')}</div>${rankPresentation(result)?this.rankCard():''}`;
    }
    if(this.screen==='error')return '<div class="comp-heading"><h1 tabindex="-1">Set interrupted.</h1><p>Return to the online menu when you’re ready. uGames determines any rating outcome.</p></div>';
    if(!this.model)return '<div class="comp-heading"><h1 tabindex="-1">Preparing your set…</h1><p>Waiting for both players’ locked selections.</p></div>';
    const s=this.model.snapshot,actor=this.model.actor,canAct=this.preview||actor===this.session?.seat;
    const legal=this.model.legalStages().map(t=>t.id),selected=STAGES.find(t=>t.id===s.stage);
    let title='',description='',content='';
    if(['striking','ban','counterpick'].includes(s.phase)){
      title=s.phase==='striking'?'Strike a starter.':s.phase==='ban'?'Protect your next game.':'Choose your counterpick.';
      description=s.phase==='striking'?`${this.names[actor]} strikes next. Order: P1 removes one, P2 removes two, P1 removes one.`:
        s.phase==='ban'?`${this.names[actor]} won the last game and bans one stage.`:`${this.names[actor]} chooses the stage. You cannot return to the stage of your last win.`;
      content=`<div class="comp-stages">${STAGES.map(t=>{const unavailable=!legal.includes(t.id);const reason=s.struck.includes(t.id)?'Struck':s.banned===t.id?'Banned':s.phase==='striking'&&t.counterpick?'Counterpick only':unavailable?'Previous win · unavailable':t.tag;return button(`${stageArt(t)}<strong>${t.name}</strong><span>${reason}</span>`,'stage',t.id,`class="comp-stage" ${unavailable||!canAct?'disabled':''}`);}).join('')}</div>`;
    }else if(['winner-character','loser-character','characters'].includes(s.phase)){
      title='Make your next pick.';description=actor===null?'Both players lock in a fighter.':`${this.names[actor]} chooses ${s.phase==='winner-character'?'first. The other player can then respond.':'second, after seeing the winner’s choice.'}`;
      const pick=this.counterSelection??s.selections[actor??0];content=`${this.roster(pick?.fighter,'counterfighter')}<div class="comp-action-row"><p>${esc(fighter(pick?.fighter))}</p>${button('Lock character','counterlock','','class="comp-primary" '+(!canAct?'disabled':''))}</div>`;
    }else if(s.phase==='ready'){
      title=`Game ${s.game}. Ready when you are.`;description=this.preview?'Preview the match screen, then try the between-game flow.':'Preparing both engines with the same fighters, stage and rules.';
      content=`<div class="comp-arena">${stageArt(selected)}<h2>${selected.name}</h2><p>${s.mode==='ranked'?'Tournament stage selection':'Random competitive stage · No repeats until the pool is exhausted'}</p>${this.preview?button('Preview game →','play','','class="comp-primary"'):'<p role="status">Waiting for both engines…</p>'}</div>`;
    }else if(s.phase==='playing'){
      title=`Game ${s.game} in progress.`;description=this.preview?'Choose a sample result to explore the next step. This does not run a match.':'The result will advance only after both engines confirm it.';
      content=`<div class="comp-arena">${stageArt(selected)}<h2>${selected.name}</h2>${this.preview?`<div class="comp-action-row">${button('Record P1 win','win','0')}${button('Record P2 win','win','1')}${button('Record draw','win','draw')}</div>`:''}</div>`;
    }else if(s.phase==='game-result'||s.phase==='complete'){
      const last=s.history.at(-1);title=last.winner===null?'A tied game.':s.phase==='complete'&&s.mode==='ranked'?`${this.names[s.scores[0]>s.scores[1]?0:1]} wins the set.`:`${this.names[last.winner]} takes game ${s.game}.`;
      description=s.phase==='game-result'?(last.winner===null?'Replay the same stage and fighters.':'Next: winner bans, loser chooses a stage, then winner chooses their character first.'):
        this.preview?'Preview complete. No result was submitted and no rating changed.':'Return to character selection, or find another match.';
      content=`<div class="comp-panel"><h2>${s.mode==='ranked'?'Set score':'Game score'} · ${s.scores.join(' – ')}</h2><ol class="comp-history">${s.history.map(g=>`<li>Game ${g.game}<span>${esc(STAGES.find(t=>t.id===g.stage).name)}</span><strong>${g.winner===null?'Draw':esc(this.names[g.winner])}</strong></li>`).join('')}</ol>
      ${s.phase==='game-result'?button(last.winner===null?'Replay game':'Continue to counterpick','continue','','class="comp-primary" '+(!this.preview&&s.continued[this.session?.seat]?'disabled':'')):
        this.preview?`<div class="comp-action-row">${button('Play again','again','','class="comp-primary"')}${button('Change fighter','change')}</div>`:`<div class="comp-action-row">${button(this.room?.queue==='ranked'?'Back to Online':'Return to lobby','return-lobby','','class="comp-primary"')}</div>`}</div>
      ${s.phase==='complete'&&s.mode==='ranked'?this.rankCard():''}`;
    }
    return `<div class="comp-heading"><p class="comp-eyebrow">${esc(s.mode.toUpperCase())} / ${s.mode==='ranked'?'BEST OF THREE':'FRIENDLIES'} / GAME ${s.game}</p><h1 tabindex="-1">${esc(title)}</h1><p role="status">${esc(description)}</p></div>${this.playerCards(s)}${content}`;
  }
  startPreview(mode,bag=null){
    this.session?.stop();this.session=null;this.roundResult=null;this.preview=true;this.screen='set';this.notice='';this.names=['You','Practice opponent'];
    this.model=new CompetitiveSet({mode,seed:0x534c4950,bag});this.model.apply(0,{type:'character',selection:this.selection});this.model.apply(1,{type:'character',selection:{fighter:20,color:0}});this.render();
  }
  async handle(action,value){
    this.notice='';
    if(action==='back'){
      this.attempt=(this.attempt??0)+1;
      this.leaveLobby();
      this.preview=false;this.screen='queues';this.hide();return;
    }
    if(action==='local-player'){this.selectedParticipant=value;this.render();return;}
    if(action==='lobby-fighter'||action==='lobby-color'){
      const own=this.lobby?.view().participants.find(p=>p.id===this.selectedParticipant&&p.local);
      if(own){const selection={...(own.selection??this.selection)};selection[action==='lobby-fighter'?'fighter':'color']=Number(value);this.lobby.pick(own.id,selection);}return;
    }
    if(action==='lobby-ready'){this.lobby?.toggleReady(value);return;}
    if(action==='lobby-start'){await this.lobby?.start();return;}
    if(action==='return-lobby'){
      if(this.room&&this.room.queue!=='ranked'&&this.room.connected!==false){this.session?.stop();this.session=null;this.model=null;this.platformResult=null;this.screen='lobby';this.lobby?.resume();}
      else {this.leaveLobby();this.screen='queues';}this.render();return;
    }
    if(action==='fighter')this.selection.fighter=Number(value);
    if(action==='color')this.selection.color=Number(value);
    if(action==='lock'){this.screen='queues';if(this.invited&&this.adapterFactory){await this.connect('friends');return;}}
    if(action==='change'){this.preview=false;this.screen='setup';}
    if(action==='preview'){this.startPreview(value);return;}
    if(action==='queue'){await this.connect(value);return;}
    if(action==='stage'){this.perform({type:'stage',stage:Number(value)});this.counterSelection=null;}
    if(action==='counterfighter')this.counterSelection={fighter:Number(value),color:0};
    if(action==='counterlock'){
      this.perform({type:'character',selection:this.counterSelection??this.model.state.selections[this.model.actor]});this.counterSelection=null;
    }
    if(action==='play'&&this.preview){this.model.apply(0,{type:'ready'});this.model.apply(1,{type:'ready'});}
    if(action==='win'&&this.preview)this.model.recordConfirmed({game:this.model.state.game,winner:value==='draw'?null:Number(value),frame:3600,checksum:`preview-${this.model.state.game}`});
    if(action==='continue'){
      if(this.preview){this.model.apply(0,{type:'continue'});this.model.apply(1,{type:'continue'});}
      else this.session.action({type:'continue'});
    }
    if(action==='again'&&this.preview){this.startPreview(this.model.state.mode,this.model.state.mode==='ranked'?null:this.model.state.bag);return;}
    this.render();
  }
  perform(action){if(this.preview)this.model.apply(this.model.actor,action);else this.session?.action(action);}
  leaveLobby(){
    this.session?.stop();this.session=null;this.onNativeLeave?.();this.lobby?.destroy();this.lobby=null;
    if(this.room&&this.roomClose)this.room.off('close',this.roomClose);
    this.room?.leave();this.room=null;this.model=null;this.connecting=false;
    this.sdk.multiplayer?.leave?.();
  }
  lobbyScreen(){
    const view=this.lobby?.view();if(!view)return '<p role="status">Joining the lobby…</p>';
    const local=view.participants.filter(p=>p.local);
    if(!local.some(p=>p.id===this.selectedParticipant))this.selectedParticipant=local[0]?.id;
    const selected=local.find(p=>p.id===this.selectedParticipant),choice=selected?.selection??this.selection;
    const seats=Array.from({length:view.capacity},(_,slot)=>{
      const p=view.participants.find(p=>p.slot===slot);
      return `<article class="comp-player"><p class="comp-eyebrow">PLAYER ${slot+1}</p><h2>${p?esc(p.name):'Open slot'}</h2><p>${p?esc(p.selection?fighter(p.selection.fighter):'Choosing a fighter'):'Waiting for someone to join'}</p>${p?.local?button('Select for this player','local-player',p.id,`aria-pressed="${p.id===this.selectedParticipant}"`):''}${p?`<p>${p.ready?'Ready':'Not ready'}</p>`:''}</article>`;
    }).join('');
    return `<div class="comp-heading"><p class="comp-eyebrow">ONLINE / ${this.room.queue==='private'?'FRIENDS':'MATCH'} LOBBY</p><h1 tabindex="-1">Choose your fighters.</h1><p>${view.playing?'A game is in progress. New players join the next game.':'Invite friends and manage local players from the YouGame lobby menu.'}</p></div><div class="comp-players comp-lobby-players">${seats}</div>${selected&&(!view.playing||view.waitingNext)?`<h2>${esc(selected.name)} · Controller ${selected.localIndex+1}</h2>${this.roster(choice.fighter,'lobby-fighter')}<div class="comp-colors">${[0,1,2,3].map(c=>button('Costume '+(c+1),'lobby-color',c,`aria-pressed="${choice.color===c}"`)).join('')}</div>${button(selected.ready?'Not ready':'Ready','lobby-ready',selected.id,`class="comp-primary" ${!selected.selection?'disabled':''}`)}`:''}<div class="comp-action-row">${view.host?button('Start game','lobby-start','','class="comp-primary" '+(!view.canStart?'disabled':'')):'<p>The host starts when everyone is ready.</p>'}</div>`;
  }
  partyScreen(){
    const result=this.platformResult;
    const title=result?(result.void?'Game cancelled':result.draw?'Draw':`${this.partyParticipants?.find(p=>p.id===result.ranking?.[0])?.name??'Winner'} wins`):this.partyPhase==='interrupted'?'A player left. Waiting for the game result…':this.partyPhase==='confirming'?'Recording the game…':'Preparing the game…';
    return `<div class="comp-heading"><p class="comp-eyebrow">FRIENDS</p><h1 tabindex="-1">${esc(title)}</h1></div>${result?button('Return to lobby','return-lobby','','class="comp-primary"'):''}`;
  }
  async connect(queue){
    if(!this.adapterFactory||this.connecting)return;
    if(queue!=='ranked'&&!this.nativeFactory){this.notice='Native online play is still loading.';this.render();return;}
    this.connecting=true;this.preview=false;const attempt=this.attempt=(this.attempt??0)+1;this.render();
    try {
      const room=await this.sdk.multiplayer.joinLobby({players:queue==='friends'?4:2,minPlayers:2,maxLocalPlayers:queue==='friends'?4:1,mode:queue==='ranked'?COMPETITIVE_PROTOCOL:NATIVE_MENU_PROTOCOL,compatibility:this.build,queue});
      if(attempt!==this.attempt){room.leave();return;}
      this.room=room;this.invited=false;this.screen='lobby';this.root.hidden=false;
      this.roomClose=()=>{
        this.lobby?.destroy();
        if(this.platformResult)return;
        this.session?.stop();this.session=null;this.onNativeLeave?.();this.room=null;this.screen='queues';this.notice='You left the lobby.';this.root.hidden=false;this.render();
      };
      room.on('close',this.roomClose);
      if(queue!=='ranked'){
        this.screen='native';this.model=null;this.platformResult=null;this.roundResult=null;this.render();
        this.session=this.nativeFactory(room,error=>{
          if(this.room!==room)return;
          this.leaveLobby();this.screen='queues';this.notice=error?.message||String(error);this.root.hidden=false;this.render();
        });
        return;
      }
      // Ranked retains its existing rules/striking path until native integration.
      this.lobby=new GameLobby({room,protocol:COMPETITIVE_PROTOCOL+':lobby',validSelection:p=>p&&Number.isInteger(p.fighter)&&FIGHTERS.some(f=>f.id===p.fighter)&&Number.isInteger(p.color)&&p.color>=0&&p.color<4,
        onChange:()=>{if(this.screen==='lobby')this.render();},onError:error=>{this.notice=error.message;this.render();},onStart:participants=>this.beginRound(participants)});
      for(const p of room.localParticipants??[])this.lobby.pick(p.id,this.selection);
      this.render();
    }catch(error){if(attempt===this.attempt){this.screen='queues';if(error.message!=='Cancelled')this.notice=error.message;}}
    finally{this.connecting=false;this.render();}
  }
  beginRound(participants){
    if(!this.room||this.session?.round===this.room.round)return;
    const roundRoom=this.room,roundId=roundRoom.round;
    const current=()=>this.room===roundRoom&&this.session?.round===roundId;
    if(!participants?.some(p=>p.connectionId===roundRoom.me))return;
    this.selection={...participants.find(p=>p.connectionId===roundRoom.me).selection};
    if(roundRoom.queue==='private'){
      this.session?.stop();this.model=null;this.platformResult=null;this.partyParticipants=participants;this.screen='party';
      this.session=new MeleePartyMatch({room:roundRoom,participants,adapter:this.adapterFactory(roundRoom),
        onChange:phase=>{if(!current())return;this.partyPhase=phase;this.root.hidden=phase==='playing';this.render();},
        onError:error=>{if(!current())return;this.notice=error.message;this.screen='error';this.root.hidden=false;this.render();},
        onResult:result=>{if(!current())return;this.platformResult=result;this.root.hidden=false;this.render();}});
      return;
    }
    const bag=this.session?.model?.state.mode!=='ranked'?this.session?.model?.snapshot.bag:null;
    this.session?.stop();this.model=null;this.roundResult=null;this.notice='';this.screen='set';this.root.hidden=false;this.names=this.room.players.map(p=>p.name);
    this.session=new MeleeCompetitiveRoom({room:this.room,build:this.build,selection:this.selection,bag:bag??null,adapter:this.adapterFactory(this.room),
      onChange:(s,model)=>{if(!current())return;this.model=model;this.root.hidden=s.phase==='playing';this.render();},onError:error=>{if(!current())return;this.notice=error.message;this.screen='error';this.root.hidden=false;this.render();},
      // The SDK advances room.round before delivering the previous round's result.
      onResult:result=>{if(!current()||result.round!==roundId)return;this.platformResult=result;this.roundResult=result;this.screen='set';this.notice='';this.root.hidden=false;const pick=this.model?.state.selections[this.session?.seat];if(pick)this.selection={...pick};this.render();}});
    this.render();
  }
}
