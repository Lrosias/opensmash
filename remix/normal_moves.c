/* Shared native jab states, using the actual motion indices from the ROM. */
#include "normal_data.h"
static void remix_normals_install(FighterDescriptor *d,int id){
 FTStatusDesc *states=(FTStatusDesc*)d->special_descs;
 for(unsigned i=0;i<sizeof(remix_normals)/sizeof(*remix_normals);i++){
  const RemixNormal *n=remix_normals+i;if(n->fighter!=id)continue;
  FTStatusDesc *s=states+n->action-220;memset(s,0,sizeof(*s));
  s->mflags.motion_id=n->motion;s->mflags.attack_id=n->attack;s->sflags.halfword=n->flags;
  s->proc_update=n->update;s->proc_interrupt=n->interrupt;s->proc_physics=n->physics;s->proc_map=n->map;
 }
}
int port_remix_jab_status(int id){
 if(!port_remix_enabled())return -1;
 if(id==64)return 254;
 for(unsigned i=0;i<sizeof(remix_normals)/sizeof(*remix_normals);i++)if(remix_normals[i].fighter==id&&remix_normals[i].attack==3)return remix_normals[i].action;
 return -1;
}
int port_remix_rapid_status(int id,int phase){
 if(!port_remix_enabled()||phase<0||phase>2)return -1;
 switch(id){case 29:case 55:case 56:case 59:case 62:case 63:return 220+phase;case 30:case 31:return 221+phase;case 57:return 231+phase;default:return -1;}
}
int port_remix_jab_kind(int id,int rapid){
 if(!port_remix_enabled()||id<29)return id;
 if(rapid){if(port_remix_rapid_status(id,0)<0)return -1;return id==30?7:id==31?5:1;}
 if(port_remix_jab_status(id)<0)return -1;
 return id==30?7:id==31?5:id==38?11:0;
}
int port_remix_ness_jump(int id){return id==nFTKindNess||id==nFTKindNNess||(port_remix_enabled()&&(id==38||id==57||id==73));}
static void dedede_jump_physics(GObj *g){
 FTStruct *fp=ftGetStruct(g);FTAttributes *a=fp->attr;ftPhysicsCheckSetFastFall(fp);
 if(fp->is_fastfall)ftPhysicsApplyFastFall(fp,a);else ftPhysicsApplyGravityDefault(fp,a);
 if(!ftPhysicsCheckClampAirVelXDecMax(fp,a))ftPhysicsClampAirVelXStickRange(fp,FTPHYSICS_AIRDRIFT_CLAMP_RANGE_MIN,a->air_accel*FTKIRBY_JUMPAERIAL_VEL_MUL,a->air_speed_max_x*FTKIRBY_JUMPAERIAL_VEL_MUL);
 ftPhysicsApplyAirVelXFriction(fp,a);
}
static void dedede_jump_map(GObj *g);
static void dedede_jumps_install(FighterDescriptor *d){
 FTStatusDesc *s=(FTStatusDesc*)d->special_descs;
 for(int a=223;a<=227;a++){FTStatusDesc *p=s+a-220;memset(p,0,sizeof(*p));p->mflags.motion_id=a-25;p->sflags.ga=nMPKineticsAir;p->proc_update=ftCommonJumpAerialProcUpdate;p->proc_interrupt=ftCommonJumpAerialProcInterrupt;p->proc_physics=dedede_jump_physics;p->proc_map=dedede_jump_map;}
}
static void dedede_jump_map(GObj *g){mpCommonProcFighterCliffWaitOrLanding(g);}
int port_remix_dedede_jump_check(GObj *g){
 FTStruct *fp=ftGetStruct(g);if(!port_remix_enabled()||fp->fkind!=64||ftHammerCheckHoldHammer(g)||fp->jumps_used>=fp->attr->jumps_max)return FALSE;
 int used=fp->jumps_used;if(used<1||used>4)return FALSE;
 if(used>1&&fp->status_id>=223&&fp->status_id<=227&&!fp->motion_vars.flags.flag1)return FALSE;
 int input=used==1?ftCommonKneeBendGetInputTypeCommon(fp):ftCommonJumpAerialMultiGetJumpInputType(fp);if(input==FTCOMMON_JUMPAERIAL_INPUT_TYPE_NONE)return FALSE;
 static const float extra[]={68,58,52};FTAttributes *a=fp->attr;
 ftMainSetStatus(g,222+used,0,1,FTSTATUS_PRESERVE_PLAYERTAG);fp->proc_map=dedede_jump_map;
 fp->physics.vel_air.x=fp->input.pl.stick_range.x*a->jumpaerial_vel_x;fp->physics.vel_air.y=used==1?(I_CONTROLLER_RANGE_MAX*a->jump_height_mul+a->jump_height_base)*a->jumpaerial_height:extra[used-2];
 fp->jumps_used++;fp->tap_stick_y=FTINPUT_STICKBUFFER_TICS_MAX;fp->motion_vars.flags.flag1=0;fp->is_special_interrupt=TRUE;
 fp->status_vars.common.jumpaerial.turn_tics=fp->input.pl.stick_range.x*fp->lr<FTCOMMON_JUMPAERIAL_TURN_STICK_RANGE_MIN?FTCOMMON_JUMPAERIAL_TURN_FRAMES:0;ftCommonJumpAerialUpdateModelYaw(fp);return TRUE;
}

void port_remix_stock_reset(GObj *g,int status){
 FTStruct *fp=ftGetStruct(g);int p=fp->player;if(!port_remix_enabled()||status<0||status>=10||p<0||p>=4)return;
 extern void portRemixSoundStop(int);portRemixSoundStop(p);portRemixSoundStop(p+4);
 marth_state[p].boost_used=marth_state[p].counter=0;goemon_state[p].charge=goemon_state[p].charged=0;dedede_state[p].charge=dedede_state[p].timer=0;
 sheik_state[p].needles=sheik_state[p].charge_timer=sheik_state[p].fish_used=0;sonic_state[p].charge=sonic_state[p].up_used=sonic_state[p].up_started=0;
 marina_state[p].charge=0;if(fp->fkind==34||fp->fkind==57)fp->passive_vars.samus.charge_level=0;
}
