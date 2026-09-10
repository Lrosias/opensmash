# GameCube SDK adoption review — 2026-09-10

This scoped change adopts the now-live YouGame controller transport. It supersedes the proposed-SDK portion of `gamecube-adapter-handoff.md`; that document remains the record of the original direct adapter implementation. No production listing or platform installer is changed here.

## Scope and provenance

Based on competitive release commit `cb0cdff88ffbd758046908e11fe6d4df1da9d594` in an isolated worktree. The shared root workspace and competitive release worktree were not edited. Original adapter source is already included in release commits `be85198` / `cb0cdff`; do not copy the entire dirty shared workspace into an adapter-only commit.

- `controllers/platform-adapter.mjs`: byte-identical copy of the published `https://yougame.co/controllers/opensmash-adapter.mjs`, also supplied by the platform agent in `build/yougame-platform-controllers/platform-adapter.mjs`. It chooses a supporting host SDK or direct fallback, never both. Host commands are asynchronous. Physical ports and raw values remain intact.
- `controllers/gc-adapter-ui.mjs`: use that facade, close the game dialog before opening host Controls, await/catch calibration/reset/disconnect, reopen the dialog on a failed Connect request, and describe host-owned USB correctly even when direct USB is blocked in the game iframe.
- `controllers/controller-menu.mjs`: a small raw input interface for competitive menus, without another acquisition owner or changes to gameplay conversion.
- `tools/stage-gamecube.mjs`: fingerprint all bundled controller modules, including the new facade/helper, when creating a candidate identifier.
- `yougame/tests/platform-adapter.test.mjs` and `platform-adapter-browser.mjs`: focused facade/menu regressions and real host/SDK/Wasm smoke checks with simulated USB.

No changes to `n64Pad`, `meleePad`, rollback frame boundaries, native engine code, `yougame/src/input.mjs`, or either competitive UI are included. The release/root agents retain those files.

## Required competitive menu wiring

Both games already have one `adapter = mountAdapterControls(...)`. Pass that same object into the competitive UI; do not construct a second direct adapter. The new API is:

```js
import {readAdapterMenu} from '../../controllers/controller-menu.mjs';

const raw = readAdapterMenu(adapter); // physical port 0 by default
// raw === null: raw ownership inactive; use the menu's existing keyboard/SDK/gamepad path.
// Otherwise: {direction: -1|0|1, select: boolean, back: boolean, start: boolean}.
```

Example wiring for `yougame/src/competitive-ui.mjs`:

1. Add `adapter=null` to the `createCompetitiveUI({onQueue,onBack,onPick,...})` options and pass `adapter` at the app call site.
2. In `controller()`, read `const raw=readAdapterMenu(adapter)` once per menu sample.
3. For direction/select/back, choose raw values when `raw !== null`; only otherwise run the existing standard-gamepad path. Keep the existing `held` edge handling, enabled-button checks and `onBack` rules.
4. Preserve gameplay suppression while the competitive UI is visible.

For the root-owned Melee competitive UI, add the same optional adapter argument to its constructor/setup options and use the same precedence in its controller sampling method. Preserve its existing SDK keyboard state handling when the helper returns null. Do not combine an owned raw pad with an SDK virtual copy of that pad. A neutral object is intentionally **not** a fallback signal: stale, suspended, empty and disconnected-but-owned ports must not hand control to another player.

The helper reads the facade's non-diagnostic snapshot. It preserves physical port order, subtracts explicit neutral offsets, uses ±44 raw stick units for menu movement, and interprets GameCube +Y as up. D-pad directions, A/select, B/back and Start are separate. It returns held state; the UI owns edges/repeat. It does not manipulate the gameplay input timeline. Ordinary SDK seat reassignment does not reassign OpenSmash's physical raw port controlling the menu.

The authored import above must become `./controllers/controller-menu.mjs` in a staged build. The release's existing app import rewriting may not cover a newly added import in `competitive-ui.mjs`: extend the build rewriting to this file explicitly, or inject `readMenu:()=>readAdapterMenu(adapter)` from the app instead so the UI needs no import. The injection route minimizes changes to root-owned UI files.

## Verification and remaining release work

`node --test yougame/tests/platform-adapter.test.mjs yougame/tests/gc-adapter.test.mjs yougame/tests/keyboard.test.mjs`: **27 passed**. This includes all 256 raw values, independent triggers, stable holes, calibration, suspension/staleness, direct fallback during/after SDK handshake, async command failures, and menu axes/buttons.

The published facade was downloaded and byte-compared against the checked-in copy. Browser checks used the actual YouGame `ControllerHost`, cross-origin MessagePort channel, SDK, facade, and preserved Wasm engines for all three games. A synthetic USB adapter supplied reports; no real hardware was connected. Connect-through-host UI, raw menu selection/direction, an empty physical port, host suspension, calibration and explicit ownership release passed. N64/Remix native input was mask 40960 and X80 for A + raw X208 + analog L80. Melee received A1, X80/127, analog L80/255 and displayed frames. No page errors occurred. Evidence from this review is `/tmp/opensmash-platform-review-results/results.json`.

Those engine checks overlay only the controller modules onto the preserved `gamecube-final` builds. They do **not** verify the release agent's newest competitive menus, which still require the wiring above, exact-build restaging/static validation, and rendered menu tests before publication. The reviewer does not own listing updates.

To rerun browser checks, start YouGame's `tools/controllers/browser-lab.mjs` against three folders named `opensmash64`, `opensmash64-remix`, and `opensmash-melee` containing these controller modules. Then run:

```sh
YG_CONTROLLER_LAB=http://127.0.0.1:4212 \
PLAYWRIGHT_PATH=/path/to/playwright \
node yougame/tests/platform-adapter-browser.mjs
```

Review used an isolated lab copy on ports 4312/4313 to avoid disturbing the platform agent's running lab. Hardware detection/driver behavior, physical latency and real multiplayer matches remain unverified. The live browser SDK is usable independently of the platform agent's ongoing signed desktop installer release. No Slippi-equivalent latency claim is made; Melee retains its existing rAF input scheduling.

## Original dirty-file ownership for the coordinator

In the shared root, the original adapter work is represented by untracked `controllers/`, `docs/gamecube-adapter-handoff.md`, `tools/stage-gamecube.mjs`, `yougame/tests/gc-adapter.test.mjs`, and `yougame/tests/gc-adapter-browser.mjs`. Adapter integration hunks also appear in `yougame/src/app.mjs`, `yougame/src/input.mjs`, `yougame/build.mjs`, and `yougame/README.md`; those tracked files contain other agents' changes. Original Melee adapter hunks are in `melee/src/app.mjs`, `melee/engine/main.cpp`, `melee/tools/build.py`, and `melee/README.md`; all of `melee/` is untracked in that old shared root and must not be attributed wholly to this task. `remix/README.md` has only an adapter documentation link from this task. `yougame/tests/gamepad-ports.test.mjs` and later ordinary-gamepad edits are release-agent work.

Desired new scoped commit: **Adopt YouGame controller transport and expose raw menu input**. Cherry-pick this review commit onto the coordinated release branch, then let each menu owner apply its own integration hunks. Do not stage the shared root's entire `melee/`, `remix/`, or `yougame/` directories for this change.
