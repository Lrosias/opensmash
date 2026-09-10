/* Optional browser duel bridge. No changes to native or offline play. */
#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#include <sc/scene.h>
#include <sc/scmanager.h>
#include <ft/fighter.h>
#include <sys/netsync.h>
#include <sys/utils.h>
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
extern int port_yougame_menu_context, port_yougame_queue_kind;
int port_yougame_enabled(void) {
    if (enabled < 0) enabled = getenv("SSB64_YOUGAME") != NULL;
    return enabled;
}
int port_yougame_before_tick(void) {
    static int seeded = 0, menu_initialized = 0;
    if (!menu_initialized) {
        menu_initialized = 1;
        if (getenv("SSB64_YOUGAME_INVITE")) { port_yougame_menu_context=1; port_yougame_queue_kind=3; }
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
    int result = -1, stocks[2] = {3,3}, percent[2] = {0,0}, i;
    if (!port_yougame_enabled()) {
        EM_ASM({Module.nativeScene=$0;}, gSCManagerSceneData.scene_curr);
        return;
    }
    hash = ((unsigned int)syUtilsRandSeed() * 16777619u) ^ gSCManagerSceneData.scene_curr;
    if (gSCManagerSceneData.scene_curr == nSCKindVSBattle && bs != NULL) {
        hash ^= syNetSyncHashBattleFighters();
        if (bs->game_status == nSCBattleGameStatusGo) battle_ticks++;
        for (i = 0; i < 2; i++) {
            stocks[i] = bs->players[i].stock_count + 1;
            if (bs->players[i].fighter_gobj) percent[i] = ftGetStruct(bs->players[i].fighter_gobj)->percent_damage;
            hash = (hash ^ (unsigned int)stocks[i]) * 16777619u;
        }
        if (battle_ticks > 0 && (stocks[0] <= 0 || stocks[1] <= 0 || battle_ticks >= 8*60*60)) {
            if (stocks[0] != stocks[1]) result = stocks[0] > stocks[1] ? 0 : 1;
            else if (percent[0] != percent[1]) result = percent[0] < percent[1] ? 0 : 1;
            else result = 2;
        }
    }
    EM_ASM({ if (Module.onYouGameState) Module.onYouGameState($0 >>> 0,$1,$2,$3,$4); },
           hash, result, stocks[0], stocks[1], battle_ticks);
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
            online_scene(nSCKindPlayersVS);
        } else if(online_cursor==1) online_event(2,0);
        else if(online_phase==4) online_event(3,0);
        else if(online_phase==6) online_event(4,0);
    }
}
void port_yougame_choose_fighter(int fighter) {
    online_event(1, (port_yougame_queue_kind<<8) | fighter);
}
#endif
