// Menus use the contact as neutral; fights use the visible stick center so an
// edge contact immediately drives movement. Undo the portrait surface rotation.
export class TouchStick {
 start(x,y,radius,rotated=false,center=null){
  this.origin={x:center?.x??x,y:center?.y??y,radius,rotated};
  return this.move(x,y);
 }
 move(x,y){
  if(!this.origin)return [0,0];
  const o=this.origin,dx=(x-o.x)/o.radius,dy=(y-o.y)/o.radius;
  return o.rotated?[dy,-dx]:[dx,dy];
 }
 end(){this.origin=null;return [0,0];}
}
