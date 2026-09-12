# Progressive Remix netplay slowdown — September 12, 2026

User reported PC Remix vs another PC, smooth initially and then unplayable.
The latest production net telemetry was queried directly using the repository's
`web/scripts/netlog.mjs` from YouGame main `210c277c`, for the preceding 30 minutes.
Raw user telemetry remains local in `/tmp/netplay-latest-20260912.json`.

## Current session evidence

| UTC / device | Frame | Step average | Checkpoint average | Restore average | State |
| --- | --- | --- | --- | --- | --- |
| 19:48:55 / PC A | 126 | 2.1 ms | 7.0 ms | none | 60 steps in reporting window |
| 19:49:17 / PC A | 1273 | 2.5 ms | 140.5 ms | none | overloaded, cadence 3, 21 steps |
| 19:49:21 / PC B | 1292 | 1.8 ms | 110.9 ms | 214.2 ms | overloaded/stalled |
| 19:49:44 / PC A | 1708 | 2.9 ms | 148.3 ms | none | overloaded, cadence 3, 21 steps |

PC A had zero rollback replays throughout these reports: the save-time explosion
already occurs without prediction corrections. Both user agents are Windows
Chrome. Hidden-page timer throttling and a pre-match freeze were also logged;
those are not counted as active-match evidence here. Telemetry does not record
heap size, so it establishes the checkpoint bottleneck but cannot alone prove
which allocation triggered it on the user's machine.

The public Remix page still selected 2.19, upload
`c050d8a5be6d46cd977631c3973b4765`. Its marked checkpoint module contains the
exact package bytes at
`/Volumes/OpenSmashBuilds/publisher/build/cheap-checkpoints-20260912-r1/remix`.
Current release fork source is `4b220922`. Its checkpoint source is missing the
already-deployed `reset()` method; this change preserves that deployed method.
Other source/runtime divergence is outside scope: do not rebuild all frontend
files from this checkout.

## Two reproduced defects and fixes

1. Mirror replacements amplify heap high-water growth. `used()` reports the
   sbrk high-water mark, including old freed mirror blocks. A replacement only
   subtracts the current mirror, counts the previous mirror's freed address
   space as game memory, and allocates a larger replacement on the next save.
   The fixed mirror is allocated once; later uncovered pages use the existing
   exact SIMD scratch comparison. No bytes are omitted or hashed approximately.

   Fixed-heap allocator reproduction: a 40 MiB initial heap plus its mirror was
   88.08 MiB. One 16 MiB game allocation followed by six `ensure()` calls grew
   the old implementation to 168.13, 280.22, 456.36, 744.59, 1208.97, then
   1961.58 MiB. No intervening game allocations occurred.

2. Mirror eligibility scans repeat a full unchanged suffix after every changed
   page. Busy frames consequently perform O(pages × changed pages) JavaScript
   checks. Cache each eligible run's end for the duration of the save; writing
   a changed page only updates that page and cannot invalidate the remaining
   run. A 40 MiB / 2560 dirty-page fixture drops from 3,278,082 eligibility
   checks to 5,121. On this Mac its saves dropped from 47.9–57.9 ms to 4.1–6.1 ms.

## Released-engine validation

Headless Chrome 152.0.7977.83, one engine at a time, visible page state, muted,
Mario/Kirby Dream Land, no live users/network. Before/after use the exact same
released Remix Wasm and assets; after overlays only the two authored modules.

- Normal battle: before save mean 1.50 ms, after linear-scan patch 1.34 ms;
  exact eight-frame diagnostic replay passed. This light case does not reproduce
  the user's collapse, and must not be advertised as doing so.
- Controlled growth in the actual native allocator: after 60 frames, allocate
  32 MiB once. Both variants grow from 144,449,536 to 178,003,968 bytes.
  The baseline next save allocates another mirror and reaches 287,989,760 bytes,
  tripping the 256 MiB test stop. The fixed variant stays at 178,003,968 bytes
  through all remaining frames, generation 1, mean save 2.18 ms, p95 2.79 ms,
  max 6.11 ms, exact replay passed. This is a controlled allocation, not a claim
  to have reproduced the user's exact fighter/scene sequence.

Tests cover fixed-mirror allocation bounds after game growth, bit-exact snapshots
against the reference across growth/exclusions/rewind, bounded scan operations,
all-byte Wasm equality, fallback and memory growth, and the released timeline
reset. Repro scripts: `yougame/tests/checkpoint-scaling.mjs` and
`yougame/tests/checkpoint-engine-performance.mjs` (set `PERF_FORCE_GROWTH=1`).
Detailed safe summaries: `docs/netplay-progressive-measurements-20260912.json`.

## Release

Runtime overlay ONLY `yougame/src/checkpoints.mjs` → `checkpoints.mjs` and
`yougame/src/page-compare.mjs` → `page-compare.mjs` on current Original/Remix
packages. Native Wasm, comparator Wasm, engine loader, SDK, controls, roster,
results and page layout need no changes. Preserve other owners' newer runtime
files and normal release fingerprint procedure. The deployed checkpoint base
hash is `989eadda6ab869600c703a242300c2b51a33345c0a942f79246500c44eed6de2`;
comparator base hash is
`097e455332f25d034f379bd6f83fc34d92b6784a4a09ea34425f13551e54a390`.

Board-controlled release operator publishes promptly; users must reload both
clients to discard the already-inflated heap. Postrelease: repeat the same PC
Remix match for several minutes and inspect checkpoint cost after entering
battle. A fixed mirror can use the slower scratch path on later large heaps,
but no longer increases that heap by replacing itself. Physical-user resolution
remains pending the live retest.
