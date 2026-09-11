// SPDX-License-Identifier: GPL-3.0-or-later
#pragma once
#include <atomic>
#include <mutex>

// Host control is deliberately outside serialized emulation state.
inline std::atomic<bool> melee_rb_mode{false};
inline std::atomic<bool> melee_rb_enabled{false};
inline std::atomic<bool> melee_rb_replaying{false};
// Mixer serialization updates fields read by the browser audio producer.
inline std::mutex melee_rb_audio_mutex;
extern "C" void melee_rb_field();
extern "C" void melee_rb_after_timing();
