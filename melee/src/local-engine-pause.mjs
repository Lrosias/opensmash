// Online engines lease the local engine's pause. Serial transitions prevent a
// cancelled boot or an old session's teardown from resuming beneath a new one.
export function createLocalEnginePause({ready, setPaused, loader, audio, resetFrames, onError=console.warn}) {
  let leases=0, blocked=false, suspended=false, tail=Promise.resolve();
  function transition() {
    const next=tail.then(async()=>{
      if(leases) {
        if(suspended)return;
        blocked=true;
        // Foreground asset reads must still complete: the CPU may be waiting
        // for one while its native pause request is being serviced.
        await loader().pauseBackground();
        await setPaused(true);
        await audio().suspend();
        suspended=true;
      } else if(blocked) {
        await setPaused(false);
        resetFrames();
        blocked=false;suspended=false;
        loader().resumeBackground();
        void audio().resume().catch(onError);
      }
    });
    tail=next.catch(()=>{});
    return next;
  }
  return {
    get blocked(){return blocked;},
    async acquire(signal) {
      signal?.throwIfAborted();
      // Boot is shared with local play; cancellation only stops this waiter.
      await new Promise((resolve,reject)=>{
        const abort=()=>reject(signal.reason);
        signal?.addEventListener('abort',abort,{once:true});
        Promise.resolve(ready).then(resolve,reject).finally(()=>signal?.removeEventListener('abort',abort));
      });
      signal?.throwIfAborted();
      leases++;
      let released=false;
      const release=()=>{
        if(released)return;
        released=true;leases--;signal?.removeEventListener('abort',release);
        void transition().catch(onError);
      };
      signal?.addEventListener('abort',release,{once:true});
      try {await transition();signal?.throwIfAborted();return release;}
      catch(error){release();throw error;}
    }
  };
}
