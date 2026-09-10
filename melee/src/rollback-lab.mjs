import {AsyncRollbackTimeline} from './rollback-timeline.mjs';
import {neutralPad,validPad} from './rollback-engine.mjs';

// Two local controller seats with delayed delivery of P2's inputs. This exercises
// the real native engine; it is intentionally not an Internet matchmaking mode.
export async function startRollbackLab({engine,input,onError}) {
  await engine.enable();
  const remote=new Map([[0,neutralPad()],[1,neutralPad()]]),packets=[];
  let clock=0;
  const timeline=new AsyncRollbackTimeline({players:['p1','p2'],me:'p1',neutral:neutralPad(),
    input:()=>{
      const pads=[input(0),input(1)];
      if(!pads.every(validPad))throw Error('Invalid controller sample');
      remote.set(timeline.recorded,pads[1]);
      return pads[0];
    },
    send:entries=>{
      const bundle=entries.map(([f])=>[f,remote.get(f)]);
      // Vary delay and drop some bundles; repeated history repairs those drops.
      if(clock%7)packets.push({at:clock+3+clock%3,bundle});
      for(const f of remote.keys())if(f<timeline.recorded-32)remote.delete(f);
    },
    engine:{save:()=>engine.save(),load:s=>engine.load(s),
      step:(inputs,metadata)=>engine.step([inputs.p1,inputs.p2,neutralPad(),neutralPad()],metadata)},
    onError:error=>{clearInterval(timer);onError(error);},
  });
  const timer=setInterval(()=>{
    clock++;
    timeline.tick();
    for(let i=packets.length-1;i>=0;i--)if(packets[i].at<=clock)
      timeline.receive('p2',packets.splice(i,1)[0].bundle);
  },1000/60);
  return {timeline,async stop(){clearInterval(timer);timeline.stop();await timeline.running;if(!engine.closed)await engine.release();}};
}
