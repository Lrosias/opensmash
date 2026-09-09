# Browser performance changes

September 8, 2026. Local build `d75c5bc145139c10`, based on merged v1.7 (`c88f3e3`).
These changes were subsequently merged with v1.8 and the other performance task
and published as v1.9. See [RELEASE-MERGE.md](RELEASE-MERGE.md).

## Implementation

- Offline simulation now runs from one requestAnimationFrame driver at 60 Hz.
  It caps catch-up at two ticks, discards long pauses, stops while the document is
  hidden, and resets on resume. A 1 ms boundary tolerance handles rounded rAF
  timestamps without accumulating extra simulation time. SDL's redundant
  Asyncify yield is disabled. Native scene coroutines still use Asyncify.
  Each catch-up tick currently renders; rendering once per display callback is
  not implemented. The SDK continues to own online rollback timing.
- AudioWorklet consumes a bounded 8,192-frame stereo PCM ring on the audio thread.
  Shared buffers avoid per-tick message serialization. The consumer resamples to
  the audio device rate, counts underruns/overflow, and acknowledges rollback
  flushes before consuming new audio. Replays suppress speculative submissions.
  Output resumes from keyboard/touch gestures; engine disposal closes its context.
  SDL remains the fallback when cross-origin isolation, SharedArrayBuffer or
  AudioWorklet is unavailable, or worklet initialization fails. A processor error
  after initialization silences output; dynamic backend recovery is not implemented.
  `SSB64_YOUGAME_AUDIO=SDL` forces the fallback for diagnostics.
- Browser texture scratch starts at 64 KiB and grows to actual upload needs,
  bounded at 256 MiB. Every decoder checks capacity before writing. Scratch
  exclusion metadata resides in Wasm so checkpoint restoration also restores the
  allocator/pointer metadata. Native desktop retains its previous preallocation.
- Initial Wasm memory falls from 512 MiB to 192 MiB; growth remains enabled.
  Linear memory is not the browser's total or resident memory footprint.
- Both browser file loggers are disabled by default. `SSB64_FILE_LOG=1` enables
  diagnostics: the port log stops at 1 MiB; libultraship rotates one 1 MiB backup
  alongside the active 1 MiB file. Browser console logging defaults to warnings.
  The native 16-second WAV diagnostic capture is also opt-in in browsers
  (`SSB64_AUDIO_DUMP=1`). Desktop file-logging behavior is unchanged.

## Validation

All browser simulations use a zero-gain output while audio processing stays active.

- Release Wasm build succeeded. Native patch reverse-application checks passed.
- 44 Node tests passed, including 30/50/60/90/120/144 Hz clocks, rounded 120 Hz
  timestamps, background/resume/disposal, PCM ordering, rate conversion, bounded
  buffering, rollback flush, uint32 counter wrap, and existing input/SDK tests.
- Chrome AudioWorklet consumed 1,877 source frames during an intentional 60 ms
  main-thread block; queue flush left zero buffered frames. Output was muted.
- Actual Wasm checkpoint test: 60 replayed frames matched exactly; 33.4 MiB of live
  pages captured, about 62 MiB native high-water memory. This accelerated diagnostic
  measured roughly 25 ms per save with a 64-frame history and is not a production
  one-client frame-time benchmark.
- Full three-stock two-client test used the real SDK rollback algorithm with
  simulated 3–5-frame delay and one dropped input bundle in seven. Both clients
  matched at confirmed frame 858 and reported p0 winning 3–0 exactly once. Each
  exercised one rewind. Accelerated completion took 49.9 seconds in this session;
  it must not be compared to earlier-session timings as a controlled speed test.

- Changing-input two-client scenario: 59 rollbacks each, identical confirmed
  state at frame 227; accelerated test took 26.6 seconds.
- Forced SDL fallback: audio context running, 60.03 ticks/second over 30 seconds,
  maximum tick interval 24.32 ms, no interval above 25 ms, no file/memory growth.
  The SDL callback does not expose the custom ring underrun counter.
- Native menu selection and return passed (scene 7 → 8 → 7) using native
  controller inputs through the local muted harness. The active simulation was
  stopped after verification.
- YouGame MCP `check_build` returned ready for all 46 packaged files.

## Final steady-play sample

Chrome, foreground 1728×833, 120 rAF callbacks/second, muted audio processing
active, 30 seconds on Dream Land. Raw data: [chrome-optimized.json](chrome-optimized.json).

- 60.00 simulation ticks/second; tick span p95 3.09 ms, max 7.85 ms.
- Tick interval p95 18.21 ms, max 21.51 ms; none above 25 ms.
- No observed long tasks, file growth, or Wasm memory growth.
- Zero new audio underruns (109 before and after; startup counted separately),
  zero buffer overflows.
- 192 MiB linear memory, approximately 62.1 MiB native high-water memory,
  64 KiB texture scratch in this scene.

Earlier final-build candidates exhibited 120 Hz boundary jitter and an automatic
WAV diagnostic allocation. Those findings drove the clock tolerance and opt-in
WAV capture changes; the numbers above come from the corrected build. This is a
short favorable sample, not proof that affected devices are stutter-free.

## Reproduction and limits

Build with the pinned engine sources and current patches; see the existing build
instructions. Serve the repository root with
`PORT=4176 node yougame/tests/serve.mjs .`, then open:

- `/yougame/tests/performance.html`: warm the battle, then measure 30 seconds.
  The baseline selector requires a locally archived v1.7 dist at
  `yougame/test-results/v1.7/`, which is intentionally not shipped.
- `/yougame/tests/audio-worklet.html`: muted audio-thread blockage test.
- `/yougame/tests/rollback-engine.html`: native checkpoint replay.
- `/yougame/tests/rollback-pair.html` and `?ko=1`: changing-input and full-match tests.
- `/yougame/tests/mobile-harness.html?menu=1`: native menu with mapped controls.

The local server provides COOP/COEP headers needed for the shared audio path.
Production hosting must provide equivalent cross-origin isolation; otherwise SDL
is selected. Tests use a powerful desktop, not affected phones. No claim is made
that all reported stuttering is fixed, or that browser performance equals native
on every device. Worker rendering, SIMD, shader prewarming and a native desktop
benchmark remain future work requiring measurements on affected hardware.
