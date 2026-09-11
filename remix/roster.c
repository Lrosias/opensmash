/* Offline roster import. Each local match loads the selected ROM fighter
 * into the prototype Fox slot; the original Marth opt-in remains supported. */
#include <ft/fighter.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/objman.h>
#include <sys/objdef.h>
#include "fighter_registry.h"
#include "roster_data.h"

extern char *getenv(const char *);
extern long strtol(const char *,char **,int);
extern void port_log(const char *, ...);
extern FTData dFTFoxData;
static void *files[9];
static FTStatusDesc prototype_statuses[64];

static void remix_entry_update(GObj *gobj)
{
    FTStruct *fp=ftGetStruct(gobj);
    if(fp->status_vars.common.entry.entry_wait>0 && --fp->status_vars.common.entry.entry_wait)return;
    fp->lr=fp->status_vars.common.entry.lr;
    DObjGetStruct(gobj)->translate.vec.f=fp->entry_pos;
    fp->coll_data.floor_line_id=fp->status_vars.common.entry.floor_line_id;
    fp->camera_mode=nFTCameraModeDefault;
    ftCommonWaitSetStatus(gobj);
}
const char *port_marth_asset_path(unsigned int id){return remix_asset_path(id);}
int port_marth_animation_file(unsigned int id){return remix_animation_file(id);}
void port_marth_init(void)
{
    const char *select=getenv("SSB64_REMIX_FIGHTER");
    const char *legacy=getenv("SSB64_REMIX_MARTH");
    RemixFighter *f=NULL;
    FighterDescriptor desc;
    int id,i;
    if(select){char *end;long n=strtol(select,&end,10);if(!*select||*end||n<0||n>96)return;id=(int)n;}
    else if(legacy&&legacy[0]=='1')id=58;
    else return;
    for(i=0;i<sizeof(remix_fighters)/sizeof(remix_fighters[0]);i++)if(remix_fighters[i].id==id){f=&remix_fighters[i];break;}
    if(!f)return;
    f->bind();
    f->main[0].anim_file_id=0;f->main[0].offset=0x80000000;
    dFTFoxData.file_main_id=f->files[0];dFTFoxData.file_mainmotion_id=f->files[1];
    dFTFoxData.file_submotion_id=f->files[2];dFTFoxData.file_model_id=f->files[3];
    dFTFoxData.file_shieldpose_id=f->files[4];dFTFoxData.file_special1_id=f->files[5];
    dFTFoxData.file_special2_id=f->files[6];dFTFoxData.file_special3_id=f->files[7];dFTFoxData.file_special4_id=f->files[8];
    dFTFoxData.p_file_main=&files[0];dFTFoxData.p_file_mainmotion=&files[1];dFTFoxData.p_file_submotion=&files[2];
    dFTFoxData.p_file_model=&files[3];dFTFoxData.p_file_shieldpose=NULL;
    dFTFoxData.p_file_special1=&files[5];dFTFoxData.p_file_special2=&files[6];
    dFTFoxData.p_file_special3=&files[7];dFTFoxData.p_file_special4=&files[8];
    dFTFoxData.o_attributes=f->attributes;dFTFoxData.mainmotion=(FTMotionDescArray*)f->main;
    dFTFoxData.submotion=(FTMotionDescArray*)f->sub;dFTFoxData.mainmotion_array_count=f->main_count;
    dFTFoxData.submotion_array_count=&f->sub_count;
    desc=*port_fighter_descriptor(nFTKindFox);
    for(i=0;i<64;i++){prototype_statuses[i].mflags.motion_id=nFTCommonMotionWait;prototype_statuses[i].proc_update=ftCommonWaitSetStatus;}
    prototype_statuses[63].mflags.motion_id=nFTCommonMotionEntryNull;prototype_statuses[63].proc_update=remix_entry_update;
    desc.special_descs=prototype_statuses;desc.special_descs_count=64;
    desc.entry_appear_status[0]=desc.entry_appear_status[1]=283;desc.entry_make_effect=NULL;
    for(i=0;i<PORT_FIGHTER_SPECIAL_COUNT;i++)desc.special_handler[i]=i<3?ftCommonWaitSetStatus:ftCommonFallSetStatus;
    port_fighter_register(nFTKindFox,&desc);
    port_log("REMIX: imported %s (ROM fighter %d, model %u, %d motion descriptors); prototype slot=1\n",f->name,f->id,f->files[3]-0x4000,f->main_count);
}
#ifdef __EMSCRIPTEN__
#include <emscripten/emscripten.h>
/* Opt-in fixture for deterministic browser combat checks. It changes only
 * starting positions/velocities; attacks and damage still run in the engine. */
EMSCRIPTEN_KEEPALIVE int port_remix_test_place(int gap)
{
    GObj *gobj;FTStruct *opponent=NULL;int count=0;
    const char *test=getenv("SSB64_REMIX_TEST");
    if(!test||test[0]!='1'||test[1]||gap<100||gap>800)return 0;
    for(gobj=gGCCommonLinks[nGCCommonLinkIDFighter];gobj;gobj=gobj->link_next){
        FTStruct *fp=ftGetStruct(gobj);count++;if(fp->fkind==nFTKindKirby)opponent=fp;
    }
    if(count!=2||!opponent)return 0;
    s32 floor=opponent->coll_data.floor_line_id;
    for(gobj=gGCCommonLinks[nGCCommonLinkIDFighter];gobj;gobj=gobj->link_next){
        FTStruct *fp=ftGetStruct(gobj);int me=fp->fkind==nFTKindFox;
        fp->lr=me?1:-1;
        fp->joints[nFTPartsJointTopN]->translate.vec.f=(Vec3f){me?-gap/2.0f:gap/2.0f,0,0};
        memset(&fp->physics,0,sizeof(fp->physics));fp->hitlag_tics=0;
        fp->coll_data.floor_line_id=floor;fp->camera_mode=nFTCameraModeDefault;
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
#endif
