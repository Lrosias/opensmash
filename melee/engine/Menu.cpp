// SPDX-License-Identifier: GPL-3.0-or-later
// Native mode menu: LOCAL VERSUS / ONLINE (FRIENDS, CASUAL, RANKED), drawn over
// the versus character select with Melee's own SIS text renderer. Every screen
// element is the game's; the browser only supplies the online status line.
//
// The menu runs on the CPU thread from the HSD_PadRenewMasterStatus hook and
// calls recompiled game functions through the module dispatcher, the same way
// a guest `bl` would, with the caller's registers saved around each call.
#include "MeleeRollback.h"
#include <atomic>
#include <cmath>
#include <cstdio>
#include <initializer_list>
#include <cstring>
#include <mutex>
#include <emscripten.h>
#include "core/cpu.h"
#include <moderngekko/module_abi.h>

extern "C" const ModernGekkoModuleDesc* staticrecomp_get_module();

namespace {
// GALE01 revision 2 (US v1.02); lite.py verifies the same executable.
constexpr u32 SENTINEL = 0x80000100u;         // never recompiled code: ends a nested call
constexpr u32 FN_CANVAS = 0x803A611Cu;        // HSD_SisLib: canvas + ortho camera
constexpr u32 FN_TEXT = 0x803A6754u;          // HSD_SisLib: text box with a string buffer on a canvas
constexpr u32 FN_SUBTEXT = 0x803A6B98u;       // HSD_SisLib: printf a subtext
constexpr u32 FN_DESTROY = 0x803A5CC4u;       // HSD_SisLib: free a text box
constexpr u32 FN_SFX = 0x80024030u;           // lbAudioAx: common menu sound
constexpr int MAX_TEXTS = 24;

// Browser-owned state (main thread writes, CPU thread reads).
std::atomic<int> menu_active{0};              // overlay owns the pads
std::atomic<int> menu_hold{0};                // keep pads neutral until every button is released
std::atomic<int> js_phase{0}, js_revision{0};
std::mutex js_mutex; char js_text[64] = "CONNECTING";
std::atomic<int> pad_buttons[4]; std::atomic<float> pad_x[4], pad_y[4];

// CPU-thread state.
bool pending = false, drawn = false, dirty = false, broken = false;
int level = 0, cursor = 0, wait = 0, frames = 0, phase = 0, revision = 0, previous = 0, canvas = -1;
u32 texts[MAX_TEXTS]; int text_count = 0; char status_text[64] = "CONNECTING";
// Layout (screen pixels of the 640x480 frame); tunable from the page while developing.
struct Layout { float scale = 1.0f, x = 46, y = 272, step = 28, boxW = 400, boxH = 40; int flags = 0; };
Layout layout; std::mutex layout_mutex; std::atomic<int> layout_revision{0}; int layout_seen = 0;

void event(int action, int value) {
  EM_ASM({ postMessage({cmd:9,handler:'onMeleeMenu',args:[$0,$1]}); }, action, value);
}

// Run one recompiled function to completion with the guest ABI, then restore
// the interrupted function's registers. Strings live in a scratch area above
// the temporary stack frame so the callee can read them by guest pointer.
u32 guest_call(CPUState* c, u32 fn, const u32* ints, int nints, const double* floats, int nfloats, const char* str = nullptr) {
  CPUState saved = *c;
  u32 sp = (c->gpr[1] - 0x400u) & ~0xFu;
  mem_write32(c, sp, saved.gpr[1]);
  u32 str_addr = sp + 0x200u;
  if (str) {
    // Melee's menu text takes full-width Shift-JIS letters (the game writes "KOs"
    // as \x82\x6a\x82\x6e\x82\x93); ASCII digits and spaces pass through as they are.
    u32 at = str_addr;
    for (const char* ch = str; *ch && at < sp + 0x3E0u; ++ch) {
      const unsigned char u = (unsigned char)*ch;
      if (u >= 'A' && u <= 'Z') { mem_write8(c, at++, 0x82); mem_write8(c, at++, (u8)(0x60 + u - 'A')); }
      else if (u >= 'a' && u <= 'z') { mem_write8(c, at++, 0x82); mem_write8(c, at++, (u8)(0x81 + u - 'a')); }
      else if (u == '%') { mem_write8(c, at++, '%'); mem_write8(c, at++, '%'); }
      else mem_write8(c, at++, u);
    }
    mem_write8(c, at, 0);
  }
  c->gpr[1] = sp;
  for (int i = 0; i < nints; ++i) c->gpr[3 + i] = ints[i] == 0xFFFFFFFEu ? str_addr : ints[i];
  for (int i = 0; i < nfloats; ++i) c->fpr[1 + i] = floats[i];
  if (nfloats) c->cr |= 1u << 25; else c->cr &= ~(1u << 25); // EABI: float args in registers (varargs)
  c->lr = SENTINEL; c->pc = fn;
  c->msr |= 0x2000u; // FP enabled: the OS switches FPU contexts lazily, and we restore every register
  const ModernGekkoModuleDesc* module = staticrecomp_get_module();
  u32 halt_lr = 0;
  for (int guard = 0; c->pc != SENTINEL; ++guard) {
    if (c->pc == 0x8034580Cu && !halt_lr) { // inside OSPanic after its report: the file is in r28
      char file[64]; for (int i = 0; i < 63; ++i) { file[i] = (char)mem_read8(c, c->gpr[28] + i); if (!file[i]) break; file[63] = 0; }
      std::fprintf(stderr, "[menu] the game panicked in %s during a menu call\n", file);
    }
    if (c->pc == 0x80335E94u && !halt_lr) halt_lr = c->lr;
    const int ok = module->dispatch(c, c->pc);
    if (!ok || c->exception || halt_lr || guard > 400000) {
      std::fprintf(stderr, "[menu] guest call 0x%08X failed at 0x%08X (dispatch %d exception %u halt from 0x%08X)\n", fn, c->pc, ok, c->exception, halt_lr);
      broken = true; break;
    }
  }
  u32 result = c->gpr[3];
  saved.downcount = c->downcount; saved.timebase = c->timebase;
  *c = saved;
  return result;
}
u32 call(CPUState* c, u32 fn, std::initializer_list<u32> ints, std::initializer_list<double> floats = {}, const char* str = nullptr) {
  return guest_call(c, fn, ints.begin(), (int)ints.size(), floats.begin(), (int)floats.size(), str);
}
constexpr u32 STR = 0xFFFFFFFEu; // placeholder: the guest address of `str`

void destroy_texts(CPUState* c) {
  for (int i = 0; i < text_count && !broken; ++i) call(c, FN_DESTROY, {texts[i]});
  text_count = 0; drawn = false;
}
// One text box per line, drawn twice: a black copy two pixels down and right,
// then the coloured text, so it reads over the roster. Positions are pixels of
// the 640x480 frame from the top-left; scale 0.6 is about 20 px tall.
void text_box(CPUState* c, const char* s, float x, float y, float scale, u32 rgba) {
  if (broken || text_count >= MAX_TEXTS || !s || !*s) return;
  u32 t = call(c, FN_TEXT, {0u, (u32)canvas});
  if (!t || broken) return;
  texts[text_count++] = t;
  union { float f; u32 u; } sx{scale * layout.scale}, px{x}, py{y}, bw{layout.boxW}, bh{layout.boxH};
  mem_write32(c, t + 0x0u, px.u); mem_write32(c, t + 0x4u, py.u);
  mem_write32(c, t + 0xCu, bw.u); mem_write32(c, t + 0x10u, bh.u);
  mem_write32(c, t + 0x24u, sx.u); mem_write32(c, t + 0x28u, sx.u);
  mem_write32(c, t + 0x30u, rgba);
  mem_write8(c, t + 0x49u, 1); // kerning
  mem_write8(c, t + 0x4Au, 0); // left aligned
  call(c, FN_SUBTEXT, {t, STR}, {0.0, 0.0}, s);
}
void line(CPUState* c, const char* s, float x, float y, float scale, u32 rgb) {
  if (!(layout.flags & 1)) text_box(c, s, x + 2, y + 2, scale, 0x000000D0u);
  text_box(c, s, x, y, scale, (rgb << 8) | 0xFFu);
}
void draw(CPUState* c) {
  destroy_texts(c);
  if (canvas < 0) canvas = (int)call(c, FN_CANVAS, {0u, 0u, 9u, 13u, 0u, 14u, 0u, 19u});
  if (broken) return;
  const u32 white = 0xFFFFFF, gold = 0xFFD84A, dim = 0xB8C4D6;
  const char* items[3]; int count;
  const char* title;
  if (phase == 0 && level == 0) { title = "OPENSMASH MELEE"; items[0] = "LOCAL VERSUS"; items[1] = "ONLINE"; count = 2; }
  else if (phase == 0) { title = "ONLINE"; items[0] = "FRIENDS"; items[1] = "CASUAL"; items[2] = "RANKED"; count = 3; }
  else { title = "ONLINE"; items[0] = phase == 6 ? "TRY AGAIN" : "WAITING"; items[1] = "BACK"; count = 2; }
  const float x = layout.x, top = layout.y, step = layout.step;
  line(c, title, x, top, 0.8f, white);
  float y = top + step + 8;
  if (phase != 0) { line(c, status_text, x, y, 0.5f, dim); y += step; }
  for (int i = 0; i < count; ++i, y += step) {
    const bool on = i == cursor, inert = phase != 0 && phase != 6 && i == 0;
    line(c, items[i], x + 22, y, on ? 0.64f : 0.6f, inert ? dim : on ? gold : white);
  }
  line(c, phase == 0 && level == 0 ? "A  SELECT" : "A  SELECT     B  BACK", x, y + 4, 0.42f, dim);
  drawn = true; dirty = false;
}
void sfx(CPUState* c, u32 id) { if (!broken) call(c, FN_SFX, {id}); }
void close(CPUState* c) {
  destroy_texts(c);
  menu_active = 0; menu_hold = 1; pending = false;
}
}

// Called from the runGameMode hook at every major scene transition.
extern "C" void melee_menu_major() {
  if (melee_rb_mode.load() || melee_session_mask.load()) return;
  pending = true;
}
// Called from gmVsMelee_EnterCss: the character select is about to initialize.
extern "C" void melee_menu_css() {
  if (!pending || melee_rb_mode.load() || melee_session_mask.load()) return;
  pending = false; drawn = false; dirty = true; canvas = -1; text_count = 0; frames = 0; wait = 0; previous = 0;
  if (phase == 0) { level = 0; cursor = 0; }
  menu_active = 1;
}
extern "C" void melee_menu_tick(void* state) {
  if (!menu_active.load() || broken) return;
  CPUState* c = static_cast<CPUState*>(state);
  ++frames;
  if (layout_revision.load() != layout_seen) { layout_seen = layout_revision.load(); dirty = true; }
  const int rev = js_revision.load();
  if (rev != revision) {
    const int was = phase;
    revision = rev; phase = js_phase.load(); cursor = 0; dirty = true;
    std::lock_guard lock(js_mutex); std::strncpy(status_text, js_text, sizeof status_text - 1);
    if (phase == 0 && was != 0) level = 1; // back from online: land on the online list
  }
  // Let the scene load its SIS font and settle before the first draw.
  if (frames < 24) return;
  if (!drawn || dirty) { draw(c); if (broken) { menu_active = 0; return; } }
  int buttons = 0; float y = 0;
  for (int i = 0; i < 4; ++i) { buttons |= pad_buttons[i].load(); const float v = pad_y[i].load(); if (std::abs(v) > std::abs(y)) y = v; }
  const int taps = buttons & ~previous; previous = buttons;
  if (wait > 0) { --wait; return; }
  const int count = phase == 0 ? (level == 0 ? 2 : 3) : 2;
  if (taps & 2) { // B
    if (phase == 0 && level == 1) { level = 0; cursor = 0; sfx(c, 0); dirty = true; wait = 12; }
    else if (phase != 0) { event(2, 0); wait = 15; }
    return;
  }
  const int dir = y > 0.5f || (taps & 64) ? -1 : y < -0.5f || (taps & 128) ? 1 : 0; // stick or D-pad up/down
  if (dir) {
    cursor = (cursor + dir + count) % count; sfx(c, 2); dirty = true; wait = 10;
    if (std::abs(y) > 0.5f) wait = 12;
    return;
  }
  if (taps & (1 | 32)) { // A or Start
    wait = 15;
    if (phase == 0 && level == 0) {
      if (cursor == 0) { sfx(c, 1); close(c); event(7, 0); }
      else { level = 1; cursor = 0; sfx(c, 1); dirty = true; }
    } else if (phase == 0) { sfx(c, 1); event(6, cursor == 0 ? 2 : cursor == 1 ? 0 : 1); } // friends, casual, ranked
    else if (cursor == 1) event(2, 0);
    else if (phase == 6) { sfx(c, 1); event(4, 0); }
  }
}

// Main thread: the browser's online status, mirrored into the native screen.
extern "C" EMSCRIPTEN_KEEPALIVE void melee_menu_status(int phase, const char* text) {
  { std::lock_guard lock(js_mutex); std::strncpy(js_text, text && *text ? text : "CONNECTING", sizeof js_text - 1); }
  js_phase = phase; js_revision.fetch_add(1);
}
extern "C" EMSCRIPTEN_KEEPALIVE int melee_menu_active() { return menu_active.load(); }
// Main thread, development only: reposition and rescale the native menu without a rebuild.
extern "C" EMSCRIPTEN_KEEPALIVE void melee_menu_layout(float scale, float x, float y, float step, float boxW, float boxH, int flags) {
  std::lock_guard lock(layout_mutex); layout = {scale, x, y, step, boxW, boxH, flags}; layout_revision.fetch_add(1);
}
// Main thread, from melee_input: while the overlay owns the pads the game sees neutral.
extern "C" int melee_menu_capture(int seat, int buttons, float x, float y) {
  if (menu_hold.load()) { if (buttons == 0) menu_hold = 0; else return 1; }
  if (!menu_active.load()) return 0;
  pad_buttons[seat] = buttons; pad_x[seat] = x; pad_y[seat] = y;
  return 1;
}
