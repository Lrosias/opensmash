# Browser netplay performance coordination

Owner: Codex task in `/Users/luis/.codex/worktrees/7f5f/OpenSmash`, branch
`codex/netplay-performance`. September 11, 2026.

## Verified facts

- Isolated checkout now uses release fork main `b2f39fa`; initial default
  `419d195` was stale. Shared dirty main checkout is untouched.
- Current Original 1.10 / Remix 2.9 Casual and Friends use
  `NativeRoomSession` → `room.lockstep({hz:60,delay:2})`.
- That native-menu path saves no rollback snapshots. The older checkpoint
  measurements do not establish the cause of this report.
- Production SDK downloaded to `/tmp/netplay-performance-sdk.js`. Its lockstep
  clock stops advancing when stalled two frames ahead; fixed delay 2 leaves a
  small input pipeline. SDK already supports `delay:'auto'`.
- Released packaged engines available in
  `/Volumes/OpenSmashBuilds/publisher/build/native-menu-mobile-release-20260911-r1/{original,remix}`.
  Mount helper verified existing volume and storage headroom.
- Exact affected game, devices, network topology, and measured live timings
  remain unknown. No physical iOS performance claim.

## Ownership

- This task: performance fixtures and this note; requesting timing-option
  ownership in `yougame/src/native-room-session.mjs` from online owner.
- Online task `01a0890a-d42c-7ae0-b856-d50b09a7ec56`: correctness/acceptance.
- Rotation task `01a08ed5-2227-7d43-87b4-8c79315f5a3e`: touch/index/style;
  this task makes no edits there.
- Claude Fable endpoint/worktree not supplied; no contact claimed.
- Board controls release; this task will commit and hand off, never deploy.

## Hypothesis and next experiment

Measure the actual downloaded SDK in a deterministic two-peer latency fixture,
comparing fixed 2 versus its existing automatic input buffering. Record
simulation rate, presentation opportunities, stalls, and cross-peer input/state
agreement. Separately measure released engine step time with no network, then
with the SDK, to distinguish transport waiting from emulation/main-thread cost.

## Demonstrated remedy and release handoff

The online owner transferred the delay/status boundary in its durable
`docs/netplay-performance-handoff.md` at 07:35 UTC. Runtime changes are now
limited to `yougame/src/native-room-session.mjs`: use existing SDK `delay:'auto'`
and remove the inaccurate fixed-two-frame status. No SDK, Wasm, snapshot,
port mapping, result, touch, or layout changes.

Measured in Chrome 152.0.7977.83 on this Mac using released engines, one real
Mario/Kirby Dream Land engine and a synthetic transport peer. Each case spans
six seconds, includes initial transport filling, muted output, and visible page.
No full native-menu lifecycle or physical iOS benchmark is claimed.

| Edition / condition | Simulation FPS | New-state presentation opportunities/s | Mean engine step ms |
| --- | --- | --- | --- |
| Original, no transport | 59.82 | 59.49 | 1.27 |
| Original, 100 ms / fixed 2 | 35.16 | 34.83 | 1.50 |
| Original, 100 ms / auto | 58.99 | 58.66 | 1.24 |
| Original, 160 ms / fixed 2 | 23.33 | 23.16 | 1.29 |
| Original, 160 ms / auto | 58.49 | 58.32 | 1.27 |
| Remix engine, no transport | 59.83 | 59.66 | 1.30 |
| Remix engine, 100 ms / fixed 2 | 34.33 | 34.16 | 1.19 |
| Remix engine, 100 ms / auto | 58.99 | 58.49 | 1.42 |
| Remix engine, 160 ms / fixed 2 | 23.33 | 23.16 | 1.18 |
| Remix engine, 160 ms / auto | 58.49 | 58.15 | 1.10 |

No recorded long tasks in these runs. The Remix engine test uses the same base
fighters; it does not qualify all custom fighters. Render numbers count rAF
observations with new game state, not physical scanout. Synthetic peer disables
engine checksums in this browser cost fixture; separate production-SDK fixture
compares every common simulated state and enables checksum exchange.

At 160 ms the engine still needs only ~1.3 ms per frame while input waiting
stretches frame intervals, demonstrating transport starvation in this scenario.
The user's actual 5 FPS cause still needs real-device/network timings. In the
SDK-only extreme 800 ms case, auto improves 4.8 to 14.4 FPS, still unsuitable.

Automatic buffering trades higher local input latency for continuous game
speed. The current SDK starts from `ceil((room.latency+20)/16.67)`, clamps to
1–10 frames, uses five frames when RTT is unknown, and may only raise buffering
within the first 180 simulation-clock ticks. It never predicts or drops a
confirmed simulation frame. This is not a rollback implementation or Slippi
parity claim. Later latency spikes and asymmetric relay paths remain limitations
for Claude's independent transport investigation.

Validation: 33 targeted tests passed, including production SDK transport timing,
checksum/state agreement and jitter, sparse stable ports, stale scopes,
results/rematches/departure, legacy rollback convergence and online lobby input
ownership. Diff whitespace check passed. Actual battle screenshot inspected.
All raw summaries and engine/SDK hashes are in
`docs/netplay-performance-measurements-20260911.json`.

Release build instructions: apply the scoped commit on current release main;
for Original and Remix, copy the CURRENT released package to a fresh staging
folder, overlay only `yougame/src/native-room-session.mjs` as
`native-room-session.mjs`, and regenerate its app build/compatibility fingerprint
using the release operator's existing frontend-overlay procedure. Original1.10
and Remix2.9 packaged native-room-session files both hash
`e257317f9589a939ff8ad6158040e6415a53bedfefee6f0f90a939402cd48e2c`, matching
this branch's parent exactly. Preserve any newer rotation package when batching.
No engine compile is needed. Do not use the stale shared-main frontend source.
Melee and Ranked are outside this narrow fix. Board-controlled operator alone
publishes. Postrelease retest: both users reload, join Friends/Casual, navigate
native menus and play a full match; report offline vs online smoothness and
input latency on the affected iOS devices.
