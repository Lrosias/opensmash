/* Included in the original results scene so its cameras, graphics, timing and
 * placements remain the source of truth. Never write the twelve-slot record book. */
#include "results_data.h"
#include <stdio.h>
#include <string.h>
#include <emscripten/emscripten.h>
static unsigned int remix_result_mask;
static int remix_result_pose,remix_result_team;
static GObj *remix_result_stats;
extern void port_remix_results_controls(void);
extern void port_remix_results_announce(int);
extern int port_remix_results_music(int);
extern void port_yougame_menu_font(void);
extern void port_yougame_menu_text(GObj*,const char*,float,float,float,int);

static void *remix_result_file(int id){return lbRelocGetExternHeapFile(id,syTaskmanMalloc(lbRelocGetFileSize(id),16));}

static void remix_results_damage(GObj *g,float x,float y,int number,int color){
    char digits[16];snprintf(digits,sizeof(digits),"%u",number<0?0u:(unsigned int)number);
    int count=strlen(digits);float scale=count>4?4.0F/count:1.0F;
    for(int i=0;i<count;i++){
        SObj *digit=mnVSResultsMakeDigit(g,digits[i]-'0',color);
        digit->pos.x=x+32-(count-i)*8*scale;digit->pos.y=y;digit->sprite.scalex=scale;
    }
}

void port_remix_results_stats(int details){
    /* R cycles the optional match stats. Native numbers and player columns. */
    if(remix_result_stats){gcEjectGObj(remix_result_stats);remix_result_stats=NULL;}
    for(GObj *g=gGCCommonLinks[22];g;g=g->link_next)g->flags=details?GOBJ_FLAG_HIDDEN:0;
    if(!details)return;
    port_yougame_menu_font();
    remix_result_stats=gcMakeGObjSPAfter(0,NULL,22,GOBJ_PRIORITY_DEFAULT);
    gcAddGObjDisplay(remix_result_stats,lbCommonDrawSObjAttr,31,GOBJ_PRIORITY_DEFAULT,~0);
    port_yougame_menu_text(remix_result_stats,"DAMAGE",32,30,.6F,0xffffff);
    port_yougame_menu_text(remix_result_stats,"GIVEN",26,81,.5F,0xffffff);
    port_yougame_menu_text(remix_result_stats,"TAKEN",26,105,.5F,0xffffff);
    for(int i=0;i<4;i++)if(sMNVSResultsIsPresent[i]){
        char label[8];snprintf(label,sizeof(label),"%dP",i+1);
        port_yougame_menu_text(remix_result_stats,label,mnVSResultsGetColumnX(i)-5,49,.55F,0xffffff);
        remix_results_damage(remix_result_stats,mnVSResultsGetColumnX(i),81,gSCManagerTransferBattleState.players[i].total_damage_given,mnVSResultsGetNumberColorID(i));
        remix_results_damage(remix_result_stats,mnVSResultsGetColumnX(i),105,gSCManagerTransferBattleState.players[i].total_damage_all,mnVSResultsGetNumberColorID(i));
    }
}

static float remix_results_zoom(int id){const RemixResultArt *a=remix_results_art(id);return a?a->zoom:port_fighter_scale(id);}

static int remix_results_shared(void){return remix_result_team<0 && (remix_result_mask&(remix_result_mask-1));}

static int remix_results_draw(void){return remix_results_shared()||(!remix_result_mask&&!gSCManagerSceneData.is_reset);}

static void remix_results_name(void){
    if(!remix_result_mask){mnVSResultsMakeString(gSCManagerSceneData.is_reset?"NO CONTEST":"DRAW",30,180,4,1);return;}
    if(remix_result_team>=0){mnVSResultMakeTeamName();return;}
    if((remix_result_mask&(remix_result_mask-1))!=0){mnVSResultsMakeString("DRAW",95,180,4,1);return;}
    int id=mnVSResultGetWinFighterKind();const RemixResultArt *a=remix_results_art(id);
    if(!a)return;
    mnVSResultsMakeString(a->name,a->x,180,0,a->scale);
    mnVSResultsMakeString(id==68?"W1I1N1!":"W1I1N1S1!",a->wins_x,180,3,1);
}

static void remix_results_emblem(void){
    if(!remix_result_mask||remix_results_shared())return;
    const RemixResultArt *a=remix_results_art(mnVSResultGetWinFighterKind());if(!a)return;
    int color=mnVSResultsGetWinPlayer();if(remix_result_team>=0){const int colors[]={0,1,3};color=colors[remix_result_team];}
    GObj *g=gcMakeGObjSPAfter(0,NULL,23,GOBJ_PRIORITY_DEFAULT);
    gcSetupCommonDObjs(g,lbRelocGetFileData(DObjDesc*,sMNVSResultsFiles[4],a->dobj),NULL);
    gcAddGObjDisplay(g,gcDrawDObjTreeForGObj,33,GOBJ_PRIORITY_DEFAULT,~0);
    gcAddMObjAll(g,lbRelocGetFileData(MObjSub***,sMNVSResultsFiles[4],a->mobj));
    gcAddMatAnimJointAll(g,lbRelocGetFileData(AObjEvent32***,sMNVSResultsFiles[4],a->anim),color);
    gcPlayAnimAll(g);gcAddGObjProcess(g,mnVSResultsEmblemProcUpdate,nGCProcessKindFunc,1);
    DObjGetStruct(g)->translate.vec.f=(Vec3f){0,100,-11000};
    DObjGetStruct(g)->scale.vec.f.x=DObjGetStruct(g)->scale.vec.f.y=25;
}

void port_remix_native_results(unsigned int mask,int *places,int team,int pose){
    remix_result_mask=mask;remix_result_pose=pose;remix_result_team=team;remix_result_stats=NULL;
    syAudioStopBGMAll();
    gcMakeGObjSPAfter(0,mnVSResultsFuncRun,0,GOBJ_PRIORITY_DEFAULT);
    gcMakeDefaultCameraGObj(0,GOBJ_PRIORITY_DEFAULT,100,COBJ_FLAG_FILLCOLOR|COBJ_FLAG_ZBUFFER,GPACK_RGBA8888(0,0,0,255));
    efParticleInitAll();efManagerInitEffects();ftManagerAllocFighter(FTDATA_FLAG_SUBMOTION,4);
    for(int i=0;i<4;i++)if(gSCManagerTransferBattleState.players[i].pkind!=nFTPlayerKindNot)ftManagerSetupFilesAllKind(gSCManagerTransferBattleState.players[i].fkind);
    for(int i=0;i<4;i++)sMNVSResultsFigatreeHeaps[i]=syTaskmanMalloc(gFTManagerFigatreeHeapSize,16);
    sMNVSResultsFiles[4]=remix_result_file(0x4023);
    sMNVSResultsFiles[6]=remix_result_file(0x4025);
    mnVSResultsInitVars();mnVSResultsSetIsPresent();mnVSResultsInitRankings();
    if(!mask)sMNVSResultsKind=nMNVSResultsKindNoContest;
    for(int i=0;i<4;i++)if(sMNVSResultsIsPresent[i]){
        int p=places[i]>=0?places[i]:gSCManagerTransferBattleState.players[i].place;
        sMNVSResultsPlaces[i]=!mask?0:(mask&(1u<<i))?0:p>0&&p<4?p:1;
    }
    if(mask){
        lbTransitionSetupTransition();lbTransitionMakeCamera(0x20000002,0,10,COBJ_MASK_DLLINK(32));
        lbTransitionMakeTransition(syUtilsRandIntRange(ARRAY_COUNT(dLBTransitionDescs)),0x20000000,0,lbTransitionProcDisplay,32,lbTransitionProcUpdate);
    }
    mnVSResultsMakeEmblemCamera();mnVSResultsMakeFighterCamera();mnVSResultsMakePlayerTagCamera();mnVSResultsMakeResultsTextCamera();mnVSResultsMakeTintCamera();mnVSResultsMakeHeaderCamera();mnVSResultsMakeWallpaperTintCamera();mnVSResultsMakeWallpaperTint2Camera();
    remix_results_emblem();mnVSResultsMakeWallpaperTint();func_ovl31_8013797C();
    scSubsysFighterSetLightParams(10,10,255,255,255,sMNVSResultsCharacterAlpha);
    if(mask)func_800269C0_275C0(nSYAudioVoicePublicWin);
}
