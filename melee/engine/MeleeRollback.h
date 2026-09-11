// SPDX-License-Identifier: GPL-3.0-or-later
#pragma once
#include <atomic>
#include <mutex>

// Host control is deliberately outside serialized emulation state.
inline std::atomic<bool> melee_rb_mode{false};
// Immutable session ports are configured before main; zero preserves legacy mode.
inline std::atomic<unsigned> melee_session_mask{0};
inline std::atomic<bool> melee_main_started{false};
inline std::atomic<bool> melee_rb_enabled{false};
inline std::atomic<bool> melee_rb_replaying{false};
// Mixer serialization updates fields read by the browser audio producer.
inline std::mutex melee_rb_audio_mutex;
extern "C" void melee_rb_field();
extern "C" void melee_rb_after_timing();
