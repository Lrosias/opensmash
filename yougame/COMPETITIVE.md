# Competitive online: original Smash64 and Smash64 Remix

Since 2026-09-11 the native Online scene is the only entry: the browser "Competitive online" button and its mode picker were removed (see `docs/native-online-entry-removal-2026-09-11.md`). Evidence below about the browser picker's keyboard/touch fighter selection and queue routes predates that removal.

Both editions share the same online lifecycle: select a fighter, choose Casual / Ranked / Friends, connect through the uGames lobby and Ready barrier, play, agree on confirmed game results, and use the platform result card's Continue action for another set. Ranked is best of three; after a game the winner locks their fighter first and the loser counterpicks second. Dream Land is the only ranked stage. Tied ranked games replay with locked characters. Casual/Friends play one game and use a deterministic shuffled stage bag before repeats. Ranks and placements come from platform result events; casual ratings are hidden.

The built-in profile controls the complete edition, including native launch flags, legal inputs, queue identity, and number of stocks:

| Edition | Fighters | Casual stages | Stocks | Ranked mode |
|---|---:|---:|---:|---|
| Original | 12 | 9 original stages | 4 | `opensmash64-competitive-v1` |
| Remix | 34 curated fighters | 8 curated stages | 3 | `opensmash64-remix-competitive-v1` |

Both use an eight-minute match limit and no items. The native `SSB64_REMIX_MAIN` flag is omitted entirely for original; native code checks its presence, so a value of zero would incorrectly enable Remix. Profiles are selected when packaging and cannot be changed with URL parameters or peer messages.

One platform round represents the entire ranked set. Each game creates a fresh native engine and SDK rollback timeline. The adapter scopes SDK input bundles by edition, round, and game, rejecting delayed packets from prior games/rematches. Native frame stepping and checkpoint comparison remain owned by the existing engine/SDK integration. Technical errors, timeouts, and state mismatches settle with `{void:true}` so they cannot change rankings. Actual forfeits remain wins for the remaining player. A set result reports one winner and aggregate game score after both peers agree on every game result.

A visible countdown at the top of the play surface follows native simulation ticks, including rollbacks, and freezes when the connection stalls. It avoids measured host-control reservations, supports rotated phone layouts, and hides between games. Adapter setup is hidden during the battle to leave this HUD clear.

The existing WebUSB GameCube adapter remains available, including its fixed four-port mapping for local play and port-one input online. Gamepad, keyboard, and touch selection are preserved.

The shared adapter facade also drives the competitive menu. An owned but empty/stale adapter stays neutral and never falls through to a duplicate browser gamepad; direction and button presses retain their existing single-action edges.

## Build from a preserved native release

Freeze native inputs as described in `NATIVE-RELEASE-PROVENANCE.md` before packaging.

Run `node yougame/package-edition.mjs original /path/to/original-build /path/to/new-original-build`, or use `remix` with an existing Remix build. The script verifies the manifest's edition, copies its existing native assets and licenses, stages all shared frontend/controller modules, assigns a fresh content-derived build identifier, and emits sibling `-check.json` / `-release.json` files. It refuses to overwrite an existing destination. The normal `yougame/build.mjs` also writes the correct profile based on its engine manifest.

## Acceptance on 2026-09-10

- 103 unit tests passed with the current deployed SDK, including actual SDK rewind/loss/jitter, neutral technical settlement, immutable fighter locks, one settlement per BO3, stage bags, cross-edition validation, stale-game isolation, controller adapters and touch behavior.
- Two real Wasm clients completed a three-game ranked set in each edition. Original selected Mario/Kirby, Ness/Pikachu, Fox/Link; Remix selected Mario/Kirby, Marth/Roy, Falco/Ganondorf. Both peers independently reported the same 2–1 result exactly once. Every game exercised rollback under delayed/lost bundles. The harness also injected old-game bundles. Original ran in 26.6 seconds and Remix in 20.3 seconds; these are accelerated test durations, not latency claims.
- Packaged desktop and landscape-mobile menus verified 12/34 fighters, keyboard/touch selection, three queue routes, cancellation recovery, and absence of browser exceptions.

Reproduce with `YOUGAME_SDK_PATH=/path/to/current/sdk.js node --test yougame/tests/*.test.mjs`; generate the native fixture with `YOUGAME_SDK_PATH=... node yougame/tests/extract-sdk.mjs`, then run `node yougame/tests/native-competitive.mjs`. `node yougame/tests/edition-browser.mjs` tests the packaged release menus. Browser tests use localhost and do not invite real users. Hosted publication/session verification is a separate release step.
