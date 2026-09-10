/* Experimental offline Marth import. Enabled only by SSB64_REMIX_MARTH=1.
 * Fox is the temporary engine slot; all geometry/poses come from the ROM.
 */
#include <ft/fighter.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/objman.h>
#include <sys/objdef.h>
#include "fighter_registry.h"
#include "marth_data.h"

extern char *getenv(const char *);
extern void port_log(const char *, ...);
extern FTData dFTFoxData;
static void *files[9];
static s32 sub_count = sizeof(marth_sub) / sizeof(marth_sub[0]);
static FTStatusDesc prototype_statuses[64];

static void marth_entry_update(GObj *gobj)
{
    FTStruct *fp=ftGetStruct(gobj);
    if (fp->status_vars.common.entry.entry_wait > 0 && --fp->status_vars.common.entry.entry_wait) return;
    fp->lr=fp->status_vars.common.entry.lr;
    DObjGetStruct(gobj)->translate.vec.f=fp->entry_pos;
    fp->coll_data.floor_line_id=fp->status_vars.common.entry.floor_line_id;
    fp->camera_mode=nFTCameraModeDefault;
    ftCommonWaitSetStatus(gobj);
}

const char *port_marth_asset_path(unsigned int id) { return marth_asset_path(id); }
int port_marth_animation_file(unsigned int id) { return marth_animation_file(id); }

void port_marth_init(void)
{
    const char *enable = getenv("SSB64_REMIX_MARTH");
    FighterDescriptor desc;
    unsigned int i;
    if (!enable || enable[0] != '1') return;
    printf("MARTH: enabling asset import\n");
    marth_bind_scripts();
    /* Remix replaces the inherited Captain entrance in code. Its unpatched
     * animation moves TopN to zero, so use a stationary entrance here. */
    marth_main[0].anim_file_id=0;
    marth_main[0].offset=0x80000000;
    /* Mutate the existing FTData instance so the original size/allocation
     * passes and the dispatch registry consistently use the same record. */
    dFTFoxData.file_main_id = marth_file_ids[0];
    dFTFoxData.file_mainmotion_id = marth_file_ids[1];
    dFTFoxData.file_submotion_id = marth_file_ids[2];
    dFTFoxData.file_model_id = marth_file_ids[3];
    dFTFoxData.file_shieldpose_id = marth_file_ids[4];
    dFTFoxData.file_special1_id = marth_file_ids[5];
    dFTFoxData.file_special2_id = marth_file_ids[6];
    dFTFoxData.file_special3_id = marth_file_ids[7];
    dFTFoxData.file_special4_id = marth_file_ids[8];
    dFTFoxData.p_file_main = &files[0];
    dFTFoxData.p_file_mainmotion = &files[1];
    dFTFoxData.p_file_submotion = &files[2];
    dFTFoxData.p_file_model = &files[3];
    dFTFoxData.p_file_shieldpose = NULL;
    dFTFoxData.p_file_special1 = &files[5];
    dFTFoxData.p_file_special2 = &files[6];
    dFTFoxData.p_file_special3 = &files[7];
    dFTFoxData.p_file_special4 = &files[8];
    dFTFoxData.o_attributes = MARTH_ATTRIBUTES_OFFSET;
    dFTFoxData.mainmotion = (FTMotionDescArray *)marth_main;
    dFTFoxData.submotion = (FTMotionDescArray *)marth_sub;
    dFTFoxData.mainmotion_array_count = sizeof(marth_main) / sizeof(marth_main[0]);
    dFTFoxData.submotion_array_count = &sub_count;
    desc = *port_fighter_descriptor(nFTKindFox);
    for(i=0;i<64;i++) {
        prototype_statuses[i].mflags.motion_id=nFTCommonMotionWait;
        prototype_statuses[i].proc_update=ftCommonWaitSetStatus;
    }
    prototype_statuses[63].mflags.motion_id=nFTCommonMotionEntryNull;
    prototype_statuses[63].proc_update=marth_entry_update;
    desc.special_descs=prototype_statuses;
    desc.special_descs_count=64;
    desc.entry_appear_status[0] = desc.entry_appear_status[1] = 220+63;
    desc.entry_make_effect = NULL;
    /* No Fox specials operating on Marth's incompatible weapon data. */
    for (i = 0; i < PORT_FIGHTER_SPECIAL_COUNT; i++)
        desc.special_handler[i] = i < 3 ? ftCommonWaitSetStatus : ftCommonFallSetStatus;
    port_fighter_register(nFTKindFox, &desc);
    port_log("MARTH: imported ROM model 3275, 222 motion descriptors, 14 normal attacks; prototype slot=1\n");
}

#ifdef __EMSCRIPTEN__
#include <emscripten/emscripten.h>
/* Small read-only probe for the local import verification harness. */
EMSCRIPTEN_KEEPALIVE int *port_marth_probe(void)
{
    static int state[32];
    GObj *gobj;
    int i=0,j;
    for(j=0;j<32;j++)state[j]=0;
    for(gobj=gGCCommonLinks[nGCCommonLinkIDFighter];gobj && i<2;gobj=gobj->link_next,i++) {
        FTStruct *fp=ftGetStruct(gobj);
        int *row=state+16*i;
        row[0]=fp->fkind;row[1]=fp->status_id;row[2]=fp->percent_damage;
        row[3]=(int)fp->joints[nFTPartsJointTopN]->translate.vec.f.x;
        row[4]=(int)fp->joints[nFTPartsJointTopN]->translate.vec.f.y;
        row[5]=(int)gobj->anim_frame;
        row[6]=fp->data->file_main_id;
        row[7]=fp->data->file_model_id;
        for(j=0;j<4;j++)row[8+j]=fp->attack_colls[j].attack_state;
        row[12]=fp->is_invisible;row[13]=fp->is_ghost;row[14]=fp->camera_mode;row[15]=fp->lr;
    }
    return state;
}
#endif
