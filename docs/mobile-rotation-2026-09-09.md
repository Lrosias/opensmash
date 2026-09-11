# Mobile rotation and input fixes

Both listings now serve the same three shared touch modules:

- OpenSmash64 **v1.1**, upload `f67541cfdfc349198c3bd3ba969ce799`,
  local build `9591faa539e7f530`, https://yougame.co/g/opensmash64.
- OpenSmash64 Remix **v2.2**, upload `47c85145b7c0407fbd3ea4df3ef50853`,
  https://yougame.co/g/opensmash64-remix. Already fixed; no redundant release made.

The original update copies its preserved v1.0 release and changes only the three
touch modules plus the loader's build identifier. Its engine, assets, networking,
12 fighters and stages are unchanged. `yougame/package-touch-update.mjs` packages
shared control changes against either edition's preserved build into a separate
output directory. Original package: `build/OpenSmash64-touch-fix.zip`.

Original-update checks: 21 focused input tests passed, static check passed, and
hosted phone-emulation boot, fullscreen rotation, outside-circle input, release
and Start passed. Evidence: `build/opensmash64-touch-evidence/`. The sandbox report
was marked stale after publication; live module comparisons independently verify
both published editions match the tested source. No physical-device retest was
completed for the original update. iOS simulator Safari testing of Remix in the
preceding investigation did not reproduce the user's remaining failure.

The initial publication below updated Remix only. The original listing was still
running the old orientation lock and menu touch-origin behavior until v1.1.

Local Remix build: `442794af55394e61`.
Package: `build/OpenSmash64-Remix-touch-fix.zip`.
Published September 9, 2026 as minor version 2.2:
https://yougame.co/g/opensmash64-remix
Upload: `47c85145b7c0407fbd3ea4df3ef50853`.
ZIP SHA-256: `a28cc52ee2bd2c03502cfe2fbf7a3f46dc3b2897f2938528db41299bef5623d7`.

- Removed the game's native landscape-lock requests so the host controls native
  fullscreen/orientation. The portrait fallback still rotates the play surface.
- Layout follows document viewport dimensions, orientation, visual viewport,
  fullscreen and foreground changes. A real Chromium mobile-emulation sequence
  reproduced inflated `innerWidth` (852 instead of 393) on returning to portrait;
  using `documentElement.clientWidth/clientHeight` fixes that sequence.
- Menus and fights use the same visible analog origin, so outside-circle contacts
  immediately move within the enlarged movement area.
- Interrupted input clears on page transitions, touch-stream termination, missing
  pointer buttons, cancellation and capture loss. Capture failures cannot leave
  movement held. Button releases outside their target clear visual/held state;
  normal quick button taps remain latched for one sample.

Verification:

- `node --test yougame/tests/*.test.mjs`: 62 passed, 3 optional SDK tests skipped.
- `PLAYWRIGHT_PATH=/path/to/playwright node yougame/tests/touch-browser.mjs`:
  passed in Chrome with mobile/touch emulation through four portrait/landscape
  viewports and five scenes, including outside-circle input in both directions,
  captured drags/release, Start and actual touch cancellation events.
- Built with `YOUGAME_ENGINE_DIR=build/remix/main/engine node yougame/build.mjs`.
- YouGame static build check: ready, 54 files. This is not hosted runtime evidence.
- Hosted disposable Ada identity: engine boot, fullscreen portrait → landscape →
  portrait, outside-circle left input, release and actual Start clicks passed in
  Chrome with iPhone mobile emulation. No captured page errors. Test session
  `cef9645a9c2e472ca588340d8fab134e`; evidence recorded before publishing.
- The host corner controls lag the game rotation until the SDK reports it;
  settled layouts passed. Desktop-UA forced-touch fullscreen can overlap Start
  with the host controls; normal desktop keyboard flow was not rerun.
- Two-identity online and physical installed-browser flows were not rerun.

Physical iOS/Android home-screen installation, real host fullscreen transitions,
and the original intermittent stuck-left report still need a device retest.
Automated checks exercise the relevant release/rotation paths, not a reproduced
physical-device failure.
