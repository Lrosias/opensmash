# Browser performance investigation — v1.7

Examined September 8, 2026, source commit c88f3e3 and build 0fab2d72406e99b5.
This is the historical v1.7 investigation. Applied changes and current validation
are documented in [OPTIMIZATIONS.md](OPTIMIZATIONS.md). Production remains v1.7.

The local harness is `yougame/tests/performance.html`, served from the repository
root with `PORT=4176 node yougame/tests/serve.mjs .`. The original investigation compared the shipped
Wasm engine and its normal offline main loop with a no-yield experiment.
The current harness compares an archived v1.7 build with the optimized build. No rollback controller, snapshots,
or network transport participate. The test starts Mario against a CPU Kirby on
Dream Land; the human slot is idle. This is a baseline, not a four-player or
heavy-effects stress test. The original optional comparison set SDL_EMSCRIPTEN_ASYNCIFY=0
before native main started. Audio output is muted through a zero-gain node while
processing remains active. Future test runs should remain muted.

The probe records hook-to-hook tick wall time, tick intervals, rAF intervals,
frame counts per rAF, long-task/long-animation-frame entries where available,
linear-memory size, MEMFS file growth, and native profiling counters. It reports
samples in the page. rAF callbacks are not physical GPU presentation measurements.
The native profile counters add some instrumentation overhead. Verbose console
logging is OFF in the final harness, matching production.

## Findings supported by code

1. **Two browser scheduling mechanisms in offline mode.** SDL's Emscripten swap
   path calls emscripten_sleep(0) when SDL_EMSCRIPTEN_ASYNCIFY is enabled, while
   BattleShip separately waits on rAF. The SDL_SetHint intended to disable this
   is at BattleShip/port/port.cpp:1405 inside the Android-only preprocessor block
   surrounding controller pre-initialization. It is unreachable in the Wasm build. The YouGame
   loader correctly supplies the environment override for rollback, but does
   not do so for offline play (yougame/src/engine.html:47). This is a concrete
   browser-path defect, not yet a proven cause of the reported periodic stall.
2. **Separate simulation and display clocks.** The offline pacer keeps a 60 Hz
   deadline and can run catch-up frames between display callbacks
   (BattleShip/port/port.cpp:1565). At a 50 Hz callback rate, 60 simulation ticks
   cannot all be displayed individually; at 120 Hz, holding each game frame for
   two refreshes is normal. A simulation FPS counter alone hides this distinction.
3. **Main-thread audio.** Shipped BattleShip.js creates a ScriptProcessorNode
   (around line 10932). Its output callback enters Wasm on the page thread.
   Desktop SDL uses an OS audio backend. AudioWorklet could isolate playback,
   with a bounded queue; it cannot repair indefinitely slow audio production.
4. **Asyncify fibers.** CMake enables ASYNCIFY and the browser coroutine backend
   unwinds/restores state for cooperative task switches. Desktop uses its native
   coroutine backend. This browser overhead is real, but the measurements do not
   establish it as the periodic-stall culprit. Removing all Asyncify requires a
   scheduler redesign; replacing just the outer blocking loop is smaller work.
5. **Memory and logging.** Wasm starts with 512 MiB of linear memory. The renderer
   allocates an 8192 x 8192 x 4 scratch buffer on devices supporting it: 256 MiB
   INSIDE that heap, not an additional 256 MiB. Allocate scratch to actual texture
   requirements before reducing heap size. The native logger writes to an
   unbounded MEMFS file even with console mirroring disabled (port/port_log.c).
   MEMFS grows a JavaScript typed-array backing store by allocation and copying.
   This is a potential long-session pressure source, not a demonstrated hitch
   cause in the short clean baseline. Linear-memory size is not total or resident
   browser process memory, and stable Wasm memory does not rule out JavaScript GC.
6. **Existing stall diagnostic misses microstutter.** SSB64_STALL_WATCH only
   reports spans above 250 ms. Its `now` value is overwritten during rAF waits,
   so the current work/sleep split can attribute wait time to work. The new
   harness uses separate timing boundaries and lower thresholds.
7. **Original timing is also relevant.** Shared engine logic explicitly preserves
   selected cutscene/attract-mode freeze effects. Its scene allowlist excludes
   ordinary battles and menus (port/stubs/port_diag_stubs.c:115). Native desktop
   would share those authored pauses, gameplay hitstop, and engine/asset work;
   it would not use browser timers, WebGL validation or ScriptProcessorNode.

## Measurements and limits

An exploratory Chrome run with verbose logging enabled showed six tick spans over
50 ms in 30 seconds, max 73.45 ms, despite 60 simulation FPS. It is EXCLUDED as
production evidence: logging can itself cause the phenomenon. The upstream logger
explicitly documents that risk. The comparison is not a controlled causal test of
logging because callback cadence also changed between runs.

The clean, muted Chrome baseline (1728 x 907, normal offline clock, native profile
counters on, verbose logging off) ran 30 seconds:

- 59.97 simulation ticks/second.
- Tick span median 1.14 ms, p95 2.03 ms, p99 3.21 ms, maximum 7.10 ms.
- Zero tick spans above 25 ms; two intervals between ticks above 25 ms.
- 1498 rAF callbacks (about 50/second), 301 containing multiple simulation ticks.
- No observed long tasks/long animation frames; no Wasm memory growth from 512 MiB.
- Recent one-second native work averages were 0.91–1.02 ms, display-list processing
  0.61–0.65 ms, audio coroutine 0.08–0.10 ms. These are wall-clock instruments, not
  a sampled CPU/GPU profiler.

An earlier normal-window browser-view sample also delivered about 50 callbacks/s;
a fullscreen sample at 3440 x 1440 did too. That fullscreen sample simultaneously
changed the SDL hint, so it cannot establish a fullscreen or hint speedup. Chrome
also delivered about 120 callbacks/s in an earlier run. These callback rates are
observations of this test environment, not claims about all displays/browsers.

The final clean, muted SDL-no-yield experiment used the same 1728 x 907 viewport
for 30 seconds. It produced 60.03 simulation ticks/second, median tick span 2.03 ms,
p95 3.94 ms, p99 4.73 ms, maximum 9.27 ms; no tick span exceeded 25 ms. However,
three intervals between ticks exceeded 50 ms, with a maximum 127.43 ms; the maximum
rAF gap was 116.90 ms. No long-task entries were recorded. The delay occurred outside
the measured tick boundaries; its exact scheduler/OS/compositor/GC cause remains
unattributed. Absence of a long-task entry does not exclude GC or all engine work.

The callback cadence changed during this run (median 8.33 ms, p95 20.02 ms), making
it unsuitable as a controlled speedup comparison with the 50 Hz clean baseline.
There is **no demonstrated performance improvement from the SDL hint experiment**.
Do not deploy it as a proven stutter fix based on these samples.

The log grew from 202,267 to 343,412 bytes during this experiment. One backing-store
expansion to 538,624 bytes took 0.10 ms. That measured expansion cannot account for
the 127 ms gap. Logging remains unbounded by inspection, but it was not an expensive
operation in this sample. Wasm memory stayed at 536,870,912 bytes.

No native desktop binary was benchmarked, no physical phones were measured, and
no YouGame-host-page-vs-direct-page controlled comparison was completed. Thus there
is no measured browser/native slowdown ratio, no proven explanation for the users'
full-screen improvement, and no proof that the reported recurring freeze is fixed.

## Recommended order

1. Validate a single display-aligned outer loop and remove the redundant SDL
   yield in offline play. Preserve the 60 Hz simulation, bound catch-up, render
   once per display opportunity, and test 60/90/120/144 Hz and background/resume.
   Do not simply run the simulation once per rAF: that changes game speed on
   higher/lower refresh displays. Pause offline simulation when hidden.
2. Make detailed logging opt-in and bounded; right-size texture scratch and then
   initial Wasm memory. Measure allocations and log growth during long sessions.
3. Move audio playback to AudioWorklet with a bounded buffer and explicit underrun
   metrics. Audit current audio-context access through Module.SDL2 as part of it.
4. Profile actual stalls for shader compilation, texture uploads, synchronization,
   garbage collection, audio starvation and host-page compositor work. Prewarm
   relevant shader/texture variants and reuse hot-path buffers where justified.
5. Consider worker/OffscreenCanvas isolation and selective Wasm SIMD after the
   cheaper fixes. They require compatibility and deterministic-gameplay testing,
   not just a build switch. The clean baseline does not justify a renderer rewrite.

The acceptance target is stable frame delivery and low input/audio latency on each
supported device, not only an average 60 FPS. Use frame-time distributions, missed
refreshes and audio underruns on representative affected hardware. Browsers retain
control over scheduling, power limits and GPU access, so identical native desktop
performance on every device cannot be promised.

## Primary references

- https://emscripten.org/docs/porting/emscripten-runtime-environment.html
- https://emscripten.org/docs/porting/asyncify.html
- https://emscripten.org/docs/optimizing/Optimizing-WebGL.html
- https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame
- https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Using_AudioWorklet
