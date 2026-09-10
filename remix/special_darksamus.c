/* DSamusSpecial.asm: charge in the air, slow strong charge shots, Boost Ball. */
static FTStatusDesc ds_status[64];
static wpSamusChargeShotAttributes ds_charge_levels[]={
 {120,60,2,75,10,0xEE,0xEF,0x18,1},{180,55,4,100,10,0xEE,0xF0,0x18,1},
 {250,50,6,125,10,0xED,0xF1,0x17,1},{320,45,9,150,10,0xED,0xF2,0x17,1},
 {400,40,12,175,10,0xED,0xF3,0x17,1},{490,35,15,200,10,0xEC,0xF4,0x16,1},
 {620,30,18,225,10,0xEC,0xF5,0x16,1},{740,25,24,275,10,0xEB,0xF6,0x16,2}};
wpSamusChargeShotAttributes *port_remix_charge_levels(GObj *g,wpSamusChargeShotAttributes *native){return wpGetStruct(g)->port_remix_origin==34?ds_charge_levels:port_remix_mewtwo_levels(g,native);}
static void ds_charge_air_enter(GObj *g){
 FTStruct *fp=ftGetStruct(g);Vec3f pos;ftMainSetStatus(g,231,0,1,FTSTATUS_PRESERVE_COLANIM);
 fp->proc_damage=ftSamusSpecialNProcDamage;fp->status_vars.samus.specialn.charge_int=20;
 ftSamusSpecialNGetChargeShotPosition(fp,&pos);fp->status_vars.samus.specialn.charge_gobj=wpSamusChargeShotMakeWeapon(g,&pos,fp->passive_vars.samus.charge_level,FALSE);
}
static void ds_n_start_update(GObj *g){
 FTStruct *fp=ftGetStruct(g);if(g->anim_frame>0)return;
 if(fp->ga==nMPKineticsAir){if(fp->passive_vars.samus.charge_level==7||fp->status_vars.samus.specialn.is_release)ftSamusSpecialAirNEndSetStatus(g);else ds_charge_air_enter(g);}
 else if(fp->status_vars.samus.specialn.is_release)ftSamusSpecialNEndSetStatus(g);else ftSamusSpecialNLoopSetStatus(g);
}
static void ds_ng(GObj *g){ftManagerSetupFilesAllKind(nFTKindSamus);ftSamusSpecialNStartSetStatus(g);}
static void ds_na(GObj *g){ftManagerSetupFilesAllKind(nFTKindSamus);ftSamusSpecialAirNStartSetStatus(g);FTStruct *fp=ftGetStruct(g);fp->status_vars.samus.specialn.is_release=fp->passive_vars.samus.charge_level==7;}
static void ds_start_air(GObj *g){FTStruct *fp=ftGetStruct(g);int release=fp->status_vars.samus.specialn.is_release;ftSamusSpecialNStartSwitchStatusAir(g);fp->status_vars.samus.specialn.is_release=release;}
static void ds_start_map(GObj *g){mpCommonProcFighterOnEdge(g,ds_start_air);}
static void ds_charge_air_update(GObj *g){
 FTStruct *fp=ftGetStruct(g);if(--fp->status_vars.samus.specialn.charge_int)return;
 fp->status_vars.samus.specialn.charge_int=20;if(fp->passive_vars.samus.charge_level>=7)return;
 if(++fp->passive_vars.samus.charge_level==7){ftParamCheckSetFighterColAnimID(g,nGMColAnimFighterCommonSpecialNCharge,0);ftSamusSpecialNDestroyChargeShot(fp);ftCommonFallSetStatus(g);}
 else if(fp->status_vars.samus.specialn.charge_gobj)wpGetStruct(fp->status_vars.samus.specialn.charge_gobj)->weapon_vars.charge_shot.charge_size=fp->passive_vars.samus.charge_level;
}
static void ds_charge_air_interrupt(GObj *g){FTStruct *fp=ftGetStruct(g);int tap=fp->input.pl.button_tap;
 if(tap&(fp->input.button_mask_a|fp->input.button_mask_b))ftSamusSpecialAirNEndSetStatus(g);
 else if(tap&fp->input.button_mask_z){ftSamusSpecialNDestroyChargeShot(fp);ftCommonFallSetStatus(g);}
}
static void ds_charge_to_air(GObj *g){FTStruct *fp=ftGetStruct(g);mpCommonSetFighterAir(fp);ftPhysicsClampAirVelXMax(fp);ftMainSetStatus(g,231,g->anim_frame,1,0x0802);fp->proc_damage=ftSamusSpecialNProcDamage;}
static void ds_charge_to_ground(GObj *g){FTStruct *fp=ftGetStruct(g);mpCommonSetFighterGround(fp);ftMainSetStatus(g,223,g->anim_frame,1,0x0802);fp->proc_damage=ftSamusSpecialNProcDamage;}
static void ds_charge_ground_map(GObj *g){ftSamusSpecialNSetChargeShotPosition(ftGetStruct(g));mpCommonProcFighterOnFloor(g,ds_charge_to_air);}
static void ds_charge_air_map(GObj *g){ftSamusSpecialNSetChargeShotPosition(ftGetStruct(g));mpCommonProcFighterLanding(g,ds_charge_to_ground);}
static void ds_ball_air(GObj *g){FTStruct *fp=ftGetStruct(g);mpCommonSetFighterAir(fp);ftMainSetStatus(g,230,g->anim_frame,1,0x2003);fp->motion_vars.flags.flag1=0;fp->physics.vel_air.x*=0.625F;}
static void ds_ball_update(GObj *g){FTStruct *fp=ftGetStruct(g);ftSamusSpecialLwMakeBomb(g);if(fp->ga==nMPKineticsAir){mpCommonSetFighterAir(fp);ftMainSetStatus(g,230,g->anim_frame,1,0x2003);fp->physics.vel_air.y=8;fp->jumps_used=fp->attr->jumps_max;}else ftAnimEndSetWait(g);}
static void ds_ball_ground_physics(GObj *g){FTStruct *fp=ftGetStruct(g);if(fp->motion_vars.flags.flag3){ftPhysicsSetGroundVelStickRange(fp,0.625F,10);ftPhysicsSetGroundVelTransferAir(g);}else ftPhysicsApplyGroundVelFriction(g);}
static void ds_ball_air_physics(GObj *g){FTStruct *fp=ftGetStruct(g);FTAttributes *a=fp->attr;
 if(fp->motion_vars.flags.flag1){if(fp->motion_vars.flags.flag1==1){fp->physics.vel_air.x=70*fp->lr;fp->physics.vel_air.y=-40;}else{fp->motion_vars.flags.flag1=0;fp->physics.vel_air.x*=0.5F;}return;}
 ftPhysicsApplyGravityDefault(fp,a);if(!ftPhysicsCheckClampAirVelXDec(fp,a->air_speed_max_x*0.66F)){ftPhysicsClampAirVelXStickRange(fp,FTPHYSICS_AIRDRIFT_CLAMP_RANGE_MIN,0.1875F,a->air_speed_max_x*0.66F);ftPhysicsApplyAirVelXFriction(fp,a);}
}
static void ds_ball_ground_map(GObj *g){FTStruct *fp=ftGetStruct(g);if(fp->motion_vars.flags.flag2&&ftCommonKneeBendGetInputTypeCommon(fp)){ds_ball_air(g);fp->physics.vel_air.y=32;efManagerDustExpandSmallMakeEffect(&DObjGetStruct(g)->translate.vec.f,1);return;}mpCommonProcFighterOnEdge(g,ds_ball_air);}
static void ds_ball_ground(GObj *g){FTStruct *fp=ftGetStruct(g);fp->motion_vars.flags.flag3=0;mpCommonSetFighterGround(fp);ftMainSetStatus(g,229,g->anim_frame,1,0x2003);}
static void ds_ball_air_map(GObj *g){mpCommonProcFighterLanding(g,ds_ball_ground);}
static void ds_ball_landing(GObj *g){FTStruct *fp=ftGetStruct(g);mpCommonSetFighterGround(fp);fp->physics.vel_ground.x*=0.625F;ftMainSetStatus(g,233,0,1,0);ftMainPlayAnimEventsAll(g);}
static void ds_ball_dive_map(GObj *g){if(ftGetStruct(g)->motion_vars.flags.flag2)mpCommonProcFighterLanding(g,ds_ball_landing);else mpCommonProcFighterCliffFloorCeil(g);}
static void ds_lg(GObj *g){ftManagerSetupFilesAllKind(nFTKindSamus);ftSamusSpecialLwSetStatus(g);FTStruct *fp=ftGetStruct(g);fp->motion_vars.flags.flag1=fp->motion_vars.flags.flag2=0;}
static void ds_la(GObj *g){FTStruct *fp=ftGetStruct(g);ftManagerSetupFilesAllKind(nFTKindSamus);ftMainSetStatus(g,232,0,1,0);ftMainPlayAnimEventsAll(g);fp->motion_vars.flags.flag0=fp->motion_vars.flags.flag1=fp->motion_vars.flags.flag2=0;fp->physics.vel_air.y=30;ftPhysicsClampAirVelX(fp,fp->attr->air_speed_max_x*0.66F);fp->jumps_used=fp->attr->jumps_max;fp->status_vars.samus.speciallw.unused=TRUE;}
static void ds_install(FighterDescriptor *d){const FighterDescriptor *parent=port_fighter_descriptor(nFTKindSamus);memcpy(ds_status,safe_statuses,sizeof(ds_status));memcpy(ds_status,parent->special_descs,11*sizeof(*ds_status));
 ds_status[2].proc_update=ds_status[5].proc_update=ds_n_start_update;ds_status[2].proc_map=ds_start_map;ds_status[5].proc_interrupt=ftSamusSpecialNStartProcInterrupt;ds_status[3].proc_map=ds_charge_ground_map;
 ds_status[11]=ds_status[3];ds_status[11].mflags.motion_id=206;ds_status[11].sflags.ga=nMPKineticsAir;ds_status[11].proc_update=ds_charge_air_update;ds_status[11].proc_interrupt=ds_charge_air_interrupt;ds_status[11].proc_physics=ftPhysicsApplyAirVelFriction;ds_status[11].proc_map=ds_charge_air_map;
 ds_status[9].proc_update=ds_ball_update;ds_status[9].proc_physics=ds_ball_ground_physics;ds_status[9].proc_map=ds_ball_ground_map;
 ds_status[10].proc_physics=ds_ball_air_physics;ds_status[10].proc_map=ds_ball_air_map;ds_status[12]=ds_status[10];ds_status[12].mflags.motion_id=207;ds_status[12].proc_map=ds_ball_dive_map;
 ds_status[13]=ds_status[9];ds_status[13].mflags.motion_id=208;ds_status[13].proc_update=ftAnimEndSetWait;ds_status[13].proc_interrupt=NULL;ds_status[13].proc_physics=ftPhysicsApplyGroundVelFriction;ds_status[13].proc_map=mpCommonProcFighterOnCliffEdge;
 d->special_descs=ds_status;memcpy(d->special_handler,parent->special_handler,sizeof(d->special_handler));d->special_handler[0]=ds_ng;d->special_handler[3]=ds_na;d->special_handler[2]=ds_lg;d->special_handler[5]=ds_la;d->computer_attack_list=parent->computer_attack_list;
}
