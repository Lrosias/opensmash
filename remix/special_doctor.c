/* DrMario.asm / DrLuigi.asm inherit their respective native state machines.
 * fireball.asm supplies the distinct capsule assets, physics and palettes. */
#include <wp/weapon.h>
#include <sys/utils.h>
static FTStatusDesc doctor_status[2][64];
extern WPDesc dWPMarioFireballWeaponDesc;
static sb32 capsule_update(GObj *g){
 WPStruct *w=wpGetStruct(g);int luigi=w->weapon_vars.fireball.index;
 if(wpMainDecLifeCheckExpire(w)){efManagerDustExpandSmallMakeEffect(&DObjGetStruct(g)->translate.vec.f,1);return TRUE;}
 wpMainApplyGravityClampTVel(w,luigi?0:1.5F,luigi?55:60);DObjGetStruct(g)->rotate.vec.f.x+=luigi?0.4363323F:0.3F;return FALSE;
}
static sb32 capsule_map(GObj *g){
 WPStruct *w=wpGetStruct(g);Vec3f pos;int luigi=w->weapon_vars.fireball.index;wpMapTestAll(g);
 if(wpMapCheckAllRebound(g,MAP_FLAG_MAIN_MASK,luigi?0.85F:0.95F,&pos)){
  if(lbCommonMag2D(&w->physics.vel_air)<(luigi?30:25))return TRUE;
  wpMainVelSetModelPitch(g);efManagerSparkleWhiteMakeEffect(&DObjGetStruct(g)->translate.vec.f);
 }return FALSE;
}
static sb32 capsule_reflect(GObj *g){WPStruct *w=wpGetStruct(g);w->lifetime=w->weapon_vars.fireball.index?100:140;wpMainReflectorSetLR(w,ftGetStruct(w->owner_gobj));wpMainVelSetModelPitch(g);return FALSE;}
static void doctor_capsule(GObj *g){
 FTStruct *fp=ftGetStruct(g);Vec3f pos={0,0,0};GObj *projectile;WPStruct *w;WPDesc d;int luigi=fp->fkind==75;
 if(!fp->motion_vars.flags.flag0)return;fp->motion_vars.flags.flag0=0;
 gmCollisionGetFighterPartsWorldPosition(fp->joints[FTMARIO_FIREBALL_SPAWN_JOINT],&pos);
 d=dWPMarioFireballWeaponDesc;d.p_weapon=fp->data->p_file_special1;d.o_attributes=0;d.proc_update=capsule_update;d.proc_map=capsule_map;d.proc_reflector=capsule_reflect;
 projectile=wpManagerMakeWeapon(g,&d,&pos,WEAPON_FLAG_COLLPROJECT|WEAPON_FLAG_PARENT_FIGHTER);if(!projectile)return;
 w=wpGetStruct(projectile);w->weapon_vars.fireball.index=luigi;w->lifetime=luigi?100:140;
 w->physics.vel_air=(Vec3f){(luigi?36:40*__cosf(-0.4F))*fp->lr,luigi?0:40*__sinf(-0.4F),0};
 if(DObjGetStruct(projectile)->mobj)DObjGetStruct(projectile)->mobj->palette_id=syUtilsRandIntRange(3)+(luigi?3:0);
 wpMainVelSetModelPitch(projectile);
}
static void doctor_ng(GObj *g){ftMarioSpecialNSetStatus(g);ftGetStruct(g)->proc_accessory=doctor_capsule;}
static void doctor_na(GObj *g){ftMarioSpecialAirNSetStatus(g);ftGetStruct(g)->proc_accessory=doctor_capsule;}
static void doctor_ng_map(GObj *g){ftMarioSpecialNProcMap(g);if(ftGetStruct(g)->status_id==224)ftGetStruct(g)->proc_accessory=doctor_capsule;}
static void doctor_na_map(GObj *g){ftMarioSpecialAirNProcMap(g);if(ftGetStruct(g)->status_id==223)ftGetStruct(g)->proc_accessory=doctor_capsule;}
static void doctor_install(FighterDescriptor *d,int id){
 int luigi=id==75;const FighterDescriptor *parent=port_fighter_descriptor(luigi?nFTKindLuigi:nFTKindMario);FTStatusDesc *s=doctor_status[luigi];
 memcpy(s,safe_statuses,sizeof(doctor_status[0]));memcpy(s,parent->special_descs,9*sizeof(*s));
 s[3].proc_map=doctor_ng_map;s[4].proc_map=doctor_na_map;
 d->special_descs=s;memcpy(d->special_handler,parent->special_handler,sizeof(d->special_handler));d->special_handler[0]=doctor_ng;d->special_handler[3]=doctor_na;d->computer_attack_list=parent->computer_attack_list;
}
