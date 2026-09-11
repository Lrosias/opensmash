import {NativeCheckpoints} from './checkpoints.mjs';

export async function prepareRollbackEngine(raw,{getState,setPads,cancelled=()=>false}) {
 // Loading/render-resource creation is outside the speculative timeline. Both
 // seats advance with neutral inputs to the exact first active battle tick.
 raw.silence?.(true);
 setPads([[0,0,0],[0,0,0]]);
 for(let n=0;!getState()?.[4];n++){
  if(cancelled())return null;
  if(n>=900)throw new Error('Native battle did not finish loading');
  raw.step();
  if(n%16===15)await new Promise(resolve=>setTimeout(resolve,0));
 }
 raw.silence?.(false);
 if(getState()[4]!==1)throw new Error('Native battle started at an unexpected tick');
 const store=new NativeCheckpoints(raw);let state=[...getState()],closed=false;
 return {
  save(frame){if(closed)throw new Error('Engine was closed');return store.save(frame,state);},
  load(handle){if(closed)throw new Error('Engine was closed');state=store.load(handle);raw.rollback?.();},
  step(pads){if(closed)throw new Error('Engine was closed');setPads(pads);raw.step();state=[...getState()];return state;},
  destroy(){closed=true;store.destroy();}
 };
}
