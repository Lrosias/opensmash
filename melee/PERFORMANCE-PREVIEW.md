# OpenSmash Melee performance preview — 2026-09-09

The complete game runs in the browser, but the current match baseline is below
full speed. This package is for testing YouGame feasibility; rollback is deferred.

## Tested build

Engine SHA-256: `7654b249a07847bec08c7457e9da6f982aa71f504c8645c078d5b3a3866769f4`.
Apple M4 Pro, 48 GB RAM, macOS 26.3, Chrome 152, WebGL 2 through ANGLE Metal.
Canvas 640 × 480; GameCube EFB 640 × 528; target simulation rate 60 Hz.

## Results

| Test | Result |
|---|---|
| Menus after warmup | About 60 FPS / 100% simulation speed |
| Ice Climbers vs Kirby on Onett, 70 one-second samples | Mean 37.79 FPS; median 38.02; range 29.99–40.04 |
| Same match simulation speed | Mean 63.65%; median 64.30% |
| Linear memory | 531 MiB in menus; 628 MiB in the measured match |
| Browser process memory, later gameplay snapshot | Renderer about 1.68 GiB RSS; GPU process about 257 MiB |
| Game data fetched through the match | 53,594,973 bytes, served locally |
| Compressed engine transfer | 21,110,519 bytes in 35 independent gzip parts |
| Audio | Running 48 kHz stereo worklet; non-silent output; no additional ring underruns in the 70-second sample |
| Embedded player replica | Parent non-isolated; child isolated; shared memory, engine workers and WebGL frames passed |
| Performance report | Open and close controls passed inside the sandboxed iframe |

Keyboard input navigated the original menus, selected both local fighters and the
stage, and exercised movement, attack, jump and special during the match. The
first memory-card creation takes several seconds but completes. Game progress is
currently retained only for the running session. The audible quality of slowed
simulation has not been independently evaluated; non-silent samples and buffer
continuity are the verified audio evidence.

These are localhost measurements, not a claim about YouGame's CDN or every stage,
fighter, controller or browser. Two brief embedded smoke tests overlapped part of
the gameplay run. Physical controllers, touch play, mobile devices and a live
YouGame upload remain untested. The final clean gameplay run had no page errors
or reported WebGL errors. The boot screen alone is not a gameplay pass.

## Changes driven by measurements

- Replaced repeated offset-zero `glBufferSubData` streaming with orphaning through
  `glBufferData`. The original profile spent about 58% of samples in uploading
  buffers and 18% in drawing; the replacement removed the severe GPU stall.
- Corrected WebGL's non-reversed depth range, comparisons and clear values. This
  restored the actual 3D game after the initially blank gameplay output.
- Generated smaller functions, 512 PowerPC instructions each instead of 4096,
  while keeping precise floating-point compilation. This reduces huge Wasm
  functions and improves browser compilation and execution behavior.
- Added a narrowly guarded empty-pad-queue idle path for verified GALE01 revision
  2, after disc/card callbacks, with interrupts enabled and no pending exception.
  It wakes through the existing hardware-event scheduler. Deterministic replay
  still needs validation before using this optimization in netplay.
- Enabled the native OS idle loop and fast-disc settings; stream original game
  files lazily through a 96 MiB bounded cache instead of copying the full disc
  into Wasm memory.
- Moved rendering onto its engine worker and transfer at most two outstanding
  GPU bitmaps. A MessageChannel yield lets worker messages run without relying
  on a nested zero-delay timer. Its isolated speed benefit is not established.
- Use shared-memory stereo audio rather than sending a message for every block.
- Corrected overlapping Start keys for the two keyboard seats.

The first correctly rendered Mario-versus-Kirby test ran around 6 FPS. The smaller
functions and idle optimization brought that scene to roughly 36–42 FPS. The
final Ice Climbers test is a different matchup and should not be treated as an
identical before/after benchmark. Remaining samples are spread across generated
game code, CPU dispatch, graphics setup and vertex conversion; there is no spare
60 Hz frame budget for speculative rollback yet.

An experimental Binaryen `-O2` pass reduced transfer size to about 19.94 MB, but
showed no established gameplay benefit and is not used by the preview. The
optional optimizer preserves the input feature set: enabling all experimental
Wasm features emitted imports unsupported by Chrome and was rejected.

## Evidence

`build/melee-web/test-results/gameplay-verification.json` contains the 70 raw
samples and summary; `play-metrics.json` contains the full session. The
`preview-gameplay-final.png` screenshot shows an active match. `embedded.json`
records the iframe test. `build/melee-web/static-check.json` records YouGame's
static-only validation, and `build/melee-web/package.json` identifies the ZIP.

Use the in-game Report button to copy measurements from the hosted build. The
report includes the engine hash so runs can be compared against the same binary.
