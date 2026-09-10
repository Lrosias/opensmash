/* RoySpecial.asm: Flare Blade charge/release, damage scaling and full-charge
 * recoil. Neutral and up specials share Marth's code with Roy's constants. */
static FTStatusDesc roy_status[64];
static int roy_charge[4];
static void roy_down_enter(GObj *g,int air){roy_charge[ftGetStruct(g)->player]=0;marth_enter(g,air?243:239);}
static void roy_down_ground(GObj *g){roy_down_enter(g,0);}
static void roy_down_air(GObj *g){roy_down_enter(g,1);}
static void roy_down_begin(GObj *g){
 FTStruct *fp=ftGetStruct(g);int air=fp->ga==nMPKineticsAir;
 if(fp->motion_vars.flags.flag1&&!(fp->input.pl.button_hold&fp->input.button_mask_b))marth_enter(g,air?245:241);
 else if(g->anim_frame<=0)marth_enter(g,air?244:240);
}
static void roy_down_wait(GObj *g){
 FTStruct *fp=ftGetStruct(g);int air=fp->ga==nMPKineticsAir;
 if(fp->motion_vars.flags.flag0){fp->motion_vars.flags.flag0=0;roy_charge[fp->player]++;}
 if(roy_charge[fp->player]>=21)marth_enter(g,air?246:242);
 else if(!(fp->input.pl.button_hold&fp->input.button_mask_b))marth_enter(g,air?245:241);
}
static void roy_down_end(GObj *g){
 FTStruct *fp=ftGetStruct(g);int i,shield=8+roy_charge[fp->player];
 if(fp->motion_vars.flags.flag2){ftParamUpdateDamage(fp,10);fp->motion_vars.flags.flag2=0;}
 for(i=0;i<4;i++)if(fp->attack_colls[i].attack_state==1){fp->attack_colls[i].damage+=roy_charge[fp->player]*2;fp->attack_colls[i].shield_damage=shield;shield>>=1;}
 if(g->anim_frame<=0)mpCommonSetFighterWaitOrFall(g);
}
static void roy_down_to_air(GObj *g){FTStruct *fp=ftGetStruct(g);mpCommonSetFighterAir(fp);ftMainSetStatus(g,fp->status_id+4,g->anim_frame,1,0x2803);ftPhysicsClampAirVelXMax(fp);}
static void roy_down_to_ground(GObj *g){FTStruct *fp=ftGetStruct(g);mpCommonSetFighterGround(fp);ftMainSetStatus(g,fp->status_id-4,g->anim_frame,1,0x2803);}
static void roy_down_ground_map(GObj *g){mpCommonProcFighterOnEdge(g,roy_down_to_air);}
static void roy_down_air_map(GObj *g){mpCommonProcFighterLanding(g,roy_down_to_ground);}
static void roy_install(FighterDescriptor *d){
 int action;marth_install(d);memcpy(roy_status,marth_status,sizeof(roy_status));
 for(action=239;action<=246;action++){
  FTStatusDesc *s=&roy_status[action-220];int kind=(action-239)%4,air=action>=243;
  s->mflags.motion_id=action-25;s->mflags.attack_id=30;s->sflags.attack_id=30;s->sflags.ga=air;
  s->proc_update=kind==0?roy_down_begin:kind==1?roy_down_wait:roy_down_end;s->proc_interrupt=NULL;
  s->proc_physics=air?(kind<2?ftPhysicsApplyAirVelDrift:ftPhysicsApplyAirVelFriction):ftPhysicsApplyGroundVelFriction;
  s->proc_map=air?roy_down_air_map:roy_down_ground_map;
 }
 d->special_descs=roy_status;d->special_handler[2]=roy_down_ground;d->special_handler[5]=roy_down_air;
}
