# Implemented uGames / Melee async integration

Updated September 10, 2026. The previous proposal is now implemented on both
sides and tested together. The uGames agent in task **Compare rollback support
with SDK** shipped `room.rollbackAsync`; this task added Melee's SDK adapter,
explicit native checkpoint ownership and independent deterministic boot gating.
Neither task needed an additional SDK fix after joint integration testing.

## Version verified

- Live [SDK API documentation](https://yougame.co/sdk.md#asynchronous-rollback-and-buffered-play).
- SDK merge commit `23cbbd4fe8722dd2aa9ee9c3aca877cbb53a2505`, PR #59.
- Live `sdk.js` SHA-256
  `7aee8d9980b4e50dabda76a13d40f7b0237d9c2d561449480629d51ecd3d310a`.
- uGames plugin 1.15.0. The legacy synchronous `room.rollback()` API remains
  available; Melee uses the distinct async factory.

The earlier September 9 SDK audit described real missing functionality in older
SDK bytes. It is no longer the current platform contract.

## Melee adapter

`src/rollback-sdk.mjs` exports `createMeleeSync`. Supply a real SDK room and an
active, paused `NativeRollbackEngine`. Create one controller per round, verify
both peers' initial state, then start. The adapter maps ordered room player IDs
to GameCube ports, adds neutral unused ports, translates native output `hash`
to SDK `checksum`, and accounts for the engine's setup-frame offset.

```js
import {createMeleeSync} from './rollback-sdk.mjs';

const session = await createMeleeSync({
  room, engine, input: frame => sampleLocalPad(frame),
  delay: 3, maxRollback: 0, // use 7 to exercise speculative rollback
  protocol: compatibleBuildAndRulesProtocol,
  onConfirm: ({frame, output}) => recordConfirmedFrame(frame, output),
  onError: (error, {requiresReload}) => showFatalError(error, requiresReload),
});
await verifyBothPeersAtSharedState(); // application-specific ready barrier
session.start();
// Before resetting or reusing the engine:
await session.stop();
```

The example's input, compatibility protocol, shared-state barrier and fatal-error
UI are application responsibilities. The test harness supplies these explicitly;
this adapter does not itself launch Internet matchmaking or choose match rules.
The default protocol identifies the adapter ABI, so production callers must add
their verified build/rules compatibility policy.

The working mode contracts are:

| Mode | SDK behavior | Melee support |
|---|---|---|
| Buffered, `maxRollback: 0` | Wait for actual inputs; no save/load/release | Default adapter mode; three-frame agreed input buffer |
| Rollback, `maxRollback: 7` | Predict, save, restore, replay, release tokens | Supported for correctness testing; still too slow for a 60 Hz release |

`step` receives `replaying`, and `confirmed` fires only after corrections finish.
Our checksum format is explicitly `melee-main-ram-crc32-v1`. It is a development
RAM checksum, not a full CPU/device digest or anti-cheat. Current outputs contain
`checksum` and `engineFrame`; automatic confirmed match-result extraction and
submission are **not implemented**.

## Native ownership and failures

In SDK-managed mode, each save creates a local token that stays valid until
discarded. Load does not consume it or invalidate later snapshots. Same-frame
saves do not invalidate each other. Capacity is twelve owned tokens; exceeding
capacity fails rather than evicting an SDK-owned token. The adapter caps rollback
at seven and rejects unreleased setup checkpoints before creating a session.

Native control operations added for integration:

- `discard(checkpoint)`: release one handle; leave stepping active.
- `checkpointStats()`: report live handle count and reusable scratch bytes.
- `manageCheckpoints()`: select explicit ownership on an empty history.
- `waitForBoot()` with the `rollback-boot` native argument: pause at the first VI
  boundary. Browser test entry point is `?rollback=boot`.

`NativeRollbackEngine.release()` still exits the entire frame gate and resumes
normal execution. It must **never** be used as the SDK's per-token release
callback. `await session.stop()` drains in-flight work and owned tokens first.
Reusable serializer scratch may remain allocated after all tokens are released.

Fatal errors set `session.requiresReload` and call
`onError(error, {requiresReload: true})`. The caller must reload the page or
terminate the actual worker/runtime before another match. `engine.destroy()`
only closes the JS driver; it does not free the Wasm runtime or its memory.
Do not resume a partially restored match, and do not call whole-engine release
concurrently with SDK cleanup. A permanently hung engine may require immediate
external teardown because an awaited operation cannot be forcibly canceled.

## Joint verification

`tests/rollback-sdk-native.mjs` runs two independently booted Wasm engines in
Chrome with the exact live SDK. The test exposes only the SDK's room factory and
substitutes delayed local transport. The SDK controller code is unchanged.

The strengthened acceptance run passed:

- Identical first-VI RAM CRC `438640146` on independent boots.
- All 471 setup frames matched, including entering Ness/Kirby on Onett.
- Buffered mode: 120 common confirmed frames, zero SDK saves/loads/releases.
- Rollback mode: 124 common confirmed frames; peers performed 27/21 corrections
  and 63/58 replayed steps. All 187/184 saved tokens were released.
- Zero outstanding SDK tokens/native handles after awaited stop, and no errors.
- Independent earlier, later and same-frame tokens remained loadable until
  explicit discard. Renderer/native error assertions passed.

The staged Wasm build for this run has SHA-256
`39fec373b63366356a99502ccecba25475bf8e38f639bc3dd769b4e77a8b9a2b`.
Running two engines on the same machine took 6.85 seconds for buffered mode
and 12.0 seconds for rollback mode (about 17.5/10.3 common confirmed frames per
second, including test overhead and local contention). This is correctness
evidence, not a single-client 60 FPS performance claim.

The uGames agent independently inspected the report and screenshot, reviewed the
adapter/native ownership code, and ran 19 SDK async tests including corrections
arriving during load and stop during load. Melee's eight unit tests additionally
cover pad mapping, frame offsets, invalid inputs, ownership and fatal teardown.
The strengthened native acceptance harness also checks independent token lifetime,
page/native/WebGL failures, and records elapsed runtime per mode.

Run from the OpenSmash repository with the local server on port 8197:

```sh
curl -fsSL https://yougame.co/sdk.js -o /tmp/opensmash-rollback-integration-sdk.js
PLAYWRIGHT_PATH=/path/to/node_modules/playwright \
YOUGAME_SDK_PATH=/tmp/opensmash-rollback-integration-sdk.js \
MELEE_RESULTS=build/melee-web/test-results/rollback-sdk-acceptance \
node melee/tests/rollback-sdk-native.mjs
```

Evidence lives in ignored `build/melee-web/test-results/rollback-sdk-native/`
and `rollback-sdk-acceptance/`. The test's browser flags disable background
throttling to isolate correctness. Ordinary background-tab behavior, real hosted
matchmaking/relay, other devices and a desktop-native executable are separate
acceptance gates. No new game build was published in this integration task.

The next engine priorities remain compact checkpoints, cheaper replay, a broader
determinism matrix and confirmed result extraction. SDK availability removes the
API blocker; it does not remove Melee's performance or deployment gates.
