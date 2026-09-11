// SPDX-License-Identifier: GPL-3.0-or-later
#include "MeleeRollback.h"
#include <algorithm>
#include <array>
#include <chrono>
#include <cstring>
#include <map>
#include <memory>
#include <vector>
#include <emscripten.h>
#include <wasm_simd128.h>
#include <emscripten/threading.h>
#include "Common/Buffer.h"
#include "Common/Hash.h"
#include "Core/Core.h"
#include "Core/State.h"
#include "Core/System.h"
#include "Core/HW/Memmap.h"
#include "Core/Config/MainSettings.h"

extern "C" void melee_input(int,int,float,float,float,float,float,float);

namespace {
__attribute__((target("simd128"))) bool equal_simd(const u8* a, const u8* b, size_t n) {
  size_t i=0;
  for (; i+64<=n; i+=64) {
    auto x=wasm_v128_xor(wasm_v128_load(a+i),wasm_v128_load(b+i));
    x=wasm_v128_or(x,wasm_v128_xor(wasm_v128_load(a+i+16),wasm_v128_load(b+i+16)));
    x=wasm_v128_or(x,wasm_v128_xor(wasm_v128_load(a+i+32),wasm_v128_load(b+i+32)));
    x=wasm_v128_or(x,wasm_v128_xor(wasm_v128_load(a+i+48),wasm_v128_load(b+i+48)));
    if(wasm_v128_any_true(x))return false;
  }
  for (; i<n; ++i)if(a[i]!=b[i])return false;
  return true;
}
constexpr size_t PAGE = 16384;
constexpr size_t HISTORY = 16;
using Page = std::array<u8, PAGE>;
struct Snapshot { int frame; size_t size; std::vector<std::shared_ptr<Page>> pages; };
std::map<int, Snapshot> history;
Common::UniqueBuffer<u8> scratch;
std::atomic<int> request{0}, command{0}, argument{0}, replay{0};
std::atomic<bool> waiting{false};
bool field_pending = false, entered = false, managed_history = false;
std::atomic<bool> match_configured{false}, match_entered{false};
std::array<int, 13> match_config{};
bool match_menu_started = false;
int menu_field = 0;

void advance_match_boot() {
  if (!match_menu_started) return;
  // Version-checked GALE01r2 menu route from rollback-match-setup.json. Advance
  // from a native VI counter, never wall-clock delays or browser input events.
  int f = menu_field++ - 60, buttons0 = 0, buttons1 = 0;
  float x = 0, y = 0;
  if (f >= 0 && f < 4) buttons0 = buttons1 = 1;
  else if (f >= 8 && f < 32) y = 0.63f;
  else if (f >= 32 && f < 42) x = 0.63f;
  else if (f >= 42 && f < 46) buttons0 = buttons1 = 1;
  else if (f >= 52 && f < 56) buttons0 = 32;
  else if (f >= 106 && f < 124) y = 0.63f;
  else if (f >= 127 && f < 131) buttons0 = 1;
  if (match_entered.load()) { buttons0 = buttons1 = 0; x = y = 0; }
  melee_input(0,buttons0,x,y,0,0,0,0);
  melee_input(1,buttons1,f < 56 ? x : 0,f < 56 ? y : 0,0,0,0,0);
}

struct MatchStatus { int active, outcome, stocks0, stocks1, percent0, percent1, seconds, game_frame, fighter0, fighter1, stage, stocks2, stocks3, percent2, percent3, fighter2, fighter3, mask; };
MatchStatus match_status() {
  if (!match_entered.load()) return {};
  auto& mem = Core::System::GetInstance().GetMemory();
  // Verified GALE01r2 VsSceneController and StaticPlayer fields (doldecomp).
  constexpr u32 controller = 0x8046b6a0, player = 0x80453080, stride = 0xe90;
  const int game_frame = mem.Read_U32(controller + 0x24);
  return {game_frame > 0, mem.Read_U8(controller + 8),
    static_cast<s8>(mem.Read_U8(player + 0x8e)), static_cast<s8>(mem.Read_U8(player + stride + 0x8e)),
    mem.Read_U16(player + 0x60), mem.Read_U16(player + stride + 0x60),
    static_cast<int>(mem.Read_U32(controller + 0x28)), game_frame,
    static_cast<int>(mem.Read_U32(player + 4)), static_cast<int>(mem.Read_U32(player + stride + 4)),
    mem.Read_U16(controller + 0x24c8 + 0xe),
    static_cast<s8>(mem.Read_U8(player + stride * 2 + 0x8e)), static_cast<s8>(mem.Read_U8(player + stride * 3 + 0x8e)),
    mem.Read_U16(player + stride * 2 + 0x60), mem.Read_U16(player + stride * 3 + 0x60),
    static_cast<int>(mem.Read_U32(player + stride * 2 + 4)), static_cast<int>(mem.Read_U32(player + stride * 3 + 4)), match_config[12]};
}
int frame = 0, next_handle = 0, step_sequence = 0;
double step_start = 0;

// Development diagnostic covers all emulated main RAM. It is separate from the
// checkpoint's local handle, and is not advertised as an anti-cheat checksum.
u32 ram_hash() {
  auto& mem = Core::System::GetInstance().GetMemory();
  const u8* bytes = mem.GetRAM();
  return Common::ComputeCRC32(bytes, mem.GetRamSizeReal());
}
void reply(int seq, int status, int handle, size_t bytes, double ms, bool hash = true) {
  const u32 digest = hash ? ram_hash() : 0;
  const auto match = match_status();
  // EM_ASM supports at most 16 scalar arguments. Copy the status from this
  // stack frame before posting so all four ports keep the same callback ABI.
  static_assert(sizeof(MatchStatus) == 18 * sizeof(int));
  EM_ASM({
    var i = $7 >>> 2;
    var args = new Array($0,$1,$2,$3,$4,$5,$6);
    for (var f = 0; f < 8; f++) args.push(HEAP32[i + f]);
    args.push((HEAP32[i + 8] & 255) | ((HEAP32[i + 9] & 255) << 8) | (HEAP32[i + 10] << 16));
    for (var f = 11; f < 18; f++) args.push(HEAP32[i + f]);
    postMessage({cmd:9,handler:'onMeleeRollback',args:args});
  }, seq, status, frame, handle, digest, bytes, ms, &match);
}
int capture() {
  if (managed_history && history.size() >= HISTORY) return 0;
  size_t size;
  {
    std::lock_guard lock(melee_rb_audio_mutex);
    size = State::CaptureRollback(Core::System::GetInstance(), scratch);
  }
  if (!size) return 0;
  Snapshot snapshot{frame, size, {}};
  const Snapshot* previous = history.empty() ? nullptr : &history.rbegin()->second;
  for (size_t offset = 0, index = 0; offset < size; offset += PAGE, ++index) {
    const size_t length = std::min(PAGE, size - offset);
    if (previous && index < previous->pages.size() && previous->size >= offset + length &&
        equal_simd(previous->pages[index]->data(), scratch.data() + offset, length)) {
      snapshot.pages.push_back(previous->pages[index]);
    } else {
      auto page = std::make_shared<Page>();
      std::memcpy(page->data(), scratch.data() + offset, length);
      snapshot.pages.push_back(std::move(page));
    }
  }
  const int handle = ++next_handle;
  // Managed SDK tokens remain valid until explicit release; legacy diagnostics
  // retain their bounded ring behavior.
  for (auto it = history.begin(); it != history.end();) {
    if (!managed_history && it->second.frame == frame) it = history.erase(it); else ++it;
  }
  history.emplace(handle, std::move(snapshot));
  while (!managed_history && history.size() > HISTORY) history.erase(history.begin());
  return handle;
}
bool restore(int handle) {
  const auto it = history.find(handle);
  if (it == history.end()) return false;
  const auto& snapshot = it->second;
  if (scratch.size() < snapshot.size) scratch.reset(snapshot.size);
  for (size_t offset = 0, index = 0; offset < snapshot.size; offset += PAGE, ++index)
    std::memcpy(scratch.data() + offset, snapshot.pages[index]->data(), std::min(PAGE, snapshot.size - offset));
  {
    std::lock_guard lock(melee_rb_audio_mutex);
    if (!State::RestoreRollback(Core::System::GetInstance(), {scratch.data(), snapshot.size})) return false;
  }
  frame = snapshot.frame;
  if (!managed_history) history.erase(history.upper_bound(handle), history.end());
  return true;
}
}

// Called before main. Each occupied participant keeps its actual controller port.
extern "C" EMSCRIPTEN_KEEPALIVE int melee_match_configure_slots(unsigned seed, int stage, int mask,
    int f0, int c0, int f1, int c1, int f2, int c2, int f3, int c3) {
  if (match_configured.load() || entered || mask < 1 || mask > 15 || __builtin_popcount(static_cast<unsigned>(mask)) < 2 ||
      (stage != 2 && stage != 3 && stage != 8 && stage != 28 && stage != 31 && stage != 32)) return 0;
  const int fighters[] = {f0,f1,f2,f3}, colors[] = {c0,c1,c2,c3};
  for (int i=0;i<4;i++) if ((mask & (1<<i)) &&
      (fighters[i]<0 || fighters[i]>25 || colors[i]<0 || colors[i]>3)) return 0;
  match_config = {static_cast<int>(seed), stage, f0, c0, f1, c1, 1, 0, f2, c2, f3, c3, mask};
  melee_rb_mode = true;
  match_configured.store(true, std::memory_order_release);
  return 1;
}
// Preserve the existing two-player ABI for diagnostics and previously authored adapters.
extern "C" EMSCRIPTEN_KEEPALIVE int melee_match_configure(unsigned seed, int stage, int f0, int c0, int f1, int c1) {
  return melee_match_configure_slots(seed,stage,3,f0,c0,f1,c1,0,0,0,0);
}
extern "C" int melee_match_option(int option) {
  if (!match_configured.load(std::memory_order_acquire)) return -1;
  if (option == 7) return match_menu_started ? 1 : 0;
  return option >= 0 && option < 13 ? match_config[option] : -1;
}
extern "C" void melee_match_menu() { if (match_configured.load()) { match_menu_started = true; menu_field = 0; } }
extern "C" void melee_match_enter() { match_entered = true; EM_ASM({console.log("Melee competitive match configured");}); }

extern "C" EMSCRIPTEN_KEEPALIVE int melee_rb_enable() {
  if (!melee_rb_mode.load() || melee_rb_enabled.exchange(true)) return 0;
  return 1;
}
extern "C" EMSCRIPTEN_KEEPALIVE int melee_rb_command(int seq, int op, int arg, int replaying) {
  if (seq <= 0 || op < 1 || op > 8 || !waiting.load(std::memory_order_acquire) || request.load()) return 0;
  command = op; argument = arg; replay = replaying;
  request.store(seq, std::memory_order_release);
  emscripten_futex_wake(&request, 1);
  return 1;
}
extern "C" void melee_rb_field() { field_pending = true; }

// Called after CoreTiming::Advance returns, never inside a timing event or a
// generated PPC block. PPC state is authoritative here. Single-core video mode
// ensures no GPU worker can mutate the snapshot concurrently.
extern "C" void melee_rb_after_timing() {
  if (!field_pending) return;
  field_pending = false;
  if (!melee_rb_enabled.load()) return;
  if (!entered && match_configured.load() && !match_status().active) {
    advance_match_boot();
    return;
  }
  if (!entered) {
    Config::SetCurrent(Config::MAIN_EMULATION_SPEED, 0.0f);
    entered = true; frame = 0; history.clear(); managed_history = match_configured.load();
    waiting.store(true, std::memory_order_release);
    reply(0, 1, 0, 0, 0);
  } else if (step_sequence) {
    ++frame;
    waiting.store(true, std::memory_order_release);
    reply(step_sequence, 1, 0, 0, emscripten_get_now() - step_start);
    step_sequence = 0;
  }
  while (melee_rb_enabled.load()) {
    const int seq = request.load(std::memory_order_acquire);
    if (!seq) { emscripten_futex_wait(&request, 0, 1000); continue; }
    waiting.store(false, std::memory_order_release);
    const int op = command.load(), arg = argument.load();
    request = 0;
    const double start = emscripten_get_now();
    int status = 1, handle = 0; size_t bytes = 0;
    if (op == 1) { handle = capture(); status = handle ? 1 : -1; if (handle) bytes = history.at(handle).size; }
    if (op == 2) { melee_rb_replaying = true; status = restore(arg) ? 1 : -2; }
    if (op == 3) {
      melee_rb_replaying = replay.load() != 0;
      step_sequence = seq; step_start = start;
      return;
    }
    if (op == 6) history.erase(arg);
    if (op == 7) { handle = history.size(); bytes = scratch.size(); }
    if (op == 8) { if (!history.empty()) status = -3; else managed_history = true; }
    if (op == 4) { melee_rb_enabled = false; melee_rb_replaying = false; entered = false; history.clear(); scratch.clear(); Config::SetCurrent(Config::MAIN_EMULATION_SPEED, 1.0f); }
    waiting.store(op != 4, std::memory_order_release);
    reply(seq, status, handle, bytes, emscripten_get_now() - start, op < 6);
    if (status < 0) {
      // A failed restore may have partly modified engine state. Stay paused;
      // the host must discard this engine instead of resuming a corrupt match.
      waiting = false;
      for (;;) emscripten_futex_wait(&request, 0, 1000);
    }
  }
}
