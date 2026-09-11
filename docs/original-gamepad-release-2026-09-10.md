# Original standard browser controllers — September 10, 2026

Original **v1.6** is published at <https://yougame.co/g/opensmash64>, upload
`e8858c50348643b4be93cd3adc8c432e`. This minor update preserves the listing and
media, sends no notifications, and keeps online play enabled with both score
boards disabled. Remix v2.5 and Melee v1.9 were not updated in this follow-up.

## Source and immutable artifact

Independent review approved `bc002b7ecdfa5353016499a8ee00daf5b3032a25`.
The exact two-file change was adopted as
`d35cd3cc8c01ef060f0ffd962d07eba21525d929`, atop the separately reviewed
source-archive license fix `ebfbde85cfbaa7162936445ea841d75dc5626130`.

Local standard browser gamepads now occupy stable indices 0–3. Empty and
disconnected slots stay empty; keyboard and touch belong to player one. Online
reads retain the first-connected-controller behavior. The release's keyboard
enabled guard, per-axis keyboard/gamepad blend, Start filtering and raw-adapter
ownership are preserved.

The fresh stage `build/competitive-original-gamepad-ports-v1` contains 59 files.
Only `input.mjs` changes from the verified Original v1.5 controller stage; the
other 58 files, including every engine file and the physics compatibility
identity, are unchanged. No engine rebuild was performed. The staged module is
the reviewed source with its controller import rewritten for the packaged path.

- Input SHA-256: `15dc0e149fae72f24487d3b58d67478d6e276626d776d03a0624d9503fcb8ca7`
- Stage content SHA-256: `1de47647ee5381105af09da6d283884c0ec00c5cfb5e060c2f9e21b73f3bc71b`
- Test build fingerprint: `0bd10a9c75e8cbd733441c40fce2e3e91085d3ef63dd5580d3f80e30efa5755c`

All 59 hashes remained unchanged after upload. Static checks report ready.

## Validation

All 46 focused input tests pass. A real Chrome 152 browser fixture exercises the
shipped module with real keyboard events and explicitly simulated standard
gamepads. It verifies four independent ports, holes, disconnected neutrality,
reconnection, per-axis blending, keyboard gating, touch-state precedence, Start
filtering and raw-owned precedence. The actual native bridge receives the
expected four-port values. The local fixture's touch-state and raw-adapter
reports are injected; they do not establish physical device compatibility.

Official hosted session `889ffcc79786427a9a0b8fd6a1719069` used separate disposable
Ada and Bo accounts, desktop 1440×900 and touch-enabled Pixel 7 emulation at
375×812 and 812×375. Both game frames used the exact upload and SDK SHA-256
`ac8fac80456c57d358feb11fd72f9ad3727ec6f614272604c651a7c716fe8b8c`.

The actual Casual and Ranked entries and cancellation work. Friends challenge,
the recipient's Leave & join confirmation, fresh fighter selection and both
Ready controls start Fox/Mario on stage 1, seed 1392579430, with four stocks.
Native startup after Ready is approximately 2.5 seconds. A standard controller
at browser index 1 supplies the online fighter while index 0 is empty; held
Start is filtered. An actual phone Attack tap reaches native port two and its
release returns to neutral.

The first game ends naturally after Fox loses four stocks. Both peers agree Bo
won, 0–1; no game state or result was injected. One Continue each starts round
two on stage 3, seed 3462285586. Both fighters remain at four stocks and zero
damage after 39 seconds idle, and fresh keyboard movement works. A second
natural-result wait expires while Planet Zebes hazards keep gameplay active;
this is not counted as another natural finish or a runtime stall. Intentional
Escape then leaves the match and produces the peer's forfeit result. SDK
Continue → waiting Leave → authored Back restores the phone's original scene 16;
desktop Back restores scene 7. Both have one native menu frame, neutral local
input and no active room.

Whole Continue targets are clear in desktop embedded, phone portrait fullscreen
and settled phone landscape fullscreen. Actual desktop fullscreen/embedded and
phone return-to-game-page transitions pass. Touch capability remains enabled.
No page or native errors occur; failed requests are canceled host navigation,
prefetch or telemetry. Harness selector, role and confirmation mistakes are
recorded in the action log. An immediate landscape layout probe had stale host
dimensions and is superseded by the settled landscape probe.

The official report is not stale and records two matches, zero ratings and zero
scores. Its aggregate remains incomplete because optional cases and the full
ranked/public-match matrix were not repeated for this one-file input change.
Prior release coverage remains supporting evidence. Audio output was muted;
physical controllers, audio listening and WAN reliability were not verified.
Both browser runs exited normally, the local server and official session are
closed, and the exclusive testing slot was released to the coordinator.

Evidence:

- `/tmp/opensmash-gamepad-local-evidence/verification.json`
- `/tmp/opensmash-gamepad-hosted-evidence/` — actions, snapshots and errors
- `/tmp/opensmash-gamepad-final-report.json` — sanitized official report
- `build/competitive-original-gamepad-ports-v1-live.json` — public verification

## Public verification and source status

The public entry points to the exact upload. Nine selected files, including the
changed input module and unchanged engine manifest, match the immutable stage
apart from the exact known hosting stamps. Public input SHA-256 including its
hosting stamp is `cf99a8ef9249cb6fc83b3ec88a12c31da8a34bfb31aae1c75edda61b591c6d0e`.
Cross-origin isolation headers remain present.

The separate Melee packaging fix includes the repository LICENSE exactly once
in the sibling source ZIP. Its baseline/candidate CLI fixture preserves all
other archive entries except the changed build script and leaves game
distribution bytes identical. It requires no runtime release.

Git source export remains subject to the existing automatic approval block.
No push, proxy export or remote merge was attempted. Shared-checkout media and
unrelated authored work were not swept into these commits.
