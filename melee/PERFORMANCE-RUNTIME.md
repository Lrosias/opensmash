# Browser runtime follow-up — September 9, 2026

## Current outcome and measured scope

Published v1.6 engine: `7c54dc1ad7c3bcaa258b14abb37b5b3283d4208372c426e2f6dad3d62c493f82`.
The Lite reflection change raises the local Fountain comparison from 50.23 to
59.96 FPS. A fresh match on the staged YouGame player measured 60.06 and 59.99 FPS
in two subsequent 15-second combat windows. Other scenes remain below 60 and
first-use shaders can hitch. All test browsers are muted; audio processing stays
active. Details and limitations follow.

## Initial compiler comparison

The initial candidate engine was `0fc83b3cdbfac942b3d40cf18f24f9babd3708474e5fa4aaf7b54b652c9a3f27`.
It combines the existing exact-FMA/dispatcher/empty-mod changes and progressive
loader with game-only ThinLTO, WebGL compatibility fixes, persistent portable
pipeline descriptions, and direct HTTP-compressed Wasm streaming.

On the M4 Pro in muted, headed Chromium 151 at 1280×720 with 320×240 output,
Ice Climbers/Peach Onett combat measured:

| Build | Combat FPS | Mean |
| --- | --- | ---: |
| Corrected runtime without ThinLTO, repeated baseline | 56.52, 58.32 | 57.42 |
| Same runtime with game-only ThinLTO, first browser | 59.26, 59.12 | 59.19 |
| ThinLTO, independent second browser | 59.99, 59.59 | 59.79 |

The four candidate windows average **59.49 FPS**. The first candidate pair uses the original checkpoint. The second candidate
pair and repeated baseline actually use the later hazard checkpoint, as explained
below. Each window follows a movement/jump/attack warmup. All six measured windows
had zero asset requests, missing reads and reported engine errors. Candidate p99
frame gaps were 21.1–24.3 ms, so this is not a locked 16.67 ms frame budget.
The matched hazard-state means are 59.79 FPS with ThinLTO versus 57.42 without;
the 59.49 figure is only the average of the four candidate observations across
two match moments. Controls are wall-timed, not deterministic frame-stepped replay: paths and new
shader variants differ. The repeated baseline's first window compiled 62 variants
in 263 ms, versus 0–17 variants in candidate windows. Do not attribute the entire
observed mean difference to the compiler. Earlier baseline results of 51–55 FPS
also show session-to-session variability. No builds or profilers ran during these
measurements; other user applications remained open.

Evidence: `build/melee-web/test-results/lto-corrected-comparison.json`,
`lto-corrected/valid-heavy-*`, `lto-hazard-check/repeat-heavy-*`, and
`corrected-baseline-repeat/combat-*`. The original checkpoint SHA is
`ac743cd9531792d06385f087823cbab29f9629cd51c55fd13b0b18da0c24738b`.

## Correction to the earlier compiler rejection

The folded awnings and fallen Drug Store sign are Onett's intended hazard, not
evidence of compiler corruption. The decompiled `gronett.c` implements the
landing-count trigger, collapse animations, disabled platforms and recovery.
A checkpoint captured with the hazard active in the LTO build was loaded into
the non-LTO baseline and reproduced the same folded awnings and fallen sign.
Compare `lto-hazard-check/hazard-saved.png` with
`corrected-baseline-repeat/same-hazard-baseline.png`. Repeated restores and active
combat continued normally. The earlier rejection based on those features was a
false positive. This does not establish whole-game determinism or rollback safety.

Four initial readings in `lto-corrected/` actually showed the results screen;
their JSON is marked `validGameplayBenchmark: false` and they are excluded.
The diagnostic save harness now waits for the engine's atomic final-file rename
instead of assuming a fixed delay means asynchronous compression completed.
A further harness issue was isolated in Emscripten's `wasmfs/js_api.cpp`:
`FS.writeFile` appends to existing files in this version. After saving the hazard
checkpoint, attempts to write the original checkpoint appended bytes and kept
loading the hazard prefix. This affected the second candidate pair and the
repeated baseline equally; both really used `lto-onett-hazard.sav`. The first
candidate pair used the original checkpoint. Loading now unlinks the existing
file and verifies the replacement length. Results-screen readings remain excluded.
This is a diagnostic-harness issue, not the game's asset loader.

## Runtime changes

* Game C and CPU helpers use ThinLTO with link-time optimization level 2. Emscripten also selects its LTO system libraries. Dolphin runtime
  C++ remains separately compiled and the final Binaryen level stays 0. No
  fast-math, relaxed SIMD, emulated-clock adjustment or frame skipping was added.
  The exact-FMA regression passed **8,001,331 bitwise comparisons** under the new
  Wasm ThinLTO settings; prior ARM64 and Wasm checks also passed.
* CPU timing slices and recurring graphics work return through explicit noinline
  functions in browser builds. This permits optimized Wasm code to be entered on
  later calls. This change alone did not demonstrate a speed gain in the short
  trials; it is not credited with an independent percentage improvement.
* Emscripten runtime assertions are disabled in release builds and remain
  available with `MELEE_WEB_ASSERTIONS=1` for diagnostics.
* Custom shader/resource workers no longer request shared OpenGL contexts under
  WebGL. The workerless path compiles on the owning graphics context. This fixes
  the three shared-context startup failures at their source.
* WebGL staging textures use CPU storage plus `getBufferSubData` for readback and
  `glBufferSubData` for upload. WebGL has no desktop mapped-buffer API. Native
  mapping behavior is unchanged. This fixes unsupported map requests rather than
  filtering their warnings away.
* Routine renderer/core/input messages use console debug. Unexpected stderr,
  exceptions and fatal initialization failures remain visible.

## Shader persistence and remaining hitches

The browser persists Dolphin's portable pipeline UID descriptions in CacheStorage,
keyed by engine hash. It validates the format, trims incomplete records, and caps
startup work at 512 records, preserving common boot records plus recent variants.
These are not driver program binaries. The graphics worker regenerates and
compiles them before the first frame, including dependent pipeline work.

In `webgl-cache/`, a reload restored 103 learned UIDs and compiled 207 shader
objects before the menu, versus 76 on a cold visit. Startup was approximately
4.6 seconds warm versus 5 seconds cold in that local run. This proves persistence
and precompilation, not complete hitch removal: a subsequent combat window still
found 19 new variants, with a 240 ms maximum frame gap. No universal seed covering
all fighters/stages ships. A selected-match shader catalog and more complete
coverage remain useful follow-ups. Three cache tests, five loader tests, two asset
catalog tests and the B0XX input checks pass.

## Platform delivery

YouGame already supports `httpCompression: true` alongside `crossOriginIsolation`.
The engine now ships as one 20,433,257-byte `melee.wasm.gz` (138,011,528 decoded
bytes). The host supplies `Content-Encoding: gzip` and `application/wasm`; the
browser passes the real HTTP response directly to `instantiateStreaming`.
This removes custom engine-part reconstruction and enables the normal browser
streaming/code-cache path. A compiled-code cache hit has not been measured and is
not claimed. Game-data blocks remain progressive and separately compressed.
The legacy engine-part loader remains supported for older releases.

All test browsers launch with `--mute-audio`. The audio engine and worklet remain
active so muting does not artificially remove their runtime cost. Browser-only
flags such as `--no-liftoff` are diagnostic experiments, not player requirements;
the optimized-only trial did not improve the measured steady-state result and
made startup compilation worse.

## OpenGL diagnostic verification

A separate `MELEE_WEB_ASSERTIONS=1` build
(`dc7b7018c824ca7d2dfa9ccdfdaca6c4fbd349138c06a68bac3277437b0fb257`)
booted with **zero console warnings/errors**. Actual combat, saving and restoring
completed with no WebGL mapped-buffer or shared-context errors and normal
rendering. Diagnostic checkpoint operations still produce Emscripten's generic
main-thread-blocking warning; these are test-only operations and not a rollback
implementation. The release engine above was restored after this test. Evidence:
`build/melee-web/test-results/webgl-assertions/startup.json`, `measurement.json`
and `restored.png`. This verifies the OpenGL fixes with diagnostics enabled,
rather than relying on release assertions being disabled.

## Startup fix and corrected-harness verification

The pre-reflection engine hash is
`85b53eada54361f3ac9f2cd1c487e0d482a9fa9c714a7db8bd20c98b343ce0ab`.
It additionally omits the renderer's in-game `Video Info` startup overlay on
WebGL; initialization errors and the ordinary diagnostic log remain. The prior
`0fc83...` staging upload was not published because hosted visual inspection
exposed that separate overlay. The opening-screen Fullscreen button also sits
above the platform's reserved bottom-right controls.

With checkpoint replacement fixed, two new 15-second active-combat windows on the
original Ice Climbers/Peach Onett checkpoint measured **59.92 and 59.99 FPS**, mean
**59.96 FPS**. P99 gaps were 20.46 and 22.15 ms; maximum gaps were 28.39 and 28.80 ms.
Both windows had zero asset requests, missing reads and engine errors. The cold
roster screenshot shows no OpenGL/driver overlay. A later reload restored 94
pipeline UIDs, precompiled 202 shader objects before the roster, and reached
120 frames in about 3.5 seconds; audio processing remained active and muted.
Evidence: `build/melee-web/test-results/clean-start-final/`. These final-engine
results supersede the exploratory compiler timings above for release reporting.

The final corrected-harness baseline measured **56.86 and 58.33 FPS**, mean
**57.59 FPS**. Candidate mean 59.96 is an observed 4.1% improvement in this pair,
with 16/12 new shader variants versus 17/9 in baseline. All four windows had
zero asset I/O and engine errors. This is the current matched comparison:
`build/melee-web/test-results/runtime-final-comparison.json`.


## Fountain of Dreams Lite rendering

The current candidate engine is
`7c54dc1ad7c3bcaa258b14abb37b5b3283d4208372c426e2f6dad3d62c493f82`.
A fresh hosted Ice Climbers/Kirby match exposed a separate bottleneck: the prior
CPU-only candidate sustained 50.39 and 50.19 FPS on Fountain of Dreams after
warmup, despite zero asset I/O. Its first visit also had a roughly 3.5-second
shader compilation hitch. Evidence: `runtime-final-hosted/`.

Fountain draws three extra object lists into its water reflection every frame.
Lite mode skips only those calls in `grIzumi_801CCEA0`. It retains camera setup,
texture clear/copy/matrix updates and the normal stage drawing. The water becomes
a plain light cyan surface; stage geometry, moving platforms and gameplay update
functions remain. The generated-code hooks verify the original call instructions
and can be applied repeatedly. Default is Lite; `?full-effects` and the diagnostic
`melee_set_lite_effects` export enable the original reflection for comparisons.

In a single muted Chromium 151 browser, the same Fountain checkpoint and engine
were tested with the reflection toggled off/on in reverse order:

| Rendering | First 15-second combat window | Second window |
| --- | ---: | ---: |
| Original reflection | 49.66 FPS | 50.79 FPS |
| Lite plain water | 59.99 FPS | 59.92 FPS |

Lite mean was **59.96 FPS**, versus **50.23 FPS** with reflection. The final full
reflection window was shader-warm (zero new shaders), so the steady-state gap
persists beyond compilation. Lite p99 gaps were 22.31/22.88 ms, maximum
27.69/29.73 ms. All four windows had zero asset requests, missing reads and engine
errors. Full first window compiled nine shader variants (174 ms); Lite first
compiled five (16 ms). Wall-timed input produces different match trajectories,
so this is not a deterministic frame-for-frame replay. Screenshots show actual
combat and the expected plain water. Evidence: `reflection-ab/full-{1,2}` and
`reflection-ab/lite-{1,2}` under `build/melee-web/test-results/`.

This provides headroom by reducing visual work, not by changing the emulated
clock or skipping simulation frames. Rollback safety and cross-build determinism
are still unverified; future online negotiation must agree on the build and
rendering configuration. First-use shader hitches and untested stages remain
limits. No universal 60 FPS claim is made.


The reflection build's Onett regression check measured 59.59 and 58.86 FPS
(mean 59.22), with 12/9 shader variants, zero asset I/O/errors, and normal combat
screenshots (`reflection-ab/onett-combat-{1,2}`). This is slightly below the
prior 59.96 pair; the Fountain-only branch is inactive on Onett, and these short
wall-timed runs do not establish whether the difference is a regression or
session variability. The exploratory `onett-lite-1` result is excluded: an
incorrect checkpoint/preload combination left the results screen visible.


## Exact uploaded build verification

Upload `add0f906041342f38708cd1cd485e1a4` passed MCP and uploader static checks:
1,224 files and 427,520,054 hosted bytes. Test-session fingerprint:
`feac96627228ba5cde381ed4f64b1e7683c847eaec58d93984c0ad97061795ed`.
The real hosted player serves the same engine hash with `application/wasm` and
`Content-Encoding: gzip`; shared memory and cross-origin isolation are enabled.

Muted Chromium 151 entered the full roster with no OpenGL overlay or console
errors. Actual keyboard and two simulated standard-controller devices selected
Ice Climbers/Kirby and Fountain, exercising the normal selection/match gates.
Fresh stage rendering shows a valid plain water surface and moving platforms.
Report, embedded layout and fullscreen were visually checked. The two 15-second
combat windows measured **60.06 and 59.99 FPS** (mean 60.02); p99 gaps were
22.84/21.17 ms, maxima 34.23/24.46 ms. Both had zero asset requests, missing reads
and engine errors, with 20/4 new shader variants. The warmup measured 59.12 FPS.
These are a new match moment, not a matched comparison with the prior build.

Reload restored 153 pipeline descriptions and precompiled 295 shader objects
before the roster (roughly 5.9 seconds from Play to the readiness check). Console
and engine errors stayed empty. The host's disabled-score lookup returned 403;
no game assets failed. Audio was deliberately inaudible; produced/consumed samples
and a running audio context verify processing, not subjective sound quality.
Evidence: `build/melee-web/test-results/reflection-hosted/`.


Installed Chrome 152.0.7977.83 also booted cleanly in the hosted player. The same
new Fountain checkpoint, preloaded and restored in this separate browser,
measured 56.86 FPS during warmup and **58.92 FPS** in a 15-second combat check.
The measured window had zero asset I/O/errors, but nine newly compiled shader
variants took 346 ms and the maximum frame gap was 191.93 ms (p99 23.25 ms).
This confirms compatibility and the remaining first-use hitch limitation; it is
not a locked-60 result. The screenshot shows active combat. Evidence:
`build/melee-web/test-results/reflection-hosted-chrome/`. Both test browsers were
closed after verification and launched with `--mute-audio` throughout.

The candidate was published as minor version **1.6**. The public entry URL and
engine manifest match the tested upload/hash. See `media/runtime-lite-release.json`.
