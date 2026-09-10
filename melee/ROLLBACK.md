# Melee rollback development implementation

Updated September 10, 2026. The binary now supports frame-boundary checkpoints and replay,
with an asynchronous prediction/correction timeline and a playable local latency
lab. This is a correctness prototype, **not released Internet netplay**. Normal
Play still uses the existing four-player local mode.

The live uGames `room.rollbackAsync` integration now passes two independently
booted Wasm engines in both buffered and rollback modes. See the
[implemented SDK contract](YOUGAME-ROLLBACK-CONTRACT.md) for versions, ownership,
joint verification and remaining release limits.

## Try it

Build with `python3 melee/tools/build.py`, serve with
`python3 melee/tools/serve.py --port 8197`, then open
`http://127.0.0.1:8197/?rollback` in current desktop Chrome. Start a local match
with two human slots, then click **Start rollback lab**. P1 uses local input; P2's
local controller inputs arrive through a simulated link after 3–5 lab ticks,
with some bundles dropped. Both seats have two frames of input delay. Counters
show actual corrections and replayed frames. **Exit lab** reloads the engine.
This mode is deliberately visible only with the development query parameter.
It runs much slower than ordinary local play.

## Engine boundary

`engine/Rollback.cpp`, `MeleeRollback.h` and `browser.patch` implement:

- Opt-in single-core CPU/GPU execution and synchronous DSP, determinism
  notifications, and an RTC based on emulated ticks and a fixed epoch.
- A VI end-of-field marker serviced **after** the outer `CoreTiming::Advance`
  returns, outside timing callbacks and generated PPC blocks. Execution waits
  on a worker futex; the UI remains available for input and networking.
- Explicit enable, save, load, step, inspect and release commands. Each step
  advances one field. The logical counter starts at the enabling boundary;
  enabling two unrelated engines does not itself synchronize their game state.
- Dolphin's canonical in-memory serializer for CPU, RAM, DSP, timing, devices
  and video state. No raw shared-heap snapshot, worker-stack copy, disk save or
  synchronous main-thread wait is involved.
- Twelve checkpoint frames, divided into 16 KiB pages. Exact comparison shares
  unchanged pages with the previous checkpoint; corrected snapshots replace
  their old frame. This reduces retained memory but still serializes and scans
  the entire state every save. It is **not** dirty-page tracking.
  SDK-managed mode instead keeps each owned token valid until explicit discard,
  including across load and same-frame saves, and fails at capacity rather than
  silently evicting a token. The local lab retains its original automatic ring.
- WebGL staging readback via `getBufferSubData`, replacing unsupported read
  mapping of pixel buffers. Earlier testing exposed snapshots without valid
  framebuffer data until this was fixed.
- Replay suppresses bitmap presentation and outgoing DSP/streaming audio
  samples. DSP and GPU work still execute. Already-played speculative sounds
  cannot be canceled, and corrected sounds are not reconciled individually.
  This is not Slippi-style audio event reconciliation or simulation-only replay.
- Checkpoint serialization and the browser audio mixer share a lock, preventing
  restore from racing with the audio worker's reads of mixer settings.

`src/rollback-engine.mjs` enforces one outstanding asynchronous command, validates
all four complete controller samples and keeps local native checkpoint handles
separate from diagnostics. A failed restore closes the adapter and leaves the
CPU paused; reload rather than continuing partially restored state.

`src/rollback-timeline.mjs` owns frame-indexed inputs, last-known-input prediction,
a seven-frame speculation limit, bounded recording lead, earliest correction,
and confirmed-frame callbacks. Network reception remains possible during an
awaited save/load/step, including an input that invalidates an in-flight frame.
Confirmation happens only after corrections complete. Unit tests use two async
engines with reordered, duplicated and dropped messages. `rollback-lab.mjs`
connects the timeline to the real emulator and two local controller seats.

## Verification

Run `node --test melee/tests/rollback-*.test.mjs` for the eight adapter/timeline
tests. For the actual compiled engine, with the local server running:

```sh
PLAYWRIGHT_PATH=/path/to/node_modules/playwright \
MELEE_SETUP=melee/tests/rollback-match-setup.json \
MELEE_RESULTS=build/melee-web/test-results/rollback-acceptance-final \
node melee/tests/rollback-native.mjs
```

Optional `YOUGAME_SDK_PATH` uses a previously downloaded SDK for reproducibility;
otherwise the page loads the hosted SDK. `MELEE_URL` overrides the localhost URL.
The checked-in setup selects Ness/Kirby and Onett using raw controller input.
Screenshot inspection confirmed an active match, not just menus.

The September 9 run of Wasm SHA-256
`b789d93b350656304f9ceba12d8055d257e77a644c121e0817ead43b036cbf74`
passed restoration and identical replay at depths 1, 3 and 7. A 100-tick simulated
link schedule produced **99 confirmed frames matching uninterrupted execution**,
with **28 rollbacks / 87 replayed frames**. Evidence is in the ignored build
directory's `rollback-acceptance-final/results.json`, `delayed-input.json`,
`events.json` and screenshots. The lab's start and exit controls also passed
through the actual page UI.

These comparisons use CRC32 over emulated main RAM after each frame. They are
useful regression evidence, not bytewise proofs, full-device checksums,
cross-client determinism tests, anti-cheat or evidence for every fighter/stage.
The native test also rejects the WebGL readback errors found in the earlier run.

On this Mac/Chrome active-match run:

| Operation | Observed cost |
|---|---:|
| Serialized checkpoint size | 88,833,524 bytes (84.7 MiB) |
| Warm save | 12.4–15.7 ms |
| Warm load | 3.6–3.7 ms |
| Forward frame | Approximately 16 ms |
| Delayed-input schedule, mean complete tick | 74.3 ms |
| Delayed-input schedule, 95th percentile complete tick | 167.4 ms |

Native operation timings exclude the subsequent RAM checksum and host messaging;
the complete-tick measurement includes those plus save, replay and bridge cost.
This schedule intentionally awaits work and is not a real-network latency or
sustained-FPS benchmark. It clearly exceeds the 16.67 ms budget for 60 Hz play.

## Next implementation gates

1. Replace full-state serialization with a measured compact deterministic
   checkpoint and tracked mutations. Prove which device/video state may be
   omitted; do not copy Slippi's excluded memory ranges into a different engine.
   Keep this full-state implementation as a correctness reference.
2. Add a game update boundary that can replay game logic without full graphics,
   retaining camera and other rendering-associated work that affects gameplay.
   Reconcile audio effects by simulation frame/event identity.
3. Define deterministic startup: build/protocol/ROM revision, rules, ordered
   player seats, seed, fighters, stage and preloaded assets. Wait for both engines
   at the same initial state, verify a canonical checksum, then start the clock.
4. The SDK now supports the [async rollback contract](YOUGAME-ROLLBACK-CONTRACT.md)
   and the Melee adapter is verified. Connect the player-facing room lifecycle,
   authenticated messages and confirmed match-result extraction/submission.
   Never settle a speculative KO.
5. Broaden the two-independently-booted-engine tests to long matches, stock loss,
   projectiles, transformations, stage hazards and rematches; then test real
   identities, network impairment, background tabs and hosted-player isolation.

The [Slippi research](../docs/slippi-rollback-research-2026-09-09.md) explains why
Slippi's optimized game-specific RAM rollback is different from this general
serializer baseline. The existing OpenSmash 64 integration is unchanged.
