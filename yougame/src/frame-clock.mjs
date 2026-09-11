// Fixed 60 Hz simulation driven only by display callbacks. Hidden time is
// discarded; late frames get bounded catch-up rather than a burst of old inputs.
export class FrameClock {
 constructor({hz=60,maxSteps=2}={}){this.interval=1000/hz;this.maxSteps=maxSteps;this.reset();}
 reset(){this.last=null;this.pending=0;}
 advance(now){
  if(this.last===null){this.last=now;return 1;}
  const elapsed=Math.max(0,now-this.last);this.last=now;
  if(elapsed>250){this.pending=0;return 1;}
  this.pending+=elapsed;
  // Browser timestamps are rounded and refresh intervals vary slightly. Without
  // a small tolerance, a 120 Hz display alternates one/three refreshes per tick
  // whenever its nominal two-refresh boundary lands just below 16.666… ms.
  // Keep the negative remainder so this tolerance never accumulates extra time.
  const due=Math.max(0,Math.floor((this.pending+1)/this.interval));
  this.pending-=due*this.interval;
  return Math.min(due,this.maxSteps);
 }
}
export function startOfflineClock(step,{onError=console.error,doc=document,raf=requestAnimationFrame,cancel=cancelAnimationFrame}={}){
 const clock=new FrameClock();let id=0,closed=false;
 function tick(now){if(closed)return;try{if(doc.hidden)clock.reset();else for(let n=clock.advance(now);n>0;n--)step();}catch(e){stop();onError(e);return;}id=raf(tick);}
 function visibility(){clock.reset();}
 function stop(){closed=true;cancel(id);doc.removeEventListener('visibilitychange',visibility);}
 doc.addEventListener('visibilitychange',visibility);id=raf(tick);return stop;
}
