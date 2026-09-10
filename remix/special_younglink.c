/* YoungLinkSpecial.asm: native boomerang/spin attack plus ground-running Bombchu. */
#include <it/item.h>
static FTStatusDesc younglink_status[64];
static ITStatusDesc bombchu_status[7];
extern ITStatusDesc dItLinkBombStatusDescs[];
static int bombchu_is(ITStruct *ip){return port_remix_enabled()&&main_files[31][0]&&ip->kind==nITKindLinkBomb&&(void*)ip->attr==(char*)main_files[31][0]+0x40;}
void **port_remix_bomb_file(GObj *g,void **native){return bombchu_is(itGetStruct(g))?&main_files[31][0]:native;}
ITStatusDesc *port_remix_item_status(GObj *g,ITStatusDesc *table){return bombchu_is(itGetStruct(g))?bombchu_status:table;}
static void bombchu_direction(GObj *g){DObjGetStruct(g)->rotate.vec.f.z=itGetStruct(g)->lr<0?PI32:0;}
static sb32 bombchu_explode(GObj *g){itLinkBombExplodeInitVars(g);return FALSE;}
static void bombchu_fall(GObj *g){
 ITStruct *ip=itGetStruct(g);itLinkBombCommonSetHitStatusNormal(g);ip->pickup_wait=0;ip->is_allow_knockback=TRUE;
 itMainSetStatus(g,bombchu_status,4);ip->physics.vel_air.y=-20;ip->ga=nMPKineticsAir;bombchu_direction(g);
}
static void bombchu_move(GObj *g){
 ITStruct *ip=itGetStruct(g);ip->times_landed=0;ip->ga=nMPKineticsGround;ip->physics.vel_air=(Vec3f){34*ip->lr,0,0};
 itLinkBombCommonSetHitStatusNormal(g);itMainSetStatus(g,bombchu_status,6);ip->is_thrown=TRUE;bombchu_direction(g);
}
static sb32 bombchu_move_update(GObj *g){
 ITStruct *ip=itGetStruct(g);
 if(ip->lifetime==0){itLinkBombExplodeInitVars(g);return FALSE;}
 if(ip->lifetime==ITLINKBOMB_BLOAT_BEGIN){itMainCheckSetColAnimID(g,nGMColAnimItemLinkBombCritical,ITLINKBOMB_BLOAT_COLANIM_LENGTH);ip->item_vars.linkbomb.scale_id=1;}
 if(ip->lifetime<ITLINKBOMB_BLOAT_BEGIN)itLinkBombExplodeWaitUpdateScale(g);
 ip->lifetime--;if(!(ip->lifetime&7))efManagerDustLightMakeEffect(&DObjGetStruct(g)->translate.vec.f,ip->lr,1);
 return FALSE;
}
static sb32 bombchu_move_map(GObj *g){
 ITStruct *ip=itGetStruct(g);itMapCheckLRWallProcNoFloor(g,bombchu_fall);
 if(ip->ga==nMPKineticsGround&&(ip->coll_data.mask_curr&(MAP_FLAG_LWALL|MAP_FLAG_RWALL))){ip->lr=(ip->coll_data.mask_curr&MAP_FLAG_LWALL)?-1:1;ip->physics.vel_air.x=34*ip->lr;bombchu_direction(g);}return FALSE;
}
static sb32 bombchu_thrown_map(GObj *g){
 ITStruct *ip=itGetStruct(g);itMapTestAllCollisionFlag(g,MAP_FLAG_MAIN_MASK);
 if(itMapCheckCollideAllRebound(g,MAP_FLAG_MAIN_MASK,0.375F,NULL)){
  itLinkBombFallSetStatus(g);if(ip->coll_data.mask_stat&MAP_FLAG_FLOOR)bombchu_move(g);
 }return FALSE;
}
static sb32 bombchu_hold(GObj *g){
 sb32 done=itLinkBombHoldProcUpdate(g);ITStruct *ip=itGetStruct(g);
 if(ip->owner_gobj){ip->lr=ftGetStruct(ip->owner_gobj)->lr;DObjGetStruct(g)->child->rotate.vec.f.z=ip->lr<0?PI32:0;}return done;
}
static sb32 bombchu_reflect(GObj *g){itMainCommonProcReflector(g);ITStruct *ip=itGetStruct(g);ip->lr=ip->physics.vel_air.x<0?-1:1;bombchu_direction(g);return FALSE;}
static void younglink_turn(GObj *g){
 FTStruct *fp=ftGetStruct(g);if(fp->motion_vars.flags.flag1!=2)return;
 ftCaptainSpecialHiProcInterrupt(g);fp->physics.vel_air.x=40*ABSF(fp->input.pl.stick_range.x)*0.0125F*fp->lr;
}
static void younglink_install(FighterDescriptor *d){
 const FighterDescriptor *parent=port_fighter_descriptor(nFTKindLink);
 memcpy(younglink_status,safe_statuses,sizeof(younglink_status));memcpy(younglink_status,parent->special_descs,(nFTLinkStatusSpecialAirLw-220+1)*sizeof(*younglink_status));
 younglink_status[nFTLinkStatusSpecialAirHi-220].proc_interrupt=younglink_turn;
 d->special_descs=younglink_status;memcpy(d->special_handler,parent->special_handler,sizeof(d->special_handler));d->computer_attack_list=parent->computer_attack_list;
 memcpy(bombchu_status,dItLinkBombStatusDescs,6*sizeof(*bombchu_status));bombchu_status[2].proc_update=bombchu_hold;
 bombchu_status[3].proc_map=bombchu_status[4].proc_map=bombchu_thrown_map;
 bombchu_status[3].proc_reflector=bombchu_status[4].proc_reflector=bombchu_reflect;
 bombchu_status[6]=(ITStatusDesc){bombchu_move_update,bombchu_move_map,bombchu_explode,bombchu_explode,NULL,NULL,bombchu_reflect,itLinkBombCommonProcDamage};
}
