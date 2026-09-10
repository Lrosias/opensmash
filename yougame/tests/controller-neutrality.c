// Links the actual decomp controller.c, with only OS/platform I/O doubled.
#include "sys/controller.h"
#include "sc/scmanager.h"
#include "sc/sctypes.h"
#include "enhancements/enhancements.h"
#include <assert.h>
#include <stdio.h>

#undef assert
#define assert(expression) ((expression) ? (void)0 : __assert(#expression, __FILE__, __LINE__))

extern ControllerInfo sSYControllerDescs[MAXCONTROLLERS];
extern OSContStatus sSYControllerDeviceStatuses[MAXCONTROLLERS];
void syControllerReadDeviceData(void);
void syControllerUpdateGlobalData(void);
SYController gSYControllerMain;
SCCommonData gSCManagerSceneData;
static OSContPad sRaw[MAXCONTROLLERS], sOrdinary[MAXCONTROLLERS];
static int sOwned, sRemapCalls, sRemapEnabled;

// decomp/include/assert.h uses the N64 assertion hook rather than libc's.
void __assert(const char* expression, const char* file, int line) {
    fprintf(stderr, "Assertion failed: %s (%s:%d)\n", expression, file, line);
    __builtin_trap();
}

s32 osContStartReadData(OSMesgQueue* queue) { (void)queue; return 0; }
s32 osRecvMesg(OSMesgQueue* queue, OSMesg* message, s32 flags) {
    (void)queue; (void)message; (void)flags; return 0;
}
void osContGetReadData(OSContPad* pads) {
    for (int i = 0; i < MAXCONTROLLERS; ++i) pads[i] = sOrdinary[i];
}
s32 osMotorInit(OSMesgQueue* queue, OSPfs* pfs, int port) {
    (void)queue; (void)pfs; (void)port; return 0;
}
void port_input_apply_pads(void* target) {
    OSContPad* pads = target;
    if (sOwned) for (int i = 0; i < MAXCONTROLLERS; ++i) pads[i] = sRaw[i];
}
int port_input_platform_owned(void) { return sOwned; }
void port_log(const char* format, ...) { (void)format; }
void port_enhancement_analog_remap(int port, signed char* x, signed char* y) {
    (void)port; if (sRemapEnabled) { ++sRemapCalls; *x = -77; *y = 66; }
}
void port_enhancement_c_stick_smash(int port, unsigned short* hold, unsigned short* tap,
                                  signed char* x, signed char* y, unsigned short oldTap) {
    (void)port; (void)hold; (void)tap; (void)x; (void)y; (void)oldTap;
}
void port_enhancement_dpad_jump(int port, unsigned short* hold, unsigned short* tap, unsigned short oldTap) {
    (void)port; (void)hold; (void)tap; (void)oldTap;
}
static void sample(void) {
    syControllerReadDeviceData();
    syControllerUpdateGlobalData();
}
static void assert_neutral(SYController* pad) {
    assert(pad->button_hold == 0 && pad->button_tap == 0 && pad->button_release == 0 && pad->button_update == 0);
    assert(pad->stick_range.x == 0 && pad->stick_range.y == 0);
}
static void assert_cache_clear(int i) {
    const ControllerInfo* d = &sSYControllerDescs[i];
    assert_neutral(&gSYControllerDevices[i]);
    assert(d->unk00 == 0 && d->unk02 == 0 && d->unk04 == 0 && d->unk06 == 0);
    assert(d->unk08 == 0 && d->unk0A == 0 && d->unk0C == 0 && d->unk0E == 0 && d->unk0F == 0);
    assert(d->unk1C == 8 && d->unk10 == 30 && d->unk14 == 5 && d->unk18 == 30);
}
int main(void) {
    for (int i = 0; i < MAXCONTROLLERS; ++i) {
        sRaw[i].errno = sOrdinary[i].errno = 8;
        sSYControllerDescs[i].unk10 = 30;
        sSYControllerDescs[i].unk14 = 5;
    }
    sOwned = 1;
    sRaw[0] = (OSContPad){.errno=0}; // Keyboard/touch keep local port 1 present.
    for (int port = 1; port < 4; ++port) {
        sRaw[port] = (OSContPad){.button=0x8000, .stick_x=63, .stick_y=-41, .errno=0};
        sample(); // The game has consumed the held sample before the device disconnects.
        assert(gSYControllerDevices[port].button_hold == 0x8000);
        assert(gSYControllerDevices[port].stick_range.x == 63);
        assert(gSYControllerDevices[port].stick_range.y == -41);
        sRaw[port] = (OSContPad){.errno=8};
        sample();
        assert_cache_clear(port);
        assert(gSYControllerConnectedNum == 1 && gSYControllerDeviceStatuses[0] == 0);
        for (int i = 1; i < 4; ++i) assert(gSYControllerDeviceStatuses[i] == -1);
        // A held reconnect is a new tap, never a synthetic release from the old controller.
        sRaw[port] = (OSContPad){.button=0x8000, .stick_x=1, .errno=0};
        sample();
        assert(gSYControllerDevices[port].button_tap == 0x8000);
        assert(gSYControllerDevices[port].button_release == 0);
        sRaw[port] = (OSContPad){.errno=8}; sample();
    }
    // Query can mark a port errored after reading it but before publication.
    sRaw[2] = (OSContPad){.button=0x4000, .stick_x=17, .errno=0}; sample();
    syControllerReadDeviceData(); sSYControllerDescs[2].unk1C = 8;
    syControllerUpdateGlobalData(); assert_cache_clear(2);

    // Raw-owned suspension/staleness/unplug can disconnect ALL four ports.
    for (int i = 0; i < 4; ++i) sRaw[i] = (OSContPad){.errno=8};
    sample();
    assert(gSYControllerConnectedNum == 0); assert_neutral(&gSYControllerMain);
    for (int i = 0; i < 4; ++i) { assert_cache_clear(i); assert(gSYControllerDeviceStatuses[i] == -1); }
    // Reconnect only port 4: preserve physical identity and select it safely as main input.
    sRaw[3] = (OSContPad){.button=0x4000, .stick_x=12, .errno=0}; sample();
    assert(gSYControllerConnectedNum == 1 && gSYControllerDeviceStatuses[0] == 3);
    assert(gSYControllerMain.button_hold == 0x4000 && gSYControllerMain.stick_range.x == 12);

    // Saved AnalogRemap cannot resample SDL over browser-resolved input.
    sRemapEnabled = 1; sRemapCalls = 0; sample();
    assert(sRemapCalls == 0 && gSYControllerDevices[3].stick_range.x == 12);
    // Releasing shell ownership restores the saved regular SDL enhancement.
    sOwned = 0;
    sOrdinary[0] = (OSContPad){.button=0x20, .stick_x=5, .stick_y=6, .errno=0}; sample();
    assert(sRemapCalls == 1 && gSYControllerDevices[0].stick_range.x == -77);
    assert(gSYControllerDevices[0].stick_range.y == 66 && gSYControllerDevices[0].button_hold == 0x20);
    // Errored ordinary SDL slots must also clear; the fix is PORT-wide.
    sOrdinary[0] = (OSContPad){.errno=8}; sample();
    assert(gSYControllerConnectedNum == 0); assert_cache_clear(0); assert_neutral(&gSYControllerMain);
    puts("Actual N64 controller: ordinary P2-P4 disconnect, all-empty, reconnect, query, remap passed");
    return 0;
}
