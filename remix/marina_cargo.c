/* Marina shares DK's cargo action IDs 235..249. The ROM supplies her own
 * animations, shake pummel, jump animation and blue gem. */
static int marina_gem_spawned[4];
int port_remix_cargo_kind(int id){return id==nFTKindDonkey||(port_remix_enabled()&&id==63);}
int port_remix_cargo_damage(FTStruct *fp){if(port_remix_enabled()&&fp->fkind==63){marina_gem_spawned[fp->player]=0;return 5;}return 8;}
static void marina_cargo_jump_update(GObj *g){if(g->anim_frame<=0)ftDonkeyThrowFFallSetStatus(g);}
static void marina_cargo_shake_update(GObj *g){
 FTStruct *fp=ftGetStruct(g);if(!sonic_live(fp->catch_gobj,nGCCommonLinkIDFighter)){mpCommonSetFighterWaitOrFall(g);return;}
 int damage=fp->motion_vars.flags.flag0;
 if(damage){fp->motion_vars.flags.flag0=0;FTStruct *victim=ftGetStruct(fp->catch_gobj);if(ftParamGetBestHitStatusAll(fp->catch_gobj)==nGMHitStatusNormal){ftParamUpdateDamage(victim,damage);
   if(!marina_gem_spawned[fp->player]){marina_gem_spawned[fp->player]=1;GObj *gem=clan_make(g,1);if(gem){ITStruct *ip=itGetStruct(gem);Vec3f pos={0,0,0};gmCollisionGetFighterPartsWorldPosition(fp->joints[30],&pos);pos.z=0;DObjGetStruct(gem)->translate.vec.f=pos;ip->physics.vel_air=(Vec3f){0,30,0};ip->attack_coll.damage=1;ip->attack_coll.knockback_base=30;CLAN(ip)->cracked=1;if(DObjGetStruct(gem)->mobj)DObjGetStruct(gem)->mobj->palette_id=0;clan_fall(gem);}}
  }}
 if(fp->motion_vars.flags.flag1&&(fp->input.pl.button_tap&fp->input.button_mask_b))fp->motion_vars.flags.flag2=1;
 u32 frame_bits;memcpy(&frame_bits,&g->anim_frame,sizeof(frame_bits));
 if(frame_bits==0x80000000u){int loop=fp->motion_vars.flags.flag2;fp->motion_vars.flags.flag2=fp->motion_vars.flags.flag1=0;if(!loop)ftDonkeyThrowFWaitSetStatus(g);}
}
int port_remix_cargo_shake_check(GObj *g){FTStruct *fp=ftGetStruct(g);if(!port_remix_enabled()||fp->fkind!=63||fp->ga!=nMPKineticsGround||!(fp->input.pl.button_tap&fp->input.button_mask_b))return FALSE;marina_enter(g,251);marth_clear_flags(fp);func_800269C0_275C0(0x420);return TRUE;}
static void marina_cargo_install(FighterDescriptor *d){
 FTStatusDesc *s=(FTStatusDesc*)d->special_descs;const FTStatusDesc *dk=port_fighter_special_descs(nFTKindDonkey);
 for(int a=235;a<=249;a++){s[a-220]=dk[a-220];s[a-220].mflags.motion_id=a-25;s[a-220].mflags.attack_id=s[a-220].sflags.attack_id=35;}
 s[250-220]=s[241-220];s[250-220].mflags.motion_id=225;s[250-220].proc_update=marina_cargo_jump_update;
 s[251-220]=s[235-220];s[251-220].mflags.motion_id=226;s[251-220].proc_update=marina_cargo_shake_update;s[251-220].proc_interrupt=NULL;
}
static int wario_capture_no_break(FTStruct *fp){(void)fp;return 1;}

/* ThrownDK begins before ThrowF finishes; its breakout counter is initialized
 * only when cargo Wait starts. Match Marina.asm capture_action_fix_. */
static int marina_capture_no_break(FTStruct *fp){return fp->status_id==nFTCommonStatusThrowF;}
