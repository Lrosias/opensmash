# Marth: local Smash Remix binary import

For the expanded 94-fighter selector and offline build, see [ROSTER.md](ROSTER.md).

This prototype imports Marth's actual model, textures, rig, stock icon and
animations from the supplied Smash Remix 2.0.1 ROM into OpenSmash's BattleShip
engine. It also translates 14 normal attack scripts: two jabs, dash attack,
three tilts, three smashes, and five aerials. The retained scripts preserve
their original timing, hitbox positions, damage and knockback.

This is an experimental local build. Fox is the temporary engine slot. It is
not a complete Marth moveset port: specials are disabled, and custom voices,
sword trails, other cosmetic script events, and full character-select/menu
integration remain unfinished. Grab/throw behavior and every engine interaction
have not been exhaustively ported or tested. Do not use this build for online
matches. The existing YouGame distribution is unchanged.

## Run

The current local build is in `build/marth/demo/`. From the repository root:

```sh
PORT=4197 node yougame/tests/serve.mjs build/marth/demo
```

Open <http://127.0.0.1:4197/>. Move with WASD/arrows, attack with M, jump
with P/Space, shield with Q, pause with Enter. Direction plus attack performs
tilts, smashes and aerials. Existing OpenSmash gamepad bindings also work.
Use <http://127.0.0.1:4197/?practice=1> for a stationary Kirby opponent.

## Rebuild offline

Requires the existing local BattleShip checkout/build dependencies, its base
game archive, and the installed Emscripten toolchain. No asset downloads,
model generation, or web reference material are used by the extractor.

```sh
bash remix/build.sh '/Users/luis/Documents/SmashRemix/Smash Remix 2.0.1.z64'
```

The build uses the existing `BattleShip/build-wasm` build tree, then packages
the result into `build/marth/demo`. It does not publish or replace
`yougame/dist`. `prepare.py` applies four narrow source hooks and copies the
import module into the gitignored engine checkout. Normal engine runs keep
their original fighters unless `SSB64_REMIX_MARTH=1` is explicitly enabled.

## Binary evidence and translation

- Supported source SHA-256:
  `7efec9e0983656bb0219a23c511cd1505a5f84d524e50ad4284dc1c7eb4d1403`.
- Expanded asset directory at ROM offset `0x001AC870`: 5,455 files; data
  starts at `0x001BC830`.
- Marth's character-data record is at `0x02CBE960`. Main file is 3274,
  model file is 3275, attributes offset is `0x524`.
- 222 main motion descriptors; 160 distinct animation files; 167 assets
  including the transitive dependencies.
- Normal attack scripts run from `0x8055DE98` onward in the ROM's RAM mapping.
  Nearby Dolphin Slash, Dancing Blade and Counter labels corroborate the
  character identification. Name-list order must not be used as a fighter ID.
- VPK0 decompression uses the decoder already present in BattleShip. Every
  dependency receives a private asset ID (`0x4000 + source ID`) so imports do
  not overwrite the vanilla assets. Internal and external relocations use
  BattleShip's existing token and byte-order conversion pipeline.
- Generated C motion bytecode uses heap storage because the engine separates
  native pointers from relative file offsets at 1 MiB; Wasm static data can
  be below that boundary.
- A stationary entrance replaces the inherited Captain arrival animation;
  the original Remix entrance depends on custom routines. This preserves
  spawn position and restores the ordinary gameplay camera after countdown.

`build/marth/assets/extraction.json` records source offsets, file hashes,
motion descriptors, translated attack words and intentionally omitted events.
Generated ROM assets stay in the gitignored build directory. The ROM is read
without modification. Only the extraction/integration tools are source files.

## Verification

```sh
python3 remix/verify_assets.py
PLAYWRIGHT_MODULE=/path/to/playwright CHROMIUM_PATH=/path/to/chromium \
  node remix/smoke.cjs
```

The asset check verifies checksums, archive integrity, dependency targets and
relocation-chain bounds. The browser check boots the actual Wasm game and uses
the keyboard bridge to check model identity, animation, movement and active
attack hitboxes. Browser requests are restricted to localhost. Screenshots,
native logs and sampled fighter states are written to
`build/marth/verification/`.

The completed local checks passed for all 167 asset checksums, 4,977 bounded
relocations and 14 terminated attack scripts. The browser run captured 1,029
frames, confirmed the imported model, movement, animations and active hitboxes,
and inflicted 2% damage on the stationary practice opponent without runtime
errors. This is a smoke test, not exhaustive moveset validation.
