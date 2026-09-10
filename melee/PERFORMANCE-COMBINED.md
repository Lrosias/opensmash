# Combined runtime and progressive loader — 2026-09-09

The near-60 FPS build already contains this worktree's exact-FMA, dispatcher,
and empty-ModManager callback optimizations. Its `browser.patch` and
`MeleeExactFma.h` are byte-identical to ours. There is no second independent CPU
optimization to stack. Its additional changes are progressive asset loading,
selection hints, match preloading, and the associated browser callbacks/exports.

This worktree now contains that combined source and exact validated engine,
including the generated streaming hooks. ThinLTO is absent; link optimization
remains 0. The previous source and prepared-assets build are preserved under
`build/melee-web/before-combined/`. We reused the validated linked engine rather
than claiming a new compiler result. The coordinated release task published
this same engine as [v1.5](https://yougame.co/g/opensmash-melee).

## Matched heavier-scene comparison

M4 Pro, headed bundled Chromium 151, 1280×720 browser viewport, 320×240 output.
Both builds restored the same Ice Climbers/Peach Onett checkpoint. Each browser
ran a 15-second movement/attack warmup, then restored that checkpoint before each
of two 15-second combat windows. The progressive build preloaded the checkpoint's
actual fighter/stage/match groups through its production callback before restore;
ticket zero does not release a live match gate. This test-only preparation is
needed because restoring a checkpoint bypasses normal match entry.

| Build | Run 1 FPS | Run 2 FPS | Mean FPS | Wasm heap in runs 1 / 2 |
| --- | ---: | ---: | ---: | ---: |
| Our CPU runtime, all assets prepared at boot | 51.66 | 51.73 | 51.69 | 1,356 / 1,476 MiB |
| Same CPU runtime, progressive loader | 53.86 | 54.66 | 54.26 | 861 / 999 MiB |

The observed mean difference is +4.96%. Two short windows do not establish a
general 5% speedup: wall-timed controls can produce different simulation paths,
first-use shaders remain, and earlier runs of the prepared build averaged 54.69
FPS. The stronger conclusion is that the combination retains the CPU gains with
much lower startup transfer and memory use. Heap figures include checkpoint
restore temporaries and are not a fresh-match memory requirement.

All four measured windows had zero asset requests, missing reads, or engine
errors. Combined p99 frame gaps were 31.36 / 30.78 ms versus 34.93 / 32.95 ms.
First-window shader compilation took 54 ms combined versus 251 ms prepared;
therefore the maximum-gap difference is not evidence that shader stalls are
solved. Screenshots after repeated restores showed normal stage geometry and
active gameplay. Five loader tests and two asset-catalog tests passed.

## Why the other result was 59 FPS

The release task's separate paired Bowser/Kirby Onett benchmark measured
48.69 FPS before the CPU patches and 59.06 FPS after them (+21.29%). It uses a
different checkpoint and fighters. Its 59.06 FPS cannot be compared directly
with the heavier scene above. Installed Chrome 152 also measured 52.98 FPS in a
different Yoshi's Island scene, with a first-use shader hitch over 200 ms.
Sustained 60 FPS across matchups and stages is still unproven.

## Reproduction and evidence

- Combined engine SHA-256: `57522a4bec2c20cc07fccc364f555dc80e47f32f55a29c81da05cd4554022349`.
- Prepared CPU engine SHA-256: `32f5ab90f2d33015b3132cc5ba159ab1d55a6659a1ad3c36a48a7f99bbd28b9f`.
- Common checkpoint `melee/media/checkpoint.sav` SHA-256: `ac743cd9531792d06385f087823cbab29f9629cd51c55fd13b0b18da0c24738b`.
- Harness: `melee/tests/stalls.mjs`; use `prepareMatch: {stage: 9, fighters: [14,12,-1,-1]}` before restoring this checkpoint in a progressive build.
- Machine-readable comparison: `build/melee-web/test-results/combined-heavy-comparison.json`.
- Raw actions, environment, frame samples, shader timings, and screenshots: `build/melee-web/test-results/combined-heavy/` and `prepared-heavy/`.
- Lighter-scene paired comparison: `build/melee-web/test-results/cpu-integration-comparison.json`.
- CPU correctness evidence and rejected compiler experiments: [PERFORMANCE-CPU.md](PERFORMANCE-CPU.md).
- Loader design and tests: [PROGRESSIVE-LOADING.md](PROGRESSIVE-LOADING.md).

Further runtime work needs a new measured optimization, most likely CPU hot-path
work or shader prewarming with correct first-use coverage. Reapplying these same
patches cannot supply another additive gain. Rollback remains deferred.
