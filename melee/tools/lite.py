#!/usr/bin/env python3
"""Apply version-checked browser-only scene hooks to generated GALE01r2 C."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
CHUNKS = ROOT / 'build/melee-web/game-small/generated/chunks'

def main():
    # Addresses and the save-data offset are checked against GALE01r2's actual
    # generated instructions, not the evolving decomp struct layout.
    path = CHUNKS / 'chunk_0834_text1_801A4140.c'
    text = path.read_text()
    text = re.sub(r'    /\* OPENSMASH_LITE_BEGIN \*/.*?    /\* OPENSMASH_LITE_END \*/\n', '', text, flags=re.S)
    anchor = 'label_801A43A0:\n'
    if text.count(anchor) != 1 or '// 801A43A0: mflr    r0' not in text:
        raise SystemExit('Unexpected runGameMode code; refusing to patch.')
    hook = '''    /* OPENSMASH_LITE_BEGIN */
    // runGameMode: initialization has completed. Enter VS directly, including
    // when Back attempts to return to the removed main/single-player menus.
    ctx->gpr[3] = 2;
    mem_write8(ctx, 0x80479D30u, 2);
    {
        u32 save = mem_read32(ctx, ctx->gpr[13] - 30656u);
        mem_write16(ctx, save + 0x1868u, 0xFFFFu);
    }
    { extern void melee_menu_major(void); melee_menu_major(); }
    /* OPENSMASH_LITE_END */
'''
    updated = text.replace(anchor, anchor + hook)
    if path.read_text() != updated:
        path.write_text(updated)
    # Version-checked hooks at original function entry, before register clobbers.
    hooks = [
        ('chunk_0042_text1_80018140.c', '80018254',
         '''extern int melee_match_option(int);
        if (melee_match_option(7) == 1) {
            // The native scene preloader must agree with the locked roster and
            // stage BEFORE it allocates fighter archives. The browser asset gate
            // alone cannot replace Melee's emulated archive/preload bookkeeping.
            u32 cache = 0x80432078u + 4u + 8u;
            mem_write32(ctx,cache+4u,melee_match_option(1));
            for (int i=0;i<8;i++) {
                mem_write32(ctx,cache+8u+i*8u,(i<4 && (melee_match_option(12)&(1<<i)))?melee_match_option(i<2?2+i*2:4+i*2):0x21);
                mem_write8(ctx,cache+12u+i*8u,(i<4 && (melee_match_option(12)&(1<<i)))?melee_match_option(i<2?3+i*2:5+i*2):0);
                mem_write8(ctx,cache+13u+i*8u,1);
            }
        }'''),
        ('chunk_0836_text1_801A5140.c', '801A5680',
         '''extern int melee_match_option(int);
        if (melee_match_option(6) == 1) {
            // GameModeState.info.exit_data -> CSSData.vs.start.players.
            u32 css = mem_read32(ctx,ctx->gpr[3]+0x14u);
            for (int i=0;i<4;i++) {
                u32 p=css+8u+0x68u+i*0x24u;
                mem_write8(ctx,p,(melee_match_option(12)&(1<<i))?melee_match_option(i<2?2+i*2:4+i*2):0x21);
                mem_write8(ctx,p+3,(melee_match_option(12)&(1<<i))?melee_match_option(i<2?3+i*2:5+i*2):0);
            }
        }'''),
        ('chunk_0836_text1_801A5140.c', '801A57A8',
         '''extern int melee_match_option(int);
        if (melee_match_option(6) == 1) {
            // Set stage before the normal SSS-exit audio preload selects music.
            u32 sss = mem_read32(ctx,ctx->gpr[3]+0x14u);
            mem_write16(ctx,sss+8u+0x16u,melee_match_option(1));
        }'''),
        ('chunk_0713_text1_80167940.c', '80167BC8',
         '''extern int melee_match_option(int);
        // Online rules were supplied at EnterVs; bypass local saved preferences.
        if (melee_match_option(6) == 1) { ctx->pc = ctx->lr; return; }'''),
        ('chunk_0093_text1_80031940.c', '80031CB0',
         'extern void melee_asset_selection(int,int); melee_asset_selection(0,ctx->gpr[3]);'),
        ('chunk_1092_text1_80225140.c', '802251B4',
         'extern void melee_asset_selection(int,int); melee_asset_selection(1,ctx->gpr[3]);'),
        ('chunk_0836_text1_801A5140.c', '801A5618',
         'extern void melee_asset_menu(void); extern void melee_match_menu(void); melee_match_menu(); melee_asset_menu(); extern void melee_session_scene(int,int,int); melee_session_scene(1,-1,0); extern void melee_menu_css(void); melee_menu_css();'),
        ('chunk_0836_text1_801A5140.c', '801A5754',
         'extern void melee_session_scene(int,int,int); melee_session_scene(2,-1,0);'),
        ('chunk_0837_text1_801A5940.c', '801A5AF0',
         'extern void melee_session_scene(int,int,int); melee_session_scene(4,-1,0);'),
        ('chunk_0837_text1_801A5940.c', '801A5C3C',
         'extern void melee_session_scene(int,int,int); melee_session_scene(5,-1,0);'),
        ('chunk_1861_text1_803A5940.c', '803A6048',
         '''// The versus character select sizes the SIS text pool for its own name tags
        // (0x2400 bytes). The native mode menu draws with the same renderer; give
        // every scene the results screen's pool so the menu never empties it.
        if (ctx->gpr[3] < 0xC000u) ctx->gpr[3] = 0xC000u;'''),
        ('chunk_1768_text1_80377140.c', '8037750C',
         'extern void melee_menu_tick(void*); melee_menu_tick(ctx);'),
        ('chunk_0837_text1_801A5940.c', '801A5F50',
         'extern void melee_session_result(unsigned); melee_session_result(ctx->gpr[31]+8u);'),
        ('chunk_0836_text1_801A5140.c', '801A583C',
         '''extern void melee_asset_match(int,int,int,int,int);
        u32 vs = ctx->gpr[4];
        extern int melee_match_option(int);
        extern void melee_match_enter(void);
        if (melee_match_option(6) == 1) {
            // StartMeleeRules / PlayerInitData GALE01r2 layout. Keep scene
            // callbacks zero and reproduce the normal default gameplay flags.
            for (u32 i=0;i<0x138u;i++) mem_write8(ctx,vs+8u+i,0);
            u32 rules = vs + 8u;
            mem_write8(ctx,rules,0x32); // stock, default type 4, timer enabled
            mem_write8(ctx,rules+2,0x8e); // stock, no pause, default flags
            mem_write8(ctx,rules+3,0x4c);
            mem_write8(ctx,rules+4,0xc3); // normal VS camera flags
            mem_write8(ctx,rules+0xb,0xff); // no item spawns
            mem_write8(ctx,rules+0xc,0xff);
            mem_write8(ctx,rules+0xd,110);
            mem_write16(ctx,rules+0xe,melee_match_option(1));
            mem_write32(ctx,rules+0x10,480);
            for (u32 i=0x2c;i<=0x34;i+=4) mem_write32(ctx,rules+i,0x3f800000);
            for (int i=0;i<6;i++) {
                u32 p=vs+0x68u+i*0x24u;
                mem_write8(ctx,p,(i<4 && (melee_match_option(12)&(1<<i)))?melee_match_option(i<2?2+i*2:4+i*2):0x21);
                mem_write8(ctx,p+1,(i<4 && (melee_match_option(12)&(1<<i)))?0:3);
                mem_write8(ctx,p+2,(i<4 && (melee_match_option(12)&(1<<i)))?4:0);
                mem_write8(ctx,p+3,(i<4 && (melee_match_option(12)&(1<<i)))?melee_match_option(i<2?3+i*2:5+i*2):0);
                mem_write8(ctx,p+4,0); // 0 uses this slot's own controller port
                mem_write8(ctx,p+5,0xff);
                mem_write8(ctx,p+8,9);
                mem_write8(ctx,p+0xa,120);
                mem_write8(ctx,p+0xc,0x40);
                mem_write8(ctx,p+0xe,4);
                for (u32 off=0x18;off<=0x20;off+=4) mem_write32(ctx,p+off,0x3f800000);
            }
            // SSS confirmation must not trigger the held-A Zelda/Sheik boot
            // transformation. Both characters remain available during gameplay.
            for (int i=0;i<4;i++) {
                u32 buttons=0x804c20bcu+i*0x44u;
                mem_write32(ctx,buttons,mem_read32(ctx,buttons)&~0x100u);
            }
            mem_write32(ctx,0x804d5f90u,(u32)melee_match_option(0));
            melee_match_enter();
        }
        int fighters[4];
        // GALE01r2: rules at +8, stage at rules+0x0e; four 0x24-byte slots.
        for (int i=0;i<4;i++) {
            u32 player = vs + 0x68u + i * 0x24u;
            fighters[i] = mem_read8(ctx,player+1) <= 1 ? mem_read8(ctx,player) : -1;
        }
        extern void melee_session_scene(int,int,int);
        int mask = 0;
        for (int i=0;i<4;i++) if (fighters[i]>=0) mask |= 1<<i;
        melee_session_scene(3,mem_read16(ctx,vs+0x16u),mask);
        melee_asset_match(mem_read16(ctx,vs+0x16u),fighters[0],fighters[1],fighters[2],fighters[3]);'''),
    ]
    for filename, address, code in hooks:
        path = CHUNKS / filename
        original = path.read_text()
        marker = 'OPENSMASH_STREAM_' + address
        text = re.sub(r'    /\* '+marker+r'_BEGIN \*/.*?    /\* '+marker+r'_END \*/\n', '', original, flags=re.S)
        anchor = 'label_' + address + ':\n'
        expected = '// 801A5F50: lwz     r0, 28(r1)' if address == '801A5F50' else '// '+address+': mflr'
        if text.count(anchor) != 1 or expected not in text:
            raise SystemExit('Unexpected scene entry at '+address+'; refusing to patch.')
        if address == '801A5F50' and any(instruction not in text for instruction in [
            '// 801A5F14: or   r31, r3, r3', '// 801A5F30: addi    r4, r3, 4',
            '// 801A5F34: lwzu     r3, 8(r4)', '// 801A5F3C: stwu     r3, 8(r5)',
            '// 801A5F4C: stw     r0, 8(r5)']):
            raise SystemExit('Unexpected native result copy layout; refusing to patch.')
        hook = '    /* '+marker+'_BEGIN */\n    { '+code+' }\n    /* '+marker+'_END */\n'
        text = text.replace(anchor, anchor+hook)
        if text != original: path.write_text(text)
    # Fountain of Dreams renders fighters, scenery and effects a second time
    # into its water reflection. Skip only those three draw-list calls in Lite
    # mode. Keep camera setup, texture clear/copy/matrix and normal stage drawing
    # intact: the surface has a valid neutral texture, never an uninitialized one.
    path = CHUNKS / 'chunk_0915_text1_801CC940.c'
    original = path.read_text()
    text = re.sub(r'    /\* OPENSMASH_REFLECTION_.*?_BEGIN \*/.*?    /\* OPENSMASH_REFLECTION_.*?_END \*/\n', '', original, flags=re.S)
    for address in ['801CCFE4', '801CD004', '801CD024']:
        anchor = 'label_' + address + ':\n'
        if text.count(anchor) != 1 or '// '+address+': bl      0x80390ED0' not in text:
            raise SystemExit('Unexpected Fountain reflection draw call at '+address)
        next_address = f'{int(address,16)+4:08X}'
        marker = 'OPENSMASH_REFLECTION_' + address
        hook = ('    /* '+marker+'_BEGIN */\n'
                '    { extern int melee_lite_effects(void); if (melee_lite_effects()) {\n'
                '        ctx->lr = 0x'+next_address+'u; goto label_'+next_address+';\n'
                '    } }\n    /* '+marker+'_END */\n')
        text = text.replace(anchor, anchor+hook)
    if text != original: path.write_text(text)
    print('Applied VS-only boot, full roster, asset gates and Lite water reflections.')


if __name__ == '__main__':
    main()
