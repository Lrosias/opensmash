# Smash Remix roster import

The local prototype extracts all 94 entries in the supplied ROM's selectable
fighter-name/ID table, excluding Random. This includes the original 12,
Remix fighters, regional variants, metal/giant forms and polygon fighters.
Master Hand's boss record and an unused duplicate record are outside that
selectable table and are not exposed as normal fighters.

## Play locally

```sh
PORT=4198 node yougame/tests/serve.mjs build/remix/demo
```

Open <http://127.0.0.1:4198/> and choose a fighter. Choose practice for a
stationary Kirby opponent. The selector reloads the match with that fighter's
original ROM model, textures, stock icon, attributes, rig and animation assets.
WASD/arrows move, M attacks, P/Space jumps, Q shields, Enter pauses.

This extends the Marth prototype's scope. Each match temporarily substitutes
one imported fighter into Fox's engine slot. Custom specials are disabled;
voices, fighter-specific transitions, third jabs/rapid jabs, custom weapons,
grabs/throws and cosmetic effects are not fully ported. Some Remix command
extensions are omitted, including animation-rate changes, so this is not a
frame-accurate competitive port. Sandbag retains its non-attacking behavior.
Fighters cannot yet face another imported fighter, and this is not an online
build. The existing YouGame distribution and original Marth demo are separate.

## Rebuild offline

```sh
bash remix/build_roster.sh '/Users/luis/Documents/SmashRemix/Smash Remix 2.0.1.z64'
```

The extractor checks the ROM SHA-256 documented in [README.md](README.md).
All dependencies and the engine toolchain come from the existing workspace.
The input ROM is not modified. Generated assets remain under gitignored
`build/remix/`; the source importer does not embed ROM assets.

The Marth-only build remains available through `build.sh`. Both builds use
the local `BattleShip/build-wasm` compiler output, then package into separate
demo directories. `prepare.py --roster` installs the general importer using
the same opt-in engine hooks. With neither `SSB64_REMIX_FIGHTER` nor the legacy
`SSB64_REMIX_MARTH` switch set, the hook leaves engine data unchanged.

## ROM evidence

- Fighter-data pointer table: `0x00092610`.
- Character-name pointer table: `0x02CE3E84`.
- Corresponding fighter IDs: `0x02CE4000`. This is necessary because displayed
  name order differs from internal fighter order.
- Asset directory: `0x001AC870`; asset data starts at `0x001BC830`.
- ROM address mappings: expanded RAM `0x80400000` maps to ROM `0x02C00000`;
  original fighter data uses RAM minus `0x80084800`; opening/sub-motion data
  uses RAM minus `0x80288A20`.
- Custom command dispatcher: `0x02C6FBE4`; handler table: `0x02C70820`.
  Inspected D0–DA command handlers consume four bytes, except D6 and D9,
  which consume eight. Unsupported DB control-flow commands are rejected.

The archive contains 4,548 shared assets. A few source references point
outside their dependency files and require Remix's own runtime patches.
The prototype nulls exactly 12 inspected references, preserving each original
checksum and recording the changed slot/target. Unexpected invalid references
stop extraction. One compressed asset's header describes a byte beyond its
word-truncated table size; the extractor preserves it and pads to four bytes.

`build/remix/assets/extraction.json` contains source records, motion tables,
script words, omitted commands, original/extracted checksums and reference
repairs. `roster.json` is the selector's small public manifest.

## Validation

```sh
python3 remix/verify_assets.py --roster
python3 remix/verify_scripts.py
python3 remix/test_scripts.py
PLAYWRIGHT_MODULE=/path/to/playwright CHROMIUM_PATH=/path/to/chromium \
  node remix/roster_smoke.cjs
PLAYWRIGHT_MODULE=/path/to/playwright CHROMIUM_PATH=/path/to/chromium \
  node remix/selector_smoke.cjs
```

The archive check verifies 4,548 checksums, 127,769 bounded relocations and
850 terminated translated scripts. Additional normal attacks retain their
original relative scripts and use the engine's relocation/interpreter path.
The script walker checks all 1,628 normal-script entries: 21,276 events,
branch destinations, payload bounds and hitbox indices. Eight parser unit
tests cover branching, finite loops, extension sizes and malformed input.

The browser harness uses only localhost. It checks each fighter's main/model
IDs, movement, animation, active hitboxes, visibility and damage against Kirby.
An explicitly enabled test fixture places the fighters at repeatable distances;
attacks, collisions and damage still run through the real game. Sandbag instead
must retain its lack of attacks. Screenshots, logs and sampled states go to
`build/remix/verification/`. This is gameplay smoke coverage, not exhaustive
validation of every move or interaction.

The completed run passed all 94 entries: 93 combat fighters plus Sandbag, over 59,745 sampled frames. The selector check also passed repeated fighter changes, mode changes, restart, uncancelled dropdown keys and isolation of the test-only positioning fixture. See `build/remix/verification/report.md` for individual results and screenshots, and `provenance.json` for the tested archive and Wasm hashes.
