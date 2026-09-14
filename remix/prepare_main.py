from pathlib import Path
import shutil
from prepare import replace,ROOT,ENGINE,install_hooks
install_hooks()
for name in ['roster_data.h','stage_data.h','main_sizes.h','menu_data.h','normal_data.h','kirby_data.h','trail_data.h','presentation_data.h']:
 shutil.copyfile(ROOT/'build/remix/main/assets'/name,ENGINE/'port/stubs'/name)
shutil.copyfile(ROOT/'remix/main.c',ENGINE/'port/stubs/remix_marth.c')
for name in ['special_marth.c','special_falco.c','special_roy.c','special_doctor.c','special_ganon.c','special_younglink.c','special_lucas.c','special_darksamus.c','special_wolf.c','special_wario.c','special_bowser.c','special_peach.c','special_conker.c','special_mewtwo.c','special_sonic.c','special_sheik.c','special_marina.c','special_clanpot.c','special_crash.c','special_goemon.c','special_dedede.c','special_minions.c','special_banjo.c','normal_moves.c','marina_cargo.c','kirby_copy.c','special_trails.c']:
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
replace(p,'void ftMainSetStatus(GObj *fighter_gobj, s32 status_id, f32 frame_begin, f32 anim_speed, u32 flags)\n{','void ftMainSetStatus(GObj *fighter_gobj, s32 status_id, f32 frame_begin, f32 anim_speed, u32 flags)\n{\n#ifdef __EMSCRIPTEN__\n extern int port_remix_kirby_action(GObj*,int);extern void port_remix_before_status(GObj*,int);status_id=port_remix_kirby_action(fighter_gobj,status_id);port_remix_before_status(fighter_gobj,status_id);\n#endif')
p=ENGINE/'decomp/src/mn/mnvsmode/mnvsresults.c'
replace(p,'LBFileNode sMNVSResultsStatusBuffer[120];','LBFileNode sMNVSResultsStatusBuffer[4096];')

p=ENGINE/'decomp/src/ft/ftmain.c'
replace(p,'void ftMainParseMotionEvent(GObj *fighter_gobj, FTStruct *fp, FTMotionScript *ms, u32 ev_kind)\n{','void ftMainParseMotionEvent(GObj *fighter_gobj, FTStruct *fp, FTMotionScript *ms, u32 ev_kind)\n{\n#ifdef __EMSCRIPTEN__\n if(ev_kind>=52){extern int port_remix_motion_event(GObj*,FTMotionScript*);if(port_remix_motion_event(fighter_gobj,ms))return;}\n#endif')

p=ENGINE/'decomp/src/ef/efmanager.c'
for move,kick in [('Kick',1),('Punch',0)]:
 signature=f'GObj* efManagerCaptainFalcon{move}MakeEffect(GObj *fighter_gobj)\n{{'
 replace(p,signature,signature+f'\n#ifdef __EMSCRIPTEN__\n {{extern int port_remix_enabled(void);extern GObj *port_remix_ganon_effect(GObj*,int);if(port_remix_enabled()&&(ftGetStruct(fighter_gobj)->fkind==30||(!{kick}&&ftGetStruct(fighter_gobj)->fkind==8&&ftGetStruct(fighter_gobj)->passive_vars.kirby.copy_id==30)))return port_remix_ganon_effect(fighter_gobj,{kick});}}\n#endif')

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
replace(p,'    s32 display_mode;                   // Weapon\'s display mode:', '    #ifdef __EMSCRIPTEN__\n    int port_remix_origin;\n    float remix_speed_scale;\n    #endif\n    s32 display_mode;                   // Weapon\'s display mode:')
p=ENGINE/'decomp/src/wp/wpmanager.c'
sig='GObj* wpManagerMakeWeapon(GObj *parent_gobj, WPDesc *wp_desc, Vec3f *spawn_pos, u32 flags)\n{'
replace(p,sig,sig+'''\n#ifdef __EMSCRIPTEN__
    extern int port_remix_weapon_desc(GObj*,WPDesc*,u32);
    WPDesc remix_desc=*wp_desc;wp_desc=&remix_desc;
    int remix_origin=port_remix_weapon_desc(parent_gobj,wp_desc,flags);
#endif''')
replace(p,'    wp->kind = wp_desc->kind;','    wp->kind = wp_desc->kind;\n#ifdef __EMSCRIPTEN__\n    wp->port_remix_origin=remix_origin;\n    wp->remix_speed_scale=1;\n#endif')
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

p=ENGINE/'decomp/src/ef/efmanager.c'
replace(p,'GObj *effect_gobj = efManagerMakeEffectForce(&dEFManagerFoxReflectorEffectDesc);','''EFDesc remix_desc=dEFManagerFoxReflectorEffectDesc;
#ifdef __EMSCRIPTEN__
    {extern void port_remix_fox_effect(GObj*,EFDesc*);port_remix_fox_effect(fighter_gobj,&remix_desc);}
#endif
    GObj *effect_gobj = efManagerMakeEffectForce(&remix_desc);''')
replace(p,'    gcAddAnimJointAll(effect_gobj, lbRelocGetFileData(AObjEvent32**, gFTDataFoxSpecial2, dEFManagerFoxReflectorAnimJointOffsets[anim_id]), 0.0F);','''    void *anim=lbRelocGetFileData(AObjEvent32**,gFTDataFoxSpecial2,dEFManagerFoxReflectorAnimJointOffsets[anim_id]);
#ifdef __EMSCRIPTEN__
    {extern void *port_remix_fox_reflector_anim(GObj*,int,void*);anim=port_remix_fox_reflector_anim(effect_gobj,anim_id,anim);}
#endif
    gcAddAnimJointAll(effect_gobj,anim,0.0F);''')

p=ENGINE/'decomp/src/ft/ftmain.c'
sig='void ftMainSetHitInteractStats(FTStruct *fp, u32 attack_group_id, GObj *victim_gobj, s32 attack_type, u32 victim_group_id, sb32 ignore_damage_or_hit)\n{'
replace(p,sig,sig+'\n#ifdef __EMSCRIPTEN__\n    {extern void port_remix_hit_contact(FTStruct*,int);port_remix_hit_contact(fp,attack_type); }\n#endif')

p=ENGINE/'decomp/src/ft/ftmain.c'
sig='void ftMainProcPhysicsMap(GObj *fighter_gobj)\n{'
replace(p,sig,sig+'\n#ifdef __EMSCRIPTEN__\n    {extern void port_remix_fighter_tick(GObj*);port_remix_fighter_tick(fighter_gobj); }\n#endif')

for name,sig,body in [
 ('ft/ftcommon/ftcommonjumpaerial.c','sb32 ftCommonJumpAerialCheckInterruptCommon(GObj *fighter_gobj)','extern int port_remix_peach_float_check(GObj*);if(port_remix_peach_float_check(fighter_gobj))return TRUE;'),
 ('ft/ftcommon/ftcommonfall.c','void ftCommonFallSetStatus(GObj *fighter_gobj)','extern int port_remix_peach_float_fall(GObj*);if(port_remix_peach_float_fall(fighter_gobj))return;'),
 ('ft/ftphysics.c','void ftPhysicsApplyGravityClampTVel(FTStruct *fp, f32 gravity, f32 tvel)','extern int port_remix_peach_gravity(FTStruct*);if(port_remix_peach_gravity(fp))return;'),
 ('ft/ftcommon/ftcommonitemthrow.c','sb32 ftCommonLightThrowCheckItemTypeThrow(FTStruct *fp)','extern int port_remix_peach_floating(FTStruct*);if(port_remix_peach_floating(fp))return FALSE;')]:
 p=ENGINE/'decomp/src'/name;sig+='\n{';replace(p,sig,sig+'\n#ifdef __EMSCRIPTEN__\n    '+body+'\n#endif')

p=ENGINE/'decomp/src/ft/ftmanager.c'
replace(p,'void ftManagerSetupFilesKind(s32 fkind)\n{','void ftManagerSetupFilesKind(s32 fkind)\n{\n#ifdef __EMSCRIPTEN__\n {extern void port_remix_load_files(int);port_remix_load_files(fkind);}\n#endif')

p=ENGINE/'decomp/src/ft/ftchar/ftsamus/ftsamusspecialn.c'
replace(p,'void ftSamusSpecialNGetChargeShotPosition(FTStruct *fp, Vec3f *pos)\n{','void ftSamusSpecialNGetChargeShotPosition(FTStruct *fp, Vec3f *pos)\n{\n#ifdef __EMSCRIPTEN__\n extern int port_remix_mewtwo_ball_position(FTStruct*,Vec3f*);if(port_remix_mewtwo_ball_position(fp,pos))return;\n#endif')
p=ENGINE/'decomp/src/wp/wpsamus/wpsamuschargeshot.c'
replace(p,'    wp->proc_dead = wpSamusChargeShotProcDead;','    wp->proc_dead = wpSamusChargeShotProcDead;\n#ifdef __EMSCRIPTEN__\n {extern void port_remix_mewtwo_ball_init(GObj*);port_remix_mewtwo_ball_init(weapon_gobj);}\n#endif')

p=ENGINE/'decomp/src/ft/ftcommon/ftcommondamage.c'
replace(p,'    if (fp->damage_element == nGMHitElementSleep)\n    {\n        ftCommonFuraSleepSetStatus(fighter_gobj);','    #ifdef __EMSCRIPTEN__\n    {extern int port_remix_disable_damage(GObj*);if(port_remix_disable_damage(fighter_gobj))return;}\n    #endif\n    if (fp->damage_element == nGMHitElementSleep)\n    {\n        ftCommonFuraSleepSetStatus(fighter_gobj);')
p=ENGINE/'decomp/src/ft/ftcommon/ftcommonfurafura.c'
replace(p,'    ftMainSetStatus(fighter_gobj, nFTCommonStatusFuraFura, 0.0F, 1.0F, (FTSTATUS_PRESERVE_TEXTUREPART | FTSTATUS_PRESERVE_MODELPART));','    u32 flags=FTSTATUS_PRESERVE_TEXTUREPART | FTSTATUS_PRESERVE_MODELPART;\n    #ifdef __EMSCRIPTEN__\n    {extern int port_remix_enabled(void);if(port_remix_enabled())flags=0;}\n    #endif\n    ftMainSetStatus(fighter_gobj, nFTCommonStatusFuraFura, 0.0F, 1.0F, flags);')

p=ENGINE/'decomp/src/ft/ftcommon/ftcommonspecialair.c'
replace(p,'sb32 ftCommonSpecialAirCheckInterruptCommon(GObj *fighter_gobj)\n{','sb32 ftCommonSpecialAirCheckInterruptCommon(GObj *fighter_gobj)\n{\n#ifdef __EMSCRIPTEN__\n extern int port_remix_sonic_special_block(GObj*);if(port_remix_sonic_special_block(fighter_gobj))return FALSE;\n#endif')

p=ENGINE/'decomp/src/ft/ftcommon/ftcommoncaptureyoshi.c'
replace(p,'    ftMainSetStatus(fighter_gobj, nFTCommonStatusCaptureYoshi, 0.0F, 1.0F, FTSTATUS_PRESERVE_NONE);','    int capture_status=nFTCommonStatusCaptureYoshi;\n#ifdef __EMSCRIPTEN__\n    {extern int port_remix_enabled(void);if(port_remix_enabled()&&(capture_fp->fkind==63||capture_fp->fkind==65))capture_status=nFTCommonStatusThrownCommon;}\n#endif\n    ftMainSetStatus(fighter_gobj, capture_status, 0.0F, 1.0F, FTSTATUS_PRESERVE_NONE);')

p=ENGINE/'decomp/src/wp/wpprocess.c'
replace(p,'        wp->owner_gobj = wp->reflect_gobj;','        #ifdef __EMSCRIPTEN__\n        {extern int port_remix_marina_absorb_weapon(GObj*);extern int port_remix_dedede_absorb_weapon(GObj*);if(port_remix_marina_absorb_weapon(weapon_gobj)||port_remix_dedede_absorb_weapon(weapon_gobj)){wpMainDestroyWeapon(weapon_gobj);return;}}\n        #endif\n        wp->owner_gobj = wp->reflect_gobj;')
p=ENGINE/'decomp/src/it/itprocess.c'
replace(p,'        ip->owner_gobj = ip->reflect_gobj;','        #ifdef __EMSCRIPTEN__\n        {extern int port_remix_marina_absorb_item(GObj*);extern int port_remix_dedede_absorb_item(GObj*);if(port_remix_marina_absorb_item(item_gobj)||port_remix_dedede_absorb_item(item_gobj)){itMainDestroyItem(item_gobj);return;}}\n        #endif\n        ip->owner_gobj = ip->reflect_gobj;')
# Dedede uses Kirby's capture machinery with its own status IDs.
p=ENGINE/'decomp/src/ft/ftcommon/ftcommoncapturekirby.c'
replace(p,'#include <ft/fighter.h>','#include <ft/fighter.h>\n#ifdef __EMSCRIPTEN__\nextern int port_remix_dedede_capture_wait(FTStruct*);\nextern int port_remix_dedede_capture_air(GObj*);\nextern int port_remix_star_damage(int,int);\n#endif')
replace(p,'    if ((capture_fp->status_id == nFTKirbyStatusSpecialAirNWait) || (capture_fp->status_id == nFTKirbyStatusSpecialNWait))','    if (\n#ifdef __EMSCRIPTEN__\n        port_remix_dedede_capture_wait(capture_fp) ||\n#endif\n        (capture_fp->status_id == nFTKirbyStatusSpecialAirNWait) || (capture_fp->status_id == nFTKirbyStatusSpecialNWait))')
s=p.read_text();old='                ftKirbySpecialNWaitSwitchStatusAir(capture_fp->fighter_gobj);';new='                #ifdef __EMSCRIPTEN__\n                if(!port_remix_dedede_capture_air(capture_fp->fighter_gobj))\n                #endif\n'+old
if new not in s:s=s.replace(old,new)
s=s if 'port_remix_star_damage(fp->fkind,' in s else s.replace('attack_coll->damage = copy[fp->fkind].star_damage;', 'attack_coll->damage =\n#ifdef __EMSCRIPTEN__\n                port_remix_star_damage(fp->fkind,copy[fp->fkind<29?fp->fkind:0].star_damage);\n#else\n                copy[fp->fkind].star_damage;\n#endif');p.write_text(s)
p=ENGINE/'decomp/src/ef/efmanager.c'
replace(p,'#include <ef/effect.h>','#include <ef/effect.h>\n#ifdef __EMSCRIPTEN__\nextern int port_remix_star_parent(int);\n#endif')
s=p.read_text();s=s.replace('copy[fp->fkind].effect_scale','copy[port_remix_star_parent(fp->fkind)].effect_scale').replace('copy[ftGetStruct(fighter_gobj)->fkind].effect_scale','copy[port_remix_star_parent(ftGetStruct(fighter_gobj)->fkind)].effect_scale');p.write_text(s)
# PCM bank supports overlapping character voices and per-player looping effects.
shutil.copyfile(ROOT/'remix/special_audio.c',ENGINE/'port/audio/remix_sounds.inc.h')
p=ENGINE/'port/audio/voice_inject.c'
replace(p,'#define OUTPUT_RATE 32000','#include "remix_sounds.inc.h"\n\n#define OUTPUT_RATE 32000')
replace(p,'    return sCursor >= 0 && sActive != NULL && sActive->pcm != NULL;','    return remix_sound_playing() || (sCursor >= 0 && sActive != NULL && sActive->pcm != NULL);')
replace(p,'void portVoiceInjectMix(short *stereo, int sampleCount)\n{','void portVoiceInjectMix(short *stereo, int sampleCount)\n{\n    remix_sound_mix(stereo,sampleCount);')
p=ENGINE/'decomp/src/libultra/n_audio/n_env.c'
replace(p,'ALWhatever8009EDD0_siz34* func_800269C0_275C0(u16 id)\n{','ALWhatever8009EDD0_siz34* func_800269C0_275C0(u16 id)\n{\n#ifdef __EMSCRIPTEN__\n  extern int portRemixSoundPlay(unsigned,int,int);if(portRemixSoundPlay(id,-1,0))return NULL;\n#endif')
p=ENGINE/'decomp/src/ft/ftparam.c'
replace(p,'void ftParamPlayVoice(FTStruct *fp, u16 voice_id)\n{','void ftParamPlayVoice(FTStruct *fp, u16 voice_id)\n{\n#ifdef __EMSCRIPTEN__\n    extern int portRemixSoundPlay(unsigned,int,int);if(portRemixSoundPlay(voice_id,4+fp->player,0)){fp->p_voice=NULL;fp->voice_id=0;return;}\n#endif')
replace(p,'void ftParamStopVoice(FTStruct *fp)\n{','void ftParamStopVoice(FTStruct *fp)\n{\n#ifdef __EMSCRIPTEN__\n    extern void portRemixSoundStop(int);portRemixSoundStop(4+fp->player);\n#endif')
replace(p,'void ftParamPlayLoopSFX(FTStruct *fp, u16 sfx_id)\n{','void ftParamPlayLoopSFX(FTStruct *fp, u16 sfx_id)\n{\n#ifdef __EMSCRIPTEN__\n    extern int portRemixSoundPlay(unsigned,int,int);if(portRemixSoundPlay(sfx_id,fp->player,1))return;\n#endif')
replace(p,'void ftParamStopLoopSFX(FTStruct *fp)\n{','void ftParamStopLoopSFX(FTStruct *fp)\n{\n#ifdef __EMSCRIPTEN__\n    extern void portRemixSoundStop(int);portRemixSoundStop(fp->player);\n#endif')

# Expanded roster uses its ROM jab IDs and Ness-style aerial jump physics.
p=ENGINE/'decomp/src/ft/ftcommon/ftcommonattack1.c'
replace(p,'static s32 ftCommonAttack1ResolveParentKind(s32 fkind)\n{','static s32 ftCommonAttack1ResolveParentKind(s32 fkind)\n{\n#ifdef __EMSCRIPTEN__\n    extern int port_remix_enabled(void),port_remix_jab_kind(int,int);if(port_remix_enabled()&&fkind>=29)return port_remix_jab_kind(fkind,0);\n#endif')
replace(p,'void ftCommonAttack12SetStatus(GObj *fighter_gobj)\n{','void ftCommonAttack12SetStatus(GObj *fighter_gobj)\n{\n#ifdef __EMSCRIPTEN__\n    extern int port_remix_enabled(void);if(port_remix_enabled()&&ftGetStruct(fighter_gobj)->fkind==57){ftCommonAttack100StartSetStatus(fighter_gobj);return;}\n#endif')
s=p.read_text();s=s.replace('switch (fp->fkind)','switch (FT_A1_KIND(fp))');p.write_text(s)
needle='void ftCommonAttack13SetStatus(GObj *fighter_gobj)'
s=p.read_text();at=s.index(needle);before=s[:at];part=s[at:];anchor='        switch (FT_A1_KIND(fp))';insert='#ifdef __EMSCRIPTEN__\n        extern int port_remix_jab_status(int);status_id=port_remix_jab_status(fp->fkind);\n        if(status_id<0)\n#endif\n'
if insert not in part:part=part.replace(anchor,insert+anchor,1)
p.write_text(before+part)
p=ENGINE/'decomp/src/ft/ftcommon/ftcommonattack100.c'
replace(p,'static s32 ftCommonAttack100ResolveParentKind(s32 fkind)\n{','static s32 ftCommonAttack100ResolveParentKind(s32 fkind)\n{\n#ifdef __EMSCRIPTEN__\n    extern int port_remix_enabled(void),port_remix_jab_kind(int,int);if(port_remix_enabled()&&fkind>=29)return port_remix_jab_kind(fkind,1);\n#endif')
s=p.read_text()
for phase in range(3):
 a='status_id = FighterRapidJabStatusQueryEvent_.status_id;'
 # Distinct queries already identify their phase; patch their following assignment.
 start=s.index(f'/* phase */ {phase}')
 end=s.index(a,start)+len(a)
 text=f'\n#ifdef __EMSCRIPTEN__\n            extern int port_remix_rapid_status(int,int);int custom=port_remix_rapid_status(fp->fkind,{phase});if(custom>=0)status_id=custom;\n#endif'
 if text not in s:s=s[:end]+text+s[end:]
p.write_text(s)
p=ENGINE/'decomp/src/ft/ftcommon/ftcommonjumpaerial.c'
replace(p,'#include <ft/fighter.h>','#include <ft/fighter.h>\n#ifdef __EMSCRIPTEN__\nextern int port_remix_ness_jump(int),port_remix_dedede_jump_check(GObj*);\n#define REMIX_NESS_JUMP(fp) port_remix_ness_jump((fp)->fkind)\n#else\n#define REMIX_NESS_JUMP(fp) ((fp)->fkind==nFTKindNess||(fp)->fkind==nFTKindNNess)\n#endif')
s=p.read_text().replace('(fp->fkind == nFTKindNess) || (fp->fkind == nFTKindNNess)','REMIX_NESS_JUMP(fp)');p.write_text(s)
replace(p,'extern int port_remix_peach_float_check(GObj*);if(port_remix_peach_float_check(fighter_gobj))return TRUE;','extern int port_remix_peach_float_check(GObj*);if(port_remix_peach_float_check(fighter_gobj)||port_remix_dedede_jump_check(fighter_gobj))return TRUE;')
# Imported victims have no entry in the native Kirby copy table. Retain inhale
# and spit safely until the expanded Kirby copy moves/hat files are ported.
p=ENGINE/'decomp/src/ft/ftchar/ftkirby/ftkirbyspecialn.c'
replace(p,'else kirby_fp->status_vars.kirby.specialn.copy_id = copy[victim_fp->fkind].copy_id;','else kirby_fp->status_vars.kirby.specialn.copy_id = victim_fp->fkind<27 ? copy[victim_fp->fkind].copy_id : port_remix_kirby_copy_id(victim_fp->fkind);')

p=ENGINE/'decomp/src/ft/ftcommon/ftcommoncapturecaptain.c'
replace(p,'#include <reloc_data.h>','#include <reloc_data.h>\n#ifdef __EMSCRIPTEN__\nextern int port_remix_star_parent(int);\n#define REMIX_CAPTURE_INDEX(fp) port_remix_star_parent((fp)->fkind)\n#else\n#define REMIX_CAPTURE_INDEX(fp) ((fp)->fkind)\n#endif')
s=p.read_text().replace('offset_add[capture_fp->fkind]','offset_add[REMIX_CAPTURE_INDEX(capture_fp)]');p.write_text(s)

# Marina's cargo uses DK's native state IDs with her own ROM animations.
import re
for rel in ['ft/ftcommon/ftcommonthrow.c','ft/ftcommon/ftcommonthrown1.c','ft/ftcommon/ftcommondamage.c','ft/ftparam.c','ft/ftcommon/ftcommonitemget.c','ft/ftcommon/ftcommonitemthrow.c','ft/ftcommon/ftcommonheavythrow.c']:
 p=ENGINE/'decomp/src'/rel
 if not p.exists():continue
 if 'extern int port_remix_cargo_kind(int);' not in p.read_text():replace(p,'#include <ft/fighter.h>','#include <ft/fighter.h>\n#ifdef __EMSCRIPTEN__\nextern int port_remix_cargo_kind(int);\n#define REMIX_CARGO_KIND(id) port_remix_cargo_kind(id)\n#else\n#define REMIX_CARGO_KIND(id) ((id)==nFTKindDonkey)\n#endif')
 s=p.read_text();s=re.sub(r'(\w*fp)->fkind == nFTKindDonkey',r'REMIX_CARGO_KIND(\1->fkind)',s);s=re.sub(r'(\w*fp)->fkind != nFTKindDonkey',r'!REMIX_CARGO_KIND(\1->fkind)',s);p.write_text(s)
p=ENGINE/'decomp/src/ft/ftcommon/ftcommoncapture.c'
replace(p,'    damage = ftParamGetStaledDamage(capture_fp->player, 8, capture_fp->motion_attack_id, capture_fp->motion_count);','    int cargo_damage=8;\n#ifdef __EMSCRIPTEN__\n    extern int port_remix_cargo_damage(FTStruct*);cargo_damage=port_remix_cargo_damage(capture_fp);\n#endif\n    damage = ftParamGetStaledDamage(capture_fp->player, cargo_damage, capture_fp->motion_attack_id, capture_fp->motion_count);')
p=ENGINE/'decomp/src/ft/ftchar/ftdonkey/ftdonkeythrowff.c'
replace(p,'sb32 ftDonkeyThrowFFCheckInterruptThrowFCommon(GObj *fighter_gobj)\n{','sb32 ftDonkeyThrowFFCheckInterruptThrowFCommon(GObj *fighter_gobj)\n{\n#ifdef __EMSCRIPTEN__\n    extern int port_remix_cargo_shake_check(GObj*);if(port_remix_cargo_shake_check(fighter_gobj))return TRUE;\n#endif')
p=ENGINE/'decomp/src/ft/ftchar/ftdonkey/ftdonkeythrowffall.c'
a='    ftMainSetStatus(fighter_gobj, nFTDonkeyStatusThrowFFall, 0.0F, 0.0F, FTSTATUS_PRESERVE_NONE);'
b='    int cargo_jump=nFTDonkeyStatusThrowFFall;float cargo_speed=0;\n#ifdef __EMSCRIPTEN__\n    extern int port_remix_enabled(void);if(port_remix_enabled()&&fp->fkind==63){cargo_jump=250;cargo_speed=1;}\n#endif\n    ftMainSetStatus(fighter_gobj, cargo_jump, 0.0F, cargo_speed, FTSTATUS_PRESERVE_NONE);'
replace(p,a,b)
for rel,status,flags in [('ftdonkeythrowffall.c','nFTDonkeyStatusThrowFFall','FTSTATUS_PRESERVE_FASTFALL'),('ftdonkeythrowfkneebend.c','nFTDonkeyStatusThrowFKneeBend','FTSTATUS_PRESERVE_NONE')]:
 p=ENGINE/'decomp/src/ft/ftchar/ftdonkey'/rel
 a=f'    ftMainSetStatus(fighter_gobj, {status}, 0.0F, 0.0F, {flags});'
 b=f'    float cargo_speed=0;\n#ifdef __EMSCRIPTEN__\n    extern int port_remix_enabled(void);if(port_remix_enabled()&&fp->fkind==63)cargo_speed=1;\n#endif\n    ftMainSetStatus(fighter_gobj, {status}, 0.0F, cargo_speed, {flags});'
 replace(p,a,b)
# Kirby owns the extended ROM action table and accessories. Keep native table
# lookups bounded; only copied powers with installed callbacks can be acquired.
p=ENGINE/'decomp/src/ft/ftchar/ftkirby/ftkirbyspecialn.c'
a='victim_fp->fkind<29 ? copy[victim_fp->fkind].copy_id : nFTKindKirby'
b='victim_fp->fkind<27 ? copy[victim_fp->fkind].copy_id : port_remix_kirby_copy_id(victim_fp->fkind)'
replace(p,'#include <ft/fighter.h>','#include <ft/fighter.h>\n#ifdef __EMSCRIPTEN__\nextern int port_remix_kirby_copy_id(int),port_remix_kirby_hat(int);\n#else\n#define port_remix_kirby_copy_id(id) nFTKindKirby\n#define port_remix_kirby_hat(id) 0\n#endif')
replace(p,a,b)
replace(p,'copy[copy_id].copy_modelpart_id','copy_id<27 ? copy[copy_id].copy_modelpart_id : port_remix_kirby_hat(copy_id)')
for rel,fn in [('ftcommonspecialn.c','ftKirbySpecialNSetStatusSelect'),('ftcommonspecialair.c','ftKirbySpecialAirNSetStatusSelect')]:
 p=ENGINE/'decomp/src/ft/ftcommon'/rel
 replace(p,'void '+fn+'(GObj *fighter_gobj)\n{','void '+fn+'(GObj *fighter_gobj)\n{\n#ifdef __EMSCRIPTEN__\n extern int port_remix_kirby_neutral(GObj*);if(port_remix_kirby_neutral(fighter_gobj))return;\n#endif')
p=ENGINE/'decomp/src/ft/ftparam.c'
if 'extern FTModelPart *port_remix_modelpart' not in p.read_text():replace(p,'#include <ft/fighter.h>','#include <ft/fighter.h>\n#ifdef __EMSCRIPTEN__\nextern FTModelPart *port_remix_modelpart(FTStruct*,FTModelPartDesc*,int,int,int);\n#define REMIX_MODEL_PART(fp,desc,joint,id,detail) port_remix_modelpart(fp,desc,joint,id,detail)\n#else\n#define REMIX_MODEL_PART(fp,desc,joint,id,detail) (&(desc)->modelparts[id][detail])\n#endif')
a='&FTMODELPARTCONTAINER_GET_DESC(modelparts_container, joint_id - nFTPartsJointCommonStart)->modelparts[modelpart_id][fp->detail_curr - nFTPartsDetailStart]'
b='REMIX_MODEL_PART(fp,FTMODELPARTCONTAINER_GET_DESC(modelparts_container, joint_id - nFTPartsJointCommonStart),joint_id,modelpart_id,fp->detail_curr - nFTPartsDetailStart)'
replace(p,a,b)
a='&FTMODELPARTCONTAINER_GET_DESC(modelparts_container, i)->modelparts[modelpart_status->modelpart_id_curr][fp->detail_curr - nFTPartsDetailStart]'
b='REMIX_MODEL_PART(fp,FTMODELPARTCONTAINER_GET_DESC(modelparts_container, i),i+nFTPartsJointCommonStart,modelpart_status->modelpart_id_curr,fp->detail_curr - nFTPartsDetailStart)'
s=p.read_text();s=s.replace(a,b);p.write_text(s)
p=ENGINE/'decomp/src/ft/ftmain.c'
replace(p,'extern void port_remix_before_status(GObj*,int);port_remix_before_status(fighter_gobj,status_id);','extern int port_remix_kirby_action(GObj*,int);extern void port_remix_before_status(GObj*,int);status_id=port_remix_kirby_action(fighter_gobj,status_id);port_remix_before_status(fighter_gobj,status_id);')
# Reinstall the capsule accessory after a copied doctor's ground/air transition.
p=ENGINE/'decomp/src/ft/ftchar/ftkirby/ftkirbycopymariospecialn.c'
replace(p,'void ftKirbyCopyMarioSpecialNProcAccessory(GObj *fighter_gobj)\n{','void ftKirbyCopyMarioSpecialNProcAccessory(GObj *fighter_gobj)\n{\n#ifdef __EMSCRIPTEN__\n extern int port_remix_kirby_capsule(GObj*);if(port_remix_kirby_capsule(fighter_gobj))return;\n#endif')

p=ENGINE/'decomp/src/ft/ftchar/ftkirby/ftkirbyspecialn.c'
replace(p,'            ftKirbySpecialNInitPassiveVars(fp);','            ftKirbySpecialNInitPassiveVars(fp);\n#ifdef __EMSCRIPTEN__\n            {extern void port_remix_kirby_acquired(FTStruct*);port_remix_kirby_acquired(fp);}\n#endif')

p=ENGINE/'decomp/src/ft/ftmain.c'
replace(p,'    if ((hitlag_tics == 0) && (fp->afterimage.drawstatus != -1))\n    {','    if ((hitlag_tics == 0) && (fp->afterimage.drawstatus != -1))\n    {\n#ifdef __EMSCRIPTEN__\n        extern int port_remix_trail_update(FTStruct*);\n        if(!port_remix_trail_update(fp))\n#endif')
p=ENGINE/'decomp/src/ft/ftdisplaymain.c'
if 'extern int port_remix_trail_mode' not in p.read_text():
 replace(p,'#include <ft/fighter.h>','#include <ft/fighter.h>\n#ifdef __EMSCRIPTEN__\nextern int port_remix_trail_mode(FTStruct*);\nextern void port_remix_trail_style(FTStruct*,float*,float*,SYColorRGBA**,SYColorRGBA**);\n#define REMIX_TRAIL_MODE(fp) port_remix_trail_mode(fp)\n#else\n#define REMIX_TRAIL_MODE(fp) ((fp)->afterimage.is_itemswing)\n#endif')
s=p.read_text().replace('switch (fp->afterimage.is_itemswing)','switch (REMIX_TRAIL_MODE(fp))');p.write_text(s)
replace(p,'    base_p_vtx = p_vtx = (Vtx*)gSYTaskmanGraphicsHeap.ptr;','    #ifdef __EMSCRIPTEN__\n    port_remix_trail_style(fp,&var_f20,&var_f22,&color1,&color2);\n    #endif\n    base_p_vtx = p_vtx = (Vtx*)gSYTaskmanGraphicsHeap.ptr;')

p=ENGINE/'decomp/src/mn/mnvsmode/mnvsresults.c'
replace(p,'sizeof(Gfx) * 2500,         // Display List Buffer 0 Size','sizeof(Gfx) * 8192,         // Display List Buffer 0 Size')
