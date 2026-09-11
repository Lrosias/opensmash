# OpenSmash Melee for YouGame

A lightweight versus-only browser build of Melee USA v1.02, built from the user's
verified disc and the static recompilation used by `t3dotgg/melee4mac`. It is
separate from OpenSmash 64 in `yougame/`.

The Lite edition opens directly at versus character select, with every fighter
unlocked. Back returns to versus instead of exposing the removed single-player
menus. Cinematics are omitted. Rendering uses a 320 × 240 output and 320 × 264
GameCube framebuffer, with no antialiasing or resolution enhancement. Original
match rules, timing, music and effects remain.

The engine loads the menus first (23.7 MB of compressed game data, about 21.6 MB
transferred after deduplicating identical blocks), plus a 21.1 MB engine. Selected
fighters and stages take priority over tier-ordered background caching. A corner
indicator names missing content, reports progress and offers Retry after a failed
download. The match gate waits for fighters, stage variants, music and shared
match data before play starts. Background caching runs only in menus and keeps
compressed data out of the Wasm heap. See [PROGRESSIVE-LOADING.md](PROGRESSIVE-LOADING.md).

CPU simulation and graphics run on separate workers. Exact-result math and CPU
dispatch optimizations improved the integrated Bowser/Kirby Onett test from
48.7 to 59.1 FPS on the M4 Pro. This does not guarantee sustained 60 FPS or eliminate
first-use shader hitches. [PERFORMANCE-CPU.md](PERFORMANCE-CPU.md) records the current
measurements; [PERFORMANCE.md](PERFORMANCE.md) retains earlier profiles. An opt-in
rollback development mode now supports native checkpoints, asynchronous input
prediction/correction and a local latency lab. Internet netplay remains gated on
performance and SDK integration; see [ROLLBACK.md](ROLLBACK.md).
The fresh Chrome baseline and status of the external browser-port comparison
are recorded in [PORT-COMPARISON.md](PORT-COMPARISON.md).

## Play

The **Online** entry now includes fighter setup, ranked set preparation and
counterpicks, casual stage rotation and rank/result presentation. Its explicitly
labelled flow previews work while live Melee queues wait for the native match
adapter and uGames update. See [COMPETITIVE.md](COMPETITIVE.md) for rules, verification
and the integration contract.

The title screen uses generated artwork matching the listing thumbnail: Onett,
Kirby, the purple Ice Climber and the yellow/blue OpenSmash Melee title. Live HTML
buttons and loading progress sit over `src/opening-v3.jpg`; the generation prompt
and original PNG are in `media/opening-v3-prompt.md` and `media/opening-v3.png`.

Use current desktop Chrome: the engine needs WebAssembly promise integration,
shared memory and WebGL 2. `yougame.json` enables the supported embedded isolation
policy. Unsupported browsers show a capability message. Click Play to start audio
and enter the roster. Use Report to capture measurements, or Controls to remap
keys and assign controllers. Local versus supports four SDK seats.

The default keyboard follows [Slippi Dolphin's built-in bindings](https://github.com/project-slippi/Ishiiruka/blob/slippi/Source/Core/Core/HW/GCPadEmu.cpp#L142).

| Action | Key |
|---|---|
| Move / character-select cursor | Arrow keys |
| Attack / confirm, special / back | X, Z |
| Jump X / jump Y | C / S |
| Start | Enter |
| Shield L / shield R / grab Z | Q / W / D |
| C-stick up / down / left / right | I / K / J / L |
| Half main stick / half C-stick | Left Shift / Left Ctrl |
| D-pad up / down / left / right | T / G / F / H |

Left Alt suppresses Enter's Start action, as in Slippi. The port retains its
80-unit Melee keyboard stick range; each modifier halves its own stick.
Movement uses the SDK's normal Move / Aim bindings, so Controls remapping works
for both sticks. Opposite keyboard directions cancel. When keyboard and an ordinary gamepad are
used together, modifiers apply to the active merged stick input; the keyboard
D-pad and Alt/Start guard remain active. Unmodified SDK axes retain the last
active device’s range: keyboard alone uses 80 units; mixed input can use the
ordinary gamepad’s 127-unit range. Raw GameCube adapter input bypasses this path.
Previously saved YouGame
control overrides take precedence; reset those in Controls to use these defaults.
Additional players use controllers; their default keyboard bindings are empty.
Physical controllers have not been validated; test controllers exercise the
standard Gamepad API.

## Phones

`src/touch.mjs` draws the OpenSmash64 touch scheme with Melee's buttons on any
device with a coarse pointer (`?touch=1` forces it on a desktop for layout work):
a control stick on the left, the C-stick and A / B / Jump (X) / Grab (Z) /
Shield (R) on the right, Taunt (D-pad up) above the stick, Start and a
"Reset match" button (hold L+R+A and press Start, so pause first) in the top
right. The overlay reads into port 1 beside the SDK seat in `readSeat`
(`withTouch` in `app.mjs`): buttons merge, a deflected touch stick replaces that
stick, and the triggers follow Shield. An upright phone turns `#play-surface`
(the canvas, the online match iframe and the overlay) 90°, as the 64 edition
does; the online screens cover the overlay while they are open, and in a session
the reset gives way to a hold-to-leave. The last input picks the scheme: a
pressed Bluetooth pad or a page-owned GameCube adapter hides the overlay and
gives the picture the whole screen; a touch on the picture brings it back.

The engine itself still needs WebAssembly promise integration, so phones run
Melee only where their browser has it (Chrome 137+ on Android). Safari on iOS
26.2 has no JSPI and shows the capability message at Play.

Tests: `node --test melee/tests/touch-controls.test.mjs` (pointer handlers in a
vm), `melee/tests/touch-browser.mjs` (layout, sticks, buttons and controller
hand-off at six phone viewports without the engine) and
`melee/tests/touch-native-browser.mjs` (a served build with the real engine;
touch events must reach `_melee_input` on port 1). The browser tests take
`PLAYWRIGHT_PATH` and `PLAYWRIGHT_CHROMIUM` like `keyboard-browser.mjs`.
`melee/tools/package-touch-update.mjs <released-package> <out>` overlays this
checkout's `melee/src` and `controllers/` on a released package without
rebuilding the engine, for wrapper-only releases.

## Build and upload

Run `python3 melee/tools/build.py`. Prerequisites are the pinned native
`build/melee4mac` checkout and extracted GALE01 revision 2 inputs, `tools/emsdk`,
CMake, Ninja and Homebrew Python. The executable hash is checked before staging.
[upstreams.json](upstreams.json) records the upstream commits.

The build applies `engine/browser.patch`, excludes `.mth` movies, compresses
4 MiB asset blocks, generates game C in 512-instruction chunks, applies the
version-checked versus/unlock and asset selection/match hooks, compiles the engine and stages
`build/melee-web/dist`. `--stage-only` refreshes a previously compiled engine.
`--optimize-wasm` is experimental and requires fresh benchmarking.

Run YouGame MCP `check_build`, verify actual gameplay, then run
`python3 melee/tools/package.py`. The ZIP has `index.html` at its root. Use it to
update the existing `opensmash-melee` listing, not to create a duplicate. YouGame's
streaming upload helper accepts the full build with an MCP upload token; its older
raw-ZIP API has a smaller limit. A browser upload also works.

Run `python3 melee/tools/serve.py --port 8075` for local play. Test utilities:
`node melee/tests/keyboard.mjs` validates the rectangle input math;
`tests/media.mjs` exercises keyboard and standard controller input in an isolated,
headed Chromium session and captures metrics/media; `tests/embed.mjs` tests the
platform's iframe isolation and Report controls. Set `PLAYWRIGHT_PATH` to the
installed Playwright module. Old `tests/play.mjs` and `tests/boot.mjs` retain the
pre-Lite menu flow and are historical utilities, not current acceptance tests.

Game-derived inputs, generated C, engine binaries and archives stay in ignored
`build/melee-web/`. Source and dependency licenses accompany the build in the
separate `OpenSmash-Melee-source.zip`. B0XX adaptations retain their MIT notice.
