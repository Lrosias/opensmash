# Original controller followup — September 10, 2026

This update follows published Original v1.4, upload
`103b8a90b26c4560a30878ed335d0b3f`. It is now published as **v1.5**, upload
`660e86beb75b4f39a310aa147bea2126`.

Candidate `build/competitive-original-controller-v1`, upload
`660e86beb75b4f39a310aa147bea2126`, preserves the frozen keyboard release's
59-file inventory. Exactly two files change: `controllers/gc-adapter.mjs` and
`controllers/gc-adapter-ui.mjs`. All 57 other files, including the engine,
assets, app, keyboard and competitive flow, are byte-identical. The physics
compatibility identity remains unchanged. The complete content SHA256 is
`54c91def7eeb21f5bcfc5c94145d89560d9c3dfbc127f061a910c1bd8af238f9`.
All staged hashes were checked again after upload; static validation is ready.

The reviewed consumer correction detects previously granted adapters and
explains that official WUP-028 support requires an unreleased YouGame desktop
update; desktop 0.3.0 cannot use it. The setup link leads to
`https://yougame.co/desktop#gamecube-setup`. No physical adapter compatibility is
claimed. This is the same controller correction included in the pending Remix
and Melee updates.

All 26 adapter unit tests pass. A small DOM fixture uses frozen Original CSS,
the actual controller modules, and simulated USB HID descriptors. At 320×568,
375×812, 568×320 and 812×375, the longer entry label fits and clears simulated
host reservations. Pending-support text, disabled Connect, setup link,
regular-controls recovery, dialog scrolling, and competitive hide/Back restore
pass with no page errors. No native engine or physical USB device was used.
Evidence: `yougame/test-results/original-controller-only-ui/results.json`.

The fixture also records a pre-existing shared-dialog limitation: at 568×320,
one scrolled calibration button intersects the simulated top-left reservation.
Primary recovery actions remain clear. This release does not claim a complete
calibration-dialog layout or accessibility redesign.

Focused hosted acceptance passes against deployed SDK
`ac8fac80456c57d358feb11fd72f9ad3727ec6f614272604c651a7c716fe8b8c`.
Desktop and genuine touch-phone native menus load in approximately three
seconds. Controller guidance and primary recovery actions, competitive entry
hiding and Back restoration, two Casual cancellation/retry cycles, and desktop/
phone fullscreen exits pass. Across 23 snapshots, the full controller entry
target never overlaps actual host reservations. Touch emulation remains active
before and after viewport-only screenshots. There are no page errors; three
cancelled host-link prefetches are recorded separately.

Official session `b662e730c9364211b380b97d3726ccfe` and all owned browsers are
closed. Its six focused cases pass; the optional aggregate is incomplete because
the unchanged full ranked/gameplay matrix was intentionally not repeated.
Prior v1.4 evidence applies to those unchanged files. The direct Python fetch
from the testing origin returned 403, so that attempt is not claimed as public
byte verification. Evidence:
`yougame/test-results/original-controller-only-hosted/test-report.json`.

Publication returned v1.5 as a minor update with zero notifications. Public
verification passes for eight selected app/controller/style/manifest files after
normalizing only the known hosting stamps. The entry points at the reviewed
upload, both score-board flags remain false, and public player props retain
multiplayer. Evidence: `build/competitive-original-controller-v1-live.json`.
