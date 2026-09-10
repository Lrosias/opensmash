# Rollback performance — September 9, 2026

The local YouGame build now saves rollback history substantially faster. Two
paired 4× CPU-throttled desktop tests reduced average simulation/render-submission
plus checkpoint work by 49–52%, from 22–24 ms to 11–12 ms per simulated frame.
This is an online checkpoint optimization, not an offline renderer or mobile fix.
The changes are local; no build was uploaded or published.

## Change

- Replace rebuilding a large exclusion `Set` each frame with a compact byte mask.
- Compare live memory against immutable history through a 475-byte scalar Wasm
  helper. Copy one old page into aligned scratch space, then compare exact integer
  bytes inside Wasm. No probabilistic hashes or floating-point equality.
- Reserve 32 KiB once per engine for a page-aligned 16 KiB scratch area. Exclude
  its payload from history; preserve allocator metadata and surrounding bytes.
- Keep the original JS comparison when the optional helper cannot load. The
  helper needs neither SIMD, threads, nor a rebuilt BattleShip engine.

History length, input delay, gameplay simulation, fighter detail, and render
resolution are unchanged. Replays still restore every captured byte. The scratch
allocation lives until its engine is discarded; rematches create fresh engines.

## Measurements

Chrome 152.0.7977.83, headed, ANGLE Metal / Apple M4 Pro. Same packaged BattleShip
Wasm in both versions, same scripted two-fighter Dream Land match, same 640×480
render buffer and 960×720 browser viewport. 120 warmup frames precede collection.
The paced fixture uses the real downloaded YouGame SDK's `fixedStep({hz:60})`.
No live room, network traffic, or external player UI is included in the fixture.
Final comparisons ran serially without CPU profiling enabled. CPU throttling is
a controlled stress condition, not a physical-phone emulator.

| Condition | Frames | Mean frame work before → after | p95 frame work before → after | Frames over 16.67 ms before → after |
|---|---:|---:|---:|---:|
| Unthrottled | 600 each | 5.86 → 3.16 ms | 6.72 → 4.00 ms | 0 → 0 |
| 4× CPU, first pair | 600 each | 24.06 → 11.63 ms | 26.32 → 13.49 ms | 600 → 2 |
| 4× CPU, reverse-order repeat | 900 each | 22.08 → 11.33 ms | 24.67 → 12.73 ms | 900 → 0 |
| 6× CPU | 600 each | 37.72 → 17.70 ms | 41.60 → 20.69 ms | 600 → 444 |

In the first 4× pair, checkpoint time fell from 20.16 to 7.67 ms/frame (62%).
Simulation/render submission itself was effectively unchanged: 3.90 vs 3.96 ms.
The reverse-order repeat measured 18.83 → 7.47 ms for checkpoints (60%).

The SDK's simulation rate recovered from 41–45 to approximately 60 Hz in the 4×
cases. The display callback cadence in these paced runs provided approximately
50 opportunities/s even in the unthrottled baseline. Under overload, the SDK
batched several simulation steps into each callback, so many intermediate images
could not be presented: roughly 5–6 opportunities/s before vs 50 after at 4×.
These are callback opportunities with new game state, not physical scanout FPS;
they must not be advertised as a general tenfold frame-rate improvement.

At 6× the improved simulation reached about 55 Hz, but still batched work and had
only about 7 presentation opportunities/s. That case remains visibly unsuitable
for a fighter. This demonstrates why recovering average simulation FPS alone is
not enough, and why further headroom matters for actual rollback replay bursts.

## Correctness

- All 39 Node tests pass, including input, Friends, and actual SDK protocol tests.
- Exact comparison tested by flipping each of the 16,384 bytes in a page, plus
  partial pages, differing NaN/sign-bit patterns, memory growth, and load failure.
- Accelerated snapshots match JS reference snapshots across changing exclusions,
  heap growth, captured scratch boundaries, and rewinds to older history.
- Actual-engine rewind: 60 subsequent state diagnostics replayed identically.
- Two actual engines, 3–5 frames of simulated delivery delay and one dropped input
  bundle in seven: 59 rollbacks per peer, equal confirmed state at frame 227.
- Complete KO: both peers agree at confirmed frame 858 and report p0 winning 3–0
  exactly once. Existing test checks use canonical gameplay diagnostics, not a
  cross-client comparison of every renderer/audio byte.
- Actual-engine screenshot inspected. JavaScript syntax and whitespace checks pass.

Physical iPhone/Android, Safari, long sessions, live Internet matches, and custom
fighter rendering remain unverified by these measurements. No claim is made that
the previously reported offline/mobile FPS or crash issues are resolved.

## Reproduction

`yougame/tests/performance.mjs` serves only packaged engine assets and explicit
fixtures on loopback. Use an installed Chrome and Playwright (`PLAYWRIGHT_PATH`
can point to the package). Results default to `yougame/test-results/performance`.
The local raw runs are in `paced-before-1`, `paced-after-1`, `paced-after-2`, and
`paced-before-2` beneath that directory. Do not run benchmarks alongside builds.

```sh
node yougame/build-page-compare.mjs
YOUGAME_SDK_PATH=/path/to/sdk.js node --test yougame/tests/*.test.mjs
YOUGAME_SDK_PATH=/path/to/sdk.js node yougame/tests/extract-sdk.mjs
node yougame/tests/verify-rollback.mjs
YOUGAME_SDK_PATH=/path/to/sdk.js PERF_PACED=1 PERF_RATES='[1,4,6]' PERF_FRAMES=600 node yougame/tests/performance.mjs
```

Before comparison, preserve the old `yougame/dist/engine` directory and old
`yougame/src/checkpoints.mjs`. Set `PERF_ENGINE_ROOT` and `PERF_CHECKPOINTS` to
those saved paths for the baseline. For this run the original checkpoint source
is also available at commit `c88f3e3bbad16fc0ecbe34bce3d6c4e8ac0c92fb`.
`PERF_OUTPUT` chooses a separate output folder per run. A build should use the
intended engine runtime via `YOUGAME_ENGINE_DIR`; this experiment retained the
already-packaged engine rather than incorporating unrelated engine work.

Recorded SHA-256:

- Engine, identical in both versions: `9661e6e6ab3175cfddc36c98e284fba90c46d474a49a960d58ae852713f0f3bb`
- Helper: `22702191d908da0a18890a54f58d43d6c0d08f0fdc37ec794e7623dd9cebcfad`
- SDK: `650a65c380f00db173a76788d5358d917398fb0df1aba395cc39b5a73fcebc16`
- Local packaged build fingerprint: `ef9e9be8140abc73`.
