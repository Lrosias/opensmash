/* Native translation of MarthSpecial.asm, checked against the local 2.0.1
 * action and animation tables. State lives in WASM memory for rollback. */
enum { MARTH_UP_G=222,MARTH_UP_A=223,MARTH_N_G=224,MARTH_N_A=231,
       MARTH_DOWN_G=239,MARTH_COUNTER_G=240,MARTH_DOWN_A=241,MARTH_COUNTER_A=242 };
typedef struct {int chain,boost_used,counter;} MarthState;
static MarthState marth_state[4];
static FTStatusDesc marth_status[64];
static void marth_clear_flags(FTStruct *fp){fp->motion_vars.flags.flag0=fp->motion_vars.flags.flag1=fp->motion_vars.flags.flag2=0;}
static void marth_enter(GObj *g,int action){ftMainSetStatus(g,action,0,1,FTSTATUS_PRESERVE_NONE);ftMainPlayAnimEventsAll(g);marth_clear_flags(ftGetStruct(g));}
static void marth_neutral_enter(GObj *g,int air,int chain){
 FTStruct *fp=ftGetStruct(g);int angle=fp->input.pl.stick_range.y>=40?-1:fp->input.pl.stick_range.y<=-40?1:0;
 int action=(air?MARTH_N_A:MARTH_N_G)+(chain?2+(chain-1)*3+angle:0);
 marth_state[fp->player].chain=chain;marth_enter(g,action);
 if(air){fp->is_fastfall=FALSE;fp->physics.vel_air.x*=0.875F;fp->physics.vel_air.y=chain?8:marth_state[fp->player].boost_used?16:36;marth_state[fp->player].boost_used=1;}
 else marth_state[fp->player].boost_used=0;
}
static void marth_neutral_ground(GObj *g){marth_neutral_enter(g,0,0);}
static void marth_neutral_air(GObj *g){marth_neutral_enter(g,1,0);}
static void marth_neutral_update(GObj *g){
 FTStruct *fp=ftGetStruct(g);int chain=marth_state[fp->player].chain;
 if(fp->motion_vars.flags.flag1&&(fp->input.pl.button_tap&fp->input.button_mask_b)&&chain<2){marth_neutral_enter(g,fp->ga==nMPKineticsAir,chain+1);return;}
 if(g->anim_frame<=0)mpCommonSetFighterWaitOrFall(g);
}
static void marth_transition_air(GObj *g){
 FTStruct *fp=ftGetStruct(g);int delta=fp->status_id>=MARTH_DOWN_G?2:7;
 mpCommonSetFighterAir(fp);ftMainSetStatus(g,fp->status_id+delta,g->anim_frame,1,0x2803);ftPhysicsClampAirVelXMax(fp);
}
static void marth_transition_ground(GObj *g){
 FTStruct *fp=ftGetStruct(g);int delta=fp->status_id>=MARTH_DOWN_G?2:7;
 mpCommonSetFighterGround(fp);marth_state[fp->player].boost_used=0;ftMainSetStatus(g,fp->status_id-delta,g->anim_frame,1,0x2803);
}
static void marth_ground_map(GObj *g){mpCommonProcFighterOnEdge(g,marth_transition_air);}
static void marth_air_map(GObj *g){mpCommonProcFighterLanding(g,marth_transition_ground);}
static void marth_up_enter(GObj *g,int air){
 FTStruct *fp=ftGetStruct(g);marth_enter(g,air?MARTH_UP_A:MARTH_UP_G);fp->motion_vars.flags.flag2=1;
 if(air){fp->is_fastfall=FALSE;fp->physics.vel_air.y=fp->attr->gravity;}
}
static void marth_up_ground(GObj *g){marth_up_enter(g,0);}
static void marth_up_air(GObj *g){marth_up_enter(g,1);}
static void marth_up_update(GObj *g){if(g->anim_frame<=0)ftCommonFallSpecialSetStatus(g,1,TRUE,FALSE,TRUE,0.375F,FALSE);}
static void marth_up_interrupt(GObj *g){if(ftGetStruct(g)->motion_vars.flags.flag1==2)ftCaptainSpecialHiProcInterrupt(g);}
static void marth_up_physics(GObj *g){
 FTStruct *fp=ftGetStruct(g);int flag=fp->motion_vars.flags.flag2;float x;
 if(fp->ga==nMPKineticsGround){ftPhysicsApplyGroundVelFriction(g);return;}
 ftPhysicsApplyAirVelFriction(g);
 if(flag==5)ftPhysicsClampAirVelXStickRange(fp,8,0.009765625F,24);
 if(flag==1&&fp->status_id==MARTH_UP_A){fp->physics.vel_air.x*=0.875F;fp->physics.vel_air.y=0;}
 if(flag==2){
  x=fp->input.pl.stick_range.x*fp->lr;x=x>=10?x*(fp->fkind==74?0.75F:2.0F):10;
  fp->physics.vel_air.x=(x+10)*fp->lr;fp->physics.vel_air.y=(fp->fkind==74?(fp->status_id==MARTH_UP_G?120:116):(fp->status_id==MARTH_UP_G?420:400))-(fp->input.pl.stick_range.x*fp->lr>=10?x*0.5F:0);
  fp->motion_vars.flags.flag2=3;fp->jumps_used=fp->attr->jumps_max;
 }
 if(flag==4){fp->physics.vel_air.x=fp->physics.vel_air.x*0.125F+10*fp->lr;fp->physics.vel_air.y*=fp->fkind==74?0.375F:0.09375F;fp->motion_vars.flags.flag2=5;}
}
static void marth_up_map(GObj *g){
 FTStruct *fp=ftGetStruct(g);
 if(fp->ga==nMPKineticsAir){
  if(!fp->motion_vars.flags.flag1||fp->physics.vel_air.y>=0)mpCommonCheckFighterProject(g);
  else if(mpCommonCheckFighterPassCliff(g,ftMarioSpecialHiProcPass)){
   if(fp->coll_data.mask_stat&MAP_FLAG_CLIFF_MASK)ftCommonCliffCatchSetStatus(g);
   else ftCommonLandingFallSpecialSetStatus(g,FALSE,0.375F);
  }
 }else mpCommonSetFighterFallOnEdgeBreak(g);
}
static void marth_down_ground(GObj *g){marth_enter(g,MARTH_DOWN_G);marth_state[ftGetStruct(g)->player].counter=0;}
static void marth_down_air(GObj *g){FTStruct *fp=ftGetStruct(g);marth_enter(g,MARTH_DOWN_A);marth_state[fp->player].counter=0;fp->physics.vel_air.y=0;fp->physics.vel_air.x*=0.5F;}
static void marth_down_physics(GObj *g){ftPhysicsApplyAirVelFriction(g);ftGetStruct(g)->physics.vel_air.y+=1.5F;}
static void marth_down_update(GObj *g){
 FTStruct *fp=ftGetStruct(g);
 fp->knockback_resist_status=fp->motion_vars.flags.flag0?131072:0;
 if(marth_state[fp->player].counter){marth_state[fp->player].counter=0;fp->lr=fp->damage_lr;fp->joints[nFTPartsJointTopN]->rotate.vec.f.y=fp->lr*HALF_PI32;marth_enter(g,fp->ga==nMPKineticsAir?MARTH_COUNTER_A:MARTH_COUNTER_G);return;}
 if(g->anim_frame<=0)mpCommonSetFighterWaitOrFall(g);
}
int port_remix_counter_damage(FTStruct *fp,int damage){
 if(port_remix_enabled()&&fp->fkind==58&&(fp->status_id==MARTH_DOWN_G||fp->status_id==MARTH_DOWN_A)&&fp->motion_vars.flags.flag0&&damage>0){marth_state[fp->player].counter=1;return 0;}return damage;
}
void port_remix_before_status(GObj *g,int status){
 port_remix_peach_before(g,status);port_remix_stock_reset(g,status);
 FTStruct *fp=ftGetStruct(g);
 if(port_remix_enabled()&&(fp->fkind==58||fp->fkind==74||(fp->fkind==8&&(fp->passive_vars.kirby.copy_id==58||fp->passive_vars.kirby.copy_id==74)))&&(fp->ga==nMPKineticsGround||status<nFTCommonStatusWait))marth_state[fp->player].boost_used=0;
}
static void marth_install(FighterDescriptor *desc){
 int action;memcpy(marth_status,safe_statuses,sizeof(marth_status));
 for(action=MARTH_UP_G;action<=MARTH_COUNTER_A;action++){
  FTStatusDesc *s=&marth_status[action-220];int air=action==MARTH_UP_A||(action>=MARTH_N_A&&action<=237)||action>=MARTH_DOWN_A;
  s->mflags.motion_id=action-25;s->mflags.attack_id=action<224?17:action<239?18:30;
  s->sflags.ga=air;s->sflags.attack_id=s->mflags.attack_id;
  s->proc_update=action<224?marth_up_update:action<239?marth_neutral_update:(action==MARTH_DOWN_G||action==MARTH_DOWN_A)?marth_down_update:ftAnimEndSetWait;
  s->proc_interrupt=action<224?marth_up_interrupt:NULL;
  s->proc_physics=action<224?marth_up_physics:air?(action>=239?marth_down_physics:ftPhysicsApplyAirVelFriction):action>=239?ftPhysicsApplyGroundVelFriction:ftPhysicsApplyGroundFrictionOrTransN;
  s->proc_map=action<224?marth_up_map:air?marth_air_map:marth_ground_map;
  if(action==MARTH_COUNTER_A)s->proc_update=ftAnimEndSetFall;
 }
 desc->special_descs=marth_status;
 desc->special_handler[0]=marth_neutral_ground;desc->special_handler[1]=marth_up_ground;desc->special_handler[2]=marth_down_ground;
 desc->special_handler[3]=marth_neutral_air;desc->special_handler[4]=marth_up_air;desc->special_handler[5]=marth_down_air;
}
