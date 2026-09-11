# Remix native adoption — September 10, 2026

This follows the published keyboard release, Remix **v2.4**, upload
`947a9b2bdfd047bdbf40c4b2f3d74a9c`. The reviewed native update is now published
as **v2.5**, upload `83a161be757b48a8886840a1a6c36954`, after desktop and targeted
phone acceptance passed. Original and Melee have separate publication records.

## Candidate and source

Frozen native candidate: `f2654986e14088f5`; Wasm SHA256
`923e92de4588a7e07a69dbf0629eeacf476b330bfabf271b436cd0fcbe2e6440`.
All 290 frozen file hashes and 67 source-supplement hashes were verified. The
engine overlay contains exactly 45 files, preserving the latest keyboard and
competitive frontend. Staging verifies the keyboard baseline and permits only
the named engine, presentation and adapter changes.

The superseded integrated candidate `build/competitive-remix-f265-v3`, compatibility
identity `2aa74cc9e29d1896`, upload `5b0a3dcffbdf431fbf83c5a94b37df32`,
88 files. The first integrated candidate/upload
`2eb8225d33304860bf6e473dfbf1b062` is superseded: review found a local-menu exit
problem and a phone result panel obscuring one fighter. The second upload
`edcc421a2fea4015ade3d4a46f4b58e0` is also superseded: native startup overwrote
the initial result request. Neither was published. V3 waits for two initialized
native menu frames before requesting results, with a bounded initialization
loop and cancellation checks across each asynchronous boundary.

The current candidate is `build/competitive-remix-conker-v4`, compatibility
`ae7e8aa1694e1cd0`, upload `83a161be757b48a8886840a1a6c36954`. Its 88-file inventory
matches v3: 86 files are byte-identical, app.mjs changes only its compatibility
identifier, and BattleShip.wasm contains the reviewed native fix. Static checks
pass. The same upload helper/destination was approved after an initial automatic
review rejection was resolved with this exact artifact comparison; no alternate
upload route or publisher was used.

Keyboard source `efc41d9` was integrated locally as `2fbe807`; the reviewed
five-file adapter correction `a6baeff` was integrated as `7f3635c`. A follow-up
copy change links to `/desktop#gamecube-setup` and explicitly states that the
official WUP-028 requires an unreleased desktop update. Version 0.3.0 does not
support that adapter. No physical-device compatibility is claimed.

The 62 native/build/supporting source changes come from the immutable candidate.
Existing base preparation and three patches already matched. The source-only
[provenance supplement](../remix/provenance/f2654986e14088f5/README.md) records
two generated-source differences; the frozen binary is not described as a
byte-identical clean rebuild.

The replacement native candidate `conker-f15ccb0f63fd` has manifest SHA256
`3fa66b4ff978629ea5ccba43288474ac8ed4a396370eb42ba86f2752cc61b890` and Wasm SHA256
`f15ccb0f63fdc02e8113239a273449a159a05a2049ac8c1606ec60b26a107c6e`.
All 81 frozen files and sizes match; only Wasm differs among the engine files.
The Conker source now uses the exact 13-entry ROM motion mapping. The previous
fixed offset chose wrong animations and indexed beyond the 225-entry motion
table, causing the hosted freeze. Independent review approved the source,
pinned-ROM validator, negative cases and frozen runtime evidence. Build
provenance remains an isolated relink against unchanged f265 objects, not a clean
full rebuild. The final documented relink matches the tested JS/Wasm exactly.
Source adoption and provenance are in
`remix/provenance/conker-f15ccb0f63fd/ADOPTION.md`.

## Behavior

The native update adds the imported fighters' specials, projectiles, grabs,
recovery behavior, Kirby copy powers/hats, voices, sound effects and visual
feedback. It retains the competitive setup, ranked set settlement, random casual
stage rotation and standard keyboard controls. This is functional port coverage;
it does not establish exact Remix frame-data or balance equivalence.

After YouGame settles a result, a separate disposable native engine presents
the winner/loser animations behind the existing result UI. Global fighter/seat
order is preserved; draw and void are distinct; set-win scores are never passed
as remaining stocks. The original menu stays intact, preserving its local roster
and controller setup. Continue/exit disposes the presentation. Late callbacks,
duplicate results and native rematch intents cannot advance the SDK round.

The HTML/SDK result remains available while native presentation loads, and on
presentation failure. Native input is neutral while result UI owns controls.
Phone presentation removes hidden touch-control gutters and uses a compact
summary; host controls remain reserved.

## Validation and measured limits

The original performance/set measurements below use the f265 native engine.
The replacement's mapping-only delta has separate regression evidence: the
frame-68 failure now completes 260 frames; 22 both-seat scenarios each pass
220-frame restore/replay, including ground/air shots, charge/release,
falling/landing and grenade success/failure. Adjacent recovery passes 130-frame
replay; Kirby's copied move passes on ground and in air. A muted-output,
sound-active charged-shot case verifies all 1,545 bank entries and 180-frame
projectile replay. These do not replace exact hosted acceptance.

The final v4 engine also passes all eight desktop/375px result cases and exact
local-return input checks. Evidence is
`yougame/test-results/native-results-conker-v4/verification.json`; maximum
attached Wasm capacity is 384 MiB across two frames, not process RSS.

- 113 unit tests pass against the actual deployed SDK SHA256
  `25aa37a75b1d36daa03156e134da58a95adcc50b1b6ab62427c23d0666e7e4f4`, with no skips.
  All 17 parser tests pass. Static candidate checks are ready.
- Real native engines complete two consecutive best-of-three sets and a
  same-room rematch, with delayed/dropped inputs, repeated rollbacks and matching
  2–1 results. No synthetic winner/state mutation is used.
- Both cold local clients reached the first active three-stock frame within
  2.32 seconds, versus 1.68 seconds for the matched v2.4 baseline. The preparation
  deadline remains 45 seconds.
- A custom-fighter sound scenario activates 1,545 bank entries and five plays.
  Captured state grows from 40,767,488 to 73,265,152 bytes per client. Unique
  15-frame history grows from 40,701,952 to 72,298,496 bytes.
- Matched warm native step averages 0.62–0.64 ms, save about 3.23 ms and load
  1.24–1.25 ms. Total p95 is at most 4.175 ms; none of 600 sampled desktop frames
  exceeded 16.67 ms. First sound allocation plus checkpoint peaked at 16.115 ms,
  versus 7.615 ms previously: slower-device margin is reduced.
- Each engine passes 100-frame restore/replay. These are local fresh-Chrome
  measurements with two engines loaded and sequential benchmark ticks, not a
  mobile or WAN guarantee. All browser runs are muted.

Native evidence: `yougame/test-results/remix-f265-native-summary.json` and
`yougame/test-results/remix-f265-native*`. Separate app fixtures intentionally
mock SDK/engine boundaries; they do not substitute for native or hosted proof.
The revised presentation passes eight actual native result cases across desktop
and 375px phone viewports (both winners, draw and void), plus eight logical
lifecycle cases covering cold initialization, early Continue, Leave during boot,
late callbacks and fallback. Both native fighter models remain visible on phone.
Exact Leave then Back preserves the original Module and complete local roster/
human-port state; real native port-two A and port-one Start advance local setup.
The visual fixture samples at most two attached engines, each with 192 MiB Wasm
capacity (384 MiB total). This is not process RSS or a natural battle-to-result
peak: that fixture injects settled SDK outcomes and never boots a battle.
Evidence and scope are recorded in
`yougame/test-results/native-results-candidate-v3/visual-review.md`.
Official two-identity hosted acceptance found a release blocker on the superseded
v3 upload: after fresh private Marth/Conker Ready, moving Conker right for 600 ms
then pressing his special key while airborne froze both native game renderers.
The first run included a periodic native heap-used observer; a clean rerun
removed that observer and reproduced the stall immediately. No result frame
existed before the stall. This candidate must not be published. Native diagnosis
and a new reviewed candidate are required before repeating settlement, rematch
and natural transition acceptance.
Official session `e83403b43c714eaf994f42be2b093cfd` and all its test browsers are
closed, with zero completed matches or rating updates. Fresh invitation,
fighter selection and Ready passed; clean menu load was 2,676 ms and Ready to
synchronized play was 3,250 ms. The saved active-iframe DOM subsequently supplied
the exact clean boot parameters: fighters `[58,56]`, native stage `13`, seed
`2243759118`, three stocks and two humans. The keys map to stick X=80 followed
by B=`0x4000`; the 600 ms hold was not recorded as an exact per-frame trace. The blocked
report is `/tmp/opensmash-remix-v3-blocked-report.json`; the clean interaction
screenshot and bounded renderer stack are in
`/tmp/opensmash-remix-v3-clean-evidence`.

## Exact v4 hosted acceptance

Desktop session `3a81718f5f4240d8baa771facf98fadf` passed and is closed. Fresh
Friends selection and Ready, both natural global winners, reversed Casual seats,
held-key result neutrality, single-Continue rematches, a natural ranked 2–0 set,
winner-first character counterpicks, placement settlement, forfeit, and recovery
after an intentionally aborted engine request all passed. The former Conker
trigger passed twice, including native stage 13. The engine-load failure added
no match settlement or rating changes. Original local menus and adapter guidance
were preserved. All observed normal launches reached play within six seconds.
The detailed report is `/tmp/opensmash-remix-v4-acceptance.md`.

Phone session `37b8dfc4fc314000a5a3fdc84e9ffba5` is closed with an honest failed
layout gate. Canonical touch emulation remained active throughout viewport-only
captures. Natural native results and actual touch Continue/rematch passed in
fullscreen portrait and landscape. After leaving fullscreen, the 375×211
embedded viewport exposed an SDK defect: Continue at (36.5, 140.39), 302×38,
intersects the host control reservation at (227, 150), 148×61, by 111.5×28.39 px.
A successful center tap does not make the whole target clear. The platform owner
is correcting shared SDK exclusion-band handling; the frozen game remains
unchanged. The prior report did not establish touch Back-to-local completion.
Review of its persisted action log subsequently confirmed that host-menu and
Leave-lobby taps completed; dropped tool output had been mistaken for a stalled
dispatch. No native or input-dispatch hang was established. All test browsers
from that run are closed. Evidence and the targeted
recheck scope are in `/tmp/opensmash-remix-v4-phone-gate.md`.

Production intentionally stores `score_kind: points` with both leaderboard flags
false, representing effective board kind `none`. Publication must preserve these
flags and the existing ranked ladder; no metadata correction is required.

The prior platform baseline was production `ba9e61eb-faec-4290-8ac2-e9c9656b3136`
and testing app `d8184b38-4bc0-4bfa-b338-3326e058563e`, both with the SDK above.
Testing rooms/cleaner are unchanged. Source pushes/merges remain subject to the
existing automatic-approval export blocks; runtime acceptance is separate.

The reviewed SDK correction `dd227ed` is now deployed as production
`e27096f4-116c-43ac-ac40-52bdb539cd7a` and testing app
`c30278a6-e575-4759-84da-76bad7602c48`. Both serve SDK SHA256
`ac8fac80456c57d358feb11fd72f9ad3727ec6f614272604c651a7c716fe8b8c`.
It applies the existing host exclusion bands to dialog padding and compacts
short result cards while preserving ratings, series information and scrollable
content. Independent review, 283 platform tests, typecheck/lint, input/invite
browser regressions and ten live-SDK layout cases pass. The complete Continue
target remains at least 38 px high and clears the reproduced host reservation.
Root independently fetched the SDK and all 145 combined N64/Melee unit tests
pass against it, with no skips. The frozen v4 game files are unchanged.

The exact native phone recheck passed and official session
`84dd2a76b3724d51bc30ce8ffb714e8b` is closed. At embedded 375×211, Continue is
310×38 at (32.5, 72.59), with no host intersection, clipping or required scroll.
Fullscreen portrait/landscape and actual touch rematch pass. Touch SDK Continue,
Ready/lobby Leave, and authored Back restore the preserved original native menu
(scene 16), touch controls, one menu frame and no active room. All owned browsers
are closed. The session's optional-case aggregate remains incomplete because it
was a targeted phone recheck, not a repeat of the desktop matrix; the requested
phone cases pass. Evidence: `/tmp/opensmash-phone-sdk-fixed-acceptance.md`,
`/tmp/opensmash-phone-sdk-fixed-evidence`, and
`/tmp/opensmash-phone-sdk-fixed-return-evidence`.

Publication returned version 2.5 as a minor update with zero notifications.
The existing listing, media and ranked ladder are retained. Postpublication
verification confirms 12 selected frontend/controller/native files match the
tested stage apart from exact known hosting stamps, including native JS, Wasm
and O2r. The public entry uses the reviewed upload, both score-board flags remain
false, and public player props still enable multiplayer. Evidence:
`build/competitive-remix-conker-v4-live.json`. Source export/merge approval
remains separate from the successful runtime deployment.
