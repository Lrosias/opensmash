# Native rollback integration

Implemented 2026-09-07 against YouGame's new `room.rollback()` API, read through
its MCP and checked against the published SDK source.

The active casual/ranked/friend online path is `src/rollback-session.mjs` and
`src/rollback-engine.mjs`. BattleShip C/C++ still compiles directly to Wasm;
there is no N64 CPU emulation. Original menus, assets, and touch controls remain.

## Engine contract

The native main function returns after boot for rollback sessions. JavaScript
then owns each complete VI tick. SDL's implicit swap-buffer yield is disabled;
missing optional files don't initiate an asynchronous loader when the package
already stages all assets. A frame that unexpectedly yields fails closed.

The two peers warm up to the same first active battle tick with neutral input,
then use a shared room/round-derived RNG seed, 60 Hz, two input-delay frames,
and ten prediction frames. A build/protocol handshake happens before play.

The SDK's JSON state is a local checkpoint handle plus native diagnostic state.
The actual immutable binary memory pages remain in a bounded client-local ring.
This avoids JSON-encoding hundreds of megabytes per frame. SDK checksum comparison
uses the diagnostic in that handle; it is not a bytewise audit of the whole heap.
No engine checkpoint is shared between clients. A missing/mismatched handle aborts.

Checkpoints include live memory and allocator metadata. Safe exclusions are:

- Texture-upload conversion scratch, fully overwritten before each upload.
- Unused capacity below suspended C stack pointers and above Asyncify stack pointers.
- Unused main-stack space after the frame has returned to JavaScript.
- The unallocated tail of the native scene's bump arena.

Allocator metadata, frame counters, PRNG state, suspended coroutine frames,
objects, collision data, and timers stay in the checkpoint. Unchanged 16 KiB pages
are shared between snapshots. Replayed frames clear stale queued audio and suppress
new audio submissions, so past frames are not queued repeatedly.

A predicted KO does not immediately report a result. The game holds its terminal
state while continuing input exchange until the KO is beyond the prediction window.
Loading an earlier checkpoint can undo it. Desyncs, runtime failures, and prolonged
stalls stop replay and settle a draw before leaving; they do not manufacture wins.

## Validation

- Node tests exercise the downloaded SDK's actual rollback algorithm under jitter
  and packet loss, speculative KO cancellation, and safe failure settlement.
- Checkpoint tests cover immutable history, scratch exclusions, previously unused
  pages becoming live, bounded retention, and invalid handles.
- Browser native rewind test: 60 replayed gameplay frames match exactly.
- Browser paired native test: two independent BattleShip Wasm engines, 240 ticks,
  3–5 ticks of input delay, one dropped bundle in seven, 59 rollbacks per client;
  matching confirmed native state at frame 227 and matching rendered game views.
- Complete native three-stock match: both clients independently reported the same
  winner and 3–0 stocks exactly once; matching confirmed state at frame 858.
- On this desktop, reducing the scanned memory from roughly 318 MiB to 33.5 MiB
  reduced average checkpoint time from about 52 ms to 5.2 ms. This is checkpoint
  time, not an FPS claim or a measurement on phones.
- YouGame MCP `check_build`: ready (root index, referenced assets, SDK, multiplayer,
  friends, and ratings detected).

Local fixtures are in `tests/rollback-engine.html` and `tests/rollback-pair.html`.
The latter uses a generated extraction of the current SDK with a manual test clock;
it does not replace the production SDK. `?ko=1` exercises a full stock-loss result.
See README for generation/serving commands. Fixtures and generated SDK code are not
included in the upload package.

## Release checks still needed

The automated paired test uses two engines in one desktop browser and simulated
transport. A live YouGame match between separate accounts/devices, cross-browser
soak tests, and actual iOS/Android performance/audio checks remain release checks.
The existing engine's fighter/RNG/stock hash is a diagnostic, not a complete
canonical serialization or anti-cheat proof. This implementation does not import
the separate experimental native netplay fork or Smash Remix.

Merged release fingerprint: `0fab2d72406e99b5`.
Artifact: `opensmash-yougame.zip` (42 files, including the v1.6 gallery).
Published through YouGame MCP as v1.7 at https://yougame.co/g/opensmash.
The merge retains every published v1.6 mobile and keyboard change.
