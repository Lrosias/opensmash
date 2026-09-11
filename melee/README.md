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

The page boots straight into Melee. A native mode menu, drawn with the game's
own SIS text renderer over the versus character select, offers **LOCAL VERSUS**
and **ONLINE** (**FRIENDS**, **CASUAL**, **RANKED**); the stick or D-pad moves,
A selects, B goes back, and B on an empty roster returns to the menu. Online
games boot a second engine in an iframe on Melee's own character select, stage
select and results, through `MeleeNativeRoomSession`; the platform's lobby owns
membership and invitations. The native screen shows the platform's status line
(searching, waiting, failed) with BACK and TRY AGAIN. There is no browser title
screen, no HTML mode picker and no HTML lobby or set screens any more; Escape or
the touch "Hold to leave" leaves an online session.

`melee/engine/Menu.cpp` runs the menu on the CPU thread from the
`HSD_PadRenewMasterStatus` hook (lite.py) and calls the recompiled SIS text
functions through the module dispatcher; while it is open the game sees neutral
pads. `?log` on the page routes the game's own OSReport lines to the console.

Use current desktop Chrome: the engine needs WebAssembly promise integration,
shared memory and WebGL 2. `yougame.json` enables the supported embedded isolation
policy. Unsupported browsers show a capability message. Sound starts on the first
click or key press. The platform's Controls panel remaps keys and assigns
controllers. Local versus supports four SDK seats.

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
Physical controllers and mobile have not been validated; test controllers
exercise the standard Gamepad API.

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
`tests/native-menu-browser.mjs` drives the native mode menu on the real engine
and screenshots it; `tests/native-room-app-browser.mjs` drives the online flow
through the menu callback with fixture transport and engines.
`node melee/tests/keyboard.mjs` validates the rectangle input math;
`tests/media.mjs` exercises keyboard and standard controller input in an isolated,
headed Chromium session and captures metrics/media; `tests/embed.mjs` tests the
platform's iframe isolation and Report controls. Set `PLAYWRIGHT_PATH` to the
installed Playwright module. Old `tests/play.mjs` and `tests/boot.mjs` retain the
pre-Lite menu flow and are historical utilities, not current acceptance tests.

Game-derived inputs, generated C, engine binaries and archives stay in ignored
`build/melee-web/`. Source and dependency licenses accompany the build in the
separate `OpenSmash-Melee-source.zip`. B0XX adaptations retain their MIT notice.
