import {CompetitiveSet,FIGHTERS,STAGES,MELEE_RULES,COMPETITIVE_PROTOCOL,rankPresentation} from './competitive-rules.mjs';
import {MeleeCompetitiveRoom} from './competitive-room.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fighter=id=>FIGHTERS.find(f=>f.id===id)?.name??'Choosing…';
const button=(label,action,value='',extra='')=>`<button data-action="${action}" data-value="${value}" data-key="${action}-${value}" ${extra}>${label}</button>`;
function stageArt(stage){
  const platforms=stage.id===32?'':stage.id===3?'<path d="M45 65h42m66 0h42"/>':'<path d="M35 66h48m74 0h48m-108-29h46"/>';
  return `<svg viewBox="0 0 240 120" aria-hidden="true"><circle cx="184" cy="34" r="25" fill="${stage.color}" opacity=".23"/><path d="M22 93h196l-22 17H44Z" fill="${stage.color}"/><g stroke="${stage.color}" stroke-width="7" stroke-linecap="round">${platforms}</g></svg>`;
}

export class MeleeCompetitiveUI {
  constructor({root,sdk,readMenu,onLocal=()=>{}}){
    this.root=root;this.sdk=sdk;this.readMenu=readMenu;this.onLocal=onLocal;this.selection={fighter:2,color:0};this.screen='setup';this.preview=false;this.names=['You','Practice opponent'];
    root.addEventListener('click',event=>{const b=event.target.closest('[data-action]');if(b&&!b.disabled)this.handle(b.dataset.action,b.dataset.value).catch(e=>{this.notice=e.message;this.render();});});
    root.addEventListener('keydown',event=>{
      const direction={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];
      if(direction){event.preventDefault();this.moveFocus(...direction);}
      if(event.key==='Escape'){event.preventDefault();this.handle('back','');}
    });
    this.readyHandler=()=>this.beginRound();
    if(sdk?.ready)Promise.resolve(sdk.ready()).then(()=>{if(sdk.multiplayer?.invite){this.invited=true;this.show();}}).catch(()=>{});
  }
  // Production wiring is explicit: an awaited SDK alone cannot initialize Melee.
  setAdapter(factory,build){if(typeof factory!=='function'||typeof build!=='string'||!build)throw Error('Supply a match adapter and exact build identity');this.adapterFactory=factory;this.build=build;this.render();}
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
    const focused=this.root.contains(document.activeElement)?document.activeElement.dataset.key:null;
    let body;
    if(this.screen==='setup')body=this.setup();
    else if(this.screen==='queues')body=this.queues();
    else body=this.setScreen();
    this.root.innerHTML=`<div class="comp-shell"><nav class="comp-nav"><div class="comp-brand">OPENSMASH <span>MELEE</span></div>${button(this.session?'Leave set':'Local play','back')}</nav>
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
  queues(){const unavailable=!this.adapterFactory;return `<div class="comp-heading"><p class="comp-eyebrow">ONLINE / FIND A MATCH</p><h1 tabindex="-1">Your next set starts here.</h1><p>Playing ${esc(fighter(this.selection.fighter))} · Costume ${this.selection.color+1} ${button('Change fighter','change')}</p></div>
    <div class="comp-columns"><main><div class="comp-modes">${[
      ['casual','Casual','Find your rhythm.','Random competitive stages. Keep playing, or change your fighter.'],
      ['ranked','Ranked','Play the set.','Best of three. Stage strikes, counterpicks, and a rating that follows your results.'],
      ['friends','Friends','Run it back together.','Invite a friend through uGames. Private games never change your rating.'],
    ].map(([id,name,line,detail])=>`<article class="comp-mode"><p class="comp-eyebrow">${name.toUpperCase()}</p><h2>${line}</h2><p>${detail}</p>${button(name,'queue',id,`class="comp-primary" ${unavailable||this.connecting?'disabled':''}`)}</article>`).join('')}</div>
    ${unavailable?'<p class="comp-notice">Online play is being upgraded. Explore the full competitive flow below while the match connection is prepared.</p>':''}
    <div class="comp-preview-actions">${button('Preview Ranked flow','preview','ranked')}${button('Preview Casual flow','preview','casual')}${button('Preview Friends flow','preview','friends')}</div></main>${this.rankCard()}</div>`;}
  playerCards(s){return `<div class="comp-players">${s.selections.map((p,i)=>`<article class="comp-player ${this.model?.actor===i?'is-turn':''}"><div><p class="comp-eyebrow">P${i+1}${this.preview?' · PREVIEW':''}</p><h2>${esc(this.names[i])}</h2><p>${esc(fighter(p?.fighter))}${p?` · Costume ${p.color+1}`:''}</p></div><strong aria-label="${esc(this.names[i])} wins">${s.scores[i]}</strong></article>`).join('')}</div>`;}
  setScreen(){
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
        this.preview?'Preview complete. No result was submitted and no rating changed.':'Use uGames’ Continue button when you’re ready for another match.';
      content=`<div class="comp-panel"><h2>${s.mode==='ranked'?'Set score':'Game score'} · ${s.scores.join(' – ')}</h2><ol class="comp-history">${s.history.map(g=>`<li>Game ${g.game}<span>${esc(STAGES.find(t=>t.id===g.stage).name)}</span><strong>${g.winner===null?'Draw':esc(this.names[g.winner])}</strong></li>`).join('')}</ol>
      ${s.phase==='game-result'?button(last.winner===null?'Replay game':'Continue to counterpick','continue','','class="comp-primary" '+(!this.preview&&s.continued[this.session?.seat]?'disabled':'')):
        this.preview?`<div class="comp-action-row">${button('Play again','again','','class="comp-primary"')}${button('Change fighter','change')}</div>`:''}</div>
      ${s.phase==='complete'&&s.mode==='ranked'?this.rankCard():''}`;
    }
    return `<div class="comp-heading"><p class="comp-eyebrow">${esc(s.mode.toUpperCase())} / ${s.mode==='ranked'?'BEST OF THREE':'FRIENDLIES'} / GAME ${s.game}</p><h1 tabindex="-1">${esc(title)}</h1><p role="status">${esc(description)}</p></div>${this.playerCards(s)}${content}`;
  }
  startPreview(mode,bag=null){
    this.session?.stop();this.session=null;this.preview=true;this.screen='set';this.notice='';this.names=['You','Practice opponent'];
    this.model=new CompetitiveSet({mode,seed:0x534c4950,bag});this.model.apply(0,{type:'character',selection:this.selection});this.model.apply(1,{type:'character',selection:{fighter:20,color:0}});this.render();
  }
  async handle(action,value){
    this.notice='';
    if(action==='back'){
      this.attempt=(this.attempt??0)+1;
      if(this.session){this.session.stop();this.session=null;this.room?.off('ready',this.readyHandler);this.room?.leave();this.room=null;}
      this.preview=false;this.screen='setup';this.hide();return;
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
  async connect(queue){
    if(!this.adapterFactory||this.connecting)return;
    this.connecting=true;this.preview=false;const attempt=this.attempt=(this.attempt??0)+1;this.render();
    try {
      const room=await this.sdk.multiplayer.open({players:2,mode:COMPETITIVE_PROTOCOL,queue});
      if(attempt!==this.attempt){room.leave();return;}
      this.room=room;this.invited=false;room.on('ready',this.readyHandler);this.beginRound();
    }catch(error){if(attempt===this.attempt){this.screen='queues';if(error.message!=='Cancelled')this.notice='Connection ended. Choose a mode to try again.';}}
    finally{this.connecting=false;this.render();}
  }
  beginRound(){
    if(!this.room||this.session?.round===this.room.round)return;
    const bag=this.session?.model?.state.mode!=='ranked'?this.session?.model?.snapshot.bag:null;
    this.session?.stop();this.model=null;this.screen='set';this.root.hidden=false;this.names=this.room.players.map(p=>p.name);
    this.session=new MeleeCompetitiveRoom({room:this.room,build:this.build,selection:this.selection,bag:bag??null,adapter:this.adapterFactory(this.room),
      onChange:(s,model)=>{this.model=model;this.root.hidden=s.phase==='playing';this.render();},onError:error=>{this.notice=error.message;this.screen='error';this.root.hidden=false;this.render();},
      onResult:result=>{this.platformResult=result;this.root.hidden=false;const pick=this.model?.state.selections[this.session?.seat];if(pick)this.selection={...pick};this.render();}});
    this.render();
  }
}
