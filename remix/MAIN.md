# OpenSmash64 Remix

Includes the completed browser performance release from source commit `b2e071a`: AudioWorklet with SDL fallback, the offline clock, bounded diagnostics, dynamic texture scratch, accelerated checkpoints and Friends fixes.

Main browser build: `yougame/dist`. Bundle: `build/OpenSmash64-Remix.zip`.
The curated roster has 34 independent fighter slots. The 22 added fighters use
models, textures, movement attributes, animations, attack scripts and hitboxes
extracted from the supplied Smash Remix 2.0.1 ROM. Their neutral, up and down
specials now have native implementations, including projectiles, charging,
command grabs, counters and recovery states. Kirby loads his extended ROM data,
copy animations and hats for all 22 additions while retaining the original powers.

The current multiplayer candidate also includes four local controller ports,
ROM selection announcements, combat samples, sword trails and shared effects,
animated victory/defeat screens, and returning to the saved local setup. This
working build is separate from the coordinator's published release. Its exact
validation status is tracked in [multiplayer-coverage.json](multiplayer-coverage.json).

Imported fighters currently use default costumes. Other original fighters retain
their native Smash 64 implementation. Some Remix-specific cosmetic effects and
sequenced sounds remain unported; these checks do not establish exact Remix
balance or competitive equivalence. Bosses, polygons, regional variants and
unselected bonuses remain outside this roster.

## Roster (34)

Mario, Fox, Donkey Kong, Samus, Luigi, Link, Yoshi, Captain Falcon, Kirby,
Pikachu, Jigglypuff, Ness, Falco, Ganondorf, Young Link, Dr. Mario, Wario,
Bowser, Wolf, Conker, Mewtwo, Marth, Sonic, Sheik, Marina, Dedede, Goemon,
Banjo & Kazooie, Peach, Crash, Dark Samus, Lucas, Roy, Dr. Luigi.

## Stage pool (8)

| Stage | Role in this build |
|---|---|
| Dream Land | Familiar baseline; native Whispy behavior |
| Fray's Stage | Dream Land layout without Whispy |
| First Destination | Flat alternative from the tournament preset |
| Pokémon Stadium | Two-platform layout |
| Pokémon Stadium 2 | Alternative Stadium presentation and layout data |
| Goomba Road | Asymmetric counterpick option |
| Battlefield | Three-platform alternative |
| Final Destination | Native flat-stage option |

The six imported stages use ROM geometry, collision lines, blast zones, stage
textures, backgrounds and model animations. Stage music currently uses a native battle
track. Combat sound effects use the extracted Remix sample bank. Both players spawn at
opposite equal-height spawn points selected from each stage's own map data.
Local VS offers the full pool. Online peers validate the same roster and stage
IDs, and use P1's stage selection consistently. This is a simple stage selection
policy, not a tournament striking or banning system.

## Community sources consulted, September 9, 2026

- [Smash Remix project README](https://github.com/JSsixtyfour/smashremix/blob/master/readme.md):
  the Tournament layout follows the Smash Remix Tour stage rules and the
  Tournament preset includes generally accepted stages. All eight selected maps
  appear in that preset. This is the basis for the pool, not a claim that every
  event allows every map.
- [Smash Remix Tour EC Monthly 2 rules](https://challonge.com/SRTECNetplayMonthly2):
  an older **1.1.1** event lists hazardless Dream Land layouts, Pokémon Stadium
  and Goomba Road as starters, plus Green Hill Zone and Smashville counterpicks.
  It supports historical tournament use, not a universal current ruleset.
- [Community character-legality discussion](https://www.reddit.com/r/SmashRemix/comments/1lkzqmf/character_legality_in_bracket/):
  community support informed the four bonus choices. TO decisions vary.

Smashville and Green Hill Zone remain candidates for a later pool expansion;
this initial release concentrates on maps whose collision and animation data can
run through the current native stage systems. Stage file IDs were checked against
[the project's stage definitions](https://github.com/JSsixtyfour/smashremix/blob/master/src/Stages.asm)
and all playable asset bytes came from the local ROM.

## Build

Run `bash yougame/build.sh "/path/to/Smash Remix 2.0.1.z64"` in the project root.
The pinned BattleShip checkout, existing original-game asset archive, Emscripten
and local Python environment must already be available. No ROM is distributed
in this repository. Extraction checks the supported ROM's SHA-256.

Native changes are installed idempotently by `remix/prepare_main.py` using narrow
source anchors; it preserves unrelated engine performance changes. The generated
asset/header files live under `build/remix/main/assets` and remain local.

Evidence is recorded under `build/remix/main/checks`: paired checks cover all 34
fighters, native frame replay, the eight stages, and actual menu navigation into
Marth-versus-Roy on Pokémon Stadium. Unit tests cover bonus/boss filtering,
stage agreement, and rejection of changed metadata. These checks establish the
implemented port behavior, not complete moveset accuracy or balance.

## Verified candidate

- All 34 fighters covered in 17 native pair runs on the combined performance build.
- Eight stages checked for rendering, opposing spawns and 40-frame exact replay.
- Two native clients: confirmed state agrees at frame 227 after 59 rollbacks each.
- Marth's jab damages Roy through normal walking and attack inputs.
- 78 unit tests pass; 3 optional SDK-dependent tests are skipped in the local unit command.
- 3,977 extracted assets and 109,173 relocation references validate against their
  recorded sizes and hashes.
- Native roster → CPU choice → stage choice → match launch passes.

Publishing status and release identifiers are recorded separately under remix/media.

## Imported selection menus

The VS flow uses the local Remix ROM's 30-slot portrait order, with Dark Samus,
Lucas, Roy and Dr. Luigi directly beneath it. Portraits, selection pucks, pointer,
player cards, mode title and background are ROM sprites; selected fighters use
real rotating native models. Fighter selection uses the native VS screen's
controls: every human moves a free hand with the stick (keyboard arrows and the
phone stick drive the same hand), carries their own puck, drops it on a portrait
with A, lifts it again with A or B, and can drag a CPU's puck the same way;
Start fights once every puck is down, holding B backs out. Additional local
controllers join with Start. The stage is then chosen from a four-column grid.

Stage selection uses the ROM's stage icons and title/cursor artwork, with a native
3D model preview for each of the eight selected maps. This is an adaptation of
Remix's graphical menus for this build's curated pool and multiplayer flow,
not an emulation of the ROM menu code or its full options system.

`extract_menu.py` reads portrait layout/table offsets 0x2D20E18/0x2D20EBC and
stage-icon table 0x2C56C9C from the pinned local ROM. Official CharacterSelect.asm
and Stages.asm signatures located those tables. Menu art adds eight assets;
combined validation now checks 3,985 assets and 110,050 bounded relocations.

Results render each active fighter in its victory or defeat animation, show the
winner and KO/fall counts, and return to the graphical fighter menu. Local matches
restore the selected roster and controller setup; online results expose rematch
and leave actions to the multiplayer session. The baked-in personal-name footer is hidden on the start screen.

The September 14 presentation and four-stock update is described in
[the release record](../docs/remix-polish-release-2026-09-14.md).
