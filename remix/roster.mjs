import {createInput} from './input.mjs';
let input=createInput({allowStart:true});
let engine;
function bindInput(){
 input.destroy();input=createInput({allowStart:true});
 if(document.activeElement?.tagName!=='SELECT')input.attach(window);
 if(engine)input.attach(engine);
}
window.marthSamples=[];
window.marthState=()=>{
 if(!engine?.Module?._port_marth_probe||engine.Module.nativeScene!==22)return [];
 const at=engine.Module._port_marth_probe()>>2;
 const words=Array.from(engine.HEAP32.slice(at,at+32));
 return [words.slice(0,16),words.slice(16,32)];
};
window.openSmashAttachEngine=win=>{
 engine=win;bindInput();
 return {menuState:()=>({phase:0}),menuAction(){},ready(){},afterTick(){},
  beforeTick(){
   const rows=window.marthState();
   if(rows.length){window.marthSamples.push(rows);if(window.marthSamples.length>3600)window.marthSamples.shift();}
   return true;
  },
  error(e){document.querySelector('#error').textContent=e;console.error(e);},
  readPorts(ptr,H){const p=input.read();for(let i=0;i<4;i++){const b=(ptr>>2)+i*4;H[b]=i===0?2:1;H[b+1]=i===0?p[0]:0;H[b+2]=i===0?p[1]:0;H[b+3]=i===0?p[2]:0;}}
 };
};
const roster=await fetch('./roster.json').then(r=>r.json());
window.remixRoster=roster;
const params=new URLSearchParams(location.search);
let selected=roster.find(f=>f.id===Number(params.get('fighter')??58))??roster.find(f=>f.id===58);
const chooser=document.querySelector('#fighter'),mode=document.querySelector('#mode');
const groups=new Map();
for(const f of roster){
 const group=f.name.startsWith('Poly ')?'Polygon fighters':f.id<12?'Original fighters':f.id>=29&&f.id<=76?'Remix fighters and variants':'Metal and giant fighters';
 if(!groups.has(group)){const el=document.createElement('optgroup');el.label=group;groups.set(group,el);chooser.append(el);}
 const opt=document.createElement('option');opt.value=f.id;opt.textContent=f.name;groups.get(group).append(opt);
}
chooser.value=selected.id;mode.value=params.has('practice')?'practice':'cpu';
document.querySelector('#count').textContent=`${roster.length} fighters and variants extracted from your ROM`;
function launch(){
 selected=roster.find(f=>f.id===Number(chooser.value));
 const practice=mode.value==='practice';
 const query=new URLSearchParams({fighter:String(selected.id)});if(practice)query.set('practice','1');
 history.replaceState(null,'',`?${query}`);
 window.marthSamples=[];engine=null;bindInput();document.querySelector('#error').textContent='';
 document.querySelector('#details').textContent=selected.id===60?'Sandbag · Original ROM model and animations. Practice dummy with no attacks.':`${selected.name} · Original ROM model, animations and normal attacks. Special moves, voices and some fighter-specific behavior remain unfinished.`;
 const frame=document.createElement('iframe');frame.title=`${selected.name} in Open Smash`;
 frame.src=`engine/play.html?SSB64_REMIX_FIGHTER=${selected.id}&SSB64_BOOT_BATTLE=${practice?'1,8,16,0':'1,8,6,1'}&SSB64_VS_INTRO=0&SSB64_STOCKS=3${params.has('test')?'&SSB64_REMIX_TEST=1':''}`;
 document.querySelector('#game').replaceChildren(frame);
}
document.querySelector('#restart').onclick=launch;
for(const control of [chooser,mode]){control.addEventListener('focus',bindInput);control.addEventListener('blur',bindInput);control.onchange=()=>{control.blur();launch();};}
launch();
