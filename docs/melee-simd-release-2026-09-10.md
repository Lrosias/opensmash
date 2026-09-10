# Melee snapshot comparison update — September 10, 2026

This update is being prepared against published Melee v1.8, upload
`022831141b974553aa0c6889c4bcb0d8`. No replacement native build has been
compiled or published yet. Melee retains input delay 3 and `maxRollback=0`.

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

Every current Melee frontend file matches the frozen live v1.8 distribution
after the existing controller import-path transform. The shared adapter consumer
followup is separately reviewed. Final staging will use matching freshly built
native JS/Wasm and the current frontend/assets.

Prior isolated review found exact comparisons and lower snapshot-save cost,
but the measured combined work still exceeded a 60 Hz frame budget. Those
prototype results do not establish final-build performance or justify enabling
prediction. Native startup, independent checksums, seven-frame restore/replay,
real four-stock elimination, SDK integration and exact hosted acceptance remain
required for the clean release build. Native browser harnesses run muted.
