# Native release provenance for the competitive frontend

The competitive frontend must be packaged against a frozen native release. A mutable gameplay working directory is not a release source. This keeps online/menu work from publishing unrelated, unfinished gameplay changes.

## Smash Remix 2.2

The authenticated YouGame `my_games` response on 2026-09-10 identified `opensmash64-remix` as version 2.2. Its public listing gave this immutable entry:

https://67f60110b3d44a519c3107afcc520961.yougame.co/v/47c85145b7c0407fbd3ea4df3ef50853/index.html

The creator ZIP-download endpoint returned HTTP 500, so the engine JS, Wasm, manifest and every asset referenced by that manifest were fetched from this exact version URL. Optional listing media and licenses were also obtained from that version. The isolated local copy is `build/live-remix-2.2`; its complete URL/size/SHA256 inventory is `build/live-remix-2.2-provenance.json`.

| Native file | SHA256 |
|---|---|
| `engine/BattleShip.js` | `61c241d15365c98165d6f8a2ffd3e7e6d220b8a13af1879c42f863797bfe8537` |
| `engine/BattleShip.wasm` | `8ed551fcde89e501e7059c626c5f5c13e39eaf7762d606d9afa23b5c1886387e` |
| `engine/files/BattleShip.o2r` | `595a542cad0531fdc157261ecc1df7585ef1cfc0c9273ebfa59db8a4972ffec2` |

The native exports required by rollback were present. Two actual native clients completed all three games of a 2–1 ranked set with initial three-stock assertions, Mario/Kirby → Marth/Roy → Falco/Ganondorf, delayed/lost input packets, and rollback in every game. The resulting peer reports agreed exactly. Evidence lives in `yougame/test-results/native-competitive-frozen`.

## Original OpenSmash64

Original retains the previously frozen released engine and assets, carried forward through `build/competitive-original-clock`. No currently active native source/build is read or modified when repackaging it.

| Native file | SHA256 |
|---|---|
| `engine/BattleShip.wasm` | `13bb168874cef631c1645e6b458cd349a039e78c9f74ee48af62702e4ca16cbe` |
| `engine/files/BattleShip.o2r` | `7eed12e92cc44ec2cd6a11f7a05a037908d42b9a0ef2400ce13b953000d42650` |

The same native test passed with initial four-stock assertions and Mario/Kirby → Ness/Pikachu → Fox/Link.

## Current staging inputs

Use `yougame/package-edition.mjs` with the frozen sources above. The current corrected packages are `build/competitive-original-frozen` (build `f2d1b6efcf273a49`) and `build/competitive-remix-frozen` (build `4dd7a725016e90c8`). Earlier packages named `competitive-remix-clock` used a shared gameplay output and are superseded; do not publish them.
