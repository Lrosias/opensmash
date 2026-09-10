// B0XX keyboard layout and analog behavior adapted from agirardeau/b0xx-ahk.
// See B0XX-LICENSE.txt and https://github.com/agirardeau/b0xx-ahk.
export const standardButtons=['a','b','x','y','l1','r1','l2','r2','start'];
export const rectangleKeys={
  stickup:['BracketRight'],stickdown:['Digit3'],stickleft:['Digit2'],stickright:['Digit4'],
  modx:['KeyV'],mody:['KeyB'],cup:['KeyK'],cdown:['Space'],cleft:['KeyN'],cright:['Comma'],
  light:['Minus'],mid:['Equal'],dup:['ArrowUp'],ddown:['ArrowDown'],dleft:['ArrowLeft'],dright:['ArrowRight'],
};
const labels={stickup:'Stick up',stickdown:'Stick down',stickleft:'Stick left',stickright:'Stick right',
  modx:'Mod X',mody:'Mod Y',cup:'C up',cdown:'C down',cleft:'C left',cright:'C right',
  light:'Light shield',mid:'Mid shield',dup:'D-pad up',ddown:'D-pad down',dleft:'D-pad left',dright:'D-pad right'};
const emptyKeys=Object.fromEntries([...standardButtons,'up','down','left','right','aimUp','aimDown','aimLeft','aimRight',
  ...Object.keys(rectangleKeys)].map(id=>[id,[]]));
export const keyboardOptions={
  preset:'twin-stick',players:4,deadzone:.1,touch:false,buttons:standardButtons,
  labels:{a:'Attack / confirm',b:'Special / back',x:'Jump X',y:'Jump Y',l1:'Shield L',r1:'Grab',l2:'Shield L',r2:'Shield R',start:'Start'},
  custom:Object.entries(rectangleKeys).map(([id,keys])=>({id,label:labels[id],keys})),
  keys:[{...emptyKeys,...rectangleKeys,a:['KeyM'],b:['KeyO'],x:['KeyP'],y:['Digit0'],
    l1:['KeyQ'],r1:['BracketLeft'],r2:['Digit9'],start:['Digit7']},emptyKeys,emptyKeys,emptyKeys],
};

// Last input wins, without restoring an earlier opposite direction on release.
// Listen to SDK actions rather than physical keys so the Controls remapper works.
export class RectangleInput {
  held=new Set(); last={}; horizontalLockout=false;
  event(id,pressed) {
    const before=this.held.has(id);
    if(pressed)this.held.add(id);else this.held.delete(id);
    if(pressed&&!before) {
      for(const [axis,ids] of Object.entries({x:['stickleft','stickright'],y:['stickdown','stickup'],cx:['cleft','cright'],cy:['cdown','cup']}))
        if(ids.includes(id))this.last[axis]=id;
      if((id==='stickleft'||id==='stickright')&&this.held.has('stickleft')&&this.held.has('stickright'))this.horizontalLockout=true;
      if(id==='modx')this.horizontalLockout=false;
    }
    if(!pressed&&['stickleft','stickright','modx'].includes(id))this.horizontalLockout=false;
  }
  reset(){this.held.clear();this.last={};this.horizontalLockout=false;}
  axis(negative,positive,axis,s){const last=this.last[axis];return last&&s[last]?(last===positive?1:-1):0;}
  sample(s) {
    const x=this.axis('stickleft','stickright','x',s),y=this.axis('stickdown','stickup','y',s);
    const both=s.modx&&s.mody,lock=this.horizontalLockout&&!y;
    const mx=s.modx&&!s.mody&&!lock,my=s.mody&&!s.modx&&!lock;
    const cx=both?0:this.axis('cleft','cright','cx',s),cy=both?0:this.axis('cdown','cup','cy',s);
    const shield=s.l1||s.l2||s.r2||s.light||s.mid;
    let ax=0,ay=0;
    if(x&&y) {
      if(shield) [ax,ay]=mx?[.6375,.375]:my?(y>0?[.475,.875]:[.5,.85]):(y>0?[.7,.7]:[.7,.6875]);
      else if((mx||my)&&(cx||cy||s.b)) {
        const direction=cy>0?'up':cy<0?'down':cx<0?'left':cx>0?'right':'none';
        const normal=mx?{up:[.7,.5125],down:[.7,.3625],left:[.7875,.4875],right:[.6125,.525]}:
          {up:[.5125,.7],down:[.3625,.7],left:[.4875,.7875],right:[.6375,.7625]};
        const special=mx?{up:[.7375,.5375],down:[.875,.45],left:[.85,.525],right:[.6375,.5375],none:[.9125,.3875]}:
          {up:[.5875,.8],down:[.45,.875],left:[.525,.85],right:[.5875,.7125],none:[.3875,.9125]};
        [ax,ay]=(s.b?special:normal)[direction];
      } else [ax,ay]=mx?[.7375,.3125]:my?[.3125,.7375]:[.7,.7];
    } else if(x) ax=mx?.6625:my&&!s.b?.3375:1;
    else if(y) ay=mx?.5375:my?.7375:1;
    let acx=0,acy=0;
    if(cx&&cy){acx=.525*cx;acy=.85*cy;}
    else if(cy)acy=cy;
    else if(cx){acx=(mx&&y?.9:1)*cx;acy=mx&&y?.5*y:0;}
    // Melee coordinates use 80 stick units; the host maps normalized axes to 127.
    const scale=80/127;
    return {x:ax*x*scale,y:ay*y*scale,cx:acx*scale,cy:acy*scale,
      l:s.l2?1:0,r:s.mid?94/255:s.light?49/255:s.r2?1:0,
      dup:s.dup||(both&&s.cup),ddown:s.ddown||(both&&s.cdown),
      dleft:s.dleft||(both&&s.cleft),dright:s.dright||(both&&s.cright)};
  }
}

export function gameCubeInput(s,rectangle) {
  const axes=s.source==='keyboard'?rectangle.sample(s):{x:s.move.x,y:-s.move.y,cx:s.aim.x,cy:-s.aim.y,l:s.l2?1:0,r:s.r2?1:0};
  const buttons=(s.a?1:0)|(s.b?2:0)|(s.x?4:0)|(s.y?8:0)|(s.r1?16:0)|(s.start?32:0)|
    (axes.dup?64:0)|(axes.ddown?128:0)|(axes.dleft?256:0)|(axes.dright?512:0)|
    (s.l1||s.l2?1024:0)|(s.r2?2048:0);
  return [buttons,axes.x,axes.y,axes.cx,axes.cy,axes.l,axes.r];
}
