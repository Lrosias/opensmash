# Browser port comparison — September 9, 2026

## Status

Our current build has a fresh gameplay baseline. McDandle's browser build is
not available to this comparison: the public GitHub account currently exposes
`melee-macos-recomp` with only `main` and no releases. That repository contains
the macOS integration, not the browser source or a runnable browser package.
No browser-specific code was imported and no performance optimization was
accepted from an untested demonstration.

Sources checked:

- https://x.com/mcdandle/status/2097404214947328090 — September 8 browser
  announcement claiming 60 FPS.
- https://x.com/mcdandle/status/2097379240706523185 — preceding report of
  60 FPS menus and approximately 50–53 FPS matches.
- https://github.com/McDandle/melee-macos-recomp — public macOS source;
  branches, releases and account repositories also checked through GitHub's API.
- https://x.com/neelmango/status/2097415387700965529 — the other Three.js
  demo's author limits its scope to Marth, Fox, Battlefield and the fighting engine.
  It is not a feature-equivalent full-game baseline.

Our build already uses the related ModernGekko/DolRecomp/RecompCore stack through
`t3dotgg/melee4mac`; see `upstreams.json`. Sharing that ancestry does not establish
that the two browser implementations have equivalent renderers or performance.

### Downloaded source check

Downloaded the public repository into `build/mcdandle-melee-comparison` at
`39e30dec9fa7d90fba960ca9189b573a7938e3df`. `git ls-remote --heads --tags`
confirmed only `main`, with no published tags. Inspection found macOS build
scripts and no browser/Emscripten build entry point or browser package.

This is exactly the revision already pinned by
`build/melee4mac/native/macos/build.py` and checked out at
`build/melee4mac/build/native/recomp`. All five downloaded patch files
(`cpu-abi`, `media-settings`, `native-spr-codegen`, `netplay`, `strict-native`)
are byte-for-byte identical to those in our existing dependency checkout.
Downloading this public source therefore supplies no new browser optimization
to merge. The separately demonstrated browser implementation remains unavailable
in the inspected public repository.

## Current local baseline

Headed Google Chrome 152.0.7977.83, macOS 26.3, 1280 × 720 page viewport,
320 × 240 rendered bitmaps. No CPU profiler or video recorder ran during these
windows. The machine was not placed under an exclusive system-load reservation;
these are single-run baselines, not a statistically controlled speedup claim.

Engine SHA-256:
`df2362950db9f0bf149fe963b8953032935022eff00e01e6e4cc539e5a46a29d`.

The original two-minute match was entered through the normal roster and stage
selection screens, with Ice Climbers and Kirby on Onett in two human slots.
No checkpoint was loaded. Screenshots verify the roster, selected stage and
rendered gameplay. The action sequence exercised movement, jumping, attack,
special and shield, followed by idle time; it is not continuous competitive play.

| Metric | Mostly idle match | Actions, then idle |
| --- | ---: | ---: |
| Measured duration | 29.00 s | 25.00 s |
| Presented and displayed FPS | 41.41 | 39.20 |
| Mean reported simulation speed | 69.55% | 66.38% |
| Median displayed-frame gap | 23.82 ms | 24.56 ms |
| p99 displayed-frame gap | 26.82 ms | 37.73 ms |
| Maximum displayed-frame gap | 288.81 ms | 225.45 ms |
| Gaps over 100 ms | 1 | 5 |
| New compiled shaders | 16 | 23 |
| Shader time accumulated | 284.20 ms | 719.61 ms |
| New asset misses | 0 | 0 |
| Engine asset-byte counter increase | 0 | 0 |
| New audio ring underruns | 0 | 0 |
| Peak Wasm linear memory | 634.44 MiB | 634.44 MiB |

There were no page or engine errors. First match entry did register five asset
misses before the measured windows. Zero misses in the windows does not claim
that all scene transitions are free of asset stalls. New shaders and long gaps
co-occurred; these measurements do not attribute every long gap to compilation.
The older CPU profiles in `PERFORMANCE.md` remain separate diagnostic evidence.

## Evidence and repeating the comparison

Ignored local results: `build/melee-web/test-results/port-comparison-current/`.
`steady-end.json` and `action-end.json` retain raw samples, actual frame times,
requests and timed input commands. `steady-summary.json` and
`action-summary.json` contain the selected-window summaries. `scenario.json`
records the startup and selection commands. The PNG files show both fighters
and the actual running match. These timings guide setup, but selection must be
visually checked on every run because frame-dependent cursor motion can vary.

The existing interactive harness now accepts `MELEE_BROWSER_CHANNEL=chrome`
to use installed Chrome and writes browser/version/viewport metadata for future
runs. `PLAYWRIGHT_PATH` selects the locally installed Playwright package.

```sh
python3 melee/tools/serve.py --port 8086
MELEE_BROWSER_CHANNEL=chrome MELEE_URL=http://127.0.0.1:8086 \
  MELEE_RESULTS=build/melee-web/test-results/comparison-repeat \
  node melee/tests/stalls.mjs
```

Summarize a gameplay window explicitly, excluding setup and profiler commands:

```sh
python3 melee/tools/summarize_benchmark.py \
  build/melee-web/test-results/port-comparison-current/steady-end.json \
  --start-ms 89091 --end-ms 118092 \
  --scene 'Ice Climbers vs Kirby on Onett; mostly idle'
```

The summarizer derives FPS from counter deltas and elapsed time, weights reported
simulation speed by elapsed sample time, and restricts frame gaps to the selected
window. Unequal sampling intervals, frame-window boundaries and reset rejection
were checked using synthetic data; real captured samples were summarized as well.

To complete the cross-port experiment, obtain McDandle's browser URL or source
and exact revision. Run both serially on the same browser/GPU, at equal internal
resolution, with the same roster/stage/rules and equivalent inputs. Separate
cold scene entry from repeated warmed gameplay. Require correct rendering and
game timing, not just an FPS counter; compare CPU and rendering profiles only
after collecting uninstrumented measurements. Keep any imported optimization
isolated until that before/after comparison and gameplay validation pass.
