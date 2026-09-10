<!-- Current neutral-abort support verified September10: YouGame PR68,
939351bf62e4ed161def5712fc38fb98718fa5fc; rooms deployed before SDK.
Public SDK SHA25617aafda7ae34563194700f28fc359bfa5de973f7b8f33379af16e65a7fc17316. -->
# uGames asynchronous rollback integration

Updated 2026-09-10. The hosted SDK now provides `room.rollbackAsync`, including
awaited opaque checkpoints, replay metadata, confirmed outputs, protocol/round
isolation, buffered play (`maxRollback:0`) and neutral `room.finish({void:true})`.
Verified SDK SHA-256:
`7aee8d9980b4e50dabda76a13d40f7b0237d9c2d561449480629d51ecd3d310a`.

`src/competitive-adapter.mjs` uses that API. Real SDK tests exercise both buffered
and seven-frame rollback controllers, delayed input, checkpoint ownership,
rematches and mismatched startup rejection. Native implementation supplies
version-checked GALE01r2 setup/result hooks and per-handle discard. The default
online configuration uses three delayed frames and no prediction because full
emulator checkpoints exceed the measured rollback frame budget.

Remaining engine work is performance and stronger state diagnostics: reduce the
roughly 89 MB canonical serializer cost, measure real device/network workloads,
and expand the RAM checksum to appropriate CPU/device state. The SDK cannot make
a consistently slow engine meet 60 Hz. Independent native startup and match/set
acceptance must pass before publishing; see SUBMISSION.md for release evidence.

The original proposal is retained below as historical rationale. Its statements
about unavailable APIs describe the September 9 SDK and are superseded above.

---

# Proposed uGames asynchronous rollback contract

This is an implementation proposal for the platform we control, not an API that
the hosted SDK already supports. The local timeline in `src/rollback-timeline.mjs`
is a tested scheduling reference; it is not a complete replacement for the SDK's
room, clock, transport and result handling.

## Concrete incompatibilities

The inspected [hosted SDK](https://yougame.co/sdk.js), downloaded September 9,
2026, has SHA-256
`f700ac80dee61950cdb6868cb9d22ddffbbf488b67433f032129fda33edf5c9d`.
In `makeSync`, `simulate()` immediately JSON-stringifies `o.save()` and calls
`o.step()` without awaiting either. `doRollback()` calls `o.load()` and replay
steps synchronously. Passing our Promise-returning worker adapter would store
`{}` for a pending Promise and overlap engine commands.

`flushPendingChecks()` hashes the JSON saved before frame f+1. Native checkpoints
are local handles: peers that had different correction histories can hold
different handles for the same game state. Timing, size and handles must not
participate in peer checksums. Hashing handles can also miss a real desync if
two different game states happen to have matching handles.

The SDK internally tracks confirmed inputs but exposes no completed confirmed
frame event suitable for committing a Melee match result. Its `step` callback
also cannot distinguish normal execution from replay for presentation/audio.

## Proposed opt-in API

Keep existing synchronous games compatible. Add an explicit async option or a
separate `room.rollbackAsync` factory, with equivalent room lifecycle handling:

```js
const sync = room.rollbackAsync({ // proposed, not available today
  protocol: 'opensmash-melee-rollback-v1',
  round, hz: 60, delay: 2, maxRollback: 7,
  input: frame => sampleController(frame),
  save: async frame => engine.save(), // opaque local token
  load: async checkpoint => engine.load(checkpoint),
  step: async (frame, inputs, {replaying}) => {
    const state = await engine.step(toSeats(inputs), {replaying});
    return {checksum: canonicalDigest(state), result: readMatchResult(state)};
  },
  release: checkpoint => engine.discard(checkpoint), // proposed native export
});
sync.on('confirmed', ({frame, output}) => commitConfirmedResult(frame, output));
sync.on('desync', details => endFailedRound(details));
sync.on('error', error => discardEngine(error));
sync.start(); // only after both engines complete the deterministic ready barrier
```

The example's `canonicalDigest`, result extraction and per-checkpoint discard
are required future adapter work. Current Melee diagnostics cover RAM only, and
the binary retains a fixed ring rather than exposing individual discard.

Required semantics:

1. **One engine operation at a time.** Await saves, loads and steps. Message and
   input collection continue while awaiting; network callbacks only enqueue
   corrections. Handle inputs that invalidate the step currently in flight.
   Apply the earliest correction before publishing any newly confirmed output.
2. **Opaque local checkpoints.** Do not JSON-serialize native tokens or send
   them to peers. Release them on overwrite, prune, stop and error. A delayed
   checksum must not force a native checkpoint to live beyond its ring window;
   retain the small per-frame checksum separately instead.
3. **Frame-specific diagnostics.** Store each completed step's checksum, replace
   it on replay, and exchange/compare it only once that exact frame is confirmed.
   Hash emulated deterministic state, not the current live frame when an old
   input finally arrives. Keep checksum format/version in the handshake.
4. **Explicit effects and confirmation.** Pass `replaying` to step and expose
   monotonic `confirmedFrame`/`confirmed` output after completed corrections.
   Results and achievements commit once, from confirmed outputs. Desync is not
   evidence that either peer won or cheated.
5. **Bounded work and flow control.** Cap speculation, retained states, input
   recording lead and queued catch-up work even when async engine work is slow.
   Agree input delay and neutral initialization. Preserve SDK time-sync behavior
   for peers that start late; report sustained overload separately from network
   stall. Track input arrival time, simulation time and presentation separately.
6. **Lifecycle and protocol isolation.** Scope every input/checksum by round and
   protocol, validate sender and immutable frame inputs, reject malformed/far
   future traffic, and serialize stop/error with in-flight work. A departed peer
   or old rematch message must not resurrect a stopped timeline.

## Responsibilities and priority

**uGames first:** implement awaited engine callbacks, separate state checksums
from save tokens, and expose replay/confirmation metadata. These are the minimum
integration changes. Port the concurrent-arrival and delayed-bundle tests from
`tests/rollback-timeline.test.mjs`; add lifecycle, timeout and rematch coverage in
the SDK. Existing synchronous integrations should retain their behavior.

**Melee first:** reduce checkpoint and replay cost, establish deterministic match
startup, provide a canonical CPU/device-aware digest and confirmed result
extraction. Platform changes alone cannot make the current approximately 89 MB
serializer fit a 60 Hz rollback budget.

**Transport later:** the inspected SDK relays `room.send` over WebSocket, with a
documented-in-source 120-message/s room cap. Keep redundant inputs bundled at
most once per tick. An unordered, unreliable WebRTC data channel with sequence
numbers, acknowledgments, redundant recent inputs, ICE/TURN and relay fallback
is a useful later option to test against reliable-stream head-of-line stalls.
It is not required to prove rollback correctness and will not fix slow emulation.

No platform SDK changes or production uploads were made as part of this local
Melee implementation.

The subsequent competitive UX implementation adds requirements for neutral
technical aborts, explicit per-game timeline IDs, and optional set/rank metadata.
See [the shared competitive handoff](../docs/competitive-ux-research.md#ugames-follow-up).
BO3 scoring already maps to one SDK round; it does not require a new rating engine.
