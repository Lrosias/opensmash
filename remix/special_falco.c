/* Falco.asm / Phantasm.asm: inherited Fire Bird/Reflector state machines,
 * with Remix's Phantasm, shortened charge, launch speed and ROM scripts. */
static FTStatusDesc falco_status[64];
static u16 falco_previous_b[4];
static void falco_n_enter(GObj *g,int air){
 FTStruct *fp=ftGetStruct(g);ftMainSetStatus(g,air?226:225,0,1,0);ftMainPlayAnimEventsAll(g);
 fp->motion_vars.flags.flag0=fp->motion_vars.flags.flag1=0;fp->motion_vars.flags.flag2=1;falco_previous_b[fp->player]=0;
}
static void falco_ng(GObj *g){falco_n_enter(g,0);}
static void falco_na(GObj *g){falco_n_enter(g,1);}
static int falco_shorten(FTStruct *fp){
 u16 now=fp->input.pl.button_tap&fp->input.button_mask_b,old=falco_previous_b[fp->player];falco_previous_b[fp->player]=now;return now|old;
}
static void falco_ng_interrupt(GObj *g){
 FTStruct *fp=ftGetStruct(g);int shorten=falco_shorten(fp);
 if(fp->motion_vars.flags.flag2==2){fp->physics.vel_ground.x=460;if(shorten)fp->motion_vars.flags.flag2=3;}
 if(fp->motion_vars.flags.flag2==3){fp->physics.vel_ground.x=60;fp->motion_vars.flags.flag2=0;ftParamResetStatUpdateColAnim(g);ftParamClearAttackCollAll(g);}
}
static void falco_na_interrupt(GObj *g){
 FTStruct *fp=ftGetStruct(g);int flag=fp->motion_vars.flags.flag2,shorten=falco_shorten(fp);
 if(flag==1){fp->is_fastfall=FALSE;fp->physics.vel_air.x=0;fp->physics.vel_air.y=50;}
 if(flag==3){fp->physics.vel_air.x=460*fp->lr;if(shorten){fp->motion_vars.flags.flag2=flag=4;}}
 if(flag==2||flag==3)fp->physics.vel_air.y=fp->attr->gravity;
 if(flag==4){fp->physics.vel_air.x=30*fp->lr;fp->motion_vars.flags.flag2=5;ftParamResetStatUpdateColAnim(g);ftParamClearAttackCollAll(g);}
 if(flag==5)fp->physics.vel_air.y+=1.6015625F;
}
static void falco_na_physics(GObj *g){if(ftGetStruct(g)->motion_vars.flags.flag2==5)ftPhysicsApplyAirVelDrift(g);else ftPhysicsApplyAirVelFriction(g);}
static void falco_na_map(GObj *g){
 FTStruct *fp=ftGetStruct(g);
 if(!fp->motion_vars.flags.flag1||fp->physics.vel_air.y>=0)mpCommonCheckFighterProject(g);
 else if(mpCommonCheckFighterPassCliff(g,ftMarioSpecialHiProcPass)){
  if(fp->coll_data.mask_stat&MAP_FLAG_CLIFF_MASK)ftCommonCliffCatchSetStatus(g);
  else ftCommonLandingFallSpecialSetStatus(g,FALSE,0.349609375F);
 }
}
static void falco_hi_start_update(GObj *g){
 FTStruct *fp=ftGetStruct(g);if(fp->ga==nMPKineticsAir)ftFoxSpecialAirHiStartProcUpdate(g);else ftFoxSpecialHiStartProcUpdate(g);
 if(fp->status_id==229||fp->status_id==230)fp->status_vars.fox.specialhi.launch_delay=22;
}
static void falco_hi_hold_update(GObj *g){
 FTStruct *fp=ftGetStruct(g);ftFoxSpecialHiHoldProcUpdate(g);
 if(fp->status_id==231||fp->status_id==232){fp->physics.vel_ground.x*=98.0F/115;fp->physics.vel_air.x*=98.0F/115;fp->physics.vel_air.y*=98.0F/115;}
}
static void falco_lwg(GObj *g){ftManagerSetupFilesAllKind(nFTKindFox);ftFoxSpecialLwStartSetStatus(g);}
static void falco_lwa(GObj *g){ftManagerSetupFilesAllKind(nFTKindFox);ftFoxSpecialAirLwStartSetStatus(g);}
static void falco_install(FighterDescriptor *d){
 const FighterDescriptor *fox=port_fighter_descriptor(nFTKindFox);int n=nFTFoxStatusSpecialAirLwTurn-nFTCommonStatusSpecialStart+1;
 memcpy(falco_status,safe_statuses,sizeof(falco_status));if(n>63)abort();memcpy(falco_status,fox->special_descs,n*sizeof(*falco_status));
 falco_status[5].proc_update=ftAnimEndSetWait;falco_status[5].proc_interrupt=falco_ng_interrupt;
 falco_status[6].proc_update=ftFoxSpecialAirHiEndProcUpdate;falco_status[6].proc_interrupt=falco_na_interrupt;falco_status[6].proc_physics=falco_na_physics;falco_status[6].proc_map=falco_na_map;
 falco_status[7].proc_update=falco_status[8].proc_update=falco_hi_start_update;
 falco_status[9].proc_update=falco_status[10].proc_update=falco_hi_hold_update;
 d->special_descs=falco_status;memcpy(d->special_handler,fox->special_handler,sizeof(d->special_handler));
 d->special_handler[0]=falco_ng;d->special_handler[3]=falco_na;d->special_handler[2]=falco_lwg;d->special_handler[5]=falco_lwa;
}
