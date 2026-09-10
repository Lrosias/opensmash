/* LucasSpecial.asm / nessshared.asm: PK Fire recoil, piercing PK Thunder,
 * Magnet, and the ROM's own projectile/effect assets. */
static FTStatusDesc lucas_status[64];
static void lucas_air_recoil(GObj *g){FTStruct *fp=ftGetStruct(g);if(fp->motion_vars.flags.flag0)fp->physics.vel_air.x-=40*fp->lr;}
static void lucas_hi_end(GObj *g){if(g->anim_frame<=0)ftCommonFallSpecialSetStatus(g,0.8203125F,FALSE,TRUE,TRUE,0.3F,FALSE);}
#define LUCAS_ENTER(name,native) static void name(GObj *g){ftManagerSetupFilesAllKind(nFTKindNess);native(g);}
LUCAS_ENTER(lucas_ng,ftNessSpecialNSetStatus)
LUCAS_ENTER(lucas_na,ftNessSpecialAirNSetStatus)
LUCAS_ENTER(lucas_hg,ftNessSpecialHiStartSetStatus)
LUCAS_ENTER(lucas_ha,ftNessSpecialAirHiStartSetStatus)
LUCAS_ENTER(lucas_lg,ftNessSpecialLwStartSetStatus)
LUCAS_ENTER(lucas_la,ftNessSpecialAirLwStartSetStatus)
#undef LUCAS_ENTER
static void lucas_install(FighterDescriptor *d){
 const FighterDescriptor *parent=port_fighter_descriptor(nFTKindNess);
 memcpy(lucas_status,safe_statuses,sizeof(lucas_status));memcpy(lucas_status,parent->special_descs,(nFTNessStatusSpecialAirLwEnd-220+1)*sizeof(*lucas_status));
 lucas_status[226-220].proc_physics=ftPhysicsApplyGroundFrictionOrTransN;lucas_status[227-220].proc_interrupt=lucas_air_recoil;
 lucas_status[241-220].proc_map=lucas_status[242-220].proc_map=mpCommonProcFighterCliffWaitOrLanding;
 lucas_status[nFTNessStatusSpecialAirHiEnd-220].proc_update=lucas_hi_end;
 d->special_descs=lucas_status;d->computer_attack_list=parent->computer_attack_list;
 PortFTSpecialEnterFn entries[]={lucas_ng,lucas_hg,lucas_lg,lucas_na,lucas_ha,lucas_la};memcpy(d->special_handler,entries,sizeof(entries));
}
/* Keep asset origin independent of current ownership, including reflections and
 * child projectiles. The field is part of the native rollback memory. */
int port_remix_weapon_desc(GObj *parent,WPDesc *d,u32 flags){
 int origin=-1;if(!port_remix_enabled()||!parent)return origin;
 switch(flags&WEAPON_MASK_PARENT){
 case WEAPON_FLAG_PARENT_FIGHTER:origin=ftGetStruct(parent)->fkind;break;
 case WEAPON_FLAG_PARENT_WEAPON:origin=wpGetStruct(parent)->port_remix_origin;break;
 default:break;
 }
 if(origin==38){
  if(d->kind==nWPKindPKFire)d->p_weapon=&main_files[38][6];
  if(d->kind==nWPKindPKThunderHead||d->kind==nWPKindPKThunderTrail){
   d->p_weapon=&main_files[38][0];
   if(d->proc_hit==wpNessPKThunderHeadProcHit)d->proc_hit=wpNessPKThunderTrailProcHit;
  }
 }
 if(origin==34){if(d->kind==nWPKindChargeShot)d->p_weapon=&main_files[34][6];if(d->kind==nWPKindSamusBomb)d->p_weapon=&main_files[34][0];}
 return origin;
}
void **port_remix_pkfire_file(GObj *g,void **native){return wpGetStruct(g)->port_remix_origin==38?&main_files[38][6]:native;}
void port_remix_ness_effect(int origin,EFDesc *d,int wave){
 if(!port_remix_enabled()||origin!=38)return;
 d->file_head=&main_files[38][3];d->o_dobjsetup=wave?0x121B8:0x125A8;
 d->o_mobjsub=wave?0x122F8:0;d->o_anim_joint=wave?0x123E8:0;d->o_matanim_joint=wave?0x124A0:0;
}
