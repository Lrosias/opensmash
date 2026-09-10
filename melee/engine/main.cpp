// SPDX-License-Identifier: GPL-3.0-or-later
#include <cstdio>
#include <emscripten.h>
#include <atomic>
#include <algorithm>
#include "moderngekko/runtime.hpp"
#include "Common/FileUtil.h"
#include "Core/Config/MainSettings.h"
#include "Core/Config/StaticRecompSettings.h"
#include "Core/Config/GraphicsSettings.h"
#include "Core/HW/SI/SI_Device.h"
#include "InputCommon/ControllerEmu/ControllerEmu.h"
#include "InputCommon/ControllerInterface/Touch/InputOverrider.h"
#include "VideoCommon/VideoConfig.h"
#include "GLContextWeb.h"
#include "WebSound.h"
#include "Core/System.h"
#include "Core/State.h"
#include "MeleeRollback.h"
#include "VideoCommon/PerformanceMetrics.h"
#include "VideoCommon/GXPipelineTypes.h"

extern "C" const ModernGekkoModuleDesc* staticrecomp_get_module();
void MountGameAssets(const std::string& base_url);
static std::atomic<unsigned> shader_count{0};
static std::atomic<double> shader_millis{0}, shader_max{0};
extern "C" void melee_shader_timing(double milliseconds) {
  shader_count++;
  shader_millis.store(shader_millis.load() + milliseconds);
  shader_max.store(std::max(shader_max.load(), milliseconds));
}
extern "C" EMSCRIPTEN_KEEPALIVE unsigned melee_shader_count() { return shader_count.load(); }
extern "C" EMSCRIPTEN_KEEPALIVE double melee_shader_millis() { return shader_millis.load(); }
extern "C" EMSCRIPTEN_KEEPALIVE double melee_shader_max() { return shader_max.load(); }

extern "C" EMSCRIPTEN_KEEPALIVE unsigned melee_shader_cache_format() {
  static_assert(sizeof(VideoCommon::SerializedGXPipelineUid) < 65536);
  return (VideoCommon::GX_PIPELINE_UID_VERSION << 16) |
         sizeof(VideoCommon::SerializedGXPipelineUid);
}

static std::atomic<bool> input_ready{false};
static std::atomic<int> lite_effects{1};
extern "C" EMSCRIPTEN_KEEPALIVE int melee_lite_effects() { return lite_effects.load(std::memory_order_relaxed); }
extern "C" EMSCRIPTEN_KEEPALIVE void melee_set_lite_effects(int enabled) { lite_effects.store(enabled != 0, std::memory_order_relaxed); }

// Let the worker process frame acknowledgements without setTimeout's nested
// timer clamp adding roughly 4 ms to every emulated frame.
EM_ASYNC_JS(void, melee_yield_frame, (), {
  if (!Module.meleeYieldChannel) {
    Module.meleeYieldChannel = new MessageChannel();
    Module.meleeYieldChannel.port1.onmessage = () => {
      const resolve = Module.meleeYieldResolve;
      Module.meleeYieldResolve = null;
      resolve();
    };
  }
  await new Promise(resolve => {
    Module.meleeYieldResolve = resolve;
    Module.meleeYieldChannel.port2.postMessage(0);
  });
});

extern "C" EMSCRIPTEN_KEEPALIVE void melee_input(int seat, int buttons, float x, float y,
                                                float cx, float cy, float l, float r) {
  if (seat < 0 || seat > 3 || !input_ready.load()) return;
  auto lock = ControllerEmu::EmulatedController::GetStateLock();
  for (int i = 0; i < 12; ++i)
    ciface::Touch::SetControlState(seat, static_cast<ciface::Touch::ControlID>(i), (buttons >> i) & 1);
  const float axes[] = {l, r, x, y, cx, cy};
  for (int i = 0; i < 6; ++i)
    // Dolphin maps stick override units around byte 128 with radius 127.
    // Permit -128/127 so a raw adapter byte of zero survives the round trip.
    ciface::Touch::SetControlState(seat, static_cast<ciface::Touch::ControlID>(12 + i),
                                  std::clamp(axes[i], i >= 2 ? -128.f / 127.f : 0.f, 1.f));
}
extern "C" EMSCRIPTEN_KEEPALIVE int melee_stats() { return web_present_count.load(); }
extern "C" EMSCRIPTEN_KEEPALIVE WebAudioRing* melee_audio_ring() { return &web_audio; }
extern "C" EMSCRIPTEN_KEEPALIVE void melee_frame_ack() { web_frames_in_flight.fetch_sub(1); }
extern "C" EMSCRIPTEN_KEEPALIVE double melee_speed() { return Core::System::GetInstance().GetPerfMetrics().GetSpeed(); }
extern "C" EMSCRIPTEN_KEEPALIVE double melee_vps() { return Core::System::GetInstance().GetPerfMetrics().GetVPS(); }
extern "C" float melee_efb_scale() { return web_lite_resolution ? 0.5f : 1.f; }

// Diagnostic checkpoints exercise the engine's own state format. Online
// rollback still needs deterministic frame stepping and a bounded state ring.
extern "C" EMSCRIPTEN_KEEPALIVE void melee_save_state() { State::SaveAs(Core::System::GetInstance(), "/checkpoint.sav"); }
extern "C" EMSCRIPTEN_KEEPALIVE void melee_load_state() { State::LoadAs(Core::System::GetInstance(), "/checkpoint.sav"); }

int main(int argc, char** argv) {
  for (int i = 2; i < argc; ++i)
    if (std::string_view(argv[i]) == "rollback") melee_rb_mode = true;
  for (int i = 2; i < argc; ++i)
    if (std::string_view(argv[i]) == "rollback-boot") { melee_rb_mode = true; melee_rb_enabled = true; }
  for (int i = 2; i < argc; ++i)
    if (std::string_view(argv[i]) == "native-resolution") web_lite_resolution = false;
    else if (std::string_view(argv[i]) == "full-effects") lite_effects.store(0);
  setenv("MODERNGEKKO_STATICRECOMP", "1", 1);
  setenv("MELEE_RENDER_FPS", "60", 1);
  setenv("MELEE_STRICT_NATIVE", "1", 1);
  setenv("MELEE_APP_BUNDLE", "1", 1);
  if (melee_rb_mode) setenv("MELEE_LOW_LATENCY", "0", 1);
  std::puts("OpenSmash Melee: initializing statically recompiled GALE01 revision 2.");
  if (argc > 2 && std::string_view(argv[2]) == "profile")
    setenv("STATICRECOMP_TRACE_FILE", "/dispatch.csv", 1);
  MountGameAssets(argc > 1 ? argv[1] : "./assets/");
  moderngekko::RuntimeConfig config;
  config.game_root = "/game";
  config.user_directory = "/user";
  config.module = moderngekko::ModuleSource::AttachedDescriptor(staticrecomp_get_module());
  config.hash_assets = false;
  config.graphics.backend = "OGL";
  config.audio.backend = "WebAudio";
  config.graphics.internal_resolution_scale = 1;
  config.input.background_input = true;
  config.window_title = "OpenSmash Melee";
  auto created = moderngekko::Runtime::Create(std::move(config));
  if (!created) { std::fprintf(stderr, "Melee initialization failed: %s\n", created.error->message.c_str()); return 1; }
  Config::SetBase(Config::MAIN_STATICRECOMP_IDLE_PC, 0x8034B164u);
  Config::SetBase(Config::MAIN_FAST_DISC_SPEED, true);
  Config::SetBase(Config::MAIN_CPU_THREAD, !melee_rb_mode.load());
  if (melee_rb_mode) {
    Config::SetBase(Config::MAIN_DSP_THREAD, false);
    Config::SetBase(Config::MAIN_CUSTOM_RTC_ENABLE, true);
    Config::SetBase(Config::MAIN_CUSTOM_RTC_VALUE, 946684800u);
    // The host frame controller owns pacing. Simulation always advances by
    // the same emulated cycles, including while replaying old input.
    Config::SetBase(Config::MAIN_EMULATION_SPEED, 1.0f);
  }
  Config::SetBase(Config::MAIN_SKIP_IPL, true);
  Config::SetBase(Config::GFX_SHADER_COMPILATION_MODE, ShaderCompilationMode::Synchronous);
  Config::SetBase(Config::GFX_SHADER_COMPILER_THREADS, 0);
  Config::SetBase(Config::GFX_WAIT_FOR_SHADERS_BEFORE_STARTING, false);
  for (int seat = 0; seat < 4; ++seat) {
    Config::SetBase(Config::GetInfoForSIDevice(seat), SerialInterface::SIDEVICE_GC_CONTROLLER);
    ciface::Touch::RegisterGameCubeInputOverrider(seat);
  }
  input_ready = true;
  auto result = created.runtime->Run();
  input_ready = false;
  if (result.error) { std::fprintf(stderr, "Melee boot failed: %s\n", result.error->message.c_str()); return 1; }
  return 0;
}
