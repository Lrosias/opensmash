# Remix native adoption — September 10, 2026

This follows the published keyboard release, Remix **v2.4**, upload
`947a9b2bdfd047bdbf40c4b2f3d74a9c`. Publication of the native update remains
pending exact-candidate hosted acceptance. Original v1.4 and Melee v1.8 are
outside this update's publication scope.

## Candidate and source

Frozen native candidate: `f2654986e14088f5`; Wasm SHA256
`923e92de4588a7e07a69dbf0629eeacf476b330bfabf271b436cd0fcbe2e6440`.
All 290 frozen file hashes and 67 source-supplement hashes were verified. The
engine overlay contains exactly 45 files, preserving the latest keyboard and
competitive frontend. Staging verifies the keyboard baseline and permits only
the named engine, presentation and adapter changes.

Current integrated candidate: `build/competitive-remix-f265-v3`, compatibility
identity `2aa74cc9e29d1896`, upload `5b0a3dcffbdf431fbf83c5a94b37df32`,
88 files. The first integrated candidate/upload
`2eb8225d33304860bf6e473dfbf1b062` is superseded: review found a local-menu exit
problem and a phone result panel obscuring one fighter. The second upload
`edcc421a2fea4015ade3d4a46f4b58e0` is also superseded: native startup overwrote
the initial result request. Neither was published. V3 waits for two initialized
native menu frames before requesting results, with a bounded initialization
loop and cancellation checks across each asynchronous boundary.

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
Official two-identity hosted acceptance and natural transition checks remain
pending before publication.

The current platform baseline is production `ba9e61eb-faec-4290-8ac2-e9c9656b3136`
and testing app `d8184b38-4bc0-4bfa-b338-3326e058563e`, both with the SDK above.
Testing rooms/cleaner are unchanged. Source pushes/merges remain subject to the
existing automatic-approval export blocks; runtime acceptance is separate.
