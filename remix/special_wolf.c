/* WolfSpecial.asm: accelerating blaster, steerable/shortenable Wolf Flash,
 * gravity-free Reflector. Constants follow assembled values, not stale comments. */
static FTStatusDesc wolf_status[64];static u16 wolf_buffer[4];
static sb32 wolf_bullet_update(GObj *g){WPStruct *w=wpGetStruct(g);float max=200*w->remix_speed_scale;w->physics.vel_air.x*=1.03125F;if(w->physics.vel_air.x>max)w->physics.vel_air.x=max;if(w->physics.vel_air.x<-max)w->physics.vel_air.x=-max;
 float x=(ABSF(w->physics.vel_air.x)+66)*0.25F/22;DObjGetStruct(g)->scale.vec.f.x=x;DObjGetStruct(g)->scale.vec.f.y=1/(x*0.5F+0.5F);return FALSE;
}
static sb32 wolf_bullet_reflect(GObj *g){WPStruct *w=wpGetStruct(g);FTStruct *fp=ftGetStruct(w->owner_gobj);w->remix_speed_scale=fp->fkind==55?1.57079637F:1;w->lifetime=100;w->physics.vel_air.x*=w->remix_speed_scale;wpMainReflectorSetLR(w,fp);wpMainVelSetModelPitch(g);return FALSE;}
static void wolf_neutral_update(GObj *g){FTStruct *fp=ftGetStruct(g);if(fp->motion_vars.flags.flag0){
 fp->motion_vars.flags.flag0=0;Vec3f pos={0,0,0};gmCollisionGetFighterPartsWorldPosition(fp->joints[fp->fkind==8?17:16],&pos);
 WPDesc d=dWPMarioFireballWeaponDesc;d.flags=0;d.kind=0;d.p_weapon=&main_files[55][5];d.o_attributes=0;d.transform_types=(DObjTransformTypes){nGCMatrixKindTra,0x48,0};
 d.proc_update=wolf_bullet_update;d.proc_map=itLGunWeaponAmmoProcMap;d.proc_hit=d.proc_shield=d.proc_setoff=d.proc_absorb=itLGunWeaponAmmoProcHit;d.proc_hop=wpBossBulletProcHop;d.proc_reflector=wolf_bullet_reflect;
 GObj *shot=wpManagerMakeWeapon(g,&d,&pos,WEAPON_FLAG_PARENT_FIGHTER|WEAPON_FLAG_COLLPROJECT);if(shot){WPStruct *w=wpGetStruct(shot);w->lifetime=100;w->remix_speed_scale=1;w->physics.vel_air=(Vec3f){22*fp->lr,0,0};wpMainVelSetModelPitch(shot);}
 }if(g->anim_frame<=0)mpCommonSetFighterWaitOrFall(g);
}
static void wolf_ng_land(GObj *g){mpCommonSetFighterGround(ftGetStruct(g));remix_copy_set(g,55,225,g->anim_frame,1,1);}
static void wolf_na_map(GObj *g){mpCommonProcFighterLanding(g,wolf_ng_land);}
static void wolf_up_enter(GObj *g,int action){FTStruct *fp=ftGetStruct(g);mpCommonSetFighterAir(fp);ftMainSetStatus(g,action,0,1,0);fp->motion_vars.flags.flag0=fp->motion_vars.flags.flag1=0;fp->motion_vars.flags.flag2=1;fp->is_fastfall=FALSE;fp->physics.vel_air.y=fp->attr->gravity;wolf_buffer[fp->player]=0;}
static void wolf_hg(GObj *g){wolf_up_enter(g,228);}static void wolf_ha(GObj *g){wolf_up_enter(g,227);}
static void wolf_up_start_update(GObj *g){FTStruct *fp=ftGetStruct(g);u16 b=fp->input.pl.button_tap|wolf_buffer[fp->player];wolf_buffer[fp->player]=fp->input.pl.button_tap;
 if(g->anim_frame<=0||(g->anim_frame>18&&(b&fp->input.button_mask_b))){ftMainSetStatus(g,fp->status_id==227?232:230,0,1,3);ftMainPlayAnimEventsAll(g);ftFoxSpecialHiHoldInitStatusVars(g);}
}
static void wolf_up_turn(GObj *g){if(ftGetStruct(g)->motion_vars.flags.flag1==2)ftCaptainSpecialHiProcInterrupt(g);}
static void wolf_up_physics(GObj *g){FTStruct *fp=ftGetStruct(g);FTAttributes *a=fp->attr;int phase=fp->motion_vars.flags.flag2;
 if(fp->is_fastfall)ftPhysicsApplyFastFall(fp,a);else ftPhysicsApplyGravityDefault(fp,a);
 if(!ftPhysicsCheckClampAirVelXDecMax(fp,a)){if(phase==1)ftPhysicsCheckClampAirVelXDecMax(fp,a);else ftPhysicsClampAirVelXStickRange(fp,8,phase==3?0.0234375F:phase==4?0.0078125F:a->air_accel,a->air_speed_max_x);ftPhysicsApplyAirVelXFriction(fp,a);}
 if(phase==1){fp->physics.vel_air.x=fp->physics.vel_air.y=0;}
 if(phase==2){float y=120+fp->input.pl.stick_range.y*0.796875F;fp->physics.vel_air.y=y;fp->physics.vel_air.x=(220-y*0.21875F)*fp->lr;fp->motion_vars.flags.flag2=3;fp->jumps_used=a->jumps_max;return;}
 if(phase==3)fp->physics.vel_air.y+=a->gravity;
 if(phase==4){ftParamResetStatUpdateColAnim(g);fp->physics.vel_air.x*=0.875F;fp->physics.vel_air.y*=0.875F;ftPhysicsApplyAirVelDrift(g);}
}
static void wolf_up_map(GObj *g){FTStruct *fp=ftGetStruct(g);if(!fp->motion_vars.flags.flag1||fp->physics.vel_air.y>=0)mpCommonCheckFighterProject(g);else if(mpCommonCheckFighterPassCliff(g,ftMarioSpecialHiProcPass)){if(fp->coll_data.mask_stat&MAP_FLAG_CLIFF_MASK)ftCommonCliffCatchSetStatus(g);else ftCommonLandingFallSpecialSetStatus(g,FALSE,0.25F);}}
static void wolf_up_end_update(GObj *g){FTStruct *fp=ftGetStruct(g);if(!fp->motion_vars.flags.flag0){if(port_remix_ganon_effect(g,0))fp->is_effect_attach=TRUE;fp->motion_vars.flags.flag0=1;}else if(fp->motion_vars.flags.flag0==2)ftParamProcStopEffect(g);
 if(g->anim_frame<=0)ftCommonFallSpecialSetStatus(g,1,FALSE,TRUE,FALSE,0.25F,FALSE);
}
static void wolf_reflector_physics(GObj *g){FTStruct *fp=ftGetStruct(g);if(fp->status_vars.fox.speciallw.gravity_delay)fp->status_vars.fox.speciallw.gravity_delay--;if(!ftPhysicsCheckClampAirVelXDecMax(fp,fp->attr))ftPhysicsApplyAirVelXFriction(fp,fp->attr);}
static void wolf_install(FighterDescriptor *d){const FighterDescriptor *parent=port_fighter_descriptor(nFTKindFox);memcpy(wolf_status,safe_statuses,sizeof(wolf_status));memcpy(wolf_status,parent->special_descs,26*sizeof(*wolf_status));
 wolf_status[5].proc_update=wolf_status[6].proc_update=wolf_neutral_update;wolf_status[6].proc_map=wolf_na_map;
 int actions[]={227,228,230,232};for(int i=0;i<4;i++){FTStatusDesc *s=wolf_status+actions[i]-220;s->proc_update=i<2?wolf_up_start_update:wolf_up_end_update;s->proc_interrupt=wolf_up_turn;s->proc_physics=wolf_up_physics;s->proc_map=wolf_up_map;}
 for(int i=243;i<=245;i++)wolf_status[i-220].proc_physics=wolf_reflector_physics;
 d->special_descs=wolf_status;memcpy(d->special_handler,parent->special_handler,sizeof(d->special_handler));d->special_handler[1]=wolf_hg;d->special_handler[4]=wolf_ha;d->special_handler[2]=falco_lwg;d->special_handler[5]=falco_lwa;d->computer_attack_list=parent->computer_attack_list;
}
void port_remix_fox_effect(GObj *g,EFDesc *d){FTStruct *fp=ftGetStruct(g);if(!port_remix_enabled()||fp->fkind!=55)return;d->file_head=fp->data->p_file_special2;d->o_dobjsetup=0x288;d->o_mobjsub=0;d->o_anim_joint=0x41C;d->o_matanim_joint=0;}
void *port_remix_fox_reflector_anim(GObj *g,int anim,void *native){EFStruct *e=efGetStruct(g);if(port_remix_enabled()&&e->fighter_gobj&&ftGetStruct(e->fighter_gobj)->fkind==55){static int offsets[]={0x41C,0x4C4,0x5E8,0x6FC};if(anim>=0&&anim<4)return (char*)main_files[55][6]+offsets[anim];}return native;}
