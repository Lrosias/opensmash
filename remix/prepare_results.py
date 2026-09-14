"""Install narrow expanded-roster adapters in the original VS results scene."""
from prepare import ROOT,ENGINE,replace
import shutil

def install_results():
    p=ENGINE/'decomp/src/mn/mnvsmode/mnvsresults.c'
    for name in ['results_native.inc.h','results_data.h']:
        shutil.copyfile((ROOT/'remix' if name.endswith('.inc.h') else ROOT/'build/remix/main/assets')/name,ENGINE/'port/stubs'/name)
    s=p.read_text()
    prefix='''#ifdef __EMSCRIPTEN__
extern int port_remix_enabled(void);
extern void port_remix_results_controls(void);
extern void port_remix_results_announce(int);
extern int port_remix_results_music(int);
static void remix_results_name(void);
static float remix_results_zoom(int);
static int remix_results_shared(void);
static int remix_results_draw(void);
static int remix_result_pose;
#endif
'''
    if prefix not in s:s=prefix+s
    include='\n#ifdef __EMSCRIPTEN__\n#include "stubs/results_native.inc.h"\n#endif\n'
    if include not in s:s+=include
    p.write_text(s)
    def hook(signature,body):replace(p,signature+'\n{',signature+'\n{\n#ifdef __EMSCRIPTEN__\n'+body+'\n#endif')
    hook('void mnVSResultsMakeResultsText(void)',' if(port_remix_enabled()){remix_results_name();return;}')
    hook('s32 mnVSResultsGetStatusWin(s32 fkind)',' if(port_remix_enabled())return remix_result_pose;')
    hook('sb32 mnVSResultsCheckExit(void)',' if(port_remix_enabled()){if(sMNVSResultsTotalTimeTics>=sMNVSResultsAllowExitWait)port_remix_results_controls();return FALSE;}')
    hook('void mnVSResultsAnnounceWinner(void)',' if(port_remix_enabled()&&remix_results_draw())return;')
    hook('void mnVSResultsPlayWinBGM(void)',' if(port_remix_enabled()){syAudioPlayBGM(0,remix_results_shared()?nSYAudioBGMResults:port_remix_results_music(mnVSResultsGetFighterKind(mnVSResultsGetWinPlayer())));return;}')
    old='''\t\t\tfunc_800269C0_275C0((wk >= (s32)nFTKindEnumCount)
\t\t\t                    ? (u32)port_fighter_results_announce_fgm(wk)
\t\t\t                    : announce_names[wk]);'''
    replace(p,old,'''#ifdef __EMSCRIPTEN__
            if(port_remix_enabled())port_remix_results_announce(wk);else
#endif
'''+old)
    # Remix's original ampersand lives in the extended announcement sprite file.
    replace(p,"\tcase '!':\n\t\treturn 0x1A;","\tcase '&':\n\t\treturn 0x1D;\n\tcase '!':\n\t\treturn 0x1A;")
    replace(p,'10.0F, 8.0F\n\t};','10.0F, 8.0F, 10.0F, 34.0F\n\t};')
    replace(p,'llIFCommonAnnounceCommonSymbolPeriodSprite\n\t};','llIFCommonAnnounceCommonSymbolPeriodSprite, 0, 0x8358\n\t};')
    replace(p,'f32 scale = port_fighter_scale(fkind);','#ifdef __EMSCRIPTEN__\n\tf32 scale = port_remix_enabled()?remix_results_zoom(fkind):port_fighter_scale(fkind);\n#else\n\tf32 scale = port_fighter_scale(fkind);\n#endif')
    # Imported roster material pointers are already native; retain actual costume LUT.
    # Stock KO/falls rows use the original sprites and animation cadence.
    for name in ['mnVSResultsDrawResultsStockRoyal','mnVSResultsDrawResultsStockTeam']:
        sig=f'void {name}(GObj *gobj)\n{{'
        replace(p,sig,sig+'\n#ifdef __EMSCRIPTEN__\n if(port_remix_enabled()){mnVSResultsDrawResultsTimeRoyal(gobj);return;}\n#endif')
