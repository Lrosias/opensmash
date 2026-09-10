/* OpenSmash64 Remix: curated independent fighter slots and ROM stages. */
#include <ft/fighter.h>
#include <gr/ground.h>
#include <sc/scene.h>
#include <sys/objman.h>
#include <sys/controller.h>
#include <sys/rdp.h>
#include <mn/menu.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include "fighter_registry.h"
#include "roster_data.h"
#include "stage_data.h"
#include "main_sizes.h"
#include "menu_data.h"
#include <reloc_data.h>
#include <ef/effect.h>
#include <sys/audio.h>
extern void *func_800269C0_275C0(u16);
extern void portVoiceInjectPlayPath(const char *);
extern char *getenv(const char *);
extern void port_log(const char *,...);
extern FTData dFTFoxData;
static FTData main_data[97];
static void *main_files[97][9];
static FTStatusDesc safe_statuses[64];
static FTCostume safe_costumes;
static int remix_test_floor=-1;
int port_remix_enabled(void){return getenv("SSB64_REMIX_MAIN")!=NULL;}
#include "special_marth.inc.h"
#include "special_falco.inc.h"
#include "special_roy.inc.h"
#include "special_doctor.inc.h"
#include "special_ganon.inc.h"
#include "special_younglink.inc.h"
#include "special_lucas.inc.h"
#include "special_darksamus.inc.h"
int port_remix_motion_event(GObj *g,FTMotionScript *ms){
 u32 word=*(u32*)ms->p_script;union{u32 u;float f;} speed,root_speed;FTStruct *fp=ftGetStruct(g);
 if(!port_remix_enabled())return 0;
 speed.u=(word&0xFFFF)<<16;root_speed.f=DObjGetStruct(g)->anim_speed;
 switch(word>>24){
 case 0xD0:
 gcSetAnimSpeed(g,speed.f);
 if(word&0x00FF0000){if(root_speed.u==0x3F800000)root_speed.u++;DObjGetStruct(g)->anim_speed=root_speed.f;}
 break;
 case 0xD1:fp->knockback_resist_status=speed.f;break;
 case 0xD4:fp->physics.vel_air.y=speed.f;break;
 case 0xD5:fp->is_fastfall=(word&255)!=0;break;
 case 0xD7:fp->ga=(word&255)?nMPKineticsAir:nMPKineticsGround;fp->jumps_used=(word&255)?1:0;break;
 case 0xDA:fp->lr=-fp->lr;break;
 default:return 0;
 }
 ms->p_script=(u32*)ms->p_script+1;return 1;
}
const char *port_marth_asset_path(unsigned int id){const char *p=remix_menu_asset_path(id);if(p)return p;p=remix_stage_asset_path(id);return p?p:remix_asset_path(id);}
int port_marth_animation_file(unsigned int id){return remix_animation_file(id);}
static void remix_entry_update(GObj *gobj){
 FTStruct *fp=ftGetStruct(gobj);
 if(fp->status_vars.common.entry.entry_wait>0&&--fp->status_vars.common.entry.entry_wait)return;
 fp->lr=fp->status_vars.common.entry.lr;DObjGetStruct(gobj)->translate.vec.f=fp->entry_pos;
 fp->coll_data.floor_line_id=fp->status_vars.common.entry.floor_line_id;fp->camera_mode=nFTCameraModeDefault;
 ftCommonWaitSetStatus(gobj);
}
void port_marth_init(void){
 int i,j;if(!port_remix_enabled())return;
 for(i=0;i<64;i++){safe_statuses[i].mflags.motion_id=nFTCommonMotionWait;safe_statuses[i].proc_update=ftCommonWaitSetStatus;}
 safe_statuses[63].mflags.motion_id=nFTCommonMotionEntryNull;safe_statuses[63].proc_update=remix_entry_update;
 for(i=0;i<sizeof(remix_fighters)/sizeof(remix_fighters[0]);i++){
  RemixFighter *f=&remix_fighters[i];FTData *d=&main_data[f->id];void **files=main_files[f->id];FighterDescriptor desc;
  if(f->id<12)continue;
  f->bind();f->main[0].anim_file_id=0;f->main[0].offset=0x80000000;
  *d=dFTFoxData;
  d->file_main_id=f->files[0];d->file_mainmotion_id=f->files[1];d->file_submotion_id=f->files[2];d->file_model_id=f->files[3];d->file_shieldpose_id=f->files[4];
  d->file_special1_id=f->files[5];d->file_special2_id=f->files[6];d->file_special3_id=f->files[7];d->file_special4_id=f->files[8];
  d->p_file_main=&files[0];d->p_file_mainmotion=&files[1];d->p_file_submotion=&files[2];d->p_file_model=&files[3];d->p_file_shieldpose=NULL;
  d->p_file_special1=&files[5];d->p_file_special2=&files[6];d->p_file_special3=&files[7];d->p_file_special4=&files[8];
  d->o_attributes=f->attributes;d->mainmotion=(FTMotionDescArray*)f->main;d->submotion=(FTMotionDescArray*)f->sub;
  d->mainmotion_array_count=f->main_count;d->submotion_array_count=&f->sub_count;
  d->file_main_size=remix_main_size(f->id);d->file_anim_size=remix_anim_size(f->id);
  desc=*port_fighter_descriptor(nFTKindFox);desc.ft_data=d;desc.special_descs=safe_statuses;desc.special_descs_count=64;
  desc.entry_appear_status[0]=desc.entry_appear_status[1]=283;desc.entry_make_effect=NULL;desc.scale=1;
  desc.costume_row=&safe_costumes;desc.costume_count=1;desc.default_costumes=NULL;desc.default_costumes_count=0;
  desc.public_call_fgm=0;desc.results_name=f->name;desc.results_announce_fgm=0;desc.results_name_lx=70;desc.results_name_scale=1;desc.results_wins_lx=200;
  for(j=0;j<PORT_FIGHTER_SPECIAL_COUNT;j++)desc.special_handler[j]=j<3?ftCommonWaitSetStatus:ftCommonFallSetStatus;
  if(f->id==58)marth_install(&desc);
  if(f->id==29)falco_install(&desc);
  if(f->id==74)roy_install(&desc);
  if(f->id==32||f->id==75)doctor_install(&desc,f->id);
  if(f->id==30)ganon_install(&desc);
  if(f->id==31)younglink_install(&desc);
  if(f->id==38)lucas_install(&desc);
  if(f->id==34)ds_install(&desc);
  port_fighter_register(f->id,&desc);
 }
 port_log("REMIX MAIN: 34 independent fighters registered\n");
}
void port_remix_fighter_reset(void){
 int i;if(!port_remix_enabled())return;
 remix_test_floor=-1;
 for(i=29;i<97;i++)if(main_data[i].p_file_main){*main_data[i].p_file_main=NULL;if(gFTManagerFigatreeHeapSize<main_data[i].file_anim_size)gFTManagerFigatreeHeapSize=main_data[i].file_anim_size;}
}
GRFileInfo *port_remix_ground_info(int id){
 static GRFileInfo stages[]={{0x4898,20},{0x4877,20},{0x4880,20},{0x4e69,20},{0x4a4c,20},{0x4871,20}};
 if(!port_remix_enabled()||gSCManagerSceneData.scene_curr!=nSCKindVSBattle||id<9||id>14)return NULL;
 return &stages[id-9];
}

/* Select opposite, equal-height spawn points from each stage's own map data. */
int port_remix_spawn(int player,Vec3f *pos){
 int i,j,a=-1,b=-1,best=-1;
 if(!port_remix_enabled()||gSCManagerSceneData.scene_curr!=nSCKindVSBattle||player>1)return 0;
 if(gSCManagerBattleState->pl_count+gSCManagerBattleState->cp_count!=2)return 0;
 for(i=0;i<gMPCollisionGeometry->mapobj_count;i++){
  MPMapObjData *left=&gMPCollisionMapObjs->mapobjs[i];if(left->mapobj_kind>3)continue;
  for(j=i+1;j<gMPCollisionGeometry->mapobj_count;j++){
   MPMapObjData *right=&gMPCollisionMapObjs->mapobjs[j];int distance,dy=left->pos.y-right->pos.y;
   if(dy<0)dy=-dy;
   if(right->mapobj_kind>3||dy>16)continue;
   distance=left->pos.x-right->pos.x;if(distance<0)distance=-distance;
   if(distance>best){best=distance;a=i;b=j;}
  }
 }
 if(a<0||best==0)return 0;
 if(gMPCollisionMapObjs->mapobjs[a].pos.x>gMPCollisionMapObjs->mapobjs[b].pos.x){i=a;a=b;b=i;}
 pos->x=gMPCollisionMapObjs->mapobjs[player?b:a].pos.x;pos->y=gMPCollisionMapObjs->mapobjs[player?b:a].pos.y;pos->z=0;return 1;
}

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
extern void port_yougame_menu_font(void);
extern void port_yougame_menu_text(GObj*,const char*,float,float,float,int);
extern int port_yougame_menu_context,port_yougame_queue_kind;
static const int picks[]={0,1,2,3,4,5,6,7,8,9,10,11,29,30,31,32,33,52,55,56,57,58,59,62,63,64,65,68,73,72,34,38,74,75};
static const char *names[]={"MARIO","FOX","DONKEY KONG","SAMUS","LUIGI","LINK","YOSHI","CAPTAIN FALCON","KIRBY","PIKACHU","JIGGLYPUFF","NESS","FALCO","GANONDORF","YOUNG LINK","DR MARIO","WARIO","BOWSER","WOLF","CONKER","MEWTWO","MARTH","SONIC","SHEIK","MARINA","DEDEDE","GOEMON","BANJO KAZOOIE","PEACH","CRASH","DARK SAMUS","LUCAS","ROY","DR LUIGI"};
static const int stage_ids[]={6,16,9,10,11,12,13,14};
static const char *stage_names[]={"DREAM LAND","FINAL DESTINATION","FRAYS STAGE","FIRST DESTINATION","POKEMON STADIUM","POKEMON STADIUM 2","GOOMBA ROAD","BATTLEFIELD"};
static int cursor,phase,wait_ticks,chosen[2],stage_cursor;
static void reset_results_online(void);
static GObj *words;
static void *menu_portraits,*menu_images,*menu_common,*menu_modes,*menu_stone,*menu_stage_icons,*menu_stage_ui;
static GObj *stage_layers[4];
static int preview_stage;
static MPGroundData *stage_ground[8];
extern void mpCollisionFixGroundDataLayout(MPGroundData*);
extern GRFileInfo dMPCollisionGroundFileInfos[];
extern GObj *mnMapsMakeLayer(s32,MPGroundData*,MPGroundDesc*,s32);
static void preview_map(int index){
 int i;MPGroundData *ground;
 static const int files[]={0,0,0x4898,0x4877,0x4880,0x4e69,0x4a4c,0x4871};
 if(index==preview_stage)return;
 for(i=0;i<4;i++)if(stage_layers[i]){gcEjectGObj(stage_layers[i]);stage_layers[i]=NULL;}
 preview_stage=index;
 if(!stage_ground[index]){
  GRFileInfo info=index<2?dMPCollisionGroundFileInfos[stage_ids[index]]:(GRFileInfo){files[index],20};
  u32 ids[]={info.file_id};void *data[1];lbRelocLoadFilesListed(ids,data);
  ground=(MPGroundData*)((char*)data[0]+info.offset);
  mpCollisionFixGroundDataLayout(ground);stage_ground[index]=ground;
 }
 ground=stage_ground[index];
 for(i=0;i<4;i++)stage_layers[i]=mnMapsMakeLayer(nGRKindPupupu,ground,&ground->gr_desc[i],i);
}
static GObj *menu_previews[2];
static void *menu_preview_heaps[2];
static int menu_preview_kinds[2];
static void preview_run(GObj *g){DObjGetStruct(g)->rotate.vec.f.y+=F_CST_DTOR32(1.5F);}
static void preview_fighter(int player,int id){
 FTDesc desc=dFTManagerDefaultFighterDesc;GObj *g;float scale;
 if(menu_preview_kinds[player]==id)return;
 if(menu_previews[player])ftManagerDestroyFighter(menu_previews[player]);
 ftManagerSetupFilesAllKind(id);desc.fkind=id;desc.costume=0;desc.shade=0;desc.player=player;desc.figatree_heap=menu_preview_heaps[player];desc.is_skip_shadow_setup=TRUE;
 g=menu_previews[player]=ftManagerMakeFighter(&desc);menu_preview_kinds[player]=id;
 DObjGetStruct(g)->translate.vec.f=(Vec3f){player*840-1250,-850,0};
 scale=port_fighter_scale(id);DObjGetStruct(g)->scale.vec.f=(Vec3f){scale,scale,scale};
 gcAddGObjProcess(g,preview_run,nGCProcessKindFunc,1);
}
static void scene(int id){gSCManagerSceneData.scene_prev=gSCManagerSceneData.scene_curr;gSCManagerSceneData.scene_curr=id;syTaskmanSetLoadScene();}
static const char *fighter_name(int id){int i;for(i=0;i<34;i++)if(picks[i]==id)return names[i];return "FIGHTER";}
static void announce_fighter(int id){
 if(id<12){func_800269C0_275C0(port_fighter_descriptor(id)->public_call_fgm);}
 else{char path[80];snprintf(path,sizeof(path),"assets/remix/voices/%d.wav",id);portVoiceInjectPlayPath(path);}
}
static int portrait_index(int id){int i;for(i=0;i<34;i++)if(remix_menu_layout[i]==id)return i;return 3;}
static SObj *menu_sprite(GObj *g,void *file,int offset,float x,float y,float scale){
 SObj *s=lbCommonMakeSObjForGObj(g,(Sprite*)((char*)file+offset));
 s->pos.x=x;s->pos.y=y;s->sprite.attr&=~SP_FASTCOPY;s->sprite.attr|=SP_TRANSPARENT;
 s->sprite.scalex=s->sprite.scaley=scale;return s;
}
static void portrait_xy(int index,float *x,float *y){
 *x=index<30?39+(index%10)*24:111+(index-30)*24;
 *y=index<30?44+(index/10)*24:120;
}
static void draw_menu(void){
 int i,index;float x,y;SObj *s;
 if(words)gcEjectGObj(words);
 words=gcMakeGObjSPAfter(0,NULL,28,GOBJ_PRIORITY_DEFAULT);gcAddGObjDisplay(words,lbCommonDrawSObjAttr,27,GOBJ_PRIORITY_DEFAULT,~0);
 s=menu_sprite(words,menu_stone,llMNSelectCommonStoneBackgroundSprite,10,10,1);
 s->cms=G_TX_WRAP;s->cmt=G_TX_WRAP;s->masks=6;s->maskt=5;s->lrs=300;s->lrt=220;
 menu_sprite(words,menu_modes,llMNPlayersGameModesFreeForAllTextSprite,23,20,0.7F);
 port_yougame_menu_text(words,"OPENSMASH64 REMIX",157,24,0.6F,0xFFD35C);
 if(phase==2){
  menu_sprite(words,menu_stage_ui,llMNMapsStageSelectTextSprite,29,42,0.8F);
  for(i=0;i<8;i++)menu_sprite(words,menu_stage_icons,remix_stage_icon_offsets[i],39+(i%4)*62,62+(i/4)*39,1.25F);
  s=menu_sprite(words,menu_stage_ui,llMNMapsCursorSprite,36+(stage_cursor%4)*62,59+(stage_cursor/4)*39,0.9F);s->sprite.scaley=0.86F;
  menu_sprite(words,menu_stage_ui,llMNMapsWoodenCircleSprite,205,144,0.8F);
  menu_sprite(words,menu_stage_icons,remix_stage_icon_offsets[stage_cursor],204,151,1.5F);
  port_yougame_menu_text(words,stage_names[stage_cursor],25,213,0.75F,0xFFD35C);
  preview_map(stage_cursor);
 }else{
  for(i=0;i<34;i++){portrait_xy(i,&x,&y);menu_sprite(words,menu_portraits,remix_portrait_offsets[i],x,y,0.8125F);}
  // Original Remix bonus bookend; the allowed bonus portraits are exposed
  // directly below the main thirty instead of cycling unrelated variants.
  s=menu_sprite(words,menu_images,0x3b28,25,44,0.8125F);s->sprite.scalex=0.9375F;s->sprite.scaley=0.7578125F;
  port_yougame_menu_text(words,"BONUS",65,136,0.52F,0xFFD35C);
  for(i=0;i<4;i++){
   float px=22+69*i;int id=i==0?(phase==0?remix_menu_layout[cursor]:chosen[0]):i==1?(phase==1?remix_menu_layout[cursor]:chosen[1]):0;
   s=menu_sprite(words,menu_common,i==0?llMNPlayersCommonRedCardSprite:llMNPlayersCommonGrayCardSprite,px,150,1);
   s->sprite.scaley=0.67F;
   if(i<2){
    menu_sprite(words,menu_common,i?llMNPlayersCommonCPTextSprite:llMNPlayersCommon1PTextSprite,px+4,152,0.65F);
    preview_fighter(i,id);
    port_yougame_menu_text(words,fighter_name(id),px+3,215,0.39F,0xFFFFFF);
   }else port_yougame_menu_text(words,"OFF",px+19,187,0.8F,0xA9A9A9);
  }
  if(phase>0){index=portrait_index(chosen[0]);portrait_xy(index,&x,&y);menu_sprite(words,menu_common,llMNPlayersCommon1PPuckSprite,x+6,y+9,0.38F);}
  if(phase==3){index=portrait_index(chosen[1]);portrait_xy(index,&x,&y);menu_sprite(words,menu_common,llMNPlayersCommonCPPuckSprite,x+6,y+9,0.38F);menu_sprite(words,menu_common,llMNPlayersCommonReadyToFightTextSprite,71,35,0.7F);}
  else{
   portrait_xy(cursor,&x,&y);menu_sprite(words,menu_common,phase==0?llMNPlayersCommon1PPuckSprite:llMNPlayersCommonCPPuckSprite,x+6,y+9,0.4F);
   menu_sprite(words,menu_common,llMNPlayersCommonCursorHandPointSprite,x+13,y+14,0.55F);
  }
 }
 for(i=0;i<2;i++)if(menu_previews[i])menu_previews[i]->flags=phase==2?GOBJ_FLAG_HIDDEN:0;
 for(i=0;i<4;i++)if(stage_layers[i])stage_layers[i]->flags=phase==2?0:GOBJ_FLAG_HIDDEN;
 port_yougame_menu_text(words,phase==3?"START   READY TO FIGHT":phase==2?"A SELECT   B BACK":phase==0?"1P   CHOOSE YOUR FIGHTER":"CPU   CHOOSE OPPONENT",22,223,0.55F,0xFFFFFF);
 EM_ASM({Module.remixMenu=({phase:$0,cursor:$1,stage:$2,p1:$3,p2:$4,hover:$5});},phase,cursor,stage_cursor,chosen[0],chosen[1],remix_menu_layout[cursor]);
}
static void menu_run(GObj *gobj){
 int taps=gSYControllerDevices[0].button_tap,x=gSYControllerDevices[0].stick_range.x,y=gSYControllerDevices[0].stick_range.y;
 int step=0,count=phase==2?8:34;
 if(wait_ticks){wait_ticks--;return;}
 if(taps&B_BUTTON){func_800269C0_275C0(nSYAudioFGMMenuDenied);if(phase){phase=phase==2?3:phase==3?1:0;cursor=portrait_index(chosen[phase==1?1:0]);draw_menu();wait_ticks=12;}else scene(nSCKindVSMode);return;}
 if(phase==3)step=0;
 else if(y>35||(taps&U_JPAD))step=phase==2?-4:cursor>=30?23+(cursor-30)-cursor:cursor>=10?-10:20;
 else if(y< -35||(taps&D_JPAD))step=phase==2?4:cursor<20?10:cursor<30?30+((cursor%10)<3?0:(cursor%10)>6?3:cursor%10-3)-cursor:3+(cursor-30)-cursor;
 else if(x>35||(taps&R_JPAD))step=1;else if(x< -35||(taps&L_JPAD))step=-1;
 if(step){func_800269C0_275C0(nSYAudioFGMMenuScroll2);if(phase==2)stage_cursor=(stage_cursor+step+count)%count;else cursor=(cursor+step+count)%count;wait_ticks=10;draw_menu();return;}
 if(taps&(A_BUTTON|START_BUTTON)){
  wait_ticks=15;func_800269C0_275C0(nSYAudioFGMMenuSelect);
  if(phase==0){chosen[0]=remix_menu_layout[cursor];announce_fighter(chosen[0]);phase=port_yougame_menu_context?2:1;cursor=portrait_index(chosen[1]);draw_menu();}
  else if(phase==1){chosen[1]=remix_menu_layout[cursor];announce_fighter(chosen[1]);phase=3;draw_menu();}
  else if(phase==3){phase=2;draw_menu();}
  else if(port_yougame_menu_context){
   EM_ASM({if(Module.onYouGameMenu)Module.onYouGameMenu(5,($0<<16)|($1<<8)|$2);},stage_ids[stage_cursor],port_yougame_queue_kind,chosen[0]);scene(nSCKindVSMode);
  }else{
   SCBattleState *bs=&gSCManagerTransferBattleState;int i;reset_results_online();
   bs->pl_count=1;bs->cp_count=1;bs->damage_ratio=100;bs->handicap=0;bs->gkind=stage_ids[stage_cursor];bs->game_rules=SCBATTLE_GAMERULE_STOCK;bs->stocks=2;bs->time_limit=8;bs->is_team_battle=FALSE;bs->item_toggles=0;bs->item_appearance_rate=0;
   for(i=0;i<4;i++){bs->players[i].pkind=i==0?nFTPlayerKindMan:i==1?nFTPlayerKindCom:nFTPlayerKindNot;bs->players[i].fkind=i<2?chosen[i]:nFTKindNull;bs->players[i].player=i;bs->players[i].color=i==0?0:4;bs->players[i].tag=i==0?0:4;bs->players[i].is_single_stockicon=FALSE;bs->players[i].costume=0;bs->players[i].shade=0;bs->players[i].level=5;bs->players[i].handicap=9;}
   gSCManagerSceneData.gkind=bs->gkind;scene(nSCKindVSBattle);
  }
 }
}
void port_remix_css_start(void){
 u32 ids[]={0x4a05,0x4a06,0x4011,0x4012,0x4015,0x4a04,0x401e};void *files[7];GObj *camera;CObj *c;
 lbRelocLoadFilesListed(ids,files);menu_portraits=files[0];menu_images=files[1];menu_common=files[2];menu_modes=files[3];menu_stone=files[4];
 menu_stage_icons=files[5];menu_stage_ui=files[6];preview_stage=-1;memset(stage_layers,0,sizeof(stage_layers));memset(stage_ground,0,sizeof(stage_ground));
 port_yougame_menu_font();cursor=portrait_index(0);phase=0;stage_cursor=0;wait_ticks=20;words=NULL;chosen[0]=0;chosen[1]=8;
 efParticleInitAll();efManagerInitEffects();ftManagerAllocFighter(FTDATA_FLAG_SUBMOTION,2);
 {int i;for(i=0;i<2;i++){menu_previews[i]=NULL;menu_preview_kinds[i]=-1;menu_preview_heaps[i]=syTaskmanMalloc(gFTManagerFigatreeHeapSize,16);}}
 gcMakeDefaultCameraGObj(16,GOBJ_PRIORITY_DEFAULT,100,COBJ_FLAG_ZBUFFER|COBJ_FLAG_FILLCOLOR,GPACK_RGBA8888(0x0B,0x14,0x25,0xFF));
 mnPlayersVSMakePortraitCamera();mnPlayersVSMakeFighterCamera();
 camera=gcMakeCameraGObj(1,NULL,1,GOBJ_PRIORITY_DEFAULT,func_80017DBC,65,COBJ_MASK_DLLINK(3),~0,TRUE,nGCProcessKindFunc,NULL,1,FALSE);
 c=CObjGetStruct(camera);syRdpSetViewport(&c->viewport,24,139,185,204);c->projection.persp.far=32768;
 c->projection.persp.aspect=161.0F/65.0F;c->projection.persp.fovy=30;
 c->vec.eye=(Vec3f){-1500,1800,7000};c->vec.at=(Vec3f){0,200,0};c->vec.up=(Vec3f){0,1,0};
 gcMakeGObjSPAfter(nGCCommonKindPlayerSelect,menu_run,15,GOBJ_PRIORITY_DEFAULT);draw_menu();
}
/* The original results scene indexes twelve-character tables and writes its
 * twelve-character record book. Imported IDs must never enter that code. */
static int results_wait,results_online,results_override=-3;
static void reset_results_online(void){results_online=0;results_override=-3;}
static GObj *results_fighters[4];
static void results_run(GObj *gobj){
 int taps=gSYControllerDevices[0].button_tap;
 if(results_wait){results_wait--;return;}
 if(taps&(A_BUTTON|START_BUTTON)){func_800269C0_275C0(nSYAudioFGMMenuSelect);
  if(results_online){EM_ASM({if(Module.onYouGameMenu)Module.onYouGameMenu(3,0);});results_wait=30;}
  else scene(nSCKindPlayersVS);
 }
 else if(taps&B_BUTTON){func_800269C0_275C0(nSYAudioFGMMenuDenied);if(results_online){results_online=0;EM_ASM({if(Module.onYouGameMenu)Module.onYouGameMenu(2,0);});}scene(nSCKindVSMode);}
}
int port_remix_results_start(void){
 SCBattleState *bs=&gSCManagerTransferBattleState;GObj *g;char line[96];int i,j,count=0,winner=-1,tie=0,best=-9999;
 if(!port_remix_enabled())return 0;
 for(i=0;i<4;i++)if(bs->players[i].pkind!=nFTPlayerKindNot){
  int score=bs->players[i].stock_count;count++;
  if(score>best){best=score;winner=i;tie=0;}else if(score==best)tie=1;
 }
 if(tie||gSCManagerSceneData.is_reset)winner=-1;
 if(results_override!=-3){winner=results_override;results_override=-3;}
 port_yougame_menu_font();results_wait=60;
 efParticleInitAll();efManagerInitEffects();ftManagerAllocFighter(FTDATA_FLAG_SUBMOTION,count);
 memset(results_fighters,0,sizeof(results_fighters));
 gcMakeDefaultCameraGObj(16,GOBJ_PRIORITY_DEFAULT,100,COBJ_FLAG_ZBUFFER|COBJ_FLAG_FILLCOLOR,GPACK_RGBA8888(0x0B,0x14,0x25,0xFF));
 mnPlayersVSMakePortraitCamera();mnPlayersVSMakeFighterCamera();
 g=gcMakeGObjSPAfter(0,results_run,15,GOBJ_PRIORITY_DEFAULT);gcAddGObjDisplay(g,lbCommonDrawSObjAttr,27,GOBJ_PRIORITY_DEFAULT,~0);
 port_yougame_menu_text(g,"OPENSMASH64 REMIX",20,18,0.75F,0xF4CF68);
 port_yougame_menu_text(g,gSCManagerSceneData.is_reset?"NO CONTEST":winner<0?"MATCH COMPLETE":"WINNER",20,42,0.75F,0xFFFFFF);
 if(winner>=0){snprintf(line,sizeof(line),"%s WINS",fighter_name(bs->players[winner].fkind));port_yougame_menu_text(g,line,20,59,1.0F,0xFFD35C);announce_fighter(bs->players[winner].fkind);}
 for(i=0,j=0;i<4;i++)if(bs->players[i].pkind!=nFTPlayerKindNot){
  FTDesc d=dFTManagerDefaultFighterDesc;GObj *f;float x=20+j*280.0F/count,scale;
  int kos=0,k;for(k=0;k<4;k++)kos+=bs->players[i].total_kos_players[k];
  ftManagerSetupFilesAllKind(bs->players[i].fkind);d.fkind=bs->players[i].fkind;d.costume=bs->players[i].costume;d.shade=bs->players[i].shade;d.player=i;d.figatree_heap=syTaskmanMalloc(gFTManagerFigatreeHeapSize,16);d.is_skip_shadow_setup=TRUE;
  f=results_fighters[i]=ftManagerMakeFighter(&d);
  scSubsysFighterSetStatus(f,i==winner?nFTDemoStatusWin1:nFTDemoStatusLose);
  scale=port_fighter_scale(d.fkind)*(count>2?0.7F:1.0F);
  DObjGetStruct(f)->translate.vec.f=(Vec3f){(j-(count-1)*0.5F)*(count>2?950:1500),-450,0};
  DObjGetStruct(f)->rotate.vec.f.y=F_CST_DTOR32(-12);
  DObjGetStruct(f)->scale.vec.f=(Vec3f){scale,scale,scale};
  snprintf(line,sizeof(line),"%s",fighter_name(d.fkind));port_yougame_menu_text(g,line,x,174,count>2?0.42F:0.6F,i==winner?0xFFD35C:0xFFFFFF);
  snprintf(line,sizeof(line),"%s%d  KO %d  FALLS %d",bs->players[i].pkind==nFTPlayerKindCom?"CPU ":"P",i+1,kos,bs->players[i].falls);port_yougame_menu_text(g,line,x,188,count>2?0.36F:0.45F,0xBDCDE1);j++;
 }
 port_yougame_menu_text(g,results_online?"A OR START   REMATCH":"A OR START   CHOOSE FIGHTERS",20,209,0.65F,0xFFFFFF);
 port_yougame_menu_text(g,"B   BACK TO VS MODE",20,225,0.5F,0xBDCDE1);
 EM_ASM({Module.remixResults=({winner:$0,fighters:[$1,$2],animated:true});},winner,bs->players[0].fkind,bs->players[1].fkind);
 return 1;
}
/* Display only after the multiplayer service confirms a result. */
EMSCRIPTEN_KEEPALIVE int port_remix_online_results(int first,int second,int winner,int stocks0,int stocks1){
 SCBattleState *bs=&gSCManagerTransferBattleState;int i,a=0,b=0;
 for(i=0;i<34;i++){if(picks[i]==first)a=1;if(picks[i]==second)b=1;}
 if(!port_remix_enabled()||!a||!b||winner< -2||winner>1)return 0;
 results_online=1;results_override=winner<0?-1:winner;gSCManagerSceneData.is_reset=winner==-2;
 bs->pl_count=2;bs->cp_count=0;
 for(i=0;i<4;i++){memset(&bs->players[i],0,sizeof(bs->players[i]));bs->players[i].pkind=i<2?nFTPlayerKindMan:nFTPlayerKindNot;bs->players[i].fkind=i==0?first:second;bs->players[i].player=i;bs->players[i].stock_count=(i?stocks1:stocks0)-1;}
 scene(nSCKindVSResults);return 1;
}

#endif
#ifdef __EMSCRIPTEN__
#include <emscripten/emscripten.h>
/* Opt-in fixture for deterministic browser combat checks. It changes only
 * starting positions/velocities; attacks and damage still run in the engine. */
EMSCRIPTEN_KEEPALIVE int port_remix_test_place(int gap)
{
    GObj *gobj;FTStruct *opponent=NULL;int count=0;int floor=-1;
    const char *test=getenv("SSB64_REMIX_TEST");
    if(!test||test[0]!='1'||test[1]||gap<100||gap>800)return 0;
    for(gobj=gGCCommonLinks[nGCCommonLinkIDFighter];gobj;gobj=gobj->link_next){
        FTStruct *fp=ftGetStruct(gobj);count++;if(fp->player==1)opponent=fp;
        if(fp->ga==nMPKineticsGround&&fp->coll_data.floor_line_id>=0)floor=fp->coll_data.floor_line_id;
    }
    if(floor>=0)remix_test_floor=floor;else floor=remix_test_floor;
    if(count!=2||!opponent||floor<0)return 0;
    for(gobj=gGCCommonLinks[nGCCommonLinkIDFighter];gobj;gobj=gobj->link_next){
        FTStruct *fp=ftGetStruct(gobj);int me=fp->player==0;
        fp->lr=me?1:-1;
        fp->joints[nFTPartsJointTopN]->translate.vec.f=(Vec3f){me?-gap/2.0f:gap/2.0f,0,0};
        memset(&fp->physics,0,sizeof(fp->physics));fp->hitlag_tics=0;
        fp->coll_data.floor_line_id=floor;fp->camera_mode=nFTCameraModeDefault;
        fp->coll_data.mask_curr=fp->coll_data.mask_prev=fp->coll_data.mask_unk=fp->coll_data.mask_stat=0;
        fp->coll_data.pos_prev=*fp->coll_data.p_translate;
        fp->coll_data.pos_diff=(Vec3f){0,0,0};
        fp->coll_data.ewall_line_id=-2;
        fp->is_ghost=FALSE;fp->is_invisible=FALSE;
        ftCommonWaitSetStatus(gobj);
    }
    return 1;
}
EMSCRIPTEN_KEEPALIVE int *port_marth_probe(void)
{
    static int state[32];GObj *gobj;int i=0,j;
    memset(state,0,sizeof(state));
    for(gobj=gGCCommonLinks[nGCCommonLinkIDFighter];gobj&&i<2;gobj=gobj->link_next,i++){
        FTStruct *fp=ftGetStruct(gobj);int *row=state+16*i;
        row[0]=fp->fkind;row[1]=fp->status_id;row[2]=fp->percent_damage;
        row[3]=(int)fp->joints[nFTPartsJointTopN]->translate.vec.f.x;row[4]=(int)fp->joints[nFTPartsJointTopN]->translate.vec.f.y;
        row[5]=(int)gobj->anim_frame;row[6]=fp->data->file_main_id;row[7]=fp->data->file_model_id;
        for(j=0;j<4;j++)row[8+j]=fp->attack_colls[j].attack_state;
        row[12]=fp->is_invisible;row[13]=fp->is_ghost;row[14]=fp->camera_mode;row[15]=fp->lr;
    }return state;
}
EMSCRIPTEN_KEEPALIVE int *port_remix_entity_probe(void){
 static int data[322];int n=0;GObj *g;memset(data,0,sizeof(data));
 for(g=gGCCommonLinks[nGCCommonLinkIDWeapon];g&&n<32;g=g->link_next){
  WPStruct *w=wpGetStruct(g);int *r=data+2+10*n++;data[0]++;
  r[0]=0;r[1]=w->kind;r[2]=w->port_remix_origin;r[3]=w->player;r[4]=w->lifetime;
  r[5]=DObjGetStruct(g)->translate.vec.f.x;r[6]=DObjGetStruct(g)->translate.vec.f.y;r[7]=w->attack_coll.damage;
 }
 for(g=gGCCommonLinks[nGCCommonLinkIDItem];g&&n<32;g=g->link_next){
  ITStruct *ip=itGetStruct(g);int *r=data+2+10*n++;data[1]++;
  r[0]=1;r[1]=ip->kind;r[2]=bombchu_is(ip)?31:-1;r[3]=ip->player;r[4]=ip->lifetime;
  r[5]=DObjGetStruct(g)->translate.vec.f.x;r[6]=DObjGetStruct(g)->translate.vec.f.y;r[7]=ip->attack_coll.damage;
  r[8]=ip->is_hold?1:ip->proc_update==bombchu_move_update?2:ip->proc_update==itLinkBombExplodeProcUpdate?3:0;
 }return data;
}
#endif
