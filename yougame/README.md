# OpenSmash64 main build

The current main build is the curated Remix edition: 34 fighters and eight stages.
See [remix/MAIN.md](../remix/MAIN.md) for current scope, rules, limitations and build instructions.
Earlier 12-fighter and Dream Land-only descriptions below document the original edition.

# OpenSmash for YouGame

This is a static browser edition of [OpenSmash](https://github.com/turtlesoupy/opensmash)
using its actual [BattleShip engine](https://github.com/turtlesoupy/BattleShip).
The original OpenSmash source remains in the repository. This directory contains the
native menu integration, multiplayer transport, reproducible engine patches, and packaging tools.

## Play

Upload the contents of `dist/` as a ZIP to YouGame. Set the listing to **both single-player
and multiplayer**, with keyboard/gamepad/touch controls and **Works on phones** enabled. The YouGame SDK supplies the ranked
ladder; this fighter does not submit single-player leaderboard scores.

The game boots into its original Mode Select screen. Choose **Online**, then **Casual**
or **Ranked**, select a fighter with the original character-select cursor, and press Start. The static package includes the extracted
game assets from the ROM supplied for this project. There is no ROM picker, account-storage
requirement, browser-side extraction, or first-visit file upload. The engine downloads its
assets from the same game build when a match launches.

- **Casual 1v1** and **Ranked 1v1** use separate YouGame queues under `opensmash-rollback-v1`.
- Twelve original fighters; Dream Land; three stocks; eight minutes; no items.
- A timeout compares remaining stocks, then damage; an exact tie is a draw.
- Only two humans enter online matches. The original 1P, training, and local VS menus remain.
- Online uses existing controller icons, menu-tab sprites, backgrounds, and font glyphs.
  There is no HTML launcher, replacement fighter artwork, or external match toolbar.
- In Casual/Ranked, Start after fighter selection starts matchmaking and marks the player
  ready. Results and Rematch/Back appear in the native Online menu; YouGame handles
  the ladder and result settlement.
- In Friends, choose a fighter and press Start to open YouGame's real friend picker.
  Choose a friend or Copy invite link to create the room. YouGame then shows its lobby,
  Ready, invite-link and result/Continue cards. Private hosts disable public queue fill;
  nobody is automatically marked ready. Invite links open original fighter selection
  automatically, then Start joins the existing room. Native menus pause behind the lobby.
- Leaving an active match forfeits. A connection failure during loading returns to the
  menu. A detected desync or simulation failure ends the active match as a draw.

Keyboard controls follow [Slippi Dolphin's default action layout](https://github.com/project-slippi/Ishiiruka/blob/slippi/Source/Core/Core/HW/GCPadEmu.cpp#L142),
shared with OpenSmash Melee and Smash Remix.

| Action | Keys |
| --- | --- |
| Move / character-select cursor | Arrow keys |
| Attack / menu select | X |
| Special / menu back | Z |
| Jump | C or S |
| Shield | Q or W |
| Grab | D |
| Start / local pause | Enter |
| Half stick for walking / tilts | Left Shift |
| Native C-up / down / left / right | I / K / J / L |
| D-pad up / down / left / right | T / G / F / H |

Opposite directions cancel. Short keyboard taps survive one simulation sample.
Left Alt suppresses Enter's Start action. The N64 C buttons retain their native
jump / costume-selection behavior, and shields are digital. The Melee C-stick
modifier has no N64 equivalent.

Use arrows to move the character-select hand, X to place the token, then Enter
to queue. Start pauses local games; online games cannot pause.
Escape leaves an online match.
A standard browser gamepad is supported: left stick/D-pad move, A attacks, B specials,
X/Y jump, shoulders/triggers shield, right stick C buttons, Start in local games.

The original site's server-side AI fighter generation and hosted 1,000-character service
are not part of this static edition. They remain in `web-prototype/` and `pipeline/`.

## Landscape mobile controls

Phones automatically show a thumbstick on the left and action buttons on the right.
The game keeps its original 4:3 picture between the controls, accounting for display
cutouts and home-indicator safe areas. Landscape starts automatically: the game rotates
its play surface if the player viewport is portrait, leaving native orientation and
fullscreen to the host. There is no rotation prompt or input gate. Pointer directions
and safe areas follow the same surface rotation. Orientation, fullscreen and viewport
changes release held controls and refresh the layout as the browser resizes.
Sizing uses the document viewport, avoiding inflated `innerWidth` values from
the previous landscape surface when rotating back to portrait.

- Native menus: stick to navigate/move the fighter hand, A to select, B to go back,
  and Start to confirm the chosen fighter.
- Gameplay: stick, Attack, Special, Jump, Shield, and Grab support multiple pointers.
  Quick taps are latched until the next simulation sample. Cancelled touches, rotation,
  backgrounding, and engine transitions release the controls.
- Start pauses local games. Online shows **Hold to leave** instead (hold for 1.2 seconds).
- YouGame handles fullscreen; the game has no fullscreen button.
- A large green A anchors the right-thumb cluster, with the smaller buttons following an arc
  from Special lower-left through Jump and Grab to Shield above A. Start (or Hold to leave
  online) is top-right in the black margin.
- In menus, fighter/stage selection, and fights, the visible stick center is the
  analog origin. Contacts outside the circle immediately produce movement without
  requiring an extra drag, with the same expanded hit area on every screen.
- The movement hit area spans the left side below the top 64 pixels and extends
  64 pixels beyond the movement gutter, including space outside the visible circle.
  The circle and game picture are inset a further 32–48 pixels from the left edge
  (in addition to device safe areas) to give leftward movement more room.
  Pointer capture keeps a held direction active when the finger drifts beyond this
  area; the visible circle still defines analog center and travel during fights.
- Stick axes are not latched: release, cancellation, and the center deadzone immediately
  yield zero. Button taps still survive between simulation samples.
- Stick travel and its thumb indicator clamp each axis independently, with a small
  deadzone on each axis. Horizontal sweeps outside the circle keep a constant vertical
  input instead of curving upward across the center; each new touch starts fresh.
- Desktop uses the keyboard layout above and standard gamepad controls. `?touch=1` enables the
  controller on desktop for layout testing.
- On a phone the last input picks the scheme. A button press or stick move on a connected
  controller (or an owned GameCube adapter) hides the stick and buttons and lets the picture
  fill the rotated surface; touching the picture brings them back, and so does the pad going
  away. Only **Hold to leave** remains during online matches. `?touch=1` keeps the overlay
  regardless.

The local-only `tests/mobile-harness.html?touch=1` fixture runs a real CPU battle with
the same touch/input modules. Serve `yougame/` on a separate localhost port to use it.
It is excluded from the upload ZIP. Real iOS/Android devices still need comfort,
and performance testing on physical devices.

## Networking

YouGame rooms relay the input stream and own matchmaking, identities, results, and ratings.
No custom WebSocket server, database, or signaling service is required.

Online now uses the [YouGame rollback controller](https://yougame.co/sdk.md#pattern-c-deterministic-lockstep-and-rollback):
60 Hz, two frames of local input delay, and a ten-frame prediction window. YouGame owns
input prediction, redundant input bundles, replay, stalls, and confirmed-state checksum
exchange. There is no separate host-ordered timeline in the active online path.

BattleShip remains native C/C++ compiled to WebAssembly. The integration adds a synchronous
frame entry point and local binary checkpoints. Both peers preload the battle and advance
with neutral inputs to its first active tick before starting the network clock. The room
seed and round determine the native RNG seed. Build fingerprints and a versioned queue
keep incompatible versions out of the same duel.

Checkpoint storage shares unchanged 16 KiB memory pages. It preserves live Wasm memory,
allocator bookkeeping, suspended fibers, RNG, scheduler queues, and game data. It omits
only texture-conversion scratch, unused stack capacity, and the unallocated tail of the
scene arena. These areas have no live state at the between-frame checkpoint boundary.
The SDK's JSON save value contains a frame handle and the native state diagnostic;
`load()` resolves that handle against this client's immutable binary history. Binary
snapshots stay local and are never sent over the network. Fourteen prior frames are kept;
expired or mismatched handles abort safely. SDK checksums therefore compare the canonical
native diagnostic, **not every raw byte** (renderer handles and audio timing differ between
clients). This is a desync diagnostic, not a complete anti-cheat mechanism.

A speculative KO holds the final engine state while inputs continue. Result settlement
waits until that KO is outside the prediction window, so a rollback can still undo it.
A desync, simulation failure, or prolonged stall stops the controller and submits a draw
before leaving. Rematches create fresh engines, checkpoint stores, and controllers.
Native menus and mobile/controller input remain in place.

### Rollback verification

Use a current copy of the SDK to run its actual prediction algorithm in the tests:

```sh
curl --fail https://yougame.co/sdk.js -o /tmp/yougame-sdk.js
YOUGAME_SDK_PATH=/tmp/yougame-sdk.js node --test yougame/tests/*.test.mjs
YOUGAME_SDK_PATH=/tmp/yougame-sdk.js node yougame/tests/extract-sdk.mjs
PORT=4176 node yougame/tests/serve.mjs .
```

Open `/yougame/tests/rollback-engine.html` for native checkpoint/replay verification,
and `/yougame/tests/rollback-pair.html` for two real Wasm engines using the SDK algorithm
with delayed and dropped input bundles. The generated SDK fixture and harnesses are
excluded from the upload. See `ROLLBACK.md` for measured results and remaining validation.

## Build

Pinned sources:

- BattleShip: `3ba1814ec34c376b1d1904b4dda2ef503ee90701`
- Its decomp submodule: `eddd0c9ba8ce0b9e80a225929ce466adc2e999fe`
- Emscripten used for this build: `6.0.9`

Install Emscripten into `tools/emsdk` and activate it. Create `.venv` with Python and install
`cmake`, `ninja`, `pillow`, and `pyyaml`. Node 20+ is needed for the build tools.

```sh
node yougame/prepare-engine.mjs
bash yougame/build.sh /absolute/path/to/your/opensmash.z64
```

`prepare-engine.mjs` applies patches only to the pinned engine. It accepts an already
patched checkout and fails on unexpected revisions or incompatible local modifications.
The engine checkout is ignored by the main repository; the tracked patches and
`yougame/engine/yougame.c` are the source of the integration.

For browser-bridge-only changes after building the engine:

```sh
node yougame/build.mjs
node --test yougame/tests/*.test.mjs
```

Rollback page comparison uses the optional `src/page-compare.wasm` helper, built
from `engine/page-compare.c` with `node yougame/build-page-compare.mjs` (also run by
`build.sh`). It imports the existing engine memory and needs Wasm SIMD (`-msimd128`,
no threading): a browser without it fails `WebAssembly.compile` and checkpoints take the
exact JavaScript comparison. Besides a 32 KiB scratch page it keeps a mirror of the used
heap inside that heap (the heap's size plus 8 MiB, replaced when the heap outgrows it,
within the committed `INITIAL_MEMORY`) and compares live pages against it in runs with no
copy. Both allocations stay out of checkpoints through `ranges()`; allocation metadata
remains in history.
The checkpoint bookkeeping uses a byte mask instead of rebuilding a large Set.

`tests/performance.mjs` benchmarks the packaged engine with deterministic inputs,
separating simulation/render submission from snapshot time. Set `PERF_PACED=1`
and `YOUGAME_SDK_PATH` to a local SDK copy to use YouGame's actual 60 Hz scheduler.
`tests/verify-rollback.mjs` runs the actual-engine rewind, delayed-pair, and KO
fixtures after `tests/extract-sdk.mjs`. Both runners serve only runtime assets
and explicit fixtures on loopback, and accept `PLAYWRIGHT_PATH`.

Packaging selects runtime files, including the extracted `BattleShip.o2r` game archive.
It excludes raw ROM images, the browser extractor, nested ZIPs, and server scripts.
`yougame/build-check.json` contains the
file inventory and authored loader/source text for the YouGame MCP `check_build` tool.
Run that tool after the final build. Then ZIP the contents of `dist/`, with `index.html`
at the archive root.

## Release: both editions, always

OpenSmash64 and Smash Remix are one engine and one wrapper; only the profile, roster, media and
the app `BUILD` differ. A change never ships to one edition alone. Package both from the same
source (`package-edition.mjs` / `package-touch-update.mjs` into `<dir>/original` and
`<dir>/remix`), then publish them together:

```sh
YOUGAME_API_KEY=$YOUGAME_API_KEY_OPENSMASH node yougame/publish-editions.mjs <dir> --notes "what changed"
```

The script refuses when any shared file (engine, netplay, controls, styles) differs between the
two editions, uploads original then remix, publishes original, and publishes remix with
`upstream` set to the original's upload so the remix listing's base follows. `--dry-run` only
runs the comparison.

## Test

```sh
PORT=4174 node yougame/tests/serve.mjs yougame/dist
```

Open `http://127.0.0.1:4174` in two tabs. The SDK uses real development rooms and separate
tab identities; development results do not change published ratings. On YouGame itself,
use two distinct browser identities/accounts.

`tests/game-smoke.cjs` runs the real engine in two Playwright clients,
starts from two clean browser profiles without uploading files, plays through a stock
knockout, checks both results, uses the native Rematch menu option,
and tests disconnect handling. Set `RANKED=1` for ranked,
and `PLAYWRIGHT_MODULE` to the installed Playwright module if it is outside node_modules.
`tests/sdk-smoke.cjs` separately checks both queue types and room rematches.

The automated protocol tests cover delayed inputs, stalled/bounded buffers, altered inputs,
invalid packets, stale rounds, matching results, and desync aborts. Real Internet latency,
different machines, long sessions, and all fighter matchups need broader playtesting.

## Kosher edition (YouGame patch listing)

`node yougame/package-kosher.mjs <package-dir> <out-dir> [web-dist]` turns a direct-play package
into the edition that ships no ROM-derived data: `engine/files/BattleShip.o2r` and the stage
select-screen PNGs are dropped, Torch (wasm) and `engine/torch-worker.mjs` + `engine/rom-extract.mjs`
are added, and `engine/index.html` builds the archive in the browser from the ROM the YouGame page
hands over through `parent.YouGame.baseGame()` (cached in the game origin's IndexedDB per recipe +
ROM SHA-1). It is published on YouGame as a patch listing (`kind: "patch"`, only the USA NALE dump
accepted), where the player picks their own ROM once on the site; nothing ROM-derived is hosted.
BUILD is unchanged, so the edition is the same game as the direct-play package it came from.
