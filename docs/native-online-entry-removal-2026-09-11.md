# Native-only online entry — 2026-09-11

Luis asked for the large "Competitive online" button over the Original 64 and Remix menus
to go away: online play is integrated in the native Online scene, so the browser button and
its separate "Play together" mode picker were a duplicate entry.

Changes (`yougame/src/app.mjs`, `yougame/src/style.css`):

- The `#online-entry` button and its styles are gone. Nothing is drawn over the native menu.
- `cleanup()` always resumes the same paused native menu engine and hides any browser card.
  The former `onlineMenu` custom/native switch, `showSetup()`, and the picker-only callbacks
  (`onQueue`, `onJoinInvite`) are removed from the app; `online()` takes no entry. `onBack`
  stays (`Leave lobby`, `Back to online menu`, controller B) and is plain `cleanup()`.
- Ranked keeps its browser set/lobby cards after the native scene starts the search; Casual
  and Friends stay fully native. Invite links still enter through the native scene. After a
  ranked set, `Find another match` now cleans up and starts a new ranked search directly
  instead of opening the browser picker.
- `competitive-ui.mjs` keeps `setup()` only for the standalone test harness pages.

Tests: `native-online-cancel-browser.mjs` asserts the button does not exist and enters
online only through the native bridge (passes, 6 cases, with the production SDK);
`native-room-app-browser.mjs` (passes, 4 cases), `native-results-app-browser.mjs` and
`native-results-candidate-browser.mjs` drive `menuAction` (6 = mode, 2 = back, 4 = try
again after a failure) instead of clicking the button; `edition-browser.mjs` only asserts
the button is absent; `competitive-browser.mjs` keeps only the ranked counterpick card
check; `friends.test.mjs` drives the same bridge actions. Known, pre-existing on main:
`native-results-app-browser.mjs` and 3 of 4 `friends.test.mjs` cases fail because their SDK
fixtures predate `joinLobby` / `NativeRoomSession`; `native-results-candidate-browser.mjs`
and `edition-browser.mjs` need a staged `build/` that is not in the repo. Melee is untouched.
