# Competitive release coordination

This task owns releases of `opensmash64`, `opensmash64-remix` and
`opensmash-melee`. Original Smash 64 v1.2 is published and verified. Final invite-flow
corrections for both64 editions and Melee hosted acceptance are in progress. Coordinator: task `01a08885-d751-70f3-b95b-e3d8c29c5ce3`.

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

Both editions pass 105 unit tests, actual two-Wasm three-game sets with character
counterpicks, packet delays/loss/rollback and matching 2–1 results. Desktop,
landscape and rotated-phone clock/menu tests pass. Public staged native startup
has correct isolation, rendered menus and no JavaScript errors/failed requests.

| Edition | Folder | Build | Upload |
|---|---|---|---|
| Original | `build/competitive-original-neutral` | `684e7fc13cbd95e0` | `93118f857dfd4a2da84bdc9ad4b70c0a` |
| Remix | `build/competitive-remix-neutral` | `a867751d7f30867c` | `c9775fd73f49401faa3299b3cce63c18` |

Static `check_build` and uploader verdicts are ready. Public staged native
startup passed both corrected uploads. Original’s official disposable-player
session `3034d9c5069e4f87989209be8eb52f72` completed hosted acceptance and is closed. The earlier
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
in `yougame.json`. 32 unit tests, actual DOM/raw-controller menu flows and native
startup/cancellation lifecycle tests pass. Final staged folder is
`build/competitive-melee-forfeit-final/dist`; exact hosted acceptance remains outstanding.

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
is read-only upstream. The reviewed source release remains local while explicit
permission for the public fork destination `Lrosias/opensmash` is pending.

## Final hosted findings and candidate corrections

- Source `13743f84fa6fb77e087b337d34b63a11301cf936` includes both the
  `8e50dc8` Melee CSS reservation fix and the64native-startup neutral-abort fix.
- The original frozen predecessor passed actual two-identity Casual results,
  Continue/rematch, disconnect/forfeit, a natural ranked2–1 set with ordered
  character counterpicks, and fresh Friends invitation acceptance. Its ranked
  set produced one placement/rating update per player, not one per game.
- Exact final original upload `93118f857dfd4a2da84bdc9ad4b70c0a`, official
  session `8cd4044a663d4d04aa656e36c99b1e2d`, passed an actual post-Ready
  native-script network fault: both players returned to error/setup, with zero
  recorded matches, ratings or scores. Normal Casual results and Continue to
  round2 subsequently passed. This upload is live as v1.2; its hosted JS and
  manifest match the staged artifact after known hosting watermark normalization.
- Final Melee upload `860c2e53c16e4476856c0b78bedba9b3` has content fingerprint
  `7899f2cde03b2ed338ea249d9ebd0f6a85ccfab57f38b5e1059a92d18a41e82d`.
  It differs from full-set-tested `2d759fbbf7044f03b2ecd98209fd4b48` only in
  `style.css` and `competitive.css`; all native and JavaScript bytes agree.
  The title Fullscreen button is now top-right, and scrollable menu content is
  clipped above the host-control reservation. Public1440×900 and375×812
  embedded/fullscreen checks pass. Native public startup had sustained rendering,
  working sound, zero asset misses/errors and correct gzip/isolation headers.
- Source Git push to `Lrosias/opensmash` was rejected by automatic approval review
  for destination/payload authorization. An explicit user question names the
  exact destination, reviewed source/artwork payload and binary/credential
  exclusions. No alternate push or proxy has been attempted; approval is pending.

- Exact Remix upload `c9775fd73f49401faa3299b3cce63c18`, official session
  `bd047a314e6b4010a3e5051c5cbe92ef`, passed native startup fault with zero
  matches/ratings/scores, natural ranked2–0, ordered character counterpicks,
  one placement and ±20 Elo, Continue to round2, and intentional forfeit.
  Both64 editions' fresh invite acceptance exposed a forced-Mario recipient
  selection bug. Reviewed source now shows fighter setup and one Join friend
  action before invoking the SDK's existing invite; Back/cancel preserve choice.
 105 unit tests and real desktop/phone invite UI fixtures pass. Corrected
  uploads require targeted hosted recipient-selection acceptance before release.
- Melee now distinguishes actual opponent departure (one forfeit report) from
  technical failure (neutral). UI callbacks use the captured session round:
  the deployed SDK increments its mutable room round before emitting results.
  Late result/change/error callbacks cannot affect a replacement session.
 32 unit tests pass; final content fingerprint is
  `e8c7f73c2daa85e6c7ad00e147b27d3a3e41e9cd91ac4880e7568add005f854f`.
  Only two authored competitive JavaScript modules differ from safe-layout.
- Hosted phone emulation lost its touch capability after entering the platform
  player. Public-build phone/touch fixtures passed, but full native gameplay on
  a physical phone has not been verified. Hosted reports do not claim that pass.
