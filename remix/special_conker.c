/* ConkerSpecial.asm: slingshot, tail recovery, and one live grenade per player. */
static FTStatusDesc conker_status[64];
static ITStatusDesc grenade_status[3];
static int conker_power[4],conker_age[4];
typedef struct {int source,state,cooldown,trade;float cap,spin;} RemixGrenade;
_Static_assert(sizeof(RemixGrenade)<=sizeof(((ITStruct*)0)->item_vars),"grenade state fits tracked item storage");
#define GRENADE(ip) ((RemixGrenade*)&(ip)->item_vars)
static int grenade_is(ITStruct *ip){return main_files[56][6]&&(void*)ip->attr==(char*)main_files[56][6]+0x40;}
void **port_remix_conker_bomb_file(GObj *g,void **file){return grenade_is(itGetStruct(g))?&main_files[56][6]:file;}
static int conker_b(GObj *g){FTStruct *fp=ftGetStruct(g);return (fp->input.pl.button_hold&fp->input.button_mask_b)!=0;}
static void conker_fall(GObj *g){ftCommonFallSpecialSetStatus(g,1,FALSE,TRUE,FALSE,0.35F,FALSE);}
static void conker_h_enter(GObj *g,int air){FTStruct *fp=ftGetStruct(g);marth_clear_flags(fp);ftMainSetStatus(g,air?228:227,0,1,0);ftMainPlayAnimEventsAll(g);fp->physics.vel_air.y=air?30:0;fp->is_fastfall=FALSE;fp->jumps_used=fp->attr->jumps_max;}
static void conker_hg(GObj *g){conker_h_enter(g,0);}static void conker_ha(GObj *g){conker_h_enter(g,1);}
static void conker_h_update(GObj *g){if(g->anim_frame<=0){if(conker_b(g)){ftMainSetStatus(g,230,0,1,0);ftMainPlayAnimEventsAll(g);}else conker_fall(g);}}
static void conker_hover_update(GObj *g){if(!conker_b(g))conker_fall(g);}
static void conker_h_interrupt(GObj *g){FTStruct *fp=ftGetStruct(g);if(fp->motion_vars.flags.flag1==1){mpCommonSetFighterAir(fp);fp->physics.vel_air.y=80;}else if(fp->motion_vars.flags.flag1)fp->physics.vel_air.y*=0.9375F;}
static void conker_h_physics(GObj *g){FTStruct *fp=ftGetStruct(g);union{u32 u;float f;} grav={.u=0x3D8F5D00},accel={.u=0x3D3751EC};int hover=fp->status_id==230;ftPhysicsApplyGravityClampTVel(fp,fp->attr->gravity*(hover?0.25F:fp->motion_vars.flags.flag0?1:grav.f),fp->attr->tvel_base);ftPhysicsClampAirVelXStickRange(fp,0,hover?0.04F:accel.f,hover?32:50);}
static void conker_h_map(GObj *g){FTStruct *fp=ftGetStruct(g);if(fp->ga==nMPKineticsGround){mpCommonSetFighterFallOnEdgeBreak(g);return;}if(fp->physics.vel_air.y>=0)mpCommonCheckFighterProject(g);else if(mpCommonCheckFighterPassCliff(g,ftSamusSpecialHiProcPass)){if(fp->coll_data.mask_stat&MAP_FLAG_CLIFF_MASK)ftCommonCliffCatchSetStatus(g);else ftCommonLandingFallSpecialSetStatus(g,FALSE,0.35F);}}
static sb32 nut_destroy(GObj *g){efManagerDustExpandSmallMakeEffect(&DObjGetStruct(g)->translate.vec.f,1);return TRUE;}
static sb32 nut_update(GObj *g){WPStruct *wp=wpGetStruct(g);if(wpMainDecLifeCheckExpire(wp))return nut_destroy(g);wpMainApplyGravityClampTVel(wp,1.2F,120);DObjGetStruct(g)->rotate.vec.f.x+=wp->remix_speed_scale;return FALSE;}
static void conker_nut(GObj *g){
 FTStruct *fp=ftGetStruct(g);if(!main_files[56][5])return;Vec3f p={0,0,0};gmCollisionGetFighterPartsWorldPosition(fp->joints[17],&p);p.y+=60;p.z=0;
 WPDesc d=dWPMarioFireballWeaponDesc;d.p_weapon=&main_files[56][5];d.o_attributes=0;d.transform_types=(DObjTransformTypes){0x12,0x47,0};d.proc_update=nut_update;d.proc_map=itLGunWeaponAmmoProcMap;d.proc_hit=d.proc_shield=d.proc_setoff=d.proc_absorb=nut_destroy;d.proc_reflector=wpSamusChargeShotProcReflector;
 GObj *w=wpManagerMakeWeapon(g,&d,&p,WEAPON_FLAG_PARENT_FIGHTER);if(!w)return;WPStruct *wp=wpGetStruct(w);int power=fp->motion_vars.flags.flag2;if(power<0)power=0;if(power>4)power=4;
 float speed=60+12*power,angle=0.174533F-0.00872665F*power;wp->physics.vel_air=(Vec3f){cosf(angle)*speed*fp->lr,sinf(angle)*speed,0};wp->lifetime=30;wp->remix_speed_scale=0.1F*(1+0.5F*power);wp->attack_coll.damage+=power*2;wp->attack_coll.knockback_scale+=power*12;wp->attack_coll.knockback_base+=power*4;if(power==4)wp->attack_coll.fgm_id=0x1F;wpMainVelSetLR(w);func_800269C0_275C0(power==0?0x104:power<4?0x103:0x102);
}
static void conker_n_set(GObj *g,int action,u32 keep){remix_copy_set(g,56,action,0,1,keep);ftMainPlayAnimEventsAll(g);}
static void conker_n_enter(GObj *g,int air){conker_n_set(g,air?249:246,0);marth_clear_flags(ftGetStruct(g));}
static void conker_ng(GObj *g){conker_n_enter(g,0);}static void conker_na(GObj *g){conker_n_enter(g,1);}
static void conker_n_update(GObj *g){FTStruct *fp=ftGetStruct(g);int air=fp->ga==nMPKineticsAir,phase=remix_copy_current(fp,56)-(air?249:246);
 if(phase==2){if(fp->motion_vars.flags.flag0){fp->motion_vars.flags.flag0=0;conker_nut(g);}if(g->anim_frame<=0)mpCommonSetFighterWaitOrFall(g);return;}
 if(!conker_b(g)&&(phase==1||fp->motion_vars.flags.flag1)){conker_n_set(g,air?251:248,0x800);return;}
 if(phase==0&&g->anim_frame<=0)conker_n_set(g,air?250:247,0x800);
}
static void conker_n_air(GObj *g){mpCommonSetFighterAir(ftGetStruct(g));remix_copy_set(g,56,remix_copy_current(ftGetStruct(g),56)+3,g->anim_frame,1,0x803);}
static void conker_n_ground(GObj *g){mpCommonSetFighterGround(ftGetStruct(g));remix_copy_set(g,56,remix_copy_current(ftGetStruct(g),56)-3,g->anim_frame,1,0x803);}
static void conker_n_map(GObj *g){if(ftGetStruct(g)->ga==nMPKineticsGround)mpCommonProcFighterOnFloor(g,conker_n_air);else mpCommonProcFighterLanding(g,conker_n_ground);}
static void grenade_air(GObj *g){ITStruct *ip=itGetStruct(g);itMapSetAir(ip);ip->attack_coll.attack_state=nGMAttackStateNew;ip->damage_coll.hitstatus=nGMHitStatusNormal;GRENADE(ip)->state=0;itMainSetStatus(g,grenade_status,0);}
static void grenade_rest(GObj *g){ITStruct *ip=itGetStruct(g);ip->physics.vel_air.y=ip->physics.vel_air.z=0;itMapSetGround(ip);GRENADE(ip)->state=1;itMainSetStatus(g,grenade_status,1);}
static sb32 grenade_explode_update(GObj *g){ITStruct *ip=itGetStruct(g);itLinkBombExplodeUpdateAttackEvent(g);return ++ip->multi>=6;}
static void grenade_explode(GObj *g){ITStruct *ip=itGetStruct(g);ip->physics.vel_air=(Vec3f){0,0,0};ip->damage_coll.hitstatus=nGMHitStatusNone;itMainClearOwnerStats(g);efManagerSparkleWhiteMultiExplodeMakeEffect(&DObjGetStruct(g)->translate.vec.f);efManagerQuakeMakeEffect(1);DObjGetStruct(g)->flags=2;ip->attack_coll.fgm_id=1;itMainRefreshAttackColl(g);ip->multi=ip->event_id=0;ip->attack_coll.throw_mul=1;ip->attack_coll.knockback_scale=70;ip->attack_coll.knockback_base=50;GRENADE(ip)->state=2;itLinkBombExplodeUpdateAttackEvent(g);itMainSetStatus(g,grenade_status,2);func_800269C0_275C0(1);}
static sb32 grenade_update(GObj *g){ITStruct *ip=itGetStruct(g);RemixGrenade *s=GRENADE(ip);
 if(ip->ga==nMPKineticsAir){s->cap=s->cap>61?s->cap-1:60;itMainApplyGravityClampTVel(ip,1.5F,s->cap);}else{ip->physics.vel_air.x*=0.9375F;if(ABSF(ip->physics.vel_air.x)<2){ip->physics.vel_air.x=0;ip->attack_coll.attack_state=nGMAttackStateOff;}}
 if(!ip->lifetime){grenade_explode(g);return FALSE;}ip->lifetime--;
 float speed=sqrtf(SQUARE(ip->physics.vel_air.x)+SQUARE(ip->physics.vel_air.y));if(ip->physics.vel_air.x)s->spin=ip->physics.vel_air.x>0?1:-1;if(speed)DObjGetStruct(g)->rotate.vec.f.z-=(0.003F*speed+0.017578125F)*s->spin;
 if(s->cooldown){if(!--s->cooldown)memset(ip->attack_coll.attack_records,0,sizeof(ip->attack_coll.attack_records));}else if(speed>=35)memset(ip->attack_coll.attack_records,0,sizeof(ip->attack_coll.attack_records));
 ip->attack_coll.damage=1+(int)(speed*0.0703125F);ip->attack_coll.knockback_base=8*ip->attack_coll.damage+10;
 if(ip->lifetime<50&&!(ip->lifetime&7))efManagerDustExpandSmallMakeEffect(&DObjGetStruct(g)->translate.vec.f,0.4F);return FALSE;
}
static sb32 grenade_map(GObj *g){ITStruct *ip=itGetStruct(g);itMapTestAllCheckCollEnd(g);int mask=ip->coll_data.mask_curr;itMapCheckCollideAllRebound(g,MAP_FLAG_MAIN_MASK,0.55F,NULL);if((mask&MAP_FLAG_FLOOR)&&ABSF(ip->physics.vel_air.y)<5)grenade_rest(g);return FALSE;}
static sb32 grenade_rest_map(GObj *g){itMapCheckLRWallProcNoFloor(g,grenade_air);return FALSE;}
static sb32 grenade_hit(GObj *g){ITStruct *ip=itGetStruct(g);RemixGrenade *s=GRENADE(ip);grenade_air(g);float speed=sqrtf(SQUARE(ip->physics.vel_air.x)+SQUARE(ip->physics.vel_air.y));if(!s->trade){ip->physics.vel_air.x=0;ip->physics.vel_air.y=speed*0.5F+5;}s->trade=s->cooldown=0;int n=(int)(speed+0.5F);ip->lifetime-=n+(n>>1);if(ip->lifetime<12)ip->lifetime=12;return FALSE;}
static sb32 grenade_damage(GObj *g){ITStruct *ip=itGetStruct(g);RemixGrenade *s=GRENADE(ip);grenade_air(g);itMainCopyDamageStats(g);float kb=ip->damage_queue*4+10,angle=ftCommonDamageGetKnockbackAngle(ip->damage_angle,ip->ga,kb);s->cap=kb;ip->lr=-ip->damage_lr;ip->physics.vel_air=(Vec3f){cosf(angle)*kb*ip->lr,sinf(angle)*kb,0};s->cooldown=16;s->trade=1;ip->lifetime-=ip->damage_queue*2;if(ip->lifetime<20)ip->lifetime=20;return FALSE;}
static int grenade_active(int player){for(GObj *g=gGCCommonLinks[nGCCommonLinkIDItem];g;g=g->link_next){ITStruct *ip=itGetStruct(g);if(grenade_is(ip)&&GRENADE(ip)->source==player)return TRUE;}return FALSE;}
static void conker_grenade(GObj *g){FTStruct *fp=ftGetStruct(g);if(!main_files[56][6]||grenade_active(fp->player))return;Vec3f p={0,0,0};gmCollisionGetFighterPartsWorldPosition(fp->joints[16],&p);float speed=conker_power[fp->player];Vec3f vel={cosf(0.85F)*speed*fp->lr,sinf(0.85F)*speed,0};ITDesc d=dItLinkBombItemDesc;d.p_file=&main_files[56][6];d.o_attributes=0x40;d.transform_types=(DObjTransformTypes){0x1B,0,0};d.proc_update=grenade_update;d.proc_map=grenade_map;d.proc_hit=d.proc_shield=grenade_hit;d.proc_hop=itMainCommonProcHop;d.proc_setoff=NULL;d.proc_reflector=itMainCommonProcReflector;d.proc_damage=grenade_damage;
 GObj *item=itManagerMakeItem(g,&d,&p,&vel,ITEM_FLAG_PARENT_FIGHTER);if(!item)return;ITStruct *ip=itGetStruct(item);memset(&ip->item_vars,0,sizeof(ip->item_vars));GRENADE(ip)->source=fp->player;GRENADE(ip)->cap=60;ip->owner_gobj=g;ip->team=fp->team;ip->player=fp->player;ip->player_num=fp->player_num;ip->handicap=fp->handicap;ip->is_damage_all=TRUE;ip->attack_coll.attack_state=nGMAttackStateNew;ip->damage_coll.hitstatus=nGMHitStatusNormal;ip->lifetime=150;DObj *root=DObjGetStruct(item);gcAddXObjForDObjFixed(root,0x2E,0);if(root->child)gcAddXObjForDObjFixed(root->child,0x2E,0);mpCommonRunItemCollisionDefault(item,fp->coll_data.p_translate,&fp->coll_data);
}
static void conker_d_enter(GObj *g,int air){FTStruct *fp=ftGetStruct(g);ftMainSetStatus(g,grenade_active(fp->player)?(air?245:239):(air?241:236),0,1,0);ftMainPlayAnimEventsAll(g);fp->motion_vars.flags.flag0=0;conker_power[fp->player]=20;conker_age[fp->player]=0;}
static void conker_dg(GObj *g){conker_d_enter(g,0);}static void conker_da(GObj *g){conker_d_enter(g,1);}
static void conker_d_update(GObj *g){FTStruct *fp=ftGetStruct(g);if(conker_age[fp->player]++>=3&&conker_b(g))conker_power[fp->player]+=5;if(fp->motion_vars.flags.flag0){fp->motion_vars.flags.flag0=0;conker_grenade(g);}if(g->anim_frame<=0)mpCommonSetFighterWaitOrFall(g);}
static void conker_d_air(GObj *g){FTStruct *fp=ftGetStruct(g);mpCommonSetFighterAir(fp);ftMainSetStatus(g,fp->status_id==236?241:245,g->anim_frame,1,0);}
static void conker_d_ground(GObj *g){FTStruct *fp=ftGetStruct(g);mpCommonSetFighterGround(fp);ftMainSetStatus(g,fp->status_id==241?236:239,g->anim_frame,1,0);}
static void conker_d_map(GObj *g){if(ftGetStruct(g)->ga==nMPKineticsGround)mpCommonProcFighterOnFloor(g,conker_d_air);else mpCommonProcFighterLanding(g,conker_d_ground);}
/* Pinned 2.0.1 action table at ROM 0x2cbd98c: parameter indices are
 * not a fixed action offset. In particular N246..251 use motions219..224;
 * a-25 selected the wrong phases and read past the 225-entry motion table. */
static void conker_install(FighterDescriptor *d){memcpy(conker_status,safe_statuses,sizeof(conker_status));int actions[]={227,228,230,236,239,241,245,246,247,248,249,250,251};int motions[]={202,203,205,211,212,215,216,219,220,221,222,223,224};for(int i=0;i<sizeof(actions)/sizeof(actions[0]);i++){int a=actions[i],n=a>=246,up=a<236,air=a==228||a==230||a==241||a==245||a>=249;FTStatusDesc *s=conker_status+a-220;s->mflags.motion_id=motions[i];s->mflags.attack_id=up?17:n?18:30;s->sflags.attack_id=s->mflags.attack_id;s->sflags.ga=air;s->proc_update=n?conker_n_update:up?(a==230?conker_hover_update:conker_h_update):(a==239||a==245)?ftAnimEndSetWait:conker_d_update;if(a==245)s->proc_update=ftAnimEndSetFall;s->proc_interrupt=a==227?conker_h_interrupt:NULL;s->proc_physics=up?conker_h_physics:air?ftPhysicsApplyAirVelDrift:ftPhysicsApplyGroundVelFriction;s->proc_map=n?conker_n_map:up?conker_h_map:conker_d_map;}
 grenade_status[0]=(ITStatusDesc){grenade_update,grenade_map,grenade_hit,grenade_hit,itMainCommonProcHop,NULL,itMainCommonProcReflector,grenade_damage};grenade_status[1]=grenade_status[0];grenade_status[1].proc_map=grenade_rest_map;grenade_status[2]=(ITStatusDesc){grenade_explode_update};
 d->special_descs=conker_status;d->special_handler[0]=conker_ng;d->special_handler[1]=conker_hg;d->special_handler[2]=conker_dg;d->special_handler[3]=conker_na;d->special_handler[4]=conker_ha;d->special_handler[5]=conker_da;
}
