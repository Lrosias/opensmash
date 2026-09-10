/* WarioSpecial.asm: Body Slam, Corkscrew and ground pound. */
static FTStatusDesc wario_status[64];
static u8 wario_wall[4];
static void wario_enter(GObj *g,int action){
 FTStruct *fp=ftGetStruct(g);remix_copy_set(g,33,action,0,1,0);ftMainPlayAnimEventsAll(g);
 marth_clear_flags(fp);fp->motion_vars.flags.flag2=1;
}
static void wario_ng(GObj *g){wario_enter(g,223);wario_wall[ftGetStruct(g)->player]=0;}
static void wario_na(GObj *g){FTStruct *fp=ftGetStruct(g);wario_enter(g,224);fp->is_fastfall=FALSE;fp->physics.vel_air.y=2.75F;wario_wall[fp->player]=0;}
static void wario_ng_move(GObj *g){FTStruct *fp=ftGetStruct(g);if(fp->motion_vars.flags.flag2==1)fp->physics.vel_ground.x*=0.875F;if(fp->motion_vars.flags.flag2==2)fp->physics.vel_ground.x=64;}
static void wario_na_move(GObj *g){
 FTStruct *fp=ftGetStruct(g);if(fp->motion_vars.flags.flag2==1){fp->physics.vel_air.x*=0.875F;fp->physics.vel_air.y=2.75F;}
 if(fp->motion_vars.flags.flag2==2)fp->physics.vel_air.x=64*fp->lr;
 if(fp->motion_vars.flags.flag1){fp->motion_vars.flags.flag1=0;fp->physics.vel_air.y=30+48*__sinf(ftCaptainSpecialNGetAngle(fp->input.pl.stick_range.y));}
}
static void wario_ng_physics(GObj *g){FTStruct *fp=ftGetStruct(g);ftPhysicsSetGroundVelFriction(fp,0.5F*dMPCollisionMaterialFrictions[fp->coll_data.floor_flags&MAP_VERTEX_MAT_MASK]);ftPhysicsSetGroundVelTransferAir(g);}
static void wario_na_physics(GObj *g){FTStruct *fp=ftGetStruct(g);FTAttributes attr=*fp->attr;attr.air_friction=2;ftPhysicsApplyGravityClampTVel(fp,2.75F,48);ftPhysicsApplyAirVelXFriction(fp,&attr);}
static void wario_n_to_air(GObj *g){FTStruct *fp=ftGetStruct(g);mpCommonSetFighterAir(fp);remix_copy_set(g,33,224,g->anim_frame,1,3);}
static void wario_n_to_ground(GObj *g){mpCommonSetFighterGround(ftGetStruct(g));remix_copy_set(g,33,223,g->anim_frame,1,3);}
static int wario_recoil(GObj *g){
 FTStruct *fp=ftGetStruct(g);if(!fp->motion_vars.flags.flag0)return 0;
 func_800269C0_275C0(0x117);if(fp->ga==nMPKineticsGround)mpCommonSetFighterAir(fp);
 remix_copy_set(g,33,230,0,1,3);fp->motion_vars.flags.flag1=0;fp->physics.vel_air.x=-40*fp->lr;fp->physics.vel_air.y=40;return 1;
}
static void wario_ng_map(GObj *g){
 FTStruct *fp=ftGetStruct(g);int wall=fp->coll_data.mask_curr&(fp->lr>0?MAP_FLAG_LWALL:MAP_FLAG_RWALL);
 if(fp->motion_vars.flags.flag2!=2||!wall)wario_wall[fp->player]=0;else if(!wario_wall[fp->player])fp->motion_vars.flags.flag0=1;
 if(wario_recoil(g))return;mpCommonProcFighterOnFloor(g,wario_n_to_air);
 if(remix_copy_current(fp,33)==223&&fp->motion_vars.flags.flag2==2&&ftCommonKneeBendGetInputTypeCommon(fp)){
  wario_n_to_air(g);fp->physics.vel_air.y=68;func_800269C0_275C0(0x5E);
 }
}
static void wario_na_map(GObj *g){
 FTStruct *fp=ftGetStruct(g);wario_wall[fp->player]=fp->motion_vars.flags.flag2==2&&(fp->coll_data.mask_curr&(fp->lr>0?MAP_FLAG_LWALL:MAP_FLAG_RWALL));
 if(!wario_recoil(g))mpCommonProcFighterCliff(g,wario_n_to_ground);
}
static void wario_recoil_move(GObj *g){FTStruct *fp=ftGetStruct(g);if(!fp->motion_vars.flags.flag1){fp->physics.vel_air.x*=0.96875F;fp->physics.vel_air.y+=1.25F;}}
static void wario_recoil_physics(GObj *g){if(ftGetStruct(g)->motion_vars.flags.flag1)ftPhysicsApplyAirVelDrift(g);else ftPhysicsApplyAirVelFriction(g);}
static void wario_recoil_land(GObj *g){mpCommonSetFighterGround(ftGetStruct(g));remix_copy_set(g,33,229,g->anim_frame,1,0);}
static void wario_recoil_air(GObj *g){FTStruct *fp=ftGetStruct(g);mpCommonSetFighterAir(fp);remix_copy_set(g,33,230,g->anim_frame,1,0);ftPhysicsClampAirVelXMax(fp);}
static void wario_rg_map(GObj *g){mpCommonProcFighterOnEdge(g,wario_recoil_air);}
static void wario_ra_map(GObj *g){mpCommonProcFighterCliff(g,wario_recoil_land);}
static void wario_up(GObj *g){FTStruct *fp=ftGetStruct(g);if(fp->ga==nMPKineticsGround)mpCommonSetFighterAir(fp);wario_enter(g,225);fp->is_fastfall=FALSE;fp->physics.vel_air.y=fp->attr->gravity;}
static void wario_up_end(GObj *g){if(g->anim_frame<=0)ftCommonFallSpecialSetStatus(g,1,FALSE,TRUE,FALSE,0.25F,FALSE);}
static void wario_up_physics(GObj *g){
 FTStruct *fp=ftGetStruct(g);FTAttributes *a=fp->attr;int phase=fp->motion_vars.flags.flag2;
 if(fp->is_fastfall)ftPhysicsApplyFastFall(fp,a);else ftPhysicsApplyGravityDefault(fp,a);
 if(!ftPhysicsCheckClampAirVelXDecMax(fp,a)){if(phase==1)ftPhysicsCheckClampAirVelXDecMax(fp,a);else ftPhysicsClampAirVelXStickRange(fp,8,phase==3?0.0234375F:phase==4?0.0078125F:a->air_accel,a->air_speed_max_x);ftPhysicsApplyAirVelXFriction(fp,a);}
 if(phase==1){fp->physics.vel_air.x*=0.875F;fp->physics.vel_air.y=0;}
 if(phase==2){float x=fp->input.pl.stick_range.x*fp->lr;x=x>0?x*0.5F:0;fp->physics.vel_air.x=x*fp->lr;fp->physics.vel_air.y=64-x*0.21875F;fp->motion_vars.flags.flag2=3;fp->jumps_used=a->jumps_max;return;}
 if(phase==3)fp->physics.vel_air.y+=a->gravity;
 if(phase==4){fp->physics.vel_air.x*=0.875F;fp->physics.vel_air.y=0;}
}
static void wario_dg(GObj *g){wario_enter(g,227);}
static void wario_da(GObj *g){wario_enter(g,228);ftGetStruct(g)->is_fastfall=FALSE;}
static void wario_down_move(GObj *g){
 FTStruct *fp=ftGetStruct(g);fp->physics.vel_air.x*=0.875F;if(fp->motion_vars.flags.flag2==1)fp->physics.vel_air.y*=0.875F;
 if(fp->status_id==227&&fp->motion_vars.flags.flag0){fp->motion_vars.flags.flag0=0;fp->physics.vel_air.x=90*fp->lr;fp->physics.vel_air.y=180;mpCommonSetFighterAir(fp);}
}
static void wario_down_physics(GObj *g){FTStruct *fp=ftGetStruct(g);wario_recoil_physics(g);if(fp->motion_vars.flags.flag2==1&&fp->physics.vel_air.y<0)fp->physics.vel_air.y=0;if(fp->motion_vars.flags.flag2==2)fp->physics.vel_air.y=-80;}
static void wario_down_land(GObj *g){mpCommonSetFighterGround(ftGetStruct(g));ftMainSetStatus(g,226,0,1,0);}
static void wario_down_map(GObj *g){FTStruct *fp=ftGetStruct(g);if(fp->ga==nMPKineticsGround)mpCommonSetFighterFallOnEdgeBreak(g);else if(fp->motion_vars.flags.flag2==2)mpCommonProcFighterCliff(g,wario_down_land);else mpCommonProcFighterCliffWaitOrLanding(g);}
void port_remix_hit_contact(FTStruct *fp,int type){
 port_remix_sonic_contact(fp,type);
 port_remix_sheik_contact(fp,type);
 port_remix_crash_contact(fp,type);
 port_remix_banjo_contact(fp,type);
 if(!port_remix_enabled())return;
 if((fp->fkind==33||(fp->fkind==8&&fp->passive_vars.kirby.copy_id==33))&&(remix_copy_current(fp,33)==223||remix_copy_current(fp,33)==224)&&
 (type==nGMHitTypeDamage||type==nGMHitTypeShield||(type==nGMHitTypeAttack&&fp->damage_colls[0].hitstatus!=nGMHitStatusInvincible)))fp->motion_vars.flags.flag0=1;
}
static void wario_install(FighterDescriptor *d){
 const FighterDescriptor *parent=port_fighter_descriptor(nFTKindMario);memcpy(wario_status,safe_statuses,sizeof(wario_status));memcpy(wario_status,parent->special_descs,9*sizeof(*wario_status));
 void (*updates[])(GObj*)={ftAnimEndSetWait,ftAnimEndSetFall,wario_up_end,ftAnimEndSetWait,ftAnimEndSetFall,ftAnimEndSetFall,ftAnimEndSetWait,ftAnimEndSetFall};
 void (*interrupts[])(GObj*)={wario_ng_move,wario_na_move,wolf_up_turn,NULL,wario_down_move,wario_down_move,NULL,wario_recoil_move};
 void (*physics[])(GObj*)={wario_ng_physics,wario_na_physics,wario_up_physics,ftPhysicsApplyGroundVelFriction,wario_down_physics,wario_down_physics,ftPhysicsApplyGroundVelFriction,wario_recoil_physics};
 void (*maps[])(GObj*)={wario_ng_map,wario_na_map,wolf_up_map,mpCommonProcFighterOnCliffEdge,wario_down_map,wario_down_map,wario_rg_map,wario_ra_map};
 for(int action=223;action<=230;action++){FTStatusDesc *s=wario_status+action-220;int i=action-223;s->mflags.motion_id=action-25;s->mflags.attack_id=action==225?17:action>=226&&action<=228?30:18;s->sflags.attack_id=s->mflags.attack_id;s->sflags.ga=action==224||action==225||action==228||action==230;s->proc_update=updates[i];s->proc_interrupt=interrupts[i];s->proc_physics=physics[i];s->proc_map=maps[i];}
 d->special_descs=wario_status;d->special_handler[0]=wario_ng;d->special_handler[1]=wario_up;d->special_handler[2]=wario_dg;d->special_handler[3]=wario_na;d->special_handler[4]=wario_up;d->special_handler[5]=wario_da;
}
