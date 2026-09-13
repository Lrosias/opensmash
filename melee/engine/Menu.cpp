// SPDX-License-Identifier: GPL-3.0-or-later
// Melee Mode Select integration: LOCAL / ONLINE -> FRIENDS / CASUAL.
// The original scene owns its panels, cursor, input and animations; SIS supplies
// the new option names and online status.
//
// The menu runs on the CPU thread from mnMain's original scene callbacks and
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
std::atomic<int> menu_active{0};
std::atomic<int> js_phase{0}, js_revision{0};
std::mutex js_mutex; char js_text[64] = "CONNECTING";

// CPU-thread state.
bool drawn = false, dirty = false, broken = false, canvas_valid = false;
int level = 0, cursor = 0, frames = 0, phase = 0, revision = 0, canvas = -1;
u32 texts[MAX_TEXTS]; int text_count = 0; char status_text[64] = "CONNECTING";
// Layout (screen pixels of the 640x480 frame); tunable from the page while developing.
struct Layout { float scale = 1.0f, x = 112, y = 195, step = 72, boxW = 400, boxH = 40; int flags = 0; };
Layout layout, layout_shared; std::mutex layout_mutex; std::atomic<int> layout_revision{0}; int layout_seen = 0;

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
      else if (u >= 0x80) { if (at == str_addr || mem_read8(c, at - 1) != ' ') mem_write8(c, at++, ' '); } // no Shift-JIS lead bytes from UTF-8
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
// Native SIS headings and help use a small shadow. Positions are pixels of
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

constexpr u32 FLOW = 0x804A04F0u;
void draw(CPUState* c) {
  destroy_texts(c);
  if (!canvas_valid) { canvas = (int)call(c, FN_CANVAS, {0u, 0u, 9u, 13u, 0u, 14u, 0u, 19u}); canvas_valid = !broken; }
  if (broken) return;
  const char* a = level == 0 ? "LOCAL" : "FRIENDS";
  const char* b = level == 0 ? "ONLINE" : "CASUAL";
  if (phase) { a = phase == 6 ? "TRY AGAIN" : "WAITING"; b = "BACK"; }
  text_box(c, a, layout.x, layout.y, .68f, cursor == 0 ? 0x202030FFu : 0xFFFFFFFFu);
  text_box(c, b, layout.x, layout.y + layout.step, .68f, cursor == 1 ? 0x202030FFu : 0xFFFFFFFFu);
  if (level) line(c, "ONLINE", 116, 49, .7f, 0xFFFFFF);
  const char* help = phase ? status_text : level ? (cursor ? "FIND A CASUAL MATCH" : "PLAY WITH FRIENDS") : (cursor ? "FRIENDS AND CASUAL" : "LOCAL VERSUS  1 TO 4 PLAYERS");
  line(c, help, 156, 414, .42f, 0xFFFFFF);
  drawn = true; dirty = false;
}
void sfx(CPUState* c, u32 id) { if (!broken) call(c, FN_SFX, {id}); }
void change(CPUState* c, int next) {
  destroy_texts(c);
  mem_write8(c, FLOW + 0x11, next != 0);
  level = next; cursor = 0; dirty = true;
  call(c, 0x80229894u, {(u32)next, 0u, next ? 1u : 3u});
}
}

extern "C" int melee_menu_boot_mode(int requested) {
  if (melee_rb_mode.load() || melee_session_mask.load()) return 2;
  return requested == 2 ? 2 : 1;
}
extern "C" unsigned melee_menu_sis_pool(unsigned size) {
  return size < 0x4800u ? 0x4800u : size;
}
extern "C" void melee_menu_major() {
  // Scene heap reset invalidates every SIS handle.
  text_count = 0; canvas_valid = false; drawn = false; menu_active = 0;
}
extern "C" void melee_menu_css() { menu_active = 0; }
extern "C" void melee_menu_tick(void*) {}
extern "C" void melee_menu_enter(void* state) {
  CPUState* c = static_cast<CPUState*>(state);
  const u32 data = c->gpr[3];
  const u8 requested = mem_read8(c, data);
  // VS rules, items, stage switches and name entry keep their native flows.
  // Online session engines also keep all their synchronized native subscenes.
  if (melee_rb_mode.load() || melee_session_mask.load() || (requested >= 12 && requested <= 18)) {
    menu_active = 0;
    return;
  }
  // The native Mode Select and former 1P submenu become Local/Online and
  // Friends/Casual. Keep the original panel, cursor, transitions and sound.
  for (u32 kind = 0; kind < 2; ++kind) {
    mem_write8(c, 0x803EB6B0u + kind * 20u + 12u, 2);
  }
  level = phase ? 1 : 0; cursor = 0;
  mem_write8(c, data, level); mem_write8(c, data + 1, 0);
  text_count = 0; canvas_valid = false; drawn = false; dirty = true;
  frames = 0; menu_active = 1;
}
extern "C" void melee_menu_think(void* state) {
  CPUState* c = static_cast<CPUState*>(state);
  const int rev = js_revision.load();
  if (rev != revision) {
    const int was = phase;
    revision = rev; phase = js_phase.load(); dirty = true;
    { std::lock_guard lock(js_mutex); std::strncpy(status_text, js_text, sizeof status_text - 1); }
    if (phase == 0 && was != 0) {
      if (level != 1) { change(c, 1); return; }
      cursor = 0; mem_write16(c, FLOW + 2, 0);
    }
  }
  if (layout_revision.load() != layout_seen) { layout_seen = layout_revision.load(); std::lock_guard lock(layout_mutex); layout = layout_shared; dirty = true; }
  ++frames;
  const u32 buttons = call(c, 0x80229624u, {4u}); // game's repeat, cooldown and all four ports
  if (buttons & 0x20u) {
    if (phase) event(2, 0);
    else if (level) { sfx(c, 0); change(c, 0); return; }
  } else if (buttons & 0x10u) {
    if (phase) {
      if (cursor == 1) event(2, 0);
      else if (phase == 6) { sfx(c, 1); event(4, 0); }
    } else if (level) { sfx(c, 1); event(6, cursor == 0 ? 2 : 0); }
    else if (cursor == 1) { sfx(c, 1); change(c, 1); return; }
    else {
      sfx(c, 1); destroy_texts(c); menu_active = 0;
      call(c, 0x80229860u, {2u}); // native scene exit to VS
      return;
    }
  } else if (buttons & 3u) {
    cursor ^= 1; mem_write16(c, FLOW + 2, cursor); sfx(c, 2); dirty = true;
  }
  if (frames > 24 && (!drawn || dirty)) draw(c);
}


// JObj IDs are preorder indices, as in lb_80011E24. Traverse on the host so
// label lookup never borrows the interrupted game's stack as scratch memory.
namespace {
bool joint_pointer(u32 p) { return p >= 0x80000000u && p < 0x81800000u && !(p & 3); }
u32 joint_at(CPUState* c, u32 root, int& index, int depth = 0) {
  if (!joint_pointer(root) || depth > 64) return 0;
  if (index-- == 0) return root;
  u32 child = mem_read32(c, root + 0x10u);
  for (int guard = 0; joint_pointer(child) && guard < 128; ++guard) {
    u32 found = joint_at(c, child, index, depth + 1);
    if (found) return found;
    child = mem_read32(c, child + 8u);
  }
  return 0;
}
void hide_joint(CPUState* c, u32 joint) {
  if (joint_pointer(joint)) mem_write32(c, joint + 0x14u, mem_read32(c, joint + 0x14u) | 0x10u);
}

}
extern "C" void melee_menu_labels(void* state) {
  CPUState* c = static_cast<CPUState*>(state);
  const u32 data = mem_read32(c, c->gpr[3] + 0x2Cu);
  if (mem_read8(c, data) > 1) return;
  for (u32 i = 0; i < 2; ++i) {
    const u32 parent = mem_read32(c, data + 4u + (4u + i) * 4u);
    if (!joint_pointer(parent)) continue;
    int index = 3;
    hide_joint(c, joint_at(c, mem_read32(c, parent + 0x10u), index));
  }
}
extern "C" int melee_menu_preview(void* state) {
  CPUState* c = static_cast<CPUState*>(state);
  const u32 data = mem_read32(c, c->gpr[3] + 0x2Cu);
  if (mem_read8(c, data) > 1) return 0;
  hide_joint(c, mem_read32(c, data + 4u + 14u * 4u));
  return 1;
}

extern "C" int melee_menu_update(void* state) {
  static bool updating = false;
  if (updating) return 0;
  CPUState* c = static_cast<CPUState*>(state);
  const u32 gobj = c->gpr[3];
  updating = true;
  call(c, 0x8022AFECu, {gobj});
  updating = false;
  const u32 data = mem_read32(c, gobj + 0x2Cu);
  if (mem_read8(c, data) <= 1) {
    const u32 text = mem_read32(c, data + 0xACu);
    if (text) mem_write8(c, text + 0x4Du, 1);
  }
  return 1;
}
extern "C" int melee_menu_panel(void* state) {
  static bool updating = false;
  if (updating) return 0;
  CPUState* c = static_cast<CPUState*>(state);
  const u32 gobj = c->gpr[3];
  updating = true;
  call(c, 0x80229BF4u, {gobj});
  updating = false;
  // MenMainPanel_Top joint 84 is the baked-in 1-P Mode heading. Keep the
  // frame (joint 43), help box and all native panel animation intact.
  if (level) {
    int index = 84;
    hide_joint(c, joint_at(c, mem_read32(c, gobj + 0x28u), index));
  }
  return 1;
}
extern "C" EMSCRIPTEN_KEEPALIVE void melee_menu_status(int phase, const char* text) {
  { std::lock_guard lock(js_mutex); std::strncpy(js_text, text && *text ? text : "CONNECTING", sizeof js_text - 1); }
  js_phase = phase; js_revision.fetch_add(1);
}
extern "C" EMSCRIPTEN_KEEPALIVE int melee_menu_active() { return broken ? -1 : menu_active.load(); }
extern "C" EMSCRIPTEN_KEEPALIVE void melee_menu_layout(float scale, float x, float y, float step, float boxW, float boxH, int flags) {
  std::lock_guard lock(layout_mutex); layout_shared = {scale, x, y, step, boxW, boxH, flags}; layout_revision.fetch_add(1);
}
// Input belongs to Melee's actual menu scene, including its native repeat logic.
extern "C" int melee_menu_capture(int, int, float, float) { return 0; }
