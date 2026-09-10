# Melee browser CPU optimization — September 9, 2026

This work uses an isolated build in the `fc0a/OpenSmash` worktree. The original
checkout and the other task's progressive asset loader were not modified.
These measurements are local; they are not measurements of a new YouGame release.

## Validated runtime changes

* `MeleeExactFma.h` avoids software fused multiply-add only when multiplication
  is exactly representable in binary64. Both factors have at most 26 significant
  bits and unbiased exponents in [-450, 450]; the addend must be finite. The
  resulting product is exact, normal and finite, so one addition has the same
  rounding as `fma`. All other inputs use the original library routine. No
  fast-math, relaxed SIMD, frame skipping or emulated clock changes are involved.
* The dispatcher checks the rare empty-pad-wait address before checking game
  identity and revision. All existing interrupt, revision, queue and return-address
  guards remain. It also reuses the existing memory and timer objects.
* The browser runtime leaves host-call callbacks null when its mod manager is
  empty. Mods are loaded before CPU-core creation; nonempty managers retain all
  callbacks. Native callback setup is unchanged.

The differential math test passed **8,001,331 bit-for-bit comparisons** on ARM64
and WebAssembly, including random full-precision inputs, exact-product candidates,
exponent boundaries, cancellation, adjacent representable results, signed zeros,
infinities and NaNs. The original software operation remains the fallback.

## Controlled scene measurement

M4 Pro, 48 GB, headed bundled Chromium, WebGL 2 through ANGLE Metal. Output is
320×240. Each build boots with prepared assets, restores the same Ice Climbers /
Peach Onett checkpoint, warms up, and restores that checkpoint before each
15-second measurement. Fighters are stationary in this test. It does not measure
active combat or establish competitive 60 Hz performance.

| Build | FPS in three runs | Mean FPS |
| --- | --- | ---: |
| Original baseline | 44.45, 44.93, 42.06 | 43.81 |
| Math and dispatcher changes | 52.33, 52.13, 52.52 | 52.33 |
| Same changes with release link `-O2` | 47.53, 48.06, 47.06 | 47.55 |
| Original baseline repeated | 41.79, 43.46, 41.93 | 42.39 |
| Math, dispatcher, and empty-mod changes | 55.65, 56.39, 55.66 | 55.90 |

All these measurement windows had **zero asset misses, asset requests, shader
compilations and engine errors**. Displayed FPS matched the engine's presents in
the final three runs. Builds and CPU profiling were not running during FPS tests.
Other user applications remained open; the repeated baseline captures some of
that variability. Treat these as observed results on this computer, not a
universal percentage guarantee.

The six original-baseline windows average 43.10 FPS. The validated runtime changes
average 55.90 FPS: about **30% more throughput**, or **23% less time per frame**, in
this workload. Median inter-frame gaps decreased from roughly 22–23 ms to 17.7 ms.
The final runs' p99 gaps remained 20.7–23.4 ms, above the 16.67 ms target.

The release-link trial reduced compressed engine transfer from 21.11 MB to
19.91 MB but slowed this test. The default link level remains `0`; game C is
compiled at `-O2`, runtime C++ at release optimization, with SIMD enabled.

A separate ThinLTO trial reached approximately 58–60 FPS, but repeated
checkpoint-and-action tests showed visibly distorted stage geometry. The
corresponding original-build images did not show that distortion. This has not
been isolated to a compiler defect versus a state-restore interaction, so the
trial is **not accepted** and `MELEE_GAME_THIN_LTO` remains OFF. Its timing results
must not be quoted as a validated speedup. Evidence is in `cpu-lto`; the retained
engine is the runtime-only build identified below.

Checkpoint SHA-256:
`ac743cd9531792d06385f087823cbab29f9629cd51c55fd13b0b18da0c24738b`.

Validated runtime engine SHA-256:
`32f5ab90f2d33015b3132cc5ba159ab1d55a6659a1ad3c36a48a7f99bbd28b9f`.

## Movement and attack comparison

A second test restores the checkpoint and repeats movement, jumps, attacks and
specials. After an action warmup, two 15-second windows produced:

| Build | FPS | Mean FPS |
| --- | --- | ---: |
| Original | 40.53, 42.93 | 41.73 |
| Retained runtime changes | 54.92, 54.46 | 54.69 |

This is about a **31% observed throughput gain** with visible gameplay inputs.
The retained build's screenshots show normal stage geometry, fighters, projectiles
and effects. Both variants had zero asset requests, missing reads and reported
engine errors during these windows.

This test uses timed inputs rather than deterministic frame-stepped replay;
different speeds produce different trajectories and render more simulated frames.
Some new shader variants still appeared: 7/0 in the original runs and 16/11 in the
retained runs (18/0 ms and 38/30 ms total compilation respectively). The retained
build's p99 frame gaps were still approximately 30–31 ms. These results support a
runtime speed improvement, not a claim of complete hitch removal or equal results
for every fighter/stage combination. See `cpu-combat-comparison.json`,
`combat-baseline` and `combat-final` under the test-results directory.

## Profiles and remaining work

Separate eight-second profiles found 221 software-`fma` samples out of 6,455 on
the repeated baseline CPU worker, versus 45 out of 6,510 after the runtime changes.
Mod-manager samples disappeared from the final CPU profile. These samples are
diagnostics, not uninstrumented frame-rate measurements or instruction counts.

The final profile still concentrates CPU time in recompiled dispatch, original
game functions and `GatherPipeBursted`. The graphics worker waited in futexes
for 2,398 of 6,442 samples. The existing graphics loop already coalesces wakeups;
queue batching needs a design that preserves interrupts, FIFO visibility and
ordered EFB/XFB requests. It was not changed speculatively.

Movement, jumps, attacks and special effects rendered correctly without reported
engine errors. Action testing still showed moments in the 40s. First-use shader
compilation remains synchronous; one later shader reached approximately 125 ms.
This pass does not solve shader hitches, validate rollback determinism end to
end, or establish 60 FPS during heavy combat. No matched native benchmark was
performed in this pass.

## Evidence and reproduction

`build/melee-web/test-results/cpu-comparison.json` contains the full stationary
comparison. Its sibling `cpu-baseline`, `cpu-baseline-repeat`, `cpu-candidate`,
`cpu-release` and `cpu-final` directories contain measurements, screenshots and
separate CPU profiles. Save-state restore increases the benchmark's temporary
memory footprint; it is not a new normal-play allocation introduced by these
runtime changes.

Run the numeric regression test with:

```sh
clang -O2 -ffp-contract=off -fno-fast-math melee/tests/exact-fma.c -o /tmp/melee-exact-fma
/tmp/melee-exact-fma
emcc -O2 -ffp-contract=off -fno-fast-math melee/tests/exact-fma.c -o /tmp/melee-exact-fma.js
node /tmp/melee-exact-fma.js
```

`melee/tests/stalls.mjs` accepts `saveState`, `loadState`, `benchmark` (milliseconds),
`label`, and `combat` in addition to its existing interactive commands. Benchmark
JSON reports actual elapsed time, engine SHA, displayed FPS, frame gaps, asset
reads and shader activity. Profiling should be a separate command after timing.

## Merge with the progressive loader

The normal source build already includes these runtime changes in `browser.patch`.
Two incremental patches are supplied for the other checkout:

1. Apply `engine/cpu-performance-frontend.patch` at the project root. It adds the
   exact-math header and its CMake setup without replacing loader/frontend files.
2. Apply `engine/cpu-performance.patch` in `build/melee-web/runtime`. It changes
   only the three runtime CPU source files.
3. Regenerate that checkout's combined `browser.patch` with `melee/tools/update_patch.py`,
   then rebuild and verify its progressive-loading engine before uploading.

Both incremental patches passed `git apply --check` against the original checkout.
Do not substitute this isolated engine binary into the progressive frontend: that
frontend requires its own additional asset callbacks and exports. This worktree's
prepared-assets frontend was retained only to keep the CPU comparison controlled.


## Integration with progressive loading

The validated changes above are now merged in the primary OpenSmash checkout.
The loader, asset groups, opening artwork and application JS match v1.4 byte for
byte. All asset callbacks/exports and generated scene gates are retained. ThinLTO
is not enabled; release link optimization remains 0. The updated `browser.patch`
contains the CPU changes for reproducible source builds.

Integrated engine SHA-256:
`57522a4bec2c20cc07fccc364f555dc80e47f32f55a29c81da05cd4554022349`.

Fresh actual matches reached Bowser/Kirby on Onett on both builds. Each run then
restored the same newly captured checkpoint, warmed up with movement/jump/attack
inputs, restored again and ran two 15-second scripted-combat measurements. No
builds, profiling or uploads ran during these windows. The same headed bundled
Chromium/ANGLE Metal setup was used, one browser at a time. Roster boot had zero
asset misses; both versions used about 538 MiB there. Checkpoint restores increase
benchmark memory temporarily and do not represent normal startup use.

| Progressive build | Combat run 1 | Combat run 2 | Mean |
| --- | ---: | ---: | ---: |
| v1.4 | 48.66 FPS | 48.72 FPS | 48.69 FPS |
| Integrated CPU changes | 58.92 FPS | 59.19 FPS | 59.06 FPS |

Observed throughput gain: **21.29%** in this Bowser/Kirby scene. Displayed and
engine-present FPS agree. All four measured windows had zero asset requests,
zero missing reads and zero engine errors. Median frame gaps improved from about
20.4 ms to 16.7 ms; optimized p99 gaps remain 29.4–31.2 ms. Visual inspection of
both optimized combat screenshots showed normal stage geometry, fighters and
fire effects after repeated state restores. Timed inputs are not a deterministic
frame-stepped replay, so speeds and trajectories differ; this is not a claim of
constant competitive 60 Hz or validated rollback determinism.

Both native and Wasm math regression binaries again passed all 8,001,331 cases.
Five asset-loader tests and two asset-catalog tests passed. The YouGame MCP static
check returned ready. The engine transfer is 21,109,251 bytes, only 330 bytes more
than v1.4. First-menu downloads are unchanged.

Evidence in the primary checkout:
`build/melee-web/test-results/cpu-integration-comparison.json`,
`cpu-integration-baseline/`, and `cpu-integration-candidate/`.
Checkpoint SHA-256:
`cb78ee80eb451648410e935af9b5feaeacd4b6ba1a64bb9071016d6e801f74f5`.

Staged YouGame iframe check also passed in installed Google Chrome 152.0.7977.83:
shared memory, artwork/roster rendering and Report controls worked; zero failed
loads, page/engine errors or roster asset misses. Evidence:
`build/melee-web/test-results/cpu-integration-hosted-chrome.json`.


Published as **v1.5** on the existing OpenSmash Melee listing, staged upload
`38db343b7bf748398f43ac9627648517`. The live engine manifest matches the tested
integrated hash. The final installed-Chrome fresh match landed on Yoshi’s Island
(stage 16) with Bowser/Kirby. Its 10-second movement/attack smoke window averaged
52.98 FPS with zero asset requests, missing reads or errors; first-use shader
hitches persisted (204.65 ms max frame gap). This is a different browser/stage
from the controlled comparison, so it is recorded as runtime verification rather
than an additional before/after result. Evidence: `cpu-integration-hosted-match/`.
