"""Compile the actual result-selection code with native ranking fixtures.

This checks selection/placement semantics, not native renderer or audio assets.
Run from the repository root with python3 remix/tests/results-selection.py.
"""
from pathlib import Path
import subprocess
import tempfile

root = Path(__file__).resolve().parents[2]
source = (root / "remix/main.c").read_text()
helper = source[source.index("static unsigned int results_native_winners("):source.index("int port_remix_results_start(void){")]
selection = source[source.index("int port_remix_results_start(void){"):source.index(" port_yougame_menu_font();results_wait=60;")]
preamble = r'''
#include <assert.h>
#include <stdio.h>
typedef int s32;
typedef void GObj;
enum { nFTPlayerKindNot, nFTPlayerKindMan, nFTPlayerKindCom };
typedef struct { struct { int pkind,stock_count,team; } players[4]; int is_team_battle; } SCBattleState;
static SCBattleState gSCManagerTransferBattleState;
static struct { int is_reset; } gSCManagerSceneData;
static int session_enabled,results_override=-3,rank_calls,native_places[4];
static struct { int winner,team,count,places[4];unsigned int mask; } selected;
static int port_yougame_session_enabled(void){return session_enabled;}
static int port_remix_enabled(void){return 1;}
s32 mnVSResultsGetPlace(s32 slot){rank_calls++;return native_places[slot];}
'''
finish = r'''
 selected.winner=winner;selected.team=winning_team;selected.mask=winner_mask;selected.count=count;
 for(i=0;i<4;i++)selected.places[i]=places[i];return 1;
}
static void setup(int present){
 session_enabled=1;results_override=-3;rank_calls=0;gSCManagerSceneData.is_reset=0;
 gSCManagerTransferBattleState.is_team_battle=0;
 for(int i=0;i<4;i++){gSCManagerTransferBattleState.players[i].pkind=(present&(1<<i))?nFTPlayerKindMan:nFTPlayerKindNot;gSCManagerTransferBattleState.players[i].stock_count=20-i;gSCManagerTransferBattleState.players[i].team=0;native_places[i]=3;}
}
int main(void){
 // Time/Sudden Death final placements can contradict remaining stock counts.
 setup(5);native_places[0]=1;native_places[2]=0;port_remix_results_start();
 assert(selected.winner==2&&selected.mask==4&&selected.places[1]==-1&&rank_calls==2);
 // CPU winners remain native winners even when the platform cannot score them.
 setup(5);native_places[0]=1;native_places[2]=0;gSCManagerTransferBattleState.players[2].pkind=nFTPlayerKindCom;port_remix_results_start();assert(selected.winner==2&&selected.mask==4);
 // Every first-place teammate wins, including sparse ports.
 setup(15);gSCManagerTransferBattleState.is_team_battle=1;native_places[0]=native_places[2]=0;gSCManagerTransferBattleState.players[0].team=gSCManagerTransferBattleState.players[2].team=1;port_remix_results_start();assert(selected.winner==-1&&selected.mask==5&&selected.team==1);
 // Shared FFA placements do not manufacture a unique winner.
 setup(15);native_places[1]=native_places[3]=0;port_remix_results_start();assert(selected.winner==-1&&selected.mask==10&&selected.team==-1);
 // A no contest has no winner even though native places are all zero.
 setup(15);gSCManagerSceneData.is_reset=1;for(int i=0;i<4;i++)native_places[i]=0;port_remix_results_start();assert(selected.winner==-1&&selected.mask==0);
 // Offline presentation preserves its prior stock-count policy.
 setup(5);session_enabled=0;native_places[2]=0;port_remix_results_start();assert(selected.winner==0&&selected.mask==1&&rank_calls==0);
 // Existing externally-confirmed display overrides remain authoritative.
 setup(5);results_override=2;port_remix_results_start();assert(selected.winner==2&&selected.mask==4&&rank_calls==0&&results_override==-3);
 puts("PASS: native FFA/time/SD, CPU, team/shared placements, no-contest, offline and forced-override selection");
}
'''
with tempfile.TemporaryDirectory(prefix="remix-results-selection-") as directory:
    c_file = Path(directory) / "check.c"
    binary = Path(directory) / "check"
    c_file.write_text(preamble + helper + selection + finish)
    subprocess.run(["cc", "-std=c99", str(c_file), "-o", str(binary)], check=True)
    subprocess.run([str(binary)], check=True)
