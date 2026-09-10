from pathlib import Path
import shutil
from prepare import replace,ROOT,ENGINE,install_hooks
install_hooks()
# Hide the baked-in personal-credit footer on the start screen.
p=ENGINE/'port/title_brand.cpp'
replace(p,'\t\tstd::memcpy(p + patch.offset, patch.data, patch.length);','\t\tif (patch.offset >= 0x11AF8u && patch.offset < 0x15320u)\n\t\t\tstd::memset(p + patch.offset, 0, patch.length);\n\t\telse std::memcpy(p + patch.offset, patch.data, patch.length);')
for name in ['roster_data.h','stage_data.h','main_sizes.h','menu_data.h']:
 shutil.copyfile(ROOT/'build/remix/main/assets'/name,ENGINE/'port/stubs'/name)
shutil.copyfile(ROOT/'remix/main.c',ENGINE/'port/stubs/remix_marth.c')
for name in ['special_marth.c','special_falco.c','special_roy.c','special_doctor.c','special_ganon.c','special_younglink.c','special_lucas.c','special_darksamus.c']:
 shutil.copyfile(ROOT/'remix'/name,ENGINE/'port/stubs'/name.replace('.c','.inc.h'))
 (ENGINE/'port/stubs'/name).unlink(missing_ok=True)
p=ENGINE/'decomp/src/mn/mnplayers/mnplayersvs.c'
replace(p,'LBFileNode sMNPlayersVSStatusBuffer[256];','LBFileNode sMNPlayersVSStatusBuffer[4096];')
replace(p,'void mnPlayersVSFuncStart(void)\n{','void mnPlayersVSFuncStart(void)\n{\n#ifdef __EMSCRIPTEN__\n extern int port_remix_enabled(void); extern void port_remix_css_start(void);\n#endif')
replace(p,'\tlbRelocLoadFilesListed(dMNPlayersVSFileIDs, sMNPlayersVSFiles);','\tlbRelocLoadFilesListed(dMNPlayersVSFileIDs, sMNPlayersVSFiles);\n#ifdef __EMSCRIPTEN__\n if(port_remix_enabled()){port_remix_css_start();return;}\n#endif')
p=ENGINE/'decomp/src/ft/ftmanager.c'
replace(p,'    gFTManagerFigatreeHeapSize = heap_size;','    gFTManagerFigatreeHeapSize = heap_size;\n#ifdef __EMSCRIPTEN__\n    {extern void port_remix_fighter_reset(void);port_remix_fighter_reset();}\n#endif')
p=ENGINE/'decomp/src/mp/mpcollision.c'
if 'GRFileInfo *ground_info=' not in p.read_text():
 replace(p,'    MPGeometryData *gdata;\n\n    gMPCollisionGroundData =','    MPGeometryData *gdata;\n    GRFileInfo *ground_info=&dMPCollisionGroundFileInfos[gSCManagerBattleState->gkind];\n#ifdef __EMSCRIPTEN__\n    extern GRFileInfo *port_remix_ground_info(int);\n    GRFileInfo *custom_info=port_remix_ground_info(gSCManagerBattleState->gkind);\n    if(custom_info)ground_info=custom_info;\n#endif\n\n    gMPCollisionGroundData =')
s=p.read_text();start=s.index('void mpCollisionInitGroundData(void)');end=s.index('\n}',start)
part=s[start:end].replace('dMPCollisionGroundFileInfos[gSCManagerBattleState->gkind].file_id','ground_info->file_id').replace('dMPCollisionGroundFileInfos[gSCManagerBattleState->gkind].offset','ground_info->offset')
part=part.replace('switch (gSCManagerBattleState->gkind)','switch (custom_info ? -1 : gSCManagerBattleState->gkind)')
# Stage audio sequences use a different Remix sound bank; use the native battle track.
part=part.replace('    gMPCollisionBGMCurrent = gMPCollisionBGMDefault = gMPCollisionGroundData->bgm_id;', '    if(custom_info)gMPCollisionGroundData->bgm_id=0;\n    gMPCollisionBGMCurrent = gMPCollisionBGMDefault = gMPCollisionGroundData->bgm_id;')
s=s[:start]+part+s[end:];p.write_text(s)
print('Main roster and stage hooks ready')
p=ENGINE/'decomp/src/ft/ftparam.c'
replace(p,'void ftParamUpdateDamage(FTStruct *fp, s32 damage)\n{','void ftParamUpdateDamage(FTStruct *fp, s32 damage)\n{\n#ifdef __EMSCRIPTEN__\n extern int port_remix_counter_damage(FTStruct*,int);damage=port_remix_counter_damage(fp,damage);\n#endif')

p=ENGINE/'decomp/src/sc/sccommon/scvsbattle.c'
replace(p,'\tmpCollisionGetPlayerMapObjPosition(player, pos);','\tmpCollisionGetPlayerMapObjPosition(player, pos);\n#ifdef __EMSCRIPTEN__\n {extern int port_remix_spawn(int,Vec3f*);if(port_remix_spawn(player,pos))return;}\n#endif')
p=ENGINE/'decomp/src/mp/mpcollision.c'
replace(p,'    mpCollisionFixGroundDataLayout(gMPCollisionGroundData);','    mpCollisionFixGroundDataLayout(gMPCollisionGroundData);\n#ifdef __EMSCRIPTEN__\n    if(custom_info)gMPCollisionGroundData->bgm_id=0;\n#endif')

p=ENGINE/'decomp/src/mp/mpcollision.c'
replace(p,'    if(custom_info)ground_info=custom_info;\n#endif','    if(custom_info)ground_info=custom_info;\n#else\n    GRFileInfo *custom_info=NULL;\n#endif')

p=ENGINE/'decomp/src/mn/mnvsmode/mnvsresults.c'
replace(p,'\tlbRelocLoadFilesListed(dMNVSResultsFileIDs, sMNVSResultsFiles);','\tlbRelocLoadFilesListed(dMNVSResultsFileIDs, sMNVSResultsFiles);\n#ifdef __EMSCRIPTEN__\n {extern int port_remix_results_start(void);if(port_remix_results_start())return;}\n#endif')

p=ENGINE/'decomp/src/ft/ftmain.c'
replace(p,'void ftMainSetStatus(GObj *fighter_gobj, s32 status_id, f32 frame_begin, f32 anim_speed, u32 flags)\n{','void ftMainSetStatus(GObj *fighter_gobj, s32 status_id, f32 frame_begin, f32 anim_speed, u32 flags)\n{\n#ifdef __EMSCRIPTEN__\n extern void port_remix_before_status(GObj*,int);port_remix_before_status(fighter_gobj,status_id);\n#endif')
p=ENGINE/'decomp/src/mn/mnvsmode/mnvsresults.c'
replace(p,'LBFileNode sMNVSResultsStatusBuffer[120];','LBFileNode sMNVSResultsStatusBuffer[4096];')

p=ENGINE/'decomp/src/ft/ftmain.c'
replace(p,'void ftMainParseMotionEvent(GObj *fighter_gobj, FTStruct *fp, FTMotionScript *ms, u32 ev_kind)\n{','void ftMainParseMotionEvent(GObj *fighter_gobj, FTStruct *fp, FTMotionScript *ms, u32 ev_kind)\n{\n#ifdef __EMSCRIPTEN__\n if(ev_kind>=52){extern int port_remix_motion_event(GObj*,FTMotionScript*);if(port_remix_motion_event(fighter_gobj,ms))return;}\n#endif')

p=ENGINE/'decomp/src/ef/efmanager.c'
for move,kick in [('Kick',1),('Punch',0)]:
 signature=f'GObj* efManagerCaptainFalcon{move}MakeEffect(GObj *fighter_gobj)\n{{'
 replace(p,signature,signature+f'\n#ifdef __EMSCRIPTEN__\n {{extern int port_remix_enabled(void);extern GObj *port_remix_ganon_effect(GObj*,int);if(port_remix_enabled()&&ftGetStruct(fighter_gobj)->fkind==30)return port_remix_ganon_effect(fighter_gobj,{kick});}}\n#endif')

# Use each Young Link projectile's ROM asset with the native projectile logic.
for name,desc,slot in [('wplinkboomerang.c','dWPLinkBoomerangWeaponDesc','special1'),('wplinkspinattack.c','dWPLinkSpinAttackWeaponDesc','main')]:
 p=ENGINE/'decomp/src/wp/wplink'/name
 old=f'weapon_gobj = wpManagerMakeWeapon(fighter_gobj, &{desc}, &offset, WEAPON_FLAG_PARENT_FIGHTER);'
 new=f'''WPDesc remix_desc={desc};
#ifdef __EMSCRIPTEN__
    {{extern int port_remix_enabled(void);if(port_remix_enabled()&&fp->fkind==31)remix_desc.p_weapon=fp->data->p_file_{slot};}}
#endif
    weapon_gobj = wpManagerMakeWeapon(fighter_gobj, &remix_desc, &offset, WEAPON_FLAG_PARENT_FIGHTER);'''
 replace(p,old,new)
p=ENGINE/'decomp/src/it/itfighter/itlinkbomb.c'
replace(p,'GObj *item_gobj = itManagerMakeItem(fighter_gobj, &dItLinkBombItemDesc, pos, vel, ITEM_FLAG_PARENT_FIGHTER);','''ITDesc remix_desc=dItLinkBombItemDesc;
#ifdef __EMSCRIPTEN__
    {extern int port_remix_enabled(void);FTStruct *fp=ftGetStruct(fighter_gobj);if(port_remix_enabled()&&fp->fkind==31){remix_desc.p_file=fp->data->p_file_main;remix_desc.o_attributes=0x40;}}
#endif
    GObj *item_gobj = itManagerMakeItem(fighter_gobj, &remix_desc, pos, vel, ITEM_FLAG_PARENT_FIGHTER);''')
replace(p,'\t\tgcAddXObjForDObjFixed(dobj, 0x2E, 0);','''#ifdef __EMSCRIPTEN__
        {extern int port_remix_enabled(void);gcAddXObjForDObjFixed(dobj,(port_remix_enabled()&&ftGetStruct(fighter_gobj)->fkind==31)?0x48:0x2E,0);}
#else
        gcAddXObjForDObjFixed(dobj,0x2E,0);
#endif''')
for fn in ['itLinkBombExplodeWaitUpdateScale','itLinkBombExplodeUpdateAttackEvent']:
 sig=f'void {fn}(GObj *item_gobj)\n{{'
 replace(p,sig,sig+'''\n    ITDesc remix_desc=dItLinkBombItemDesc;
#ifdef __EMSCRIPTEN__
    {extern void **port_remix_bomb_file(GObj*,void**);remix_desc.p_file=port_remix_bomb_file(item_gobj,remix_desc.p_file);}
#endif''')
replace(p,'*dItLinkBombItemDesc.p_file + (intptr_t)llLinkMainBombBloatScales','*remix_desc.p_file + (intptr_t)llLinkMainBombBloatScales')
replace(p,'itGetAttackEvent(dItLinkBombItemDesc, llLinkMainBombAttackEvents)','itGetAttackEvent(remix_desc, llLinkMainBombAttackEvents)')
p=ENGINE/'decomp/src/it/itmain.c'
sig='void itMainSetStatus(GObj *item_gobj, ITStatusDesc *status_desc, s32 status_id)\n{'
replace(p,sig,sig+'\n#ifdef __EMSCRIPTEN__\n    {extern ITStatusDesc *port_remix_item_status(GObj*,ITStatusDesc*);status_desc=port_remix_item_status(item_gobj,status_desc);}\n#endif')

p=ENGINE/'decomp/src/wp/wptypes.h'
replace(p,'    s32 display_mode;                   // Weapon\'s display mode:', '    #ifdef __EMSCRIPTEN__\n    int port_remix_origin;\n    #endif\n    s32 display_mode;                   // Weapon\'s display mode:')
p=ENGINE/'decomp/src/wp/wpmanager.c'
sig='GObj* wpManagerMakeWeapon(GObj *parent_gobj, WPDesc *wp_desc, Vec3f *spawn_pos, u32 flags)\n{'
replace(p,sig,sig+'''\n#ifdef __EMSCRIPTEN__
    extern int port_remix_weapon_desc(GObj*,WPDesc*,u32);
    WPDesc remix_desc=*wp_desc;wp_desc=&remix_desc;
    int remix_origin=port_remix_weapon_desc(parent_gobj,wp_desc,flags);
#endif''')
replace(p,'    wp->kind = wp_desc->kind;','    wp->kind = wp_desc->kind;\n#ifdef __EMSCRIPTEN__\n    wp->port_remix_origin=remix_origin;\n#endif')
p=ENGINE/'decomp/src/it/itfighter/itnesspkfire.c'
replace(p,'    item_gobj = itManagerMakeItem(weapon_gobj, &dITNessPKFireItemDesc, pos, vel, (ITEM_FLAG_COLLPROJECT | ITEM_FLAG_PARENT_WEAPON));','''    ITDesc remix_desc=dITNessPKFireItemDesc;
#ifdef __EMSCRIPTEN__
    {extern void **port_remix_pkfire_file(GObj*,void**);remix_desc.p_file=port_remix_pkfire_file(weapon_gobj,remix_desc.p_file);}
#endif
    item_gobj = itManagerMakeItem(weapon_gobj, &remix_desc, pos, vel, (ITEM_FLAG_COLLPROJECT | ITEM_FLAG_PARENT_WEAPON));''')
p=ENGINE/'decomp/src/ef/efmanager.c'
for effect,source,wave in [('ThunderWave','ftGetStruct(fighter_gobj)->fkind',1),('ThunderTrail','ftGetStruct(fighter_gobj)->fkind',0),('ReflectTrail','wpGetStruct(weapon_gobj)->port_remix_origin',0)]:
 desc=f'dEFManagerNessPK{effect}EffectDesc'
 old=f'efManagerMakeEffectNoForce(&{desc})'
 # Expand immediately before the complete assignment without changing the original variable's scope.
 assignment=('GObj *effect_gobj = ' if wave else 'effect_gobj = ')+old+';'
 replacement=f'''EFDesc remix_desc={desc};
#ifdef __EMSCRIPTEN__
    {{extern void port_remix_ness_effect(int,EFDesc*,int);port_remix_ness_effect({source},&remix_desc,{wave});}}
#endif
    '''+('GObj *effect_gobj = ' if wave else 'effect_gobj = ')+'efManagerMakeEffectNoForce(&remix_desc);'
 replace(p,assignment,replacement)

p=ENGINE/'decomp/src/ef/efmanager.c'
replace(p,'EFDesc remix_desc=dEFManagerNessPKThunderTrailEffectDesc;\n#ifdef __EMSCRIPTEN__\n    {extern void port_remix_ness_effect(int,EFDesc*,int);port_remix_ness_effect(wpGetStruct(weapon_gobj)->port_remix_origin,','EFDesc remix_desc=dEFManagerNessPKThunderTrailEffectDesc;\n#ifdef __EMSCRIPTEN__\n    {extern void port_remix_ness_effect(int,EFDesc*,int);port_remix_ness_effect(ftGetStruct(fighter_gobj)->fkind,')

p=ENGINE/'decomp/src/wp/wpsamus/wpsamuschargeshot.c'
replace(p,'#include <reloc_data.h>','''#include <reloc_data.h>
#ifdef __EMSCRIPTEN__
extern wpSamusChargeShotAttributes *port_remix_charge_levels(GObj*,wpSamusChargeShotAttributes*);
#define REMIX_CHARGE_LEVELS(g) port_remix_charge_levels(g,dWPSamusChargeShotWeaponAttributes)
#else
#define REMIX_CHARGE_LEVELS(g) dWPSamusChargeShotWeaponAttributes
#endif''')
s=p.read_text().replace('dWPSamusChargeShotWeaponAttributes[wp->','REMIX_CHARGE_LEVELS(weapon_gobj)[wp->').replace('dWPSamusChargeShotWeaponAttributes[charge_level]','REMIX_CHARGE_LEVELS(weapon_gobj)[charge_level]');p.write_text(s)
