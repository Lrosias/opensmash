"""Compile the actual fighter-select code and check when it leaves for the stage grid.

Dropping a puck picks a fighter; only Start, once every active puck is down, moves on
(READY TO FIGHT, then the stage grid). That holds in every mode, including the menu
context (native Online entry and friends invites), which used to jump to the stage grid
as soon as P1's puck dropped. This checks select semantics, not rendering or audio.
Run from the repository root with python3 remix/tests/select-flow.py (CC=cl for MSVC).
"""
from pathlib import Path
import os
import subprocess
import tempfile

root = Path(__file__).resolve().parents[2]
source = (root / "remix/main.c").read_text()


def cut(start, end):
    return source[source.index(start):source.index(end)]


stages = cut("static const int stage_ids[]=", "static const char *stage_names[]=")
state = cut("static int phase,wait_ticks,", "unsigned int port_remix_session_hash(void){")
saved = cut("static int local_setup_saved,", "static GObj *words;")
lookup = cut("static int portrait_index(int id){", "static SObj *menu_sprite(")
pucks = cut("static void portrait_xy(int index,float *x,float *y){", "static const int puck_sprites[]=")
select = cut("static void select_run(void){", "static void menu_run(GObj *gobj){")
menu = cut("static void menu_run(GObj *gobj){", "void port_remix_css_start(void){")
preamble = r'''
#include <assert.h>
#include <stdio.h>
#include <string.h>
#define EM_ASM(...) ((void)0)
#define FALSE 0
#define A_BUTTON 0x8000
#define B_BUTTON 0x4000
#define START_BUTTON 0x1000
#define U_JPAD 0x800
#define D_JPAD 0x400
#define L_JPAD 0x200
#define R_JPAD 0x100
enum { nSYAudioFGMMenuSelect, nSYAudioFGMMenuDenied, nSYAudioFGMMenuScroll2, nSYAudioFGMSamusDash, nSYAudioVoicePublicCheer };
enum { nSCKindVSMode = 1, nSCKindVSBattle, SCBATTLE_GAMERULE_STOCK };
enum { nFTPlayerKindNot, nFTPlayerKindMan, nFTPlayerKindCom, nFTKindNull = -1 };
typedef void GObj;
typedef struct { int pkind,fkind,player,color,tag,is_single_stockicon,costume,shade,level,handicap; } SCPlayer;
typedef struct { int pl_count,cp_count,damage_ratio,handicap,gkind,game_rules,stocks,time_limit,is_team_battle,item_toggles,item_appearance_rate; SCPlayer players[4]; } SCBattleState;
static SCBattleState gSCManagerTransferBattleState;
static struct { int gkind,is_reset,is_suddendeath; } gSCManagerSceneData;
static struct { int button_tap, button_hold; struct { int x, y; } stick_range; } gSYControllerDevices[4];
static int remix_menu_layout[34], port_yougame_menu_context, port_yougame_queue_kind, session, scene_calls, last_scene;
static float HEAPF32[1];
static int port_yougame_session_enabled(void){return session;}
static void func_800269C0_275C0(int fgm){(void)fgm;}
static void announce_fighter(int id){(void)id;}
static void scene(int id){scene_calls++;last_scene=id;}
static void draw_menu(void){}
static void move_hand(int p){(void)p;}
static void reset_results_online(void){}
'''
finish = r'''
// Mirrors port_remix_css_start (main.c) for a fresh human: P1 holds their puck, the P2 CPU's
// puck starts on its portrait. Keep in step with its "CPU pucks and remembered picks" loop.
static void setup(int context){
 port_yougame_menu_context=context;session=0;scene_calls=0;last_scene=0;local_setup_saved=0;
 phase=0;wait_ticks=0;start_ticks=0;stage_cursor=0;confirmed=0;memset(gSYControllerDevices,0,sizeof(gSYControllerDevices));
 for(int i=0;i<34;i++)remix_menu_layout[i]=i;
 for(int p=0;p<4;p++){local_human[p]=p==0;local_active[p]=p<2;chosen[p]=p;hand_home(p);hand_status[p]=0;holder[p]=-1;hold_b[p]=b_latch[p]=grab_cool[p]=0;hover[p]=portrait_index(chosen[p]);puck_home(p);
  if(local_active[p]&&!local_human[p])confirmed|=1<<p;}
 holder[0]=0;hand_status[0]=1;hand_x[0]=39;hand_y[0]=51;puck_follow(0);hover[0]=puck_portrait(0); // over portrait 0
}
static void tick(int taps){gSYControllerDevices[0].button_tap=taps;gSYControllerDevices[0].button_hold=taps;menu_run(NULL);}
static void idle(int n){while(n--)tick(0);}
static void check(int context){
 setup(context);
 idle(70);
 tick(START_BUTTON);assert(phase==0); // P1 still holds a puck: Start is refused
 tick(A_BUTTON);assert(holder[0]==-1&&(confirmed&1)&&chosen[0]==0);
 assert(phase==0); // picking a fighter stays on the fighter screen
 idle(120);assert(phase==0&&scene_calls==0);
 tick(START_BUTTON);assert(phase==3); // Start with every puck down: READY TO FIGHT
 idle(31);assert(phase==2); // then the stage grid
 idle(12);tick(B_BUTTON);assert(phase==0&&(confirmed&3)==3); // B backs out with the picks kept
 idle(120);assert(phase==0&&scene_calls==0); // and does not move on again by itself
 tick(START_BUTTON);idle(31);assert(phase==2);
 idle(12);tick(A_BUTTON);assert(scene_calls==1&&last_scene==(context?nSCKindVSMode:nSCKindVSBattle));
}
int main(void){
 check(1); // menu context: native Online entry and friends invites
 check(0); // local VS
 assert(gSCManagerTransferBattleState.stocks==3); // zero-based: four stocks
 gSCManagerSceneData.is_reset=gSCManagerSceneData.is_suddendeath=1;
 start_local_match();assert(gSCManagerTransferBattleState.stocks==3&&!gSCManagerSceneData.is_reset&&!gSCManagerSceneData.is_suddendeath);
 puts("PASS: a dropped puck stays on the fighter screen; Start with every puck down opens the stage grid (menu context and local)");
}
'''
compiler = os.environ.get("CC", "cc")
with tempfile.TemporaryDirectory(prefix="remix-select-flow-") as directory:
    c_file = Path(directory) / "check.c"
    binary = Path(directory) / ("check.exe" if os.name == "nt" else "check")
    c_file.write_text(preamble + stages + state + saved + lookup + pucks + select + menu + finish)
    if Path(compiler).name.lower() in ("cl", "cl.exe"):
        subprocess.run([compiler, "/nologo", f"/Fe{binary}", f"/Fo{directory}\\", str(c_file)], check=True)
    else:
        subprocess.run([compiler, "-std=c99", str(c_file), "-o", str(binary)], check=True)
    subprocess.run([str(binary)], check=True)
