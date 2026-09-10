/* PeachSpecial.asm. The turnip uses native pickup/throw plumbing with its own
 * ROM asset and collision callbacks; it never runs Link Bomb's fuse logic. */
static FTStatusDesc peach_status[64];
static ITStatusDesc turnip_status[6];
static int peach_smash[4];
static int peach_float_timer[4];
extern ITDesc dItLinkBombItemDesc;
static void peach_float_enter(GObj *g){ftMainSetStatus(g,222,0,1,0);FTStruct *fp=ftGetStruct(g);fp->physics.vel_air.y=fp->physics.vel_air.y*0.25F+24;}
int port_remix_peach_floating(FTStruct *fp){return port_remix_enabled()&&fp->fkind==73&&peach_float_timer[fp->player]>1;}
void port_remix_peach_before(GObj *g,int status){
 FTStruct *fp=ftGetStruct(g);if(!port_remix_enabled()||fp->fkind!=73)return;
 if(fp->ga==nMPKineticsGround||status<10)peach_float_timer[fp->player]=0;
 else if(peach_float_timer[fp->player]>1&&status!=222&&status!=nFTCommonStatusFall&&status!=nFTCommonStatusFallAerial&&!(status>=nFTCommonStatusAttackAirStart&&status<=nFTCommonStatusAttackAirEnd))peach_float_timer[fp->player]=1;
}
int port_remix_peach_float_check(GObj *g){
 FTStruct *fp=ftGetStruct(g);if(!port_remix_enabled()||fp->fkind!=73||peach_float_timer[fp->player]||!(fp->input.pl.button_hold&15))return 0;
 if(fp->input.pl.stick_range.y>=-39){if(fp->jumps_used<fp->attr->jumps_max&&(fp->input.pl.button_tap&15))return 0;if(fp->physics.vel_air.y>0||g->anim_frame<=20)return 0;}
 peach_float_timer[fp->player]=150;peach_float_enter(g);return 1;
}
int port_remix_peach_float_fall(GObj *g){FTStruct *fp=ftGetStruct(g);if(port_remix_peach_floating(fp)&&(fp->input.pl.button_hold&15)){peach_float_enter(g);return 1;}return 0;}
int port_remix_peach_gravity(FTStruct *fp){
 if(!port_remix_peach_floating(fp))return 0;int t=peach_float_timer[fp->player]--;if(t==150)return 0;
 if(!(fp->input.pl.button_hold&15)){peach_float_timer[fp->player]=1;return 0;}fp->physics.vel_air.y=0;return 1;
}
static void peach_float_update(GObj *g){if(peach_float_timer[ftGetStruct(g)->player]<=1)ftCommonFallSetStatus(g);}
static void peach_float_interrupt(GObj *g){if(!ftCommonSpecialAirCheckInterruptCommon(g))ftCommonAttackAirCheckInterruptCommon(g);}
void port_remix_peach_tick(GObj *g){FTStruct *fp=ftGetStruct(g);if(!port_remix_enabled()||fp->fkind!=73)return;if(fp->ga==nMPKineticsGround)peach_float_timer[fp->player]=0;
 if(port_remix_peach_floating(fp)&&fp->status_id>=nFTCommonStatusAttackAirStart&&fp->status_id<=nFTCommonStatusAttackAirEnd)fp->proc_map=mpCommonProcFighterWaitOrLanding;
}
static int turnip_is(ITStruct *ip){return main_files[73][6]&&(void*)ip->attr==(char*)main_files[73][6]+0x40;}
ITStatusDesc *port_remix_peach_item_status(GObj *g,ITStatusDesc *table){return turnip_is(itGetStruct(g))?turnip_status:port_remix_clan_item_status(g,table);}
static void turnip_fall(GObj *g){ITStruct *ip=itGetStruct(g);ip->damage_coll.hitstatus=nGMHitStatusNone;ip->is_allow_pickup=TRUE;ip->lifetime=780;itMapSetAir(ip);itMainSetStatus(g,turnip_status,4);}
static void turnip_wait(GObj *g){itMainSetGroundAllowPickup(g);itMainSetStatus(g,turnip_status,0);}
static sb32 turnip_wait_map(GObj *g){itMapCheckLRWallProcNoFloor(g,turnip_fall);return FALSE;}
static sb32 turnip_fall_map(GObj *g){return itMapCheckDestroyDropped(g,0.4F,0.3F,turnip_wait);}
static sb32 turnip_fall_update(GObj *g){ITStruct *ip=itGetStruct(g);itMainApplyGravityClampTVel(ip,1.7546875F,100);return --ip->lifetime<=0;}
static sb32 turnip_thrown_update(GObj *g){ITStruct *ip=itGetStruct(g);itVisualsUpdateSpin(g);itMainApplyGravityClampTVel(ip,1.7546875F,100);itVisualsUpdateSpin(g);return FALSE;}
static sb32 turnip_thrown_map(GObj *g){return itMapTestAllCheckCollEnd(g);}
static sb32 turnip_hit(GObj *g){ITStruct *ip=itGetStruct(g);ip->attack_coll.attack_state=nGMAttackStateOff;ip->physics.vel_air.x*=-0.125F;ip->physics.vel_air.y=40;turnip_fall(g);return FALSE;}
static sb32 turnip_damage(GObj *g){ITStruct *ip=itGetStruct(g);ip->physics.vel_air.x*=-0.125F;ip->physics.vel_air.y=40;turnip_fall(g);return FALSE;}
static sb32 turnip_reflect(GObj *g){itMainCommonProcReflector(g);itMainSetStatus(g,turnip_status,3);return FALSE;}
static GObj *peach_make_turnip(GObj *g){
 if(!main_files[73][6])return NULL;
 Vec3f pos=DObjGetStruct(g)->translate.vec.f,vel={0,0,0};ITDesc d=dItLinkBombItemDesc;
 d.p_file=&main_files[73][6];d.o_attributes=0x40;d.transform_types=(DObjTransformTypes){0x1B,0,0};d.proc_update=turnip_fall_update;d.proc_map=turnip_fall_map;d.proc_hit=d.proc_shield=d.proc_hop=d.proc_setoff=d.proc_reflector=d.proc_damage=NULL;
 GObj *item=itManagerMakeItem(g,&d,&pos,&vel,ITEM_FLAG_PARENT_FIGHTER);if(!item)return NULL;
 ITStruct *ip=itGetStruct(item);DObj *root=DObjGetStruct(item);itMainClearOwnerStats(item);gcAddXObjForDObjFixed(root,0x2E,0);
 ip->damage_coll.hitstatus=nGMHitStatusNone;ip->attack_coll.attack_state=nGMAttackStateOff;ip->attack_coll.knockback_scale=60;ip->attack_coll.knockback_base=25;ip->attack_coll.angle=361;ip->attack_coll.fgm_id=0x38;ip->lifetime=780;
 int roll=syUtilsRandIntRange(58),face=roll<52?6:roll==52?4:roll==53?5:3;ip->attack_coll.damage=roll<52?2:roll==52?30:roll==53?12:6;
 if(root->mobj)root->mobj->palette_id=face;
 return item;
}
static void peach_pull(GObj *g){
 FTStruct *fp=ftGetStruct(g);if(fp->motion_vars.flags.flag0){fp->motion_vars.flags.flag0=0;if(!fp->item_gobj){GObj *item=peach_make_turnip(g);if(item){itMainSetFighterHold(item,g);}}}
 if(g->anim_frame<=0)mpCommonSetFighterWaitOrFall(g);
}
static void peach_down(GObj *g){FTStruct *fp=ftGetStruct(g);if(fp->item_gobj){if(turnip_is(itGetStruct(fp->item_gobj)))ftCommonItemThrowSetStatus(g,fp->ga==nMPKineticsGround?110:118);return;}if(fp->ga==nMPKineticsGround){ftMainSetStatus(g,233,0,1,0);fp->motion_vars.flags.flag0=0;}}
static void peach_recoil(GObj *g){FTStruct *fp=ftGetStruct(g);if(fp->ga==nMPKineticsGround)mpCommonSetFighterAir(fp);remix_copy_set(g,73,225,0,1,0);fp->physics.vel_air.x=-34*fp->lr;fp->physics.vel_air.y=40;}
static void peach_shield(GObj *g){remix_copy_set(g,73,remix_copy_current(ftGetStruct(g),73),35,1,0);}
static void peach_bomber_handlers(GObj *g){FTStruct *fp=ftGetStruct(g);fp->proc_shield=peach_shield;fp->proc_hit=peach_recoil;}
static void peach_neutral(GObj *g,int air){
 FTStruct *fp=ftGetStruct(g);remix_copy_set(g,73,air?224:223,0,1,0x20);ftMainPlayAnimEventsAll(g);ftLinkSpecialNProcStatus(g);peach_smash[fp->player]=fp->status_vars.link.specialn.is_smash;
 fp->motion_vars.flags.flag1=fp->motion_vars.flags.flag2=0;peach_bomber_handlers(g);if(air){fp->is_fastfall=FALSE;fp->physics.vel_air.y=30;}
}
static void peach_ng(GObj *g){peach_neutral(g,0);}static void peach_na(GObj *g){peach_neutral(g,1);}
static void peach_n_air(GObj *g){mpCommonSetFighterAir(ftGetStruct(g));remix_copy_set(g,73,224,g->anim_frame,1,3);peach_bomber_handlers(g);}
static void peach_n_ground(GObj *g){mpCommonSetFighterGround(ftGetStruct(g));remix_copy_set(g,73,223,g->anim_frame,1,3);peach_bomber_handlers(g);}
static void peach_n_map(GObj *g){FTStruct *fp=ftGetStruct(g);if(fp->ga==nMPKineticsGround){if(!mpCommonProcFighterOnFloor(g,peach_n_air))return;}else if(mpCommonProcFighterLanding(g,peach_n_ground))return;
 if(fp->motion_vars.flags.flag2==2&&(fp->coll_data.mask_curr&(fp->lr>0?MAP_FLAG_LWALL:MAP_FLAG_RWALL)))peach_recoil(g);
}
static void peach_n_physics(GObj *g){
 FTStruct *fp=ftGetStruct(g);int phase=fp->motion_vars.flags.flag2;float speed=peach_smash[fp->player]?60:48;
 if(fp->ga==nMPKineticsGround){if(phase==1){fp->physics.vel_ground.x=speed;fp->motion_vars.flags.flag2=2;ftPhysicsSetGroundVelTransferAir(g);}else if(phase==3)fp->motion_vars.flags.flag2=4;else if(phase!=2)ftPhysicsApplyGroundVelFriction(g);return;}
 if(phase==1){fp->physics.vel_air.x=speed*fp->lr;fp->physics.vel_air.y=0;fp->motion_vars.flags.flag2=2;return;}
 if(phase==2)return;
 if(phase==3){fp->physics.vel_air.x*=0.5F;fp->motion_vars.flags.flag2=4;}
 if(phase==3||phase==4){FTAttributes a=*fp->attr;a.air_friction=1;ftPhysicsApplyGravityDefault(fp,&a);ftPhysicsApplyAirVelXFriction(fp,&a);}else ftPhysicsApplyAirVelDrift(g);
}
static void peach_parasol_enter(GObj *g,int action){ftMainSetStatus(g,action,0,1,0x20);ftMainPlayAnimEventsAll(g);ftGetStruct(g)->motion_vars.flags.flag1=1;}
static void peach_open(GObj *g){peach_parasol_enter(g,229);FTStruct *fp=ftGetStruct(g);fp->is_fastfall=FALSE;fp->physics.vel_air.y=0;}
static void peach_up_enter(GObj *g,int air){FTStruct *fp=ftGetStruct(g);peach_parasol_enter(g,air?228:227);marth_clear_flags(fp);fp->motion_vars.flags.flag2=1;if(air){fp->is_fastfall=FALSE;fp->physics.vel_air.y=fp->attr->gravity;}}
static void peach_hg(GObj *g){peach_up_enter(g,0);}static void peach_ha(GObj *g){peach_up_enter(g,1);}
static void peach_up_update(GObj *g){if(g->anim_frame<=0)peach_open(g);}
static void peach_open_update(GObj *g){if(g->anim_frame<=0)peach_parasol_enter(g,230);}
static void peach_close_update(GObj *g){if(g->anim_frame<=0){ftCommonFallSpecialSetStatus(g,1,FALSE,TRUE,FALSE,0.375F,FALSE);ftMainSetStatus(g,232,0,1,0x20);}}
static void peach_parasol_interrupt(GObj *g){FTStruct *fp=ftGetStruct(g);if(fp->status_id==230&&fp->input.pl.stick_range.y<-39)peach_parasol_enter(g,231);else if(fp->status_id==232&&fp->input.pl.stick_range.y>=40)peach_open(g);}
static void peach_up_physics(GObj *g){
 FTStruct *fp=ftGetStruct(g);FTAttributes *a=fp->attr;int phase=fp->motion_vars.flags.flag2;if(fp->ga==nMPKineticsGround){ftPhysicsApplyGroundVelFriction(g);return;}
 if(fp->is_fastfall)ftPhysicsApplyFastFall(fp,a);else ftPhysicsApplyGravityDefault(fp,a);
 if(!ftPhysicsCheckClampAirVelXDecMax(fp,a)){if(phase==3)ftPhysicsClampAirVelXStickRange(fp,8,0.010009765625F,24);else ftPhysicsCheckClampAirVelXDecMax(fp,a);ftPhysicsApplyAirVelXFriction(fp,a);}
 if(phase==1&&fp->status_id==228){fp->physics.vel_air.x*=0.875F;fp->physics.vel_air.y=0;}
 if(phase==2){fp->physics.vel_air.x=18*fp->lr;fp->physics.vel_air.y=fp->status_id==227?84:82;fp->motion_vars.flags.flag2=3;fp->jumps_used=a->jumps_max;}
 if(phase==4)fp->physics.vel_air.x*=0.875F;
}
static void peach_parasol_physics(GObj *g){FTStruct *fp=ftGetStruct(g);ftPhysicsApplyGravityClampTVel(fp,0.5F,13);if(!ftPhysicsCheckClampAirVelXDecMax(fp,fp->attr)){ftPhysicsClampAirVelXStickDefault(fp,fp->attr);ftPhysicsApplyAirVelXFriction(fp,fp->attr);}}
static void peach_install(FighterDescriptor *d){
 memcpy(peach_status,safe_statuses,sizeof(peach_status));
 peach_status[2].mflags.motion_id=197;peach_status[2].mflags.attack_id=0;peach_status[2].sflags.ga=1;peach_status[2].sflags.attack_id=0;
 peach_status[2].proc_update=peach_float_update;peach_status[2].proc_interrupt=peach_float_interrupt;peach_status[2].proc_physics=ftPhysicsApplyAirVelDriftFastFall;peach_status[2].proc_map=mpCommonProcFighterCliffFloorCeil;
 for(int action=223;action<=233;action++){
  if(action==226)continue;FTStatusDesc *s=peach_status+action-220;int air=action==224||action==225||(action>=228&&action<=232);
  s->mflags.motion_id=action-25;s->mflags.attack_id=action<=225?18:action==233?30:17;s->sflags.attack_id=s->mflags.attack_id;s->sflags.ga=air;
  s->proc_update=action<=225?(air?ftAnimEndSetFall:ftAnimEndSetWait):action<=228?peach_up_update:action==229?peach_open_update:action==231?peach_close_update:action==233?peach_pull:NULL;
  s->proc_interrupt=action==227||action==228?wolf_up_turn:action==230||action==232?peach_parasol_interrupt:NULL;
  s->proc_physics=action<=224?peach_n_physics:action==225?ftPhysicsApplyAirVelFriction:action<=228?peach_up_physics:action==229||action==230?peach_parasol_physics:action==231?ftPhysicsApplyAirVelDriftFastFall:action==232?ftCommonFallSpecialProcPhysics:ftPhysicsApplyGroundVelFriction;
  s->proc_map=action<=224?peach_n_map:action==225?mpCommonProcFighterCliffFloorCeil:action<=231?marth_up_map:action==232?ftCommonFallSpecialProcMap:mpCommonSetFighterFallOnEdgeBreak;
 }
 turnip_status[0]=(ITStatusDesc){turnip_fall_update,turnip_wait_map};turnip_status[1]=turnip_status[4]=(ITStatusDesc){turnip_fall_update,turnip_fall_map};
 turnip_status[3]=(ITStatusDesc){turnip_thrown_update,turnip_thrown_map,turnip_hit,turnip_hit,itMainCommonProcHop,turnip_hit,turnip_reflect,turnip_damage};
 d->special_descs=peach_status;d->special_handler[0]=peach_ng;d->special_handler[1]=peach_hg;d->special_handler[2]=peach_down;d->special_handler[3]=peach_na;d->special_handler[4]=peach_ha;d->special_handler[5]=peach_down;
}
