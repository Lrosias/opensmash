#pragma once
#include "AudioCommon/SoundStream.h"
#include "MeleeRollback.h"
#include <array>
#include <atomic>
#include <chrono>
#include <thread>

// Single producer / single consumer, signed 16-bit stereo at 48 kHz.
// JS AudioWorklet consumes shared memory without sending a message per block.
struct WebAudioRing {
  std::atomic<unsigned> write{0}, read{0}, underruns{0};
  unsigned capacity = 8192;
  std::array<s16, 8192 * 2> samples{};
};
inline WebAudioRing web_audio;
class WebSound final : public SoundStream {
  std::atomic<bool> running{false};
  std::atomic<int> volume{100};
  std::jthread producer;
public:
  bool Init() override {
    producer = std::jthread([this](std::stop_token stop) {
      std::array<s16, 512 * 2> block;
      while (!stop.stop_requested()) {
        unsigned write = web_audio.write.load(std::memory_order_relaxed);
        unsigned read = web_audio.read.load(std::memory_order_acquire);
        if (!running || write - read >= 2048) {
          std::this_thread::sleep_for(std::chrono::milliseconds(2));
          continue;
        }
        {
          std::lock_guard lock(melee_rb_audio_mutex);
          m_mixer->Mix(block.data(), 512);
        }
        int gain = volume.load();
        for (unsigned i = 0; i < 512; ++i)
          for (unsigned channel = 0; channel < 2; ++channel)
            web_audio.samples[((write + i) % 8192) * 2 + channel] = block[i * 2 + channel] * gain / 100;
        web_audio.write.store(write + 512, std::memory_order_release);
      }
    });
    return true;
  }
  bool SetRunning(bool value) override { running = value; return true; }
  void SetVolume(int value) override { volume = value; }
};
