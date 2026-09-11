"""Compile the authored C receipt/wrapper against a small native-results fixture."""
from pathlib import Path
import subprocess, tempfile, unittest

class NativeReceipt(unittest.TestCase):
    def test_native_completion_and_representable_outcomes(self):
        source=(Path(__file__).resolve().parents[1]/'engine/yougame.c').read_text()
        receipt=source[source.index('typedef struct {'):source.index('int port_yougame_before_tick')]
        program=r'''
#include <stdlib.h>
#include <assert.h>
#include <string.h>
typedef int s32;
enum { nFTPlayerKindMan, nFTPlayerKindCom, nFTPlayerKindNot };
typedef struct { int is_team_battle; struct { int pkind; } players[4]; } SCBattleState;
SCBattleState gSCManagerTransferBattleState;
struct { int is_reset; } gSCManagerSceneData;
static unsigned int session_battle;
static int enabled=1, completed, helper_calls, real_calls, native_places[4];
int port_yougame_session_enabled(void) { return enabled; }
''' + receipt + r'''
void mnVSResultsInitVars(void) { assert(completed); assert(helper_calls++==0); }
void mnVSResultsSetIsPresent(void) { assert(helper_calls++==1); }
void mnVSResultsInitRankings(void) { assert(helper_calls++==2); }
s32 mnVSResultsGetPlace(s32 p) { assert(helper_calls==3);return native_places[p]; }
void __real_scVSBattleStartScene(void) {
    real_calls++;
    /* Native Go, timeout/End and sudden-death Go/End all precede return.
       An old result is already cleared throughout this whole scene. */
    if (enabled) assert(session_receipt.kind==0);
    completed=1;
}
static void setup(void) {
    memset(&gSCManagerTransferBattleState,0,sizeof(gSCManagerTransferBattleState));
    gSCManagerSceneData.is_reset=0;
    for(int i=0;i<4;i++) { gSCManagerTransferBattleState.players[i].pkind=nFTPlayerKindNot;native_places[i]=-1; }
    gSCManagerTransferBattleState.players[0].pkind=nFTPlayerKindMan;
    gSCManagerTransferBattleState.players[2].pkind=nFTPlayerKindMan;
    native_places[0]=1;native_places[2]=0;
    setenv("SSB64_BOOT_SLOTS","hoho",1);
    completed=helper_calls=0;session_battle++;
}
static void run(int kind,int winner) {
    __wrap_scVSBattleStartScene();
    assert(session_receipt.kind==kind && session_receipt.winner==winner);
    assert(session_receipt.battle_id==session_battle);
    assert(session_receipt.places[1]==-1 && session_receipt.places[3]==-1);
}
int main(void) {
    setup();run(1,2);assert(session_receipt.present==5 && session_receipt.humans==5);
    /* Native placements are authoritative, not stock/percent heuristics. */
    setup();native_places[0]=0;native_places[2]=1;run(1,0);
    setup();gSCManagerTransferBattleState.is_team_battle=1;run(2,-1);
    setup();gSCManagerTransferBattleState.players[2].pkind=nFTPlayerKindCom;run(2,-1);
    setup();gSCManagerSceneData.is_reset=1;run(2,-1);
    setup();native_places[0]=native_places[2]=0;run(2,-1);
    setup();native_places[0]=native_places[2]=1;run(2,-1);
    setup();setenv("SSB64_BOOT_SLOTS","hhho",1);run(2,-1);
    setup();gSCManagerTransferBattleState.players[2].pkind=nFTPlayerKindNot;
    native_places[0]=0;setenv("SSB64_BOOT_SLOTS","hooo",1);run(2,-1);
    /* Legacy mode forwards the native scene without touching result helpers. */
    enabled=0;completed=helper_calls=0;int before=real_calls;
    __wrap_scVSBattleStartScene();assert(real_calls==before+1 && helper_calls==0);
    return 0;
}
'''
        with tempfile.TemporaryDirectory() as directory:
            src=Path(directory)/'receipt.c';exe=Path(directory)/'receipt'
            src.write_text(program)
            subprocess.run(['cc','-std=c11','-Wall','-Wextra','-Werror',str(src),'-o',str(exe)],check=True,capture_output=True,text=True)
            subprocess.run([str(exe)],check=True,capture_output=True,text=True)

if __name__=='__main__': unittest.main()
