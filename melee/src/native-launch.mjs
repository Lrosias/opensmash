// Every online game is a native session: the platform freezes the physical
// ports, Melee's own menus choose fighters, rules and stages.
export function nativeLaunch(launch) {
  if(launch?.nativeSession!==true)throw Error('Only native Melee sessions can boot.');
  const slots=launch.slots;
  if(!Array.isArray(slots)||slots.length<1||slots.length>4||new Set(slots).size!==slots.length||slots.some(s=>!Number.isInteger(s)||s<0||s>3))throw Error('Invalid Melee controller ports.');
  return {session:true,slots:slots.slice(),mask:slots.reduce((m,slot)=>m|(1<<slot),0),groups:['menu']};
}
