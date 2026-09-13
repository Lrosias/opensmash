/* Browser C-stick travels in the existing rollback pad word: 0x40 marks an
 * attack stick, bits 0..2 select right/left/down; no direction bit means up.
 * C-up (0x08) remains an independent jump button, including simultaneous jump.
 * This state is in wasm memory and is restored with the rest of the simulation. */
#include <ft/fighter.h>

static unsigned char cstick_direction[4];
static unsigned char cstick_frozen[4];

EMSCRIPTEN_KEEPALIVE int port_yougame_cstick_version(void) { return 1; }

static int cstick_in_hitlag(SYController *pad) {
    GObj *gobj;
    for (gobj = gGCCommonLinks[nGCCommonLinkIDFighter]; gobj; gobj = gobj->link_next) {
        FTStruct *fp = ftGetStruct(gobj);
        /* ftMain decrements hitlag before running attack interrupts. */
        if (fp->pkind == nFTPlayerKindMan && fp->input.controller == pad && !fp->is_control_disable)
            return fp->hitlag_tics > 1;
    }
    return 0;
}

void port_yougame_cstick_read(int port, SYController *pad, int gameplay) {
    unsigned short held = pad->button_hold, taps = pad->button_tap;
    unsigned short direction = held & 7;
    int frozen = gameplay && cstick_in_hitlag(pad);
    /* Match A's hitlag buffering, but discard the flick after the first
     * unfrozen frame even when the current action cannot attack. */
    if (!gameplay || !cstick_frozen[port]) cstick_direction[port] = 0;
    cstick_frozen[port] = frozen;
    if (!(held & 0x40)) return;
    if (!gameplay) {
        /* Preserve native costume selection in menus. */
        pad->button_hold = (held & ~0x40) | (direction ? 0 : 8);
        pad->button_tap = (taps & ~0x40) | ((taps & 0x40) && !direction ? 8 : 0);
        return;
    }
    /* Only a fresh flick fires; holding or circling the stick cannot repeat.
     * Remove the encoded directions before the fighter's jump checks. */
    pad->button_hold &= ~0x47;
    pad->button_tap &= ~0x47;
    pad->button_update &= ~0x47;
    if (taps & 0x40)
        cstick_direction[port] = (direction & 4) ? 4 : (direction & 2) ? 2 : (direction & 1) ? 1 : 3;
}

/* Inject direction only inside an attack check the current action already
 * permits. Never force a status, cancel recovery/hitstun, trigger tap-jump,
 * or replace the main stick used for drift, DI, and fast-falling. */
static sb32 cstick_attack(GObj *gobj, sb32 (*check)(GObj *), int axis) {
    FTStruct *fp = ftGetStruct(gobj);
    int port, direction = 0;
    if (fp->pkind == nFTPlayerKindMan && !fp->is_control_disable) {
        for (port = 0; port < 4; port++)
            if (fp->input.controller == &gSYControllerDevices[port]) direction = cstick_direction[port];
    }
    if (!direction || (axis == 1 && direction > 2) || (axis == 3 && direction != 3) || (axis == 4 && direction != 4))
        return check(gobj);
    {
        int x = fp->input.pl.stick_range.x, y = fp->input.pl.stick_range.y;
        int tap_x = fp->tap_stick_x, tap_y = fp->tap_stick_y;
        unsigned short tap = fp->input.pl.button_tap;
        sb32 result;
        fp->input.pl.stick_range.x = direction == 1 ? 80 : direction == 2 ? -80 : 0;
        fp->input.pl.stick_range.y = direction == 3 ? 80 : direction == 4 ? -80 : 0;
        fp->tap_stick_x = fp->tap_stick_y = 0;
        fp->input.pl.button_tap |= fp->input.button_mask_a;
        result = check(gobj);
        fp->input.pl.stick_range.x = x;
        fp->input.pl.stick_range.y = y;
        fp->tap_stick_x = tap_x;
        fp->tap_stick_y = tap_y;
        fp->input.pl.button_tap = tap;
        return result;
    }
}

#define CSTICK_CHECK(name, axis) \
    extern sb32 __real_##name(GObj *); \
    sb32 __wrap_##name(GObj *gobj) { return cstick_attack(gobj, __real_##name, axis); }

CSTICK_CHECK(ftCommonAttackS4CheckInterruptCommon, 1)
CSTICK_CHECK(ftCommonAttackS4CheckInterruptDash, 1)
CSTICK_CHECK(ftCommonAttackS4CheckInterruptTurn, 1)
CSTICK_CHECK(ftCommonAttackHi4CheckInterruptCommon, 3)
CSTICK_CHECK(ftCommonAttackHi4CheckInterruptKneeBend, 3)
CSTICK_CHECK(ftCommonAttackLw4CheckInterruptCommon, 4)
CSTICK_CHECK(ftCommonAttackLw4CheckInterruptSquat, 4)
CSTICK_CHECK(ftCommonAttackDashCheckInterruptCommon, 1)
CSTICK_CHECK(ftCommonAttackAirCheckInterruptCommon, 0)
