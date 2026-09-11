/* Optional browser duel bridge. No changes to native or offline play. */
#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#include <sc/scene.h>
#include <sc/scmanager.h>
#include <ft/fighter.h>
#include <sys/netsync.h>
#include <sys/utils.h>
#include <mn/menu.h>
#include <stdlib.h>
/* The decomp supplies its own N64 stdlib.h without the host environment API. */
extern char *getenv(const char *);

/* Unallocated tail of the scene's bump arena: no live object refers here. */
EMSCRIPTEN_KEEPALIVE unsigned int *port_yougame_scene_unused(void) {
    static unsigned int range[2];
    range[0] = (unsigned int)(uintptr_t)gSYTaskmanGeneralHeap.ptr;
    range[1] = (unsigned int)(uintptr_t)gSYTaskmanGeneralHeap.end;
    return range;
}
static int enabled = -1;
static unsigned int battle_ticks = 0;
static unsigned int session_ticks = 0, session_battle = 0;
static int session_scene = -1;
extern MNPlayersSlotVS sMNPlayersVSSlots[4];
extern unsigned int port_remix_session_hash(void) __attribute__((weak));
int port_yougame_session_enabled(void) {
    static int session = -1;
    if (session < 0) session = getenv("SSB64_YOUGAME_SESSION") != NULL;
    return session;
}
/* The browser session advances emulated time only after completed native ticks.
 * Link wrapping preserves the original host clock in every existing mode. */
extern unsigned long long __real_osGetTime(void);
extern unsigned int __real_osGetCount(void);
unsigned long long __wrap_osGetTime(void) {
    return port_yougame_session_enabled() ? (unsigned long long)session_ticks * 781250ULL : __real_osGetTime();
}
unsigned int __wrap_osGetCount(void) {
    return port_yougame_session_enabled() ? (unsigned int)((unsigned long long)session_ticks * 781250ULL) : __real_osGetCount();
}
extern int port_yougame_menu_context, port_yougame_queue_kind;
int port_yougame_enabled(void) {
    if (enabled < 0) enabled = getenv("SSB64_YOUGAME") != NULL;
    return enabled;
}
/* A receipt follows the complete VS scene, including sudden death. The native
 * result initializers only fill scalar/array data, so Remix can reuse them
 * without entering the original twelve-character result renderer. */
typedef struct {
    unsigned int battle_id;
    int kind, winner, present, humans, teams, no_contest, places[4];
} YouGameNativeReceipt;
static YouGameNativeReceipt session_receipt;
extern void __real_scVSBattleStartScene(void);
extern void mnVSResultsInitVars(void);
extern void mnVSResultsSetIsPresent(void);
extern void mnVSResultsInitRankings(void);
extern s32 mnVSResultsGetPlace(s32 player);
static void port_yougame_capture_native_result(void) {
    SCBattleState *bs = &gSCManagerTransferBattleState;
    const char *roles = getenv("SSB64_BOOT_SLOTS");
    int assigned = 0, winners = 0, count = 0, i;
    if (!session_battle) return;
    mnVSResultsInitVars();
    mnVSResultsSetIsPresent();
    mnVSResultsInitRankings();
    session_receipt = (YouGameNativeReceipt){0};
    session_receipt.battle_id = session_battle;
    session_receipt.kind = 2; /* unscored unless one representable winner */
    session_receipt.winner = -1;
    session_receipt.teams = !!bs->is_team_battle;
    session_receipt.no_contest = !!gSCManagerSceneData.is_reset;
    for (i = 0; roles && i < 4 && roles[i]; i++) if (roles[i] == 'h') assigned |= 1 << i;
    for (i = 0; i < 4; i++) {
        session_receipt.places[i] = -1;
        if (bs->players[i].pkind == nFTPlayerKindNot) continue;
        count++;
        session_receipt.present |= 1 << i;
        if (bs->players[i].pkind == nFTPlayerKindMan) session_receipt.humans |= 1 << i;
        session_receipt.places[i] = mnVSResultsGetPlace(i);
        if (session_receipt.places[i] == 0) { winners++; session_receipt.winner = i; }
    }
    if (!session_receipt.teams && !session_receipt.no_contest && count >= 2 && winners == 1 &&
        session_receipt.present == assigned && session_receipt.humans == assigned) session_receipt.kind = 1;
    else session_receipt.winner = -1;
}
void __wrap_scVSBattleStartScene(void) {
    if (port_yougame_session_enabled()) session_receipt = (YouGameNativeReceipt){0};
    __real_scVSBattleStartScene();
    if (port_yougame_session_enabled()) port_yougame_capture_native_result();
}
int port_yougame_before_tick(void) {
    static int seeded = 0, menu_initialized = 0;
    if (!menu_initialized) {
        menu_initialized = 1;
        if (!port_yougame_session_enabled() && getenv("SSB64_YOUGAME_INVITE")) { port_yougame_menu_context=1; port_yougame_queue_kind=3; }
    }
    if (!port_yougame_enabled()) return EM_ASM_INT({ return !Module.beforeGameTick || Module.beforeGameTick() ? 1 : 0; });
    if (!seeded) {
        unsigned int seed = 1;
        const char *value = getenv("SSB64_YOUGAME_SEED");
        if (value && *value) { seed = 0; while (*value >= '0' && *value <= '9') seed = seed * 10u + (unsigned int)(*value++ - '0'); }
        syUtilsSetRandomSeed(seed); seeded = 1;
    }
    return EM_ASM_INT({ return Module.beforeGameTick && Module.beforeGameTick() ? 1 : 0; });
}
void port_yougame_after_tick(void) {
    SCBattleState *bs = gSCManagerBattleState;
    unsigned int hash;
    int result = -1, stocks[4] = {0,0,0,0}, percent[4] = {0,0,0,0}, i, mask = 0;
    int scene = gSCManagerSceneData.scene_curr;
    EM_ASM({Module.nativeScene=$0;}, scene);
    if (port_yougame_session_enabled()) {
        session_ticks++;
        if (scene != session_scene) {
            if (scene == nSCKindVSBattle) { battle_ticks = 0; session_battle++; }
            session_scene = scene;
        }
    }
    if (!port_yougame_enabled()) {
        return;
    }
    hash = ((unsigned int)syUtilsRandSeed() * 16777619u) ^ gSCManagerSceneData.scene_curr;
    if (gSCManagerSceneData.scene_curr == nSCKindVSBattle && bs != NULL) {
        int alive = 0, best = -1, tied = 0;
        hash ^= syNetSyncHashBattleFighters();
        if (bs->game_status == nSCBattleGameStatusGo) battle_ticks++;
        for (i = 0; i < 4; i++) {
            if (bs->players[i].pkind != nFTPlayerKindMan) continue;
            mask |= 1 << i;
            stocks[i] = bs->players[i].stock_count + 1;
            if (bs->players[i].fighter_gobj) percent[i] = ftGetStruct(bs->players[i].fighter_gobj)->percent_damage;
            hash = (hash ^ (unsigned int)stocks[i]) * 16777619u;
            if (stocks[i] > 0) alive++;
            if (best < 0 || stocks[i] > stocks[best] || (stocks[i] == stocks[best] && percent[i] < percent[best])) {best = i; tied = 0;}
            else if (stocks[i] == stocks[best] && percent[i] == percent[best]) tied = 1;
        }
        if (!port_yougame_session_enabled() && battle_ticks > 0 && best >= 0 && (alive <= 1 || battle_ticks >= 8*60*60)) result = tied ? 4 : best;
    }
    if (port_yougame_session_enabled()) {
        int seat_mask = 0;
        const char *roles = getenv("SSB64_BOOT_SLOTS");
        for (i = 0; roles && i < 4 && roles[i]; i++) if (roles[i] == 'h') seat_mask |= 1 << i;
        hash = (hash ^ session_ticks) * 16777619u;
        hash = (hash ^ session_battle) * 16777619u;
        hash = (hash ^ gSCManagerSceneData.gkind) * 16777619u;
        if (scene == nSCKindPlayersVS) for (i = 0; i < 4; i++) {
            hash = (hash ^ (unsigned int)sMNPlayersVSSlots[i].fkind) * 16777619u;
            hash = (hash ^ (unsigned int)sMNPlayersVSSlots[i].pkind) * 16777619u;
            hash = (hash ^ (unsigned int)sMNPlayersVSSlots[i].is_fighter_selected) * 16777619u;
            hash = (hash ^ (unsigned int)sMNPlayersVSSlots[i].costume) * 16777619u;
        }
        if (port_remix_session_hash) hash = (hash ^ port_remix_session_hash()) * 16777619u;
        if (session_receipt.kind) {
            hash = (hash ^ session_receipt.battle_id) * 16777619u;
            hash = (hash ^ session_receipt.kind) * 16777619u;
            hash = (hash ^ (unsigned int)session_receipt.winner) * 16777619u;
            hash = (hash ^ session_receipt.present) * 16777619u;
            hash = (hash ^ session_receipt.humans) * 16777619u;
            hash = (hash ^ session_receipt.teams) * 16777619u;
            hash = (hash ^ session_receipt.no_contest) * 16777619u;
            for (i = 0; i < 4; i++) hash = (hash ^ (unsigned int)session_receipt.places[i]) * 16777619u;
        }
        EM_ASM({Module.yougameSession=({scene:$0,frame:$1,battleId:$2,battleTicks:$3,hash:$4>>>0,mask:$5,stage:$6,seatMask:$7});},
               scene,session_ticks,session_battle,battle_ticks,hash,mask,gSCManagerSceneData.gkind,seat_mask);
        EM_ASM({Module.yougameSession.receipt=($0?{battleId:$1,kind:$0===1?'winner':'unscored',winnerSlot:$0===1?$2:null,
            participantsMask:$3,humanMask:$4,teamBattle:!!$5,noContest:!!$6,places:[$7,$8,$9,$10]}:null);},
            session_receipt.kind,session_receipt.battle_id,session_receipt.winner,session_receipt.present,session_receipt.humans,
            session_receipt.teams,session_receipt.no_contest,session_receipt.places[0],session_receipt.places[1],session_receipt.places[2],session_receipt.places[3]);
    }
    EM_ASM({ if (Module.onYouGameState) Module.onYouGameState($0 >>> 0,$1,$2,$3,$4,$5,$6,$7); },
           hash, result, stocks[0], stocks[1], battle_ticks, stocks[2], stocks[3], mask);

}
#endif

#ifdef __EMSCRIPTEN__
#include <mn/menu.h>
#include <gm/gmsound.h>
#include <sys/controller.h>
#include <reloc_data.h>
extern void *func_800269C0_275C0(u16);

/* Native menu extension: every graphic is an existing game sprite. */
int port_yougame_menu_context = 0;
int port_yougame_queue_kind = 0;
static void *menu_font, *menu_digits;
static GObj *online_buttons[3], *online_words;
static int online_cursor, online_wait, online_phase, online_revision;

void port_yougame_menu_font(void) {
    u32 ids[] = { llMNCommonFontsFileID, llMNCommonFileID };
    void *files[2];
    lbRelocLoadFilesListed(ids, files);
    menu_font = files[0];menu_digits=files[1];
}
void port_yougame_menu_text(GObj *gobj, const char *text, float x, float y, float scale, int color) {
    intptr_t letters[] = {
        llMNCommonFontsLetterASprite, llMNCommonFontsLetterBSprite,
        llMNCommonFontsLetterCSprite, llMNCommonFontsLetterDSprite,
        llMNCommonFontsLetterESprite, llMNCommonFontsLetterFSprite,
        llMNCommonFontsLetterGSprite, llMNCommonFontsLetterHSprite,
        llMNCommonFontsLetterISprite, llMNCommonFontsLetterJSprite,
        llMNCommonFontsLetterKSprite, llMNCommonFontsLetterLSprite,
        llMNCommonFontsLetterMSprite, llMNCommonFontsLetterNSprite,
        llMNCommonFontsLetterOSprite, llMNCommonFontsLetterPSprite,
        llMNCommonFontsLetterQSprite, llMNCommonFontsLetterRSprite,
        llMNCommonFontsLetterSSprite, llMNCommonFontsLetterTSprite,
        llMNCommonFontsLetterUSprite, llMNCommonFontsLetterVSprite,
        llMNCommonFontsLetterWSprite, llMNCommonFontsLetterXSprite,
        llMNCommonFontsLetterYSprite, llMNCommonFontsLetterZSprite
    };
    for (; *text; text++) {
        int ch = *text;
        SObj *s;
        if (ch >= 'a' && ch <= 'z') ch -= 32;
        if (ch >= '0' && ch <= '9') {
            intptr_t digits[]={llMNCommonDigit0Sprite,llMNCommonDigit1Sprite,llMNCommonDigit2Sprite,llMNCommonDigit3Sprite,llMNCommonDigit4Sprite,llMNCommonDigit5Sprite,llMNCommonDigit6Sprite,llMNCommonDigit7Sprite,llMNCommonDigit8Sprite,llMNCommonDigit9Sprite};
            s=lbCommonMakeSObjForGObj(gobj,lbRelocGetFileData(Sprite*,menu_digits,digits[ch-'0']));
            s->pos.x=x;s->pos.y=y;s->sprite.attr=(s->sprite.attr&~SP_FASTCOPY)|SP_TRANSPARENT;
            s->sprite.scalex=s->sprite.scaley=scale*0.6F;s->sprite.red=color>>16;s->sprite.green=color>>8;s->sprite.blue=color;
            s->envcolor.r=s->envcolor.g=s->envcolor.b=0;x+=(s->sprite.width*0.6F+1)*scale;continue;
        }
        if (ch < 'A' || ch > 'Z') { x += 4 * scale; continue; }
        s = lbCommonMakeSObjForGObj(gobj, lbRelocGetFileData(Sprite*, menu_font, letters[ch-'A']));
        s->pos.x = x; s->pos.y = y;
        s->sprite.attr = (s->sprite.attr & ~SP_FASTCOPY) | SP_TRANSPARENT;
        s->sprite.scalex = s->sprite.scaley = scale;
        s->sprite.red = color >> 16; s->sprite.green = color >> 8; s->sprite.blue = color;
        s->envcolor.r = s->envcolor.g = s->envcolor.b = 0;
        x += (s->sprite.width + 1) * scale;
    }
}
static void online_event(int action, int value) {
    EM_ASM({ if (Module.onYouGameMenu) Module.onYouGameMenu($0,$1); }, action, value);
}
static void online_scene(int scene) {
    gSCManagerSceneData.scene_prev = gSCManagerSceneData.scene_curr;
    gSCManagerSceneData.scene_curr = scene;
    syTaskmanSetLoadScene();
}
static void online_draw(void) {
    int i;
    char message[100];
    const char *labels[3] = {"CASUAL", "RANKED", "FRIENDS"};
    if (online_words) gcEjectGObj(online_words);
    for (i=0;i<3;i++) if (online_buttons[i]) {gcEjectGObj(online_buttons[i]); online_buttons[i]=NULL;}
    online_words = gcMakeGObjSPAfter(0,NULL,5,GOBJ_PRIORITY_DEFAULT);
    gcAddGObjDisplay(online_words,lbCommonDrawSObjAttr,3,GOBJ_PRIORITY_DEFAULT,~0);
    port_yougame_menu_text(online_words,"ONLINE",28,28,1.5F,0x3C73B4);
    if (!online_phase) {
        port_yougame_menu_text(online_words,"ONE ON ONE",30,190,1,0xFFFFFF);
        port_yougame_menu_text(online_words,"A SELECT   B BACK",30,209,1,0xFFFFFF);
    } else {
        EM_ASM({stringToUTF8(Module.yougameMenu?.text || 'CONNECTING', $0, 100);},message);
        port_yougame_menu_text(online_words,message,30,177,1,0xFFFFFF);
        port_yougame_menu_text(online_words,"B BACK",30,209,1,0xFFFFFF);
        labels[0] = online_phase == 4 ? "REMATCH" : online_phase == 6 ? "TRY AGAIN" : "WAITING";
        labels[1] = "BACK";
    }
    for (i=0;i<(online_phase ? 2 : 3);i++) {
        float x=115-i*20, y=58+i*38;
        GObj *b=online_buttons[i]=gcMakeGObjSPAfter(0,NULL,4,GOBJ_PRIORITY_DEFAULT);
        gcAddGObjDisplay(b,lbCommonDrawSObjAttr,2,GOBJ_PRIORITY_DEFAULT,~0);
        mnVSModeMakeButton(b,x,y,16);
        mnVSModeUpdateButton(b,i==online_cursor?nMNOptionTabStatusHighlight:nMNOptionTabStatusNot);
        port_yougame_menu_text(b,labels[i],x+26,y+10,1.4F,0x000000);
    }
}
void port_yougame_online_start(void) {
    int i;
    port_yougame_menu_font();
    for(i=0;i<3;i++) online_buttons[i]=NULL;
    online_words=NULL; online_cursor=0; online_wait=15;
    online_phase=EM_ASM_INT({return Module.yougameMenu?.phase || 0;});
    online_revision=EM_ASM_INT({return Module.yougameMenu?.revision || 0;});
    online_draw();
}
void port_yougame_online_run(void) {
    int revision=EM_ASM_INT({return Module.yougameMenu?.revision || 0;});
    int y=scSubsysControllerGetPlayerStickUD(20,1) + scSubsysControllerGetPlayerStickUD(-20,0);
    int taps=gSYControllerDevices[0].button_tap;
    if (revision!=online_revision) {
        online_revision=revision; online_phase=EM_ASM_INT({return Module.yougameMenu?.phase || 0;});
        online_cursor=0; online_draw();
    }
    if(online_wait>0) {online_wait--; return;}
    if(taps&B_BUTTON) {
        func_800269C0_275C0(nSYAudioFGMMenuSelect);
        if(online_phase) {online_event(2,0);online_wait=15;} else online_scene(nSCKindModeSelect);
        return;
    }
    if(y || (taps&(U_JPAD|D_JPAD))) {
        int count=online_phase?2:3;
        online_cursor=(online_cursor+((y>0 || (taps&U_JPAD))?count-1:1))%count;
        func_800269C0_275C0(nSYAudioFGMMenuScroll2);
        online_wait=12;online_draw();
    }
    if(taps&(A_BUTTON|START_BUTTON)) {
        online_wait=15;
        if(!online_phase) {
            port_yougame_queue_kind=online_cursor;
            func_800269C0_275C0(nSYAudioFGMMenuSelect);
            online_event(6, port_yougame_queue_kind);
        } else if(online_cursor==1) online_event(2,0);
        else if(online_phase==4) online_event(3,0);
        else if(online_phase==6) online_event(4,0);
    }
}
void port_yougame_choose_fighter(int fighter) {
    online_event(1, (port_yougame_queue_kind<<8) | fighter);
}
#endif
