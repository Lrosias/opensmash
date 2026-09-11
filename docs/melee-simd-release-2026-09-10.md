# Melee snapshot comparison update — September 10, 2026

This update is being prepared against published Melee v1.8, upload
`022831141b974553aa0c6889c4bcb0d8`. The isolated clean native build is now
published as **v1.9**, upload `dbc5cb1cb189448e9699aa3d4fc212c8`, after native
and exact hosted acceptance passed.
Melee retains input delay 3 and `maxRollback=0`.

The native change replaces snapshot-page `memcmp` with a WebAssembly SIMD
equality check. It compares complete 64-byte groups and then a scalar tail,
without reading beyond the requested page length. It changes neither state
serialization nor page ownership, checksums, restore behavior or history size.
There is no CRC experiment or profiling instrumentation in this change.

The independently reviewed patch SHA256 is
`ed978403939f93df732a78dc9c68dc7a3743865dfb52e9f7352d5c6c334414dd`.
The resulting `Rollback.cpp` SHA256 is
`39eacb4f23d6151c5d36c1c14e2096dc3894332611e93a6b359e6af13231626a`.
Root and isolated build sources match exactly.

The clean build is prepared under `build/melee-simd-only-20260910/source`.
Its runtime and generated C match the released ec79 engine inputs; only stale,
noncompiled runtime convenience copies of main.cpp/Rollback.cpp were refreshed.
Current combined browser patches preserve prior CPU and graphics behavior.
The source provenance record includes pinned upstream revisions and their
existing native-port modifications rather than claiming pristine upstream trees.
Its toolchain is read-only, with a private Emscripten cache and fresh CMake/Ninja
and ThinLTO outputs. The full plan and hashes are in the adjacent README and
provenance.json.

The clean build exited successfully and produced matching native outputs:

- `melee.wasm`: 138,043,965 bytes, SHA256
  `d4086b169259605dfd9e1da4c5d28e8870c62e51fdff295d0bce6c1751628c3d`.
- `melee.js`: 358,660 bytes, SHA256
  `b287f47e83da5c487e15a1af5eeb8100e1680ade4e62c8309f97377e8f59f74e`.

All isolated engine source files match the adopted source at `8436708`.
The build emitted Emscripten warnings about custom incoming module
callbacks and pthread memory growth; runtime validation remains required.
The 32 Melee integration/unit tests pass with no skips against the current SDK.
The final Wasm import section is byte-identical to the released ec79 engine,
and all 116 export names and kinds match (`abi-check.json`).

Every current Melee frontend file matches the frozen live v1.8 distribution
after the existing controller import-path transform. The shared adapter consumer
followup is separately reviewed. Final staging uses matching freshly built
native JS/Wasm and the current frontend/assets.

The immutable `build/competitive-melee-simd-v1` stage is ready and passes static
checks. It preserves all 1,240 baseline paths; 1,235 files are byte-identical.
Only the two reviewed controller modules, matching native JS/compressed Wasm,
and Wasm manifest change. The compressed engine is 20,439,268 bytes. All 145
combined game unit tests pass against deployed SDK SHA256
`ac8fac80456c57d358feb11fd72f9ad3727ec6f614272604c651a7c716fe8b8c`.
Upload `dbc5cb1cb189448e9699aa3d4fc212c8` is complete and statically ready;
all 1,240 staged hashes remain unchanged after upload.

Both native gameplay gates pass on the frozen candidate. Independent boots
match across 240 gameplay checksums and seven-frame restore/replay. Natural
four-stock elimination reaches the correct winner with stocks `[0,4]` at frame
1031. The actual SDK async controller and production adapters complete a full
native best-of-three set through stage and character counterpicks, with identical
final state and exactly one 2–0 finish report per peer. The direct native harness
records only two missing-favicon console messages; there are no native/runtime/
WebGL errors, and the SDK set records no errors.

The bounded 16-save observation also passes, with all checkpoint handles released
and no errors. Warm native capture median is 7.610 ms, mean 8.166 ms and maximum
17.700 ms; end-to-end RPC median is 12.375 ms, mean 12.982 ms and maximum
22.570 ms. Serialized states span 88,833,524–88,833,529 bytes; the cold first
snapshot takes 19.115 ms. This small candidate-only sample has no matched
baseline and does not establish a speedup or a sustained 60 Hz budget. Prediction
remains disabled. All browsers and the frozen server are closed. Consolidated
evidence: `build/melee-simd-only-20260910/acceptance/verification.json`.
Exact hosted acceptance also passes. Two disposable desktop identities used
real Friends/Ready controls with a nondefault Marth recipient, natural stock
losses and agreed results. Cold native startup took 21.569 seconds; exactly one
Continue per player produced a fresh idle four-stock round in 14.337 seconds,
with held input cleared and fresh movement/attacks working. Full Continue
targets clear host controls in embedded and fullscreen layouts. SDK Leave and
authored Leave set restore the local title/controller entry. The same pages
then enter public Casual with reversed player order and normal Ready; native
startup takes 15.536 seconds and controls work. No page or native errors occur.

Official session `1847c0040858494fbcabc1951bdea31d` and all owned browsers are
closed. The scoped optional-case aggregate remains incomplete because unrelated
ranked/rating, hardware and audio cases were not repeated; earlier full UX/rating
evidence and the new native set gate remain supporting evidence. Melee remains
desktop-only. Report: `/tmp/opensmash-melee19-hosted-acceptance.md`; screenshots
and traces: `/tmp/opensmash-melee19-hosted-evidence`.

The platform's static feature detector reports only `sdk` for the live v1.8
build because it recognizes literal `YouGame.multiplayer` but not Melee's
injected `this.sdk.multiplayer.open` reference. Public player props explicitly
enable multiplayer, and both score-board flags remain false. This detector
limitation is separate from runtime online behavior; this release does not add
an unnecessary source reference to influence scanning. Postpublication checks
must preserve the existing enabled online mode and board settings.

Prior isolated review found exact comparisons and lower snapshot-save cost,
but the measured combined work still exceeded a 60 Hz frame budget. Those
prototype results do not establish final-build performance or justify enabling
prediction. Native startup, independent checksums, seven-frame restore/replay,
real four-stock elimination, SDK integration and exact hosted acceptance pass
as scoped above. Native browser harnesses run muted.

Publication returned v1.9 as a minor update with zero notifications. Public
verification passes for 12 selected frontend/controller/native files, including
the matching JS and decoded Wasm length/SHA from the manifest. The public entry
uses the reviewed upload, both score-board flags remain false, and public player
props still enable multiplayer. Evidence:
`build/competitive-melee-simd-v1-live.json`. Git source exports and merges remain
a separate approval dependency.
