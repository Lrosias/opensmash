# Remix multiplayer polish release

Release candidate `e3fe2c2f6c7d68cc` is built on fetched publishing source
`f5b41fddaa274f032ebc80416acb86f85a8163b3` (`lrosias/main`), with the exact v2.22
asset package as its base. The upstream `origin/main` is a separate repository
line and is not the publishing baseline. The earlier root-worktree prototype
was not published because it predates current production features.

## Changes

- Four stocks by default in native local matches, rematches and online profiles.
- Imported entrance motions and translated idle/selection/victory/defeat scripts.
- Selection poses, three rotating victory poses, colored results panels and stats.
- Local Start rematches the saved setup; A returns to selection; Z toggles stats.
- Responsive loading cards for actual active player ports, including sparse/four-player setups.
- A larger results display-list buffer accommodates four animated imported fighters and stats.

The current free-hand/puck selection, session receipts, native placements (including
teams and ties), current C-stick support, controller mapping and accelerated
checkpoints are preserved. Only app build identity, native JS/Wasm, engine loading
HTML, game profile and the new presentation helper differ from v2.22.

## Evidence

Candidate and tests: `/Volumes/OpenSmashBuilds/main/build/remix/polish-latest-20260914`.
The `web` directory contains only distributable files; fixtures are in `test`.
Upload: `4c29ae1f0fa149d5b9d867d3d913b884`, 92 files, 68,358,345 bytes; static verdict ready.
Native SHA-256: `64aefe07bf155fa0c50275979572d5a4b234eff6d11431b1e0e385a06ee3d86f`.

- 22 imported entrances animate, restore spawn/visibility/camera and replay exactly.
- 34 selections and 102 victory poses; invalid result metadata rejected.
- Two complete four-human matches, P4 rematch, stats toggling and remembered setup.
- Native online cursor selection, recall, Start, stage-back and hold-B exit.
- C-stick: four ground directions, four aerial directions, independent jump,
  no hold repeat and exact 60-frame rollback replay in the rebuilt Wasm.
- Paired engines under lost/delayed inputs: confirmed frame 227, 59 rollbacks each.
- Four-stock settlement: both clients report p0 with stocks 4–0, confirmed frame 1048.
- Actual uploaded origin: keyboard Mode Select → VS → Banjo selection → stage →
  native battle; four HUD stocks per player; no page errors or failed asset requests.
- Loading at desktop and 568×320, reduced-motion behavior and actual entry transition.
- 35 focused JS tests pass. Full suite: 150 pass, nine fail, nine skip; the nine
  failures are identical to an independently extracted `lrosias/main` baseline.
  They are pre-existing obsolete Friends/gamepad-port expectations, not new failures.
- 21 Python tests; compiled native selection/ranking/C-stick/receipt/clock tests pass.
- 3,985 asset hashes and 110,050 bounded relocations validate.

The hosted disposable-player test service returned `Not found` twice. Hosted
signed-in Friends, ranked settlement and rematches with two disposable identities
could not be rerun. Local paired-native tests and real hosted local play passed;
these are distinct evidence and do not establish hosted social/ratings acceptance.

## Remaining parity

Alternate costumes/duplicate fighter differentiation; character-specific entrance
props and extended cosmetic events; franchise fanfares and stage music; full rules,
team/options menus and stage expansion; exact Remix balance/frame-data parity.
The original twelve fighters retain the existing native implementation. The entry
adapter has a 120-frame backstop where custom ROM routine chains are absent.
No single-player work is included.
