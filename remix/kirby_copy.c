/* Kirby keeps his own skeleton, motion table and copy-state IDs. Copied moves
 * use the ROM's Kirby animations and hitboxes, not the donor's joint layout. */
#include "kirby_data.h"
static const int kirby_shared_actions[][3]={{59,253,350},{59,254,351},{59,255,352},{59,256,353},{59,257,354},{59,258,355},{59,259,356},{59,260,357},{62,234,358},{62,235,359},{62,236,360},{62,237,361},{62,238,362},{62,239,363},{63,225,383},{63,226,384},{63,227,385},{63,228,386},{63,229,387},{63,230,388},{63,231,389},{63,232,390},{63,233,391},{63,234,392},{64,231,364},{64,232,365},{64,234,366},{64,235,367},{64,236,368},{64,237,369},{64,238,370},{64,239,371},{64,240,372},{64,241,373},{64,242,374},{64,243,375},{64,244,376},{64,245,377},{64,246,378},{64,247,379},{64,255,380},{64,256,381},{64,257,382},{65,227,393},{65,228,394},{65,229,395},{65,230,396},{65,231,397},{65,232,398},{65,233,399},{65,234,400},{65,235,401},{65,236,402},{72,223,430},{72,224,431},{72,225,432},{72,226,433},{33,223,312},{33,224,313},{33,229,314},{33,230,315},{52,228,318},{52,231,319},{55,225,322},{55,226,323},{56,246,324},{56,247,325},{56,248,326},{56,249,327},{56,250,328},{56,251,329},{68,225,411},{68,226,412},{68,227,413},{68,228,414},{68,229,415},{68,230,416},{73,223,434},{73,224,435},{73,225,436}};
static int remix_copy_current(FTStruct *fp,int donor){if(fp->fkind==8&&fp->passive_vars.kirby.copy_id==donor)for(unsigned i=0;i<sizeof(kirby_shared_actions)/sizeof(*kirby_shared_actions);i++){const int *r=kirby_shared_actions[i];if(r[0]==donor&&r[2]==fp->status_id)return r[1];}return fp->status_id;}
static int remix_copy_kind(FTStruct *fp,int donor){return fp->fkind==donor||(fp->fkind==8&&fp->passive_vars.kirby.copy_id==donor);}
static int remix_copy_action(GObj *g,int donor,int action){FTStruct *fp=ftGetStruct(g);if(fp->fkind==8&&fp->passive_vars.kirby.copy_id==donor)for(unsigned i=0;i<sizeof(kirby_shared_actions)/sizeof(*kirby_shared_actions);i++){const int *r=kirby_shared_actions[i];if(r[0]==donor&&r[1]==action)return r[2];}return action;}
static void remix_copy_set(GObj *g,int donor,int action,float frame,float speed,u32 flags){ftMainSetStatus(g,remix_copy_action(g,donor,action),frame,speed,flags);}
static FTStatusDesc kirby_status[238];
static FTModelPart kirby_hat_part[4];
static int kirby_pending_hat[4];
static void kirby_hat_pending_set(int player,int hat){if(player>=0&&player<4)kirby_pending_hat[player]=hat;}
static int kirby_hat_pending_get(int player){return player>=0&&player<4?kirby_pending_hat[player]:0;}
static int kirby_copy_supported(int id){return id==34||id==57||id==59||id==62||id==63||id==64||id==65||id==72||id==33||id==52||id==55||id==56||id==68||id==73||id==29||id==30||id==31||id==32||id==38||id==58||id==74||id==75;}
int port_remix_kirby_action(GObj *g,int action){
 FTStruct *fp=ftGetStruct(g);if(!port_remix_enabled()||fp->fkind!=8)return action;int id=fp->passive_vars.kirby.copy_id;
 if(id==57&&action>=237&&action<=241){const int a[]={330,331,332,333,335};return a[action-237];}
 if(id==34&&action==238)return RK_DSAMUS_Charge;
 if(id==30&&action>=295&&action<=296)return RK_GND_NSP_Ground+action-295;
 if((id==32||id==75)&&action>=231&&action<=234)return (id==32?RK_DRM_NSP_Ground:RK_DRL_NSP_Ground)+(action-231)%2;
 if(id==38&&action>=254&&action<=255)return RK_LUCAS_NSP_Ground+action-254;
 if(id==31&&action==287)return RK_YLINK_NSP_Ground;
 if(id==31&&action==290)return RK_YLINK_NSP_Air;
 return action;
}
static void kirby_doctor_accessory(GObj *g){doctor_capsule(g);}
int port_remix_kirby_copy_id(int id){return port_remix_enabled()&&kirby_copy_supported(id)?id:nFTKindKirby;}
int port_remix_kirby_hat(int id){return id>=29&&id<97?remix_kirby_copies[id][1]:0;}
FTModelPart *port_remix_modelpart(FTStruct *fp,FTModelPartDesc *desc,int joint,int id,int detail){
 if(!port_remix_enabled()||fp->fkind!=8||joint!=FTKIRBY_COPY_MODELPARTS_JOINT||id<15||id>=48)return &desc->modelparts[id][detail];
 const int *h=remix_kirby_hats[id-15];FTModelPart *part=&kirby_hat_part[fp->player];
 *part=desc->modelparts[h[0]][detail];part->flags=0; /* extended_special_parts temporary row has zero flags */
 void *base=PORT_RESOLVE(*(u32*)((char*)*fp->data->p_file_model+0x1d810+4*h[7]));
 const int *over=h+1+3*detail;
 if(over[0]>=0)part->dl=PORT_REGISTER((char*)base+over[0]);
 if(over[1]>=0)part->mobjsubs=PORT_REGISTER((char*)base+over[1]);
 if(over[2]>=0)part->costume_matanim_joints=PORT_REGISTER((char*)base+over[2]);
 return part;
}
static void kirby_marth_enter(GObj *g,int air,int chain){
 FTStruct *fp=ftGetStruct(g);int first=fp->passive_vars.kirby.copy_id==74?RK_ROY_NSPG_1:RK_MARTH_NSPG_1;
 int angle=fp->input.pl.stick_range.y>=40?-1:fp->input.pl.stick_range.y<=-40?1:0;
 marth_state[fp->player].chain=chain;marth_enter(g,first+air*7+(chain?2+(chain-1)*3+angle:0));
 if(air){fp->is_fastfall=FALSE;fp->physics.vel_air.x*=0.875F;fp->physics.vel_air.y=chain?8:marth_state[fp->player].boost_used?16:36;marth_state[fp->player].boost_used=1;}else marth_state[fp->player].boost_used=0;
}
static void kirby_marth_update(GObj *g){FTStruct *fp=ftGetStruct(g);int chain=marth_state[fp->player].chain;if(fp->motion_vars.flags.flag1&&(fp->input.pl.button_tap&fp->input.button_mask_b)&&chain<2){kirby_marth_enter(g,fp->ga==nMPKineticsAir,chain+1);return;}if(g->anim_frame<=0)mpCommonSetFighterWaitOrFall(g);}
static void kirby_marth_air(GObj *g){FTStruct *fp=ftGetStruct(g);mpCommonSetFighterAir(fp);ftMainSetStatus(g,fp->status_id+7,g->anim_frame,1,0x2803);ftPhysicsClampAirVelXMax(fp);}
static void kirby_marth_ground(GObj *g){FTStruct *fp=ftGetStruct(g);mpCommonSetFighterGround(fp);marth_state[fp->player].boost_used=0;ftMainSetStatus(g,fp->status_id-7,g->anim_frame,1,0x2803);}
static void kirby_marth_ground_map(GObj *g){mpCommonProcFighterOnEdge(g,kirby_marth_air);}
static void kirby_marth_air_map(GObj *g){mpCommonProcFighterLanding(g,kirby_marth_ground);}
static void kirby_falco_air(GObj *g){FTStruct *fp=ftGetStruct(g);mpCommonSetFighterAir(fp);ftMainSetStatus(g,RK_FALCO_NSP_Air,g->anim_frame,1,0x2803);ftPhysicsClampAirVelXMax(fp);}
static void kirby_falco_ground_map(GObj *g){mpCommonProcFighterOnEdge(g,kirby_falco_air);}
/* Dark Samus and Mewtwo share Kirby's charge-shot variables, including the
 * attached weapon pointer. Keeping that pointer across landing also makes
 * damage cancellation and rollback use the native ownership rules. */
static int kirby_charge_copy(FTStruct *fp){return fp->passive_vars.kirby.copy_id==34||fp->passive_vars.kirby.copy_id==57;}
static int kirby_charge_status(FTStruct *fp,int phase,int air){
 static const int dark[2][3]={{237,307,239},{240,429,241}};
 return fp->passive_vars.kirby.copy_id==57?330+3*air+phase:dark[air][phase];
}
static void kirby_charge_shoot(GObj *g){FTStruct *fp=ftGetStruct(g);fp->motion_vars.flags.flag0=0;ftMainSetStatus(g,kirby_charge_status(fp,2,fp->ga==nMPKineticsAir),0,1,FTSTATUS_PRESERVE_COLANIM);fp->proc_damage=ftKirbyCopySamusSpecialNProcDamage;}
static void kirby_charge_begin_update(GObj *g){
 FTStruct *fp=ftGetStruct(g);if(!kirby_charge_copy(fp)){ftKirbyCopySamusSpecialNStartProcUpdate(g);return;}if(g->anim_frame>0)return;
 if(fp->status_vars.kirby.copysamus_specialn.is_release){kirby_charge_shoot(g);return;}
 ftMainSetStatus(g,kirby_charge_status(fp,1,fp->ga==nMPKineticsAir),0,1,FTSTATUS_PRESERVE_COLANIM);
 fp->proc_damage=ftKirbyCopySamusSpecialNProcDamage;fp->status_vars.kirby.copysamus_specialn.charge_int=20;
 Vec3f p;ftKirbyCopySamusSpecialNGetChargeShotPosition(fp,&p);
 fp->status_vars.kirby.copysamus_specialn.charge_gobj=wpSamusChargeShotMakeWeapon(g,&p,fp->passive_vars.kirby.copysamus_charge_level,FALSE);
}
static void kirby_charge_loop_update(GObj *g){
 FTStruct *fp=ftGetStruct(g);ftKirbyCopySamusSpecialNSetChargeShotPosition(fp);
 if(--fp->status_vars.kirby.copysamus_specialn.charge_int)return;fp->status_vars.kirby.copysamus_specialn.charge_int=20;
 if(fp->passive_vars.kirby.copysamus_charge_level>=7)return;
 if(++fp->passive_vars.kirby.copysamus_charge_level==7){ftKirbyCopySamusSpecialNDestroyChargeShot(fp);mpCommonSetFighterWaitOrFall(g);}
 else if(fp->status_vars.kirby.copysamus_specialn.charge_gobj)wpGetStruct(fp->status_vars.kirby.copysamus_specialn.charge_gobj)->weapon_vars.charge_shot.charge_size=fp->passive_vars.kirby.copysamus_charge_level;
}
static void kirby_charge_loop_interrupt(GObj *g){
 FTStruct *fp=ftGetStruct(g);int tap=fp->input.pl.button_tap;
 if(tap&(fp->input.button_mask_a|fp->input.button_mask_b)){kirby_charge_shoot(g);return;}
 if(fp->ga==nMPKineticsGround){int s=ftCommonEscapeGetStatus(fp);if(s!=-1){ftKirbyCopySamusSpecialNDestroyChargeShot(fp);ftCommonEscapeSetStatus(g,s,0);return;}}
 if(tap&fp->input.button_mask_z){ftKirbyCopySamusSpecialNDestroyChargeShot(fp);mpCommonSetFighterWaitOrFall(g);}
}
static void kirby_charge_shoot_update(GObj *g){
 FTStruct *fp=ftGetStruct(g);int fire=fp->motion_vars.flags.flag0,level=fp->passive_vars.kirby.copysamus_charge_level,recoil=fp->passive_vars.kirby.copysamus_charge_recoil,air=fp->ga==nMPKineticsAir;float y=fp->physics.vel_air.y;
 ftKirbyCopySamusSpecialNSetChargeShotPosition(fp);ftKirbyCopySamusSpecialNEndProcUpdate(g);
 if(fire&&air&&fp->passive_vars.kirby.copy_id==57){fp->physics.vel_air.x=-(12+7*level)*fp->lr;float lift=level+21-recoil*5;fp->physics.vel_air.y=y>lift?y:lift;}
}
static void kirby_charge_transition(GObj *g,int air){
 FTStruct *fp=ftGetStruct(g);int phase=fp->status_id==kirby_charge_status(fp,0,!air)?0:fp->status_id==kirby_charge_status(fp,1,!air)?1:2;
 if(air)mpCommonSetFighterAir(fp);else mpCommonSetFighterGround(fp);
 ftMainSetStatus(g,kirby_charge_status(fp,phase,air),g->anim_frame,1,0x802);fp->proc_damage=ftKirbyCopySamusSpecialNProcDamage;
}
static void kirby_charge_air(GObj *g){kirby_charge_transition(g,1);}
static void kirby_charge_ground(GObj *g){kirby_charge_transition(g,0);}
static void kirby_charge_map(GObj *g){
 FTStruct *fp=ftGetStruct(g);if(!kirby_charge_copy(fp)){switch(fp->status_id){case 237:ftKirbyCopySamusSpecialNStartProcMap(g);break;case 240:ftKirbyCopySamusSpecialAirNStartProcMap(g);break;case 239:ftKirbyCopySamusSpecialNEndProcMap(g);break;case 241:ftKirbyCopySamusSpecialAirNEndProcMap(g);break;}return;}
 ftKirbyCopySamusSpecialNSetChargeShotPosition(fp);
 if(fp->ga==nMPKineticsGround)mpCommonProcFighterOnEdge(g,kirby_charge_air);else mpCommonProcFighterLanding(g,kirby_charge_ground);
}
static void kirby_charge_install(void){
 const int actions[]={237,239,240,241,307,429,330,331,332,333,334,335};
 for(unsigned i=0;i<sizeof(actions)/sizeof(*actions);i++){
  int a=actions[i],phase=a==237||a==240||a==330||a==333?0:a==307||a==429||a==331||a==334?1:2;
  int air=a==240||a==241||a==429||a>=333;FTStatusDesc *s=kirby_status+a-220;
  s->proc_update=phase==0?kirby_charge_begin_update:phase==1?kirby_charge_loop_update:kirby_charge_shoot_update;
  s->proc_interrupt=phase==0?ftKirbyCopySamusSpecialNStartProcInterrupt:phase==1?kirby_charge_loop_interrupt:NULL;
  s->proc_physics=air?ftPhysicsApplyAirVelFriction:ftPhysicsApplyGroundVelFriction;s->proc_map=kirby_charge_map;
 }
}
void port_remix_kirby_acquired(FTStruct *fp){
 if(!port_remix_enabled()||fp->fkind!=8)return;
 int id=fp->passive_vars.kirby.copy_id;
 if(id>=29)kirby_hat_pending_set(fp->player,port_remix_kirby_hat(id));
 if(id==34||id==57){fp->passive_vars.kirby.copysamus_charge_level=0;fp->passive_vars.kirby.copysamus_charge_recoil=0;}
 if(id==62)memset(SHEIK_STATE(fp),0,sizeof(sheik_state[0]));
 if(id==52){memset(&bowser_flame[fp->player],0,sizeof(bowser_flame[0]));}
 if(id==58||id==74)marth_state[fp->player].boost_used=0;
}

int port_remix_kirby_neutral(GObj *g){
 FTStruct *fp=ftGetStruct(g);int id=fp->passive_vars.kirby.copy_id,air=fp->ga==nMPKineticsAir;if(!port_remix_enabled()||!kirby_copy_supported(id))return 0;
 ftManagerSetupFilesAllKind(id);
 if(id==34||id==57){ftManagerSetupFilesAllKind(3);if(air)ftKirbyCopySamusSpecialAirNStartSetStatus(g);else ftKirbyCopySamusSpecialNStartSetStatus(g);fp->status_vars.kirby.copysamus_specialn.is_release=fp->passive_vars.kirby.copysamus_charge_level==7;}
 else if(id==59)sonic_n(g);
 else if(id==62)sheik_n(g);
 else if(id==63)marina_n(g);
 else if(id==64)dedede_n(g);
 else if(id==65)goemon_n(g);
 else if(id==72)crash_n(g);
 else if(id==33){if(air)wario_na(g);else wario_ng(g);}
 else if(id==52){if(!bowser_flame[fp->player].ready){bowser_flame[fp->player].ready=1;bowser_flame[fp->player].ammo=20;bowser_flame[fp->player].timer=0;}if(air)bowser_na(g);else bowser_ng(g);}
 else if(id==55){remix_copy_set(g,55,air?226:225,0,1,0);ftMainPlayAnimEventsAll(g);marth_clear_flags(fp);}
 else if(id==56){if(air)conker_na(g);else conker_ng(g);}
 else if(id==68)banjo_n(g);
 else if(id==73){if(air)peach_na(g);else peach_ng(g);}
 else if(id==30){if(air)ftKirbyCopyCaptainSpecialAirNSetStatus(g);else ftKirbyCopyCaptainSpecialNSetStatus(g);}
 else if(id==31){if(air)ftKirbyCopyLinkSpecialAirNSetStatus(g);else ftKirbyCopyLinkSpecialNSetStatus(g);}
 else if(id==32||id==75){if(air)ftKirbyCopyMarioSpecialAirNSetStatus(g);else ftKirbyCopyMarioSpecialNSetStatus(g);fp->proc_accessory=kirby_doctor_accessory;}
 else if(id==38){ftManagerSetupFilesAllKind(11);if(air)ftKirbyCopyNessSpecialAirNSetStatus(g);else ftKirbyCopyNessSpecialNSetStatus(g);}
 else if(id==58||id==74)kirby_marth_enter(g,air,0);
 else if(id==29){ftMainSetStatus(g,air?RK_FALCO_NSP_Air:RK_FALCO_NSP_Ground,0,1,0);ftMainPlayAnimEventsAll(g);marth_clear_flags(fp);fp->motion_vars.flags.flag2=1;falco_previous_b[fp->player]=0;}
 return 1;
}
static void kirby_copy_install(FighterDescriptor *d){
 const FighterDescriptor *base=port_fighter_descriptor(8);int n=nFTKirbyStatusCopyYoshiSpecialAirNRelease-nFTCommonStatusSpecialStart+1;if(n!=83)abort();
 for(int i=0;i<238;i++){kirby_status[i]=safe_statuses[0];}memcpy(kirby_status,base->special_descs,n*sizeof(*kirby_status));
 for(unsigned i=0;i<sizeof(remix_kirby_actions)/sizeof(*remix_kirby_actions);i++){const RemixKirbyAction *a=&remix_kirby_actions[i];FTStatusDesc *s=&kirby_status[a->action-220];if(a->base>=220&&a->base<303)*s=kirby_status[a->base-220];s->mflags.motion_id=a->motion;s->mflags.attack_id=a->attack;s->sflags.halfword=a->flags;
  if(a->action==RK_LUCAS_NSP_Ground)s->proc_physics=ftPhysicsApplyGroundFrictionOrTransN;
  if(a->action==RK_LUCAS_NSP_Air)s->proc_interrupt=lucas_air_recoil;
  int marth=a->action>=RK_MARTH_NSPG_1&&a->action<=RK_MARTH_NSPA_3_Low,roy=a->action>=RK_ROY_NSPG_1&&a->action<=RK_ROY_NSPA_3_Low;
  if(marth||roy){int air=a->action>=(roy?RK_ROY_NSPA_1:RK_MARTH_NSPA_1);s->proc_update=kirby_marth_update;s->proc_physics=air?ftPhysicsApplyAirVelFriction:ftPhysicsApplyGroundFrictionOrTransN;s->proc_map=air?kirby_marth_air_map:kirby_marth_ground_map;}
  if(a->action==RK_FALCO_NSP_Ground||a->action==RK_FALCO_NSP_Air){int air=a->action==RK_FALCO_NSP_Air;s->proc_update=air?ftFoxSpecialAirHiEndProcUpdate:ftAnimEndSetWait;s->proc_interrupt=air?falco_na_interrupt:falco_ng_interrupt;s->proc_physics=air?falco_na_physics:ftPhysicsApplyGroundVelFriction;s->proc_map=air?falco_na_map:kirby_falco_ground_map;}
 }
 kirby_charge_install();
 d->special_descs=kirby_status;d->special_descs_count=238;port_kirby_register_pending_hat_handlers(kirby_hat_pending_set,kirby_hat_pending_get);
}

int port_remix_kirby_capsule(GObj *g){FTStruct *fp=ftGetStruct(g);int id=fp->passive_vars.kirby.copy_id;if(!port_remix_enabled()||(id!=32&&id!=75))return 0;doctor_capsule(g);return 1;}

static void kirby_copies_finish(void){
 for(unsigned i=0;i<sizeof(kirby_shared_actions)/sizeof(*kirby_shared_actions);i++){const int *r=kirby_shared_actions[i];FTStatusDesc *s=&kirby_status[r[2]-220],saved=*s;*s=port_fighter_special_descs(r[0])[r[1]-220];s->mflags=saved.mflags;s->sflags=saved.sflags;}
}
