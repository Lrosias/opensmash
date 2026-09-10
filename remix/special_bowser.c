/* BowserSpecial.asm: rechargeable Fire Breath, Whirling Fortress and Bowser Bomb. */
static FTStatusDesc bowser_status[64];
static struct {int ready,ammo,timer;} bowser_flame[4];
void port_remix_fighter_tick(GObj *g){
 port_remix_peach_tick(g);
 port_remix_sonic_tick(g);
 port_remix_sheik_tick(g);
 port_remix_marina_tick(g);
 FTStruct *fp=ftGetStruct(g);if(!port_remix_enabled()||fp->is_control_disable)return;
 if(fp->fkind==52||(fp->fkind==8&&fp->passive_vars.kirby.copy_id==52)){
  __typeof__(bowser_flame[0]) *s=&bowser_flame[fp->player];
  if(!s->ready||fp->status_id<10){s->ready=1;s->ammo=20;s->timer=0;}
  if(++s->timer>=30){s->timer=0;if(remix_copy_current(fp,52)!=228&&remix_copy_current(fp,52)!=231){s->ammo+=2;if(s->ammo>20)s->ammo=20;}}
 }
}
static void bowser_breath_enter(GObj *g,int action){
 FTStruct *fp=ftGetStruct(g);remix_copy_set(g,52,action,0,1,0);fp->motion_vars.flags.flag0=0;
 ftCommonFireFlowerShootInitStatusVars(fp);ftMainPlayAnimEventsAll(g);
}
static void bowser_ng(GObj *g){bowser_breath_enter(g,228);}
static void bowser_na(GObj *g){bowser_breath_enter(g,231);}
static void bowser_flame_spawn(GObj *g,int cost){
 FTStruct *fp=ftGetStruct(g);__typeof__(fp->status_vars.common.fireflower) *s=&fp->status_vars.common.fireflower;
 if(bowser_flame[fp->player].ammo>=cost){
  Vec3f pos={60/fp->attr->size,(fp->fkind==8?200:100)/fp->attr->size,(fp->fkind==8?-20:120)/fp->attr->size};
  gmCollisionGetFighterPartsWorldPosition(fp->joints[fp->fkind==8?13:7],&pos);if(fp->fkind!=8){pos.x+=100*fp->lr;pos.y-=200;}
  int index=s->flame_vel_index>=5?8-s->flame_vel_index:s->flame_vel_index;
  float *angles=(float*)((char*)gITManagerCommonData+llITCommonDataFFlowerFlameAngles);
  Vec3f vel={30*__cosf(angles[index]),30*__sinf(angles[index]),0};itFFlowerWeaponFlameMakeWeapon(g,&pos,&vel);
  bowser_flame[fp->player].ammo-=cost;ftParamMakeRumble(fp,6,0);
 }
 if(s->ammo_fire_count<65536)s->ammo_fire_count++;
 if(++s->flame_vel_index>=8){s->flame_vel_index=0;ftParamSetMotionID(fp,nFTMotionAttackIDFireFlowerShoot);ftParamSetStatUpdate(fp,fp->stat_flags.halfword);}
}
static void bowser_breath_update(GObj *g){
 FTStruct *fp=ftGetStruct(g);__typeof__(fp->status_vars.common.fireflower) *s=&fp->status_vars.common.fireflower;
 if(g->anim_frame<=0){mpCommonSetFighterWaitOrFall(g);return;}
 if(!(fp->input.pl.button_hold&fp->input.button_mask_b))s->is_release=TRUE;
 if(s->release_lag<20)s->release_lag++;
 if(s->release_lag<20&&(fp->input.pl.button_tap&fp->input.button_mask_b))s->release_lag=0;
 if(fp->motion_vars.flags.flag0){
  int cost=s->ammo_fire_count==0?2:1;
  if(--s->effect_make_int==0){s->effect_make_int=12;
   if(!bowser_flame[fp->player].ammo){Vec3f smoke={81,304,260};ftParamMakeEffect(g,nEFKindDustLight,fp->attr->joint_itemlight_id,&smoke,NULL,-fp->lr,TRUE,FALSE);func_800269C0_275C0(0x30);}
   else {Vec3f smoke={0,0,-180};ftParamMakeEffect(g,nEFKindDustLight,0,&smoke,NULL,fp->lr,FALSE,FALSE);func_800269C0_275C0(0x1A);}
  }
  if(--s->ammo_sub==0){s->ammo_sub=8;bowser_flame_spawn(g,cost);}
  if(fp->motion_vars.flags.flag0==1){fp->motion_vars.flags.flag0=2;gcSetAnimSpeed(g,0);}
 }
 if(s->ammo_fire_count>=5&&s->is_release&&s->release_lag>=20){fp->motion_vars.flags.flag0=0;gcSetAnimSpeed(g,1);}
}
static void bowser_breath_land(GObj *g){mpCommonSetFighterGround(ftGetStruct(g));remix_copy_set(g,52,228,g->anim_frame,DObjGetStruct(g)->anim_speed,0);}
static void bowser_breath_map(GObj *g){FTStruct *fp=ftGetStruct(g);mpCommonProcFighterLanding(g,g->anim_frame>=20&&!(fp->input.pl.button_hold&fp->input.button_mask_b)?mpCommonSetFighterWaitOrLanding:bowser_breath_land);}
static void bowser_hg(GObj *g){ftYoshiSpecialHiSetStatus(g);ftGetStruct(g)->proc_damage=NULL;}
static void bowser_ha(GObj *g){FTStruct *fp=ftGetStruct(g);ftMainSetStatus(g,223,0,1,0);memset(&fp->status_vars,0,sizeof(fp->status_vars));marth_clear_flags(fp);fp->is_fastfall=FALSE;fp->jumps_used=fp->attr->jumps_max;fp->physics.vel_air.y=60;}
static void bowser_hg_physics(GObj *g){FTStruct *fp=ftGetStruct(g);union{u32 u;float f;} accel={.u=0x3D5DCCCD};ftPhysicsApplyClampGroundVelStickRange(fp,0,accel.f,fp->motion_vars.flags.flag1?10:44);ftPhysicsSetGroundVelTransferAir(g);}
static void bowser_ha_physics(GObj *g){FTStruct *fp=ftGetStruct(g);ftPhysicsApplyGravityClampTVel(fp,1.125F,fp->attr->tvel_base);ftPhysicsClampAirVelXStickRange(fp,8,0.03125F,40);ftPhysicsApplyAirVelXFriction(fp,fp->attr);}
static void bowser_hi_air(GObj *g){FTStruct *fp=ftGetStruct(g);fp->motion_vars.flags.flag1=1;mpCommonSetFighterAir(fp);ftMainSetStatus(g,223,g->anim_frame,1,FTSTATUS_PRESERVE_EFFECT);ftPhysicsClampAirVelXMax(fp);}
static void bowser_hi_ground(GObj *g){mpCommonSetFighterGround(ftGetStruct(g));ftMainSetStatus(g,222,g->anim_frame,1,FTSTATUS_PRESERVE_EFFECT);}
static void bowser_hg_map(GObj *g){mpCommonProcFighterOnFloor(g,bowser_hi_air);}
static void bowser_ha_map(GObj *g){if(ftGetStruct(g)->motion_vars.flags.flag1)mpCommonProcFighterCliff(g,bowser_hi_ground);else mpCommonProcFighterLanding(g,bowser_hi_ground);}
static void bowser_down_physics(GObj *g){DObj *d=ftGetStruct(g)->joints[0];d->scale.vec.f.x=d->scale.vec.f.y=d->scale.vec.f.z;ftPhysicsApplyAirVelTransNYZ(g);}
static void bowser_install(FighterDescriptor *d){
 const FighterDescriptor *p=port_fighter_descriptor(nFTKindYoshi);memcpy(bowser_status,safe_statuses,sizeof(bowser_status));memcpy(bowser_status,p->special_descs,12*sizeof(*bowser_status));
 bowser_status[2].proc_update=ftDonkeySpecialHiProcUpdate;bowser_status[2].proc_physics=bowser_hg_physics;bowser_status[2].proc_map=bowser_hg_map;
 bowser_status[3].proc_update=ftDonkeySpecialAirHiProcUpdate;bowser_status[3].proc_physics=bowser_ha_physics;bowser_status[3].proc_map=bowser_ha_map;
 bowser_status[5].proc_update=ftAnimEndSetWait;bowser_status[6].proc_physics=bowser_down_physics;
 bowser_status[8].proc_update=bowser_status[11].proc_update=bowser_breath_update;
 bowser_status[8].proc_interrupt=bowser_status[11].proc_interrupt=NULL;
 bowser_status[8].proc_physics=ftPhysicsApplyGroundVelFriction;bowser_status[8].proc_map=mpCommonSetFighterFallOnEdgeBreak;bowser_status[11].proc_map=bowser_breath_map;
 d->special_descs=bowser_status;memcpy(d->special_handler,p->special_handler,sizeof(d->special_handler));d->special_handler[0]=bowser_ng;d->special_handler[3]=bowser_na;d->special_handler[1]=bowser_hg;d->special_handler[4]=bowser_ha;
}
