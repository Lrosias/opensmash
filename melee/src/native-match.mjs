// Isolate each boot so a counterpick never inherits RNG, scene or worker state.
export async function createNativeMatch(launch,onStatus=()=>{},signal) {
  signal?.throwIfAborted();
  const iframe=document.createElement('iframe');
  iframe.src=new URL('./match.html',import.meta.url).href;
  iframe.title='Online Melee match';iframe.className='native-match';
  iframe.allow='autoplay';iframe.style.visibility='hidden';
  const channel=new MessageChannel(),pending=new Map();let sequence=0,closed=false,abortLoad,frame;
  const call=(method,args=[])=>new Promise((resolve,reject)=>{
    if(closed){reject(Error('The Melee match has closed.'));return;}
    const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(Error('The Melee engine did not respond.'));},120000);
    pending.set(id,{resolve,reject,timer});channel.port1.postMessage({id,method,args});
  });
  channel.port1.onmessage=({data})=>{
    if(data.status){onStatus(data.status);return;}
    const p=pending.get(data.id);if(!p)return;
    pending.delete(data.id);clearTimeout(p.timer);
    if(data.error)p.reject(Error(data.error));else {if(Number.isInteger(data.value?.frame))frame=data.value.frame;p.resolve(data.value);}
  };
  const destroy=()=>{
    if(closed)return;closed=true;iframe.remove();channel.port1.close();
    signal?.removeEventListener('abort',destroy);abortLoad?.();
    for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('The Melee match has closed.'));}pending.clear();
  };
  signal?.addEventListener('abort',destroy,{once:true});
  try {
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('The Melee match could not load.')),30000);
      abortLoad=()=>{clearTimeout(timer);reject(Error('The Melee match has closed.'));};
      iframe.onload=()=>{clearTimeout(timer);iframe.contentWindow.postMessage({kind:'melee-native-port'},location.origin,[channel.port2]);resolve();};
      iframe.onerror=()=>{clearTimeout(timer);reject(Error('The Melee match could not load.'));};
      document.body.append(iframe);
    });
    const initial=await call('boot',[launch]);
    return {initial,get frame(){return frame;},get active(){return !closed;},get closed(){return closed;},get pending(){return pending.size>0;},
      checkpointStats:()=>call('checkpointStats'),manageCheckpoints:()=>call('manageCheckpoints'),save:()=>call('save'),load:state=>call('load',[state]),discard:state=>call('discard',[state]),
      step:(inputs,options)=>call('step',[inputs,options]),resumeAudio:()=>call('audio'),saveCache:()=>call('cache'),destroy,
      show:()=>{iframe.style.visibility='visible';}};
  } catch(error){destroy();throw error;}
}

// Keep this engine alive through native CSS, stages, results and rematches.
// Roster changes require a fresh synchronized boot; no scene rollback is exposed.
export function createNativeSession({slots},onStatus=()=>{},signal) {
  return createNativeMatch({nativeSession:true,slots},onStatus,signal);
}
