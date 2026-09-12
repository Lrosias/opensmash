# Local engine suspension during online sessions

The local menu engine remains resident, but an online engine cannot boot until
the local engine acknowledges its native pause. `melee_local_pause` queues
`Core::SetState` on the runtime host worker. The pinned core waits for CPU
idleness and pauses FIFO processing and the sound stream. Browser callbacks
remain available while the CPU drains outstanding foreground asset reads.

The wrapper also suspends the local AudioContext, drains/aborts speculative
asset preparation, stops local input and metrics/cache polling, and discards
any final in-flight bitmaps while still acknowledging them. User gestures wake
only the online audio while the local engine is suspended. Leaving, failed
online startup, cancellation, and connection closure release the pause; local
frames and the existing prefetch preference resume. Overlapping session boots
share the pause until the final owner releases it. The native menu remains
active during matchmaking until a second engine actually needs to boot.

The loader's suspension does not cancel foreground reads: native pause could
otherwise deadlock while the CPU waits for one. An already running background
decompression is drained, and its cancellation is checked before Wasm allocation
and copying. Existing committed data and both engines' memory remain resident.

## Validation on Windows

- 36 Node tests pass across `local-engine-pause.test.mjs`,
  `asset-loader.test.mjs`, `native-room-session.test.mjs`, and
  `native-session.test.mjs`, with `YOUGAME_SDK_PATH` pointing to the local
  YouGame SDK.
- `native-room-app-browser.mjs` passes seven installed-Chrome scenarios:
  casual, friends, invite during boot, matchmaking cancellation, ranked exit,
  native boot failure, and connection closure. It executes the real wrapper,
  asset loader, iframe bridge, AudioContext and SDK input, with simulated
  native engines and transport. Local fixture frames stop online, audio stays
  suspended after keyboard input, and frames resume on exit.
- `local-engine-pause-native.mjs` passes with the rebuilt Wasm: three native
  pause/resume cycles, unchanged presents/audio/decoded bytes while paused,
  and 120 real second-engine frames with the local counters still frozen.
  Local rendering resumes after the second engine is destroyed. No page or
  engine errors were recorded.

## Combat measurement, September 12, 2026

Target: i7-8700, RTX 2080, 32 GB RAM, Chrome 152.0.7977.83, hardware ANGLE/D3D11
(NVIDIA driver 32.0.15.9595). The compiler was stopped before measurement.
`online-performance.mjs` drives the recorded native controller sequence into a
Ness/Kirby match on Onett, warms it for 10 seconds, then runs scripted inputs
for 60 seconds with a target of 60 Hz. Screenshots and native phase 3 confirm
combat. This exercises real engines and the iframe bridge, with no remote peer,
network latency or predictive rollback. These are controlled throughput results,
not a qualification of real internet matches or all stages.

| Build | Combat FPS | Median step | p99 step | Local frames during measurement |
| --- | ---: | ---: | ---: | ---: |
| Live v1.18, local engine running | 14.84 | 64.05 ms | 139.11 ms | 2,520 |
| Pause fix, local engine stopped | 16.72 | 57.08 ms | 104.90 ms | 0 |

The measured improvement is about 13%; **60 FPS is not achieved**. The result
does not establish that 60 FPS is impossible on this hardware.

A separate 10-second worker profile attributes approximately 20% of the active
simulation worker's sampled wall time to `crc32_braid`, 40% to generated game
functions, and 12% to dispatch/memory routines. Blocked futex samples are waits,
not CPU utilization. Strong next candidates are:

1. Compute full-RAM CRC only at required synchronization boundaries. The native
   engine currently scans 24 MB every step, while the room SDK compares every
   30th frame. Preserve boot/result agreement and all required desync checks.
2. Reduce dispatch and memory-hook overhead in the generated-code path, guided
   by the recorded worker profile and deterministic replay checks.
3. Optimize the hottest generated game routines after mapping chunk-level
   profiles to game symbols; benchmark any compiler/SIMD changes for correctness.

## Build and release

The Windows build now succeeds with Emscripten 6.0.9 and CMake 3.31.12, using
the pinned sources and supplied game inputs. All 1,186 game-file sizes and
SHA-256 hashes match the live v1.18 manifest. The runtime preparation must
include the original base `cpu-abi.patch`, `strict-native.patch`, `netplay.patch`
and `media-settings.patch`, followed by the native Melee patches and their
copied rendering/texture headers. A Wasm-compiled check confirmed matching ABI
3, CPUState size 3,472, and all 49 field layouts. Merely cloning the pinned
runtime without those preparation steps is insufficient.

This is **not a wrapper-only update**. Package the rebuilt engine with the
updated wrapper using `melee/tools/build.py --stage-only`. The tested candidate
is staged in `build/melee-web/dist`:

- Candidate Wasm SHA-256: `456fb8702256b3c1087bca67e79473d47eef284abe157514ad9b574f8596f3e5`.
- Baseline v1.18 Wasm SHA-256: `30c94b6e53084930a2be0e8587b6a69534470502f0387b68b41adfcb600dcfcc`.
- Candidate transfer: 20,958,971 bytes; decoded Wasm: 145,966,687 bytes.

Serve with `melee/tools/serve.py`. Set `MELEE_URL`, `PLAYWRIGHT_PATH`, and
`YOUGAME_SDK_PATH` for standalone tests. The combat harness additionally uses
`MELEE_PAUSE_LOCAL=1` for the candidate (`0` for the baseline),
`MELEE_BENCHMARK_MS=60000`, and optional `MELEE_PROFILE=1` for a separate profile
run. Raw evidence remains in the local `scratchpad/local-pause-native-abi`,
`scratchpad/combat-paused`, `scratchpad/combat-live-baseline`, and
`scratchpad/combat-profile` directories.

The candidate has not been published. Publication requires the OpenSmash
creator API key, conventionally `YOUGAME_API_KEY_OPENSMASH`; an upload-only
token cannot make the update live. Keep secrets outside source control and logs.
