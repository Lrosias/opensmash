import {STAGES,validSelection} from './competitive-rules.mjs';

// A native session freezes physical ports, while the native game owns choices.
export function nativeLaunch(launch) {
  const session=launch?.nativeSession===true;
  if(!session&&(!launch||!STAGES.some(s=>s.id===launch.stage)||!Array.isArray(launch.selections)||launch.selections.length<2||launch.selections.length>4||!launch.selections.every(validSelection)))throw Error('Invalid Melee match configuration.');
  const slots=launch.slots??(session?null:launch.selections.map((_,i)=>i));
  if(!Array.isArray(slots)||slots.length<1||slots.length>4||(!session&&slots.length!==launch.selections.length)||new Set(slots).size!==slots.length||slots.some(s=>!Number.isInteger(s)||s<0||s>3))throw Error('Invalid Melee controller ports.');
  return {session,slots:slots.slice(),mask:slots.reduce((m,slot)=>m|(1<<slot),0),
    groups:session?['menu']:['menu','match','stage:'+launch.stage,...launch.selections.map(s=>'fighter:'+s.fighter)]};
}
