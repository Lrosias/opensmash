// Keyboard bindings follow GCPad::LoadDefaults in Slippi's Dolphin fork:
// https://github.com/project-slippi/Ishiiruka/blob/slippi/Source/Core/Core/HW/GCPadEmu.cpp
export const standardButtons=['a','b','x','y','l1','r1','l2','r2','start'];
const customKeys={
  stickmod:['ShiftLeft'],cmod:['ControlLeft'],
  dup:['KeyT'],ddown:['KeyG'],dleft:['KeyF'],dright:['KeyH'],
  startalt:['AltLeft'],
};
const labels={stickmod:'Stick half',cmod:'C-stick half',dup:'D-pad up',ddown:'D-pad down',
  dleft:'D-pad left',dright:'D-pad right',startalt:'Start guard'};
const emptyKeys=Object.fromEntries([...standardButtons,'select','up','down','left','right',
  'aimUp','aimDown','aimLeft','aimRight',...Object.keys(customKeys)].map(id=>[id,[]]));
export const keyboardOptions={
  preset:'twin-stick',players:4,deadzone:.1,touch:false,buttons:standardButtons,
  labels:{a:'A / confirm',b:'B / back',x:'Jump X',y:'Jump Y',l1:'Shield L',r1:'Grab Z',l2:'Analog L',r2:'Shield R',start:'Start'},
  custom:Object.entries(customKeys).map(([id,keys])=>({id,label:labels[id],keys})),
  keys:[{...emptyKeys,...customKeys,
    up:['ArrowUp'],down:['ArrowDown'],left:['ArrowLeft'],right:['ArrowRight'],
    aimUp:['KeyI'],aimDown:['KeyK'],aimLeft:['KeyJ'],aimRight:['KeyL'],
    a:['KeyX'],b:['KeyZ'],x:['KeyC'],y:['KeyS'],r1:['KeyD'],
    l1:['KeyQ'],r2:['KeyW'],start:['Enter']},
    ...Array.from({length:3},()=>({...emptyKeys}))],
};

// Touch adds to port 1: buttons merge, a deflected touch stick replaces that stick,
// the triggers take the larger value. A neutral touch pad leaves the seat's pad alone.
export function withTouch(pad,t) {
  if(!t.some(Boolean))return pad;
  const main=t[1]||t[2],c=t[3]||t[4];
  return [pad[0]|t[0],main?t[1]:pad[1],main?t[2]:pad[2],c?t[3]:pad[3],c?t[4]:pad[4],Math.max(pad[5],t[5]),Math.max(pad[6],t[6])];
}

export function gameCubeInput(s) {
  const keyboard=s.source==='keyboard';
  // Read the SDK's remappable movement axes; keyboard directions cancel when
  // opposed. Keep the port's 80-unit Melee stick range and halve it for modifiers.
  // SDK axes merge devices, while source names the last active device. Custom
  // keyboard modifiers/D-pad/Start guard remain active if a pad changes source.
  const mainScale=s.stickmod?40/127:keyboard?80/127:1;
  const cScale=s.cmod?40/127:keyboard?80/127:1;
  const buttons=(s.a?1:0)|(s.b?2:0)|(s.x?4:0)|(s.y?8:0)|(s.r1?16:0)|
    (s.start&&!s.startalt?32:0)|
    (s.dup?64:0)|(s.ddown?128:0)|
    (s.dleft?256:0)|(s.dright?512:0)|
    (s.l1||s.l2?1024:0)|(s.r2?2048:0);
  return [buttons,s.move.x*mainScale,-s.move.y*mainScale,s.aim.x*cScale,-s.aim.y*cScale,
    s.l2||(keyboard&&s.l1)?1:0,s.r2?1:0];
}
