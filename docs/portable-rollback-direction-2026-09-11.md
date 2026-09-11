# Portable rollback direction

Luis’s September 11 direction: use Slippi as a reference while keeping YouGame broadly extensible across games and emulators. Accept a performance gap where necessary for a general solution. This is a researched proposal; no delay, prediction, or pacing default was changed.

## Observed implementation

Slippi Dolphin v3.6.4 (`e7711b104b339a99385f2bb12b472d46140a7bc7`) defaults to a fixed two-frame input delay, manually configurable. Prediction depth varies with input arrival within a seven-frame cap. Its peer-offset synchronization dynamically adjusts pacing. Those are distinct mechanisms; normal input delay does not automatically expand and contract.

- [Delay configuration](https://github.com/project-slippi/Ishiiruka/blob/e7711b104b339a99385f2bb12b472d46140a7bc7/Source/Core/Core/ConfigManager.cpp#L633)
- [Prediction limit](https://github.com/project-slippi/Ishiiruka/blob/e7711b104b339a99385f2bb12b472d46140a7bc7/Source/Core/Core/Slippi/SlippiNetplay.h#L31)
- [Peer timing and pacing](https://github.com/project-slippi/Ishiiruka/blob/e7711b104b339a99385f2bb12b472d46140a7bc7/Source/Core/Core/HW/EXI_DeviceSlippi.cpp#L1543-L1653)

Released OpenSmash Melee 1.11 uses `delay=3,maxRollback=0` through YouGame `rollbackAsync`: delay-based lockstep through a rollback-capable interface. It waits for required inputs rather than predicting. Source: `melee/src/competitive-adapter.mjs`, `melee/src/rollback-sdk.mjs`; release 6ce09f5. Verified SDK SHA-256 c7087e338cdacd355b569dae4898db37e89aee97eed9d194919b3f6051fa3357, YouGame193d9b6.

## Shared SDK versus adapters

| YouGame shared SDK | Game/emulator adapter |
| --- | --- |
| Frame-indexed input delivery, acknowledgments, retransmission | Controller mapping |
| Fixed delay, bounded prediction and correction | Complete state capture/restore |
| Checkpoint ownership and serialized async operations | Deterministic single-frame execution |
| Peer timing, filtered offset and bounded scheduling adjustments | Engine/core/device scheduling and RNG state |
| Confirmed-frame events, checksums and desync handling | Results, audio/rendering/rumble effects |
| Compatibility negotiation, diagnostics and resource limits | Optional selective snapshots and replay optimizations |

Slippi’s [selective snapshots](https://github.com/project-slippi/Ishiiruka/blob/e7711b104b339a99385f2bb12b472d46140a7bc7/Source/Core/Core/Slippi/SlippiSavestate.cpp#L50-L127) contain Melee-specific memory addresses/exclusions. Its [sound reconciliation](https://github.com/project-slippi/slippi-ssbm-asm/blob/fcf47f10dc244152c2ebaa3a9dec142ea42243b7/Online/Core/LoopEngineForRollback.asm#L49-L82) uses game patches. These must not become shared SDK assumptions.

The minimal adapter boundary is save, restore, advance exactly one frame, checksum, release, and stop. Capabilities include tick rate, deterministic compatibility, state format, and resource limits. Checkpoints represent precise frame boundaries. Replay consumes recorded inputs, never fresh controller samples. Operations are serialized, including teardown. The SDK confirms external events/results; adapters prevent duplicate presentation effects and may reconcile speculative effects.

Full snapshots are a valid baseline. A checksum detects divergence; it does not fix nondeterminism. Each engine needs complete snapshots, deterministic replay, and measured memory/replay cost before prediction is enabled. Delay-only deterministic lockstep remains a fallback; engines without determinism may require an authoritative networking mode.

## Proposed order

1. Formalize existing async adapter capabilities, compatibility, diagnostics and lifecycle.
2. Add generic peer simulation-offset measurements and bounded pacing. Measure actual peer transport, not only room-server ping. Adjust frame scheduling, not physics timestep.
3. Qualify each engine’s restore/replay correctness and cost; enable prediction within measured limits.
4. Allow optional adapter-local snapshot, rendering and audio optimizations.

Do not hard-code Melee’s two-frame delay or seven-frame prediction cap globally. Defer continuously varying input delay; it is not necessary to reproduce Slippi’s core design. This investigation is separate from the active browser online acceptance gate.

## Native-menu product correction

Luis clarified the browser acceptance target during hosted testing: YouGame assigns a stable lobby seat/controller port, and the players use the actual game's character selection, stages, Start, gameplay and results. HTML replacements for those native screens do not satisfy acceptance. Prior custom-lobby test results remain regression evidence only.

The existing N64 wrapper intentionally pauses its menu and launches a separate preconfigured battle after HTML selection/Ready. Its four-port battle mapping is reusable, but an unoccupied native menu port must be disconnected (`null`), not a connected neutral controller. Local input index and global participant slot are different identities. Melee similarly forces configured matches through its current adapter.

For the first Original/Remix Casual path, the platform may internally begin the room's input round after the players connect, without an HTML Ready/Start step. The native game alone handles its own Start action. Qualify deterministic lockstep across native menus and scene transitions before enabling prediction there. Preserve a native engine across the results/menu lifecycle rather than replacing the game's result screens.

Two adapter-specific fixes are required by observed source: N64 menu random choices read host wall-clock time, and its battle diagnostics accumulate time across matches. Deterministic simulation time and explicit scene/battle boundaries are general adapter requirements; their implementation in this port is N64-specific.

The larger YouGame improvement is to separate a continuing synchronized input session from scored matches. Current SDK sync helpers require an active scored-match roster and stop on its result. A portable session needs an agreed membership epoch and frame boundary, stable seat ownership, and deterministic restart/replay or qualified state transfer for joining clients. Local checkpoint handles alone cannot initialize a new peer. This API extension is proposed, not implemented or released.

Melee needs separate qualification of normal-menu stepping, controller connection masks, and results outside its forced-match adapter. N64 success does not establish Melee correctness. Ranked set rules remain a distinct layer; this correction does not silently remove best-of-three or counterpick rules.

## Deterministic devices versus game-specific policy

The Melee native-menu investigation found a concrete emulator-device issue: Dolphin's memory-card initialization paths derive header time, serial and checksums from the host clock even when the emulated RTC is fixed. Two peers first diverged in 17 bytes of a header during native post-results progression. Both the raw-card constructor and the default folder-backed card's separate EXI initialization now use the emulated clock during rollback. Existing-card reads and offline behavior retain their current paths. Compiled fixtures verify both production clock expressions; staggered native boots then matched through 18,821 frame states, two matches, results, progression screens and native No Contest. Hosted app acceptance remains separate.

The portable requirement is broader than setting a game's RNG: initial persistent/device state, clocks, controller attachment and storage metadata must be agreed and deterministic. This implementation belongs in the emulator adapter, while the shared SDK should negotiate compatibility and detect disagreement. It is not a Melee memory-address optimization. No Melee progression, award or results screen is bypassed by this fix.
