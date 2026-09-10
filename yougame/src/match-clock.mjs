export function clockText(seconds){const n=Math.max(0,Math.floor(seconds));return `${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`;}
export function clockPosition(width,height,reserved=[]){
 const w=88,h=36,left=Math.max(8,(width-w)/2);let top=12;
 // Measured host controls are already expressed in the play surface's local
 // coordinates, including CSS quarter turns. Keep a small visual gutter.
 for(let pass=0;pass<=reserved.length;pass++){
  const hit=reserved.find(r=>left<r.left+r.width+8&&left+w>r.left-8&&top<r.top+r.height+8&&top+h>r.top-8);
  if(!hit)break;top=hit.top+hit.height+8;
 }
 return {left,top:Math.max(8,Math.min(top,height-h-8))};
}
export function createMatchClock(){
 const surface=document.getElementById('play-surface'),clock=document.createElement('output');
 clock.id='match-clock';clock.hidden=true;clock.setAttribute('role','timer');clock.setAttribute('aria-live','off');surface.append(clock);
 function render(seconds){clock.textContent=clockText(seconds);clock.setAttribute('aria-label',`${clock.textContent} remaining`);clock.classList.toggle('low-time',seconds<=30);}
 function layout(){if(clock.hidden)return;const width=surface.clientWidth,height=surface.clientHeight;const info=window.YouGame?.ui?.getLayout?.(surface);let reserved=info?.reserved||[];
  if(!['ready','standalone'].includes(info?.status))reserved=[...reserved,{left:0,top:0,width:72,height:72},{left:width-192,top:height-60,width:192,height:60}];
  const pos=clockPosition(width,height,reserved);clock.style.left=`${pos.left}px`;clock.style.top=`max(${pos.top}px, var(--safe-top, 0px))`;
 }
 const observer=typeof ResizeObserver==='function'?new ResizeObserver(layout):null;observer?.observe(surface);window.addEventListener('resize',layout);window.YouGame?.ui?.onChange?.(layout);
 return{show(){render(480);clock.hidden=false;document.body.classList.add('online-playing');layout();},hide(){clock.hidden=true;document.body.classList.remove('online-playing');},updateStatus(text){const match=/· (\d+)s remaining$/.exec(text);if(match)render(Number(match[1]));}};
}
