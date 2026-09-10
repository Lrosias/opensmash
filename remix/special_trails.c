/* Use the ROM's attachment bone, axis, colors and lengths with the engine's
 * existing three-sample trail renderer. Samples live in fighter rollback memory. */
#include "trail_data.h"
static RemixTrail younglink_trail={31,11,2,{0,255,255,0},{255,255,255,0},50,250};
static RemixTrail *remix_trail(FTStruct *fp){
 if(!port_remix_enabled())return NULL;
 int id=fp->afterimage.is_itemswing;if(id==0&&fp->fkind==31)return &younglink_trail;
 if(id<2||id>=2+sizeof(remix_trails)/sizeof(*remix_trails))return NULL;
 RemixTrail *t=&remix_trails[id-2];return t->fighter==65535||t->fighter==fp->fkind?t:NULL;
}
int port_remix_trail_update(FTStruct *fp){
 RemixTrail *t=remix_trail(fp);if(!t)return 0;
 DObj *joint=fp->joints[t->joint];if(!joint)return 1;
 FTParts *parts=joint->user_data.p;func_ovl2_800EDBA4(joint);
 FTAfterImage *a=&fp->afterimage.desc[fp->afterimage.desc_id];
 a->translate_x=parts->mtx_translate[3][0];a->translate_y=parts->mtx_translate[3][1];a->translate_z=parts->mtx_translate[3][2];
 a->vec=(Vec3f){parts->mtx_translate[t->axis][0],parts->mtx_translate[t->axis][1],parts->mtx_translate[t->axis][2]};
 fp->afterimage.desc_id=(fp->afterimage.desc_id+1)%3;if(fp->afterimage.drawstatus<=2)fp->afterimage.drawstatus++;return 1;
}
int port_remix_trail_mode(FTStruct *fp){return remix_trail(fp)?0:fp->afterimage.is_itemswing;}
void port_remix_trail_style(FTStruct *fp,float *start,float *end,SYColorRGBA **first,SYColorRGBA **last){
 RemixTrail *t=remix_trail(fp);if(!t)return;*start=t->start;*end=t->end;*first=&t->first;*last=&t->last;
}
