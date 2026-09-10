# OpenSmash Melee Lite performance — 2026-09-09

The current v1.2 build removes synchronous asset loading during play, trading
more startup work and memory for fewer selection freezes. It still falls short
of the 60 Hz competitive target. Online rollback remains deferred. Measurements
for the earlier Lite build are retained below; the original preview's evidence
is in PERFORMANCE-PREVIEW.md.

## Menu and action-stall investigation (published v1.2)

The opening screen was redesigned and the title overlay removed during play.
This update addresses asset-induced pauses; it does **not** establish steady
60 FPS throughout active gameplay.

A fresh-browser test at 80 ms simulated network latency confirmed a 329.62 ms
frame gap when confirming Captain Falcon. Four compressed asset requests ran
serially, taking approximately 94, 84, 84 and 85 ms. Repeating the same selection
with those assets in the decoded cache had a 24.81 ms maximum gap. The old
`Assets.cpp` performed synchronous fetch and zlib decompression while holding a
global cache mutex on an engine worker. Its 96 MiB LRU could also evict assets.

The replacement asynchronously downloads eight blocks at a time, validates each
compressed SHA-256, decompresses before boot, then fills immutable Wasm memory.
The gameplay file backend now only copies prepared bytes; it cannot fetch,
decompress or evict them. All 1,206 blocks (580,015,843 decoded bytes) are ready
before simulation starts. CacheStorage preserves compressed blocks by hash;
reload testing reused all 405,761,344 compressed bytes without asset downloads.
Storage failure is nonfatal and reported; it does not start a partially prepared
game. Startup progress and retry errors are visible.

The same cold-selection sequence then averaged about 60 FPS with a 32.78 ms
maximum frame gap, versus 329.62 ms previously. Repeated selections had a 35.33 ms
maximum, zero asset misses and zero gameplay asset requests. These are bounded
measurements on one M4 Pro, not a guarantee of every frame meeting 16.67 ms.
Wasm memory increased from 533 MiB to 1,125 MiB; first-load latency and memory
are explicit tradeoffs for removing synchronous disc I/O from gameplay.

A separate Bowser/Young Link Onett run still ran around 36–40 FPS during active
play. First-use effects produced a 309 ms gap with no asset reads; shader
compile/link checks reached 102.78 ms individually. Shader timing increased from
about 683 ms after match entry to 1,833 ms after action testing. Scene entry also
had a roughly 961 ms gap. Thus asset loading and synchronous shader compilation
are separate stall sources, and sustained engine throughput is another limit.
The report now records frame gaps, asset misses, shader counts and shader time.

An exclusive precompiled ubershader experiment was rejected: it counted frames
and played audio but rendered a black image under this browser backend. It is
not enabled or included as a player option. Skipping draws to conceal compilation
was not used. A correct shader warmup/fallback renderer and further engine work
remain necessary before claiming steady competitive-speed play.

A fresh eight-second profile of the validated engine during active play found
6,431 non-waiting samples out of 6,481 on the CPU emulation worker. Hot stacks
included `PowerPCManager::RunLoop`, recompiled game dispatch, floating-point
math and `GatherPipeBursted`. The graphics worker had 1,985 futex-wait samples
out of 6,430. This supports CPU-side engine throughput as the sustained-speed
bottleneck in that scene; it is not evidence that faster downloads or an FPS
counter change would restore 60 Hz. The profile is diagnostic instrumentation,
not an uninstrumented FPS benchmark. See `stalls-final/profile-summary.json`.

Evidence: `build/melee-web/test-results/stall-comparison.json`, the
`stalls-baseline`, `stalls-fixed`, `stalls-match`, and `stalls-uber` directories.

The exact uploaded build also passed the hosted iframe check: a non-isolated
parent, isolated child with shared memory, actual roster rendering, working
Report/Back controls, zero failed loads and zero page/engine errors. The idle
roster measured 60.06 FPS with zero asset misses and 1,125 MiB memory. This is a
boot/isolation smoke test, not an active-match benchmark. Evidence:
`test-results/stalls-hosted-embedded.json` and its inspected PNG. As in the earlier
hosted test, the parent fixture uses an allowed YouGame origin and the child
uses the real CDN's unmodified headers and resources.

Published as minor v1.2 at https://yougame.co/g/opensmash-melee from upload
`3572bfc0f1fb406db12840f0a124f143`. The public version and versioned engine
manifest were checked after publication; the live SHA-256 is
`41dc523fd7a106af0f5da48a65ebe1da3dcafad019c55418b6b23f1241effa56`.

## Earlier v1.1: clean local measurement

Apple M4 Pro, 48 GB RAM, macOS 26.3, headed Chromium with WebGL 2 through
ANGLE Metal. Engine SHA-256:
`f595159db56234c4958abb08f91ae8080d3542d265a6c606af7aa606d331c3b6`.
Original game simulation targets 60 Hz; it is not accelerated or frame-skipped.
Internal game rendering is 320 × 264 EFB with a 320 × 240 output bitmap. The page
scales that bitmap to its display canvas. CPU simulation and graphics run on
separate workers. No resolution enhancement or antialiasing is requested.

| Metric | Earlier preview | Lite |
|---|---:|---:|
| Ice Climbers vs Kirby on Onett, mean FPS | 37.79 | 40.78 |
| Median FPS | 38.02 | 41.01 |
| Mean simulation speed | 63.65% | 68.50% |
| Match linear memory | 628 MiB | 533 MiB |
| Game assets fetched through the measured match | 53,594,973 bytes | 20,035,972 bytes |
| Cinematic data in build | 850,650,656 bytes | 0 |
| All packaged game asset bytes | 1,430,666,499 decoded | 405,761,344 compressed |

The Lite window has 50 one-second samples (93.757–142.757 seconds after page
navigation), with a 29.01–44.02 FPS range and no new audio ring underruns. The
match was active, with fighters mostly idle for measurement; action inputs and
recording followed outside that window. The earlier baseline used 70 samples,
the same matchup and stage, and a different run/browser release. This is a useful
comparison, not an isolated laboratory measurement of one optimization.

A first 240p test with CPU and graphics sharing a worker remained around 35–37
FPS. Separating them raised a restored Ice Climbers/Peach match to about 45–47
FPS, but that short test and its different matchup are not the acceptance
benchmark. State loading grew the heap to 767 MiB; the clean run above never
loaded a state. Software-rendered headless browser runs are not comparable to
these hardware-GPU measurements.

## Earlier v1.1: lightweight changes

- Direct boot at versus character select after normal global initialization;
  all 25 fighters are unlocked. Main-menu and single-player destinations are
  redirected to versus. No intro or memory-card creation is needed.
- Removed 28 unreachable movie files, totaling 850.7 MB. Remaining data stays
  streamed in independently compressed 4 MiB blocks through a bounded decoded
  cache. All 1,206 blocks / 1,186 files were decompressed and checked against
  their original full-file hashes.
- Reduced EFB width and height by half and corrected fractional scaling paths.
  This quarters the primary framebuffer pixel count. Kept original game assets,
  gameplay timing, music and effects.
- Separated CPU and graphics work. Removed the per-frame WebGL error query.
  Previously measured buffer-streaming and small-function recompilation
  optimizations remain enabled.
- B0XX keyboard preset, analog modifier angles, light shields, C-stick controls
  and SDK remapping; other keyboard seats are empty to avoid key collisions.

## Earlier v1.1: verification and limits

Verified direct boot/full roster, keyboard selection and movement, jumping,
attacking, special attacks and shield, a second standard Gamepad API input seat,
Onett gameplay, audio production, pause and the original quit-to-results flow.
The input math has focused tests. The full-framebuffer renderer and 240p renderer
were both visually inspected while developing fractional scaling.

Evidence lives in `build/melee-web/test-results/lite/verification.json`, with raw
samples, console output and screenshots beside it. The embedded isolation and
Report check is recorded separately as `lite-embedded.json`. The package report
and MCP static check describe delivery, not measured hosted gameplay performance.

The test is local and covers one main matchup. Physical controllers, phones,
other GPUs, all stages and every fighter's moves have not been validated. Audio
is non-silent and its ring remains fed; subjective quality at slowed simulation
has not been certified. Threaded local execution has not passed rollback
replay/determinism tests. Download and memory reductions do not make this build
competitive-speed ready.

## Earlier v1.1: hosted Lite verification

The staged build at `aa6fcc62b1f747e085122a7e40e1756a.yougame.co` passed a
Bowser-versus-Kirby match on Onett, including keyboard movement/jump/attack/special,
second-seat controller input, audio, pause and quit to results. Ten late-match
samples averaged 44.20 FPS and 74.18% simulation speed, with 533 MiB linear memory,
320 × 240 bitmaps and no additional audio underruns. This is a different matchup
and short smoke test, not a replacement for the clean local benchmark. There were
no page or engine errors. See `test-results/lite-hosted/verification.json`.

The final hosted iframe test also passed: a non-isolated parent, isolated child
with shared memory, live 320 × 240 frames, working Report controls, no failed
resource loads and no page/engine errors. The test parent was fulfilled locally
through Playwright at an allowed YouGame origin, because the hosted CSP correctly
blocks localhost ancestors; the child used the real CDN's unmodified headers and
resources. Evidence: `test-results/lite-hosted-embedded.json`.
