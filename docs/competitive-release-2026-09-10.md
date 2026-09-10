# Competitive release coordination

This task owns releases of `opensmash64`, `opensmash64-remix` and
`opensmash-melee`. No production game update has been made during this release
task yet. Coordinator: task `01a08885-d751-70f3-b95b-e3d8c29c5ce3`.

## Source integration

- Working directory: `/Users/luis/.codex/worktrees/6e4e/OpenSmash`.
- Branch: `codex/competitive-release-20260910`.
- `be85198`: original/Remix competitive sets, profiles, controller integration,
  match clock, native tests, preserved source and performance changes.
- `cb0cdff`: merges existing `b2e071a` performance history and upstream main
  `419d195`, preserving newer competitive implementation and release history.
- `7183e21`: reviewed platform controller facade and menu input contract.
- `13a9f9c`: reviewed shared Melee SDK bridge handoff, extended with native match metadata.
- Final Melee source integration reviewed; commit/publication follow exact-candidate acceptance.
- Original dirty checkout is not reset or swept into a commit. Native runtime
  rebuilds use exact backups when updating existing external build inputs.

## 64 acceptance and staged builds

Both editions pass 103 unit tests, actual two-Wasm three-game sets with character
counterpicks, packet delays/loss/rollback and matching 2–1 results. Desktop,
landscape and rotated-phone clock/menu tests pass. Public staged native startup
has correct isolation, rendered menus and no JavaScript errors/failed requests.

| Edition | Folder | Build | Upload |
|---|---|---|---|
| Original | `build/competitive-original-frozen` | `f2d1b6efcf273a49` | `8e6ef30ae69347eea874d5d00049129b` |
| Remix | `build/competitive-remix-frozen` | `4dd7a725016e90c8` | `52b5a880b30e489aa6d55a8808d2f756` |

Static `check_build` and uploader verdicts are ready. Public staged native
startup passed both corrected uploads. Original’s official disposable-player
session `3034d9c5069e4f87989209be8eb52f72` is running hosted acceptance. The earlier
login approval block was re-reviewed and approved; credentials remain private.
Remix now overlays exact immutable livev2.2 native assets from upload
`47c85145b7c0407fbd3ea4df3ef50853`. The earlier clock package accidentally used
unfinished shared native output and is explicitly superseded. See
[verified native provenance](../yougame/NATIVE-RELEASE-PROVENANCE.md).

## Melee acceptance and remaining release work

Final engine SHA `ec79f2015598d73f4031613634cb0ee4463e58b10290862ed67116141bc983f6`
passed deterministic independent startup, 240 identical-input frames, seven-frame
replay, real four-stock elimination, and selected Zelda/Sheik form and stage checks.
Two native engines plus the actual deployed SDK complete a full 2–0 ranked set,
Fountain→Final Destination, with character counterpicks and one agreed result.
Local transport deliberately delays/drops packets; hosted acceptance is separate.

The shared `createMeleeSync` owns frame offsets/checkpoint lifetimes. Native match
proxies expose actual frame, managed checkpoint operations, result metadata,
optional bounded shader-cache persistence and immediate hung-operation teardown.
Independent review confirmed live1.6 compiler, shader, rendering and streaming
performance improvements remain present. HTTP compression is explicitly enabled
in `yougame.json`. 27 unit tests, actual DOM/raw-controller menu flows and native
startup/cancellation lifecycle tests pass. Final staged folder is
`build/competitive-melee-final/dist`; exact hosted acceptance remains outstanding.

Default Melee online play uses a three-frame buffer with `maxRollback:0`.
Full native snapshots are88,833,524bytes and cost approximately20–21ms save,
6–7ms load on this machine. Seven-frame rollback correctness is verified; full
speed with prediction is not established. This is an explicit performance limit.

## Platform dependency

Neutral technical cancellation is now deployed and verified. YouGame PR68 merged
as `939351bf62e4ed161def5712fc38fb98718fa5fc`; rooms version
`170b748e-9c26-4052-a433-ec11bb45f436` deployed before web version
`241563c5-ab30-4d2d-82b8-694f0a530949`. Public SDK SHA256
`17aafda7ae34563194700f28fc359bfa5de973f7b8f33379af16e65a7fc17316`
is byte-identical to reviewed source. Explicit `void:true` is serialized,
restricted to round participants, sticky through retries/hibernation and refunds
without ratings. Full web suite262 tests, focused26tests, typecheck/lint/rooms
checks and actual dedicated SQL refund test passed. No production money rows or
schema changed. The older SDK dropped void and must not be used for acceptance.

Melee's current listing has `play_mode: single` and `online_off: true`. A narrow,
ownership-verified, backed-up listing update is prepared in
`/tmp/opensmash-melee-listing.py`; apply only after the tested release version is
live. Keep thumbnail, video, screenshots, comments and release history.

The reviewed controller handoff is integrated in both menu implementations and
final packages. This task remains the sole game publisher. Source remote access
is read-only upstream; authorized fork `Lrosias/opensmash` receives the reviewed
release PR/merge, preserving upstream origin configuration.
