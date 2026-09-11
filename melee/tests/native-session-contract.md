# Native Melee menu session qualification

`createNativeSession({slots:[0,2]}, onStatus, signal)` boots normal VS menus with
controllers on P1/P3. Port order is never compacted. It loads menu assets first;
existing native scene asset gates load actual fighter/stage choices. The normal
native controls own character selection, rules, stage selection, Start, results,
and rematches. Keep the returned engine alive while the roster stays unchanged.
A changed roster requires a fresh agreed boot in this first slice.

The initial response is the earliest controlled VI boundary, not a ready CSS.
Advance with four complete GameCube samples, neutral samples for holes, using
confirmed input only. Fixed RTC and single-core emulated timing apply from boot.
The session adapter rejects checkpoint save/load and replay; those APIs continue
to work in the existing configured-match mode. General SDK defaults are unchanged.

Every response includes the existing frame/RAM checksum and `nativeSession`:

- `seatMask`: immutable connected controller ports.
- `phase`: last native function entry: 0 boot, 1 CSS, 2 stage select, 3 VS,
  4 VS exit, 5 sudden death. An entry does not guarantee a rendered frame.
- `battleId`: increments at normal VS entry, remains the same for sudden death.
- `battleMask`: native participants at VS entry, which can include native CPUs.
- `stage`: native stage at VS entry, otherwise -1 until the first VS entry.

Phase 4 is not an authoritative result. The native game may enter sudden death.
Native normal menus permit rules and CPUs beyond the old configured competitive
match. Therefore this path deliberately returns `result:null`; qualification of
native final placements and supported platform scoring is separate. The host
lifecycle fields are diagnostics outside emulated serialized state.

Relevant GALE01r2 function addresses are version checked in `tools/lite.py`:
EnterCss 801A5618, EnterSss 801A5754, EnterVs 801A583C, ExitVs 801A5AF0,
EnterSuddenDeath 801A5C3C. Their names are in doldecomp/melee's GALE01 symbols.

Focused validation:

    node --test melee/tests/native-session.test.mjs melee/tests/rollback-engine.test.mjs

Build only a fresh external output:

    python3 melee/tests/build-native-session.py /Volumes/OpenSmashBuilds/publisher/build/NEW_NAME

The build must reproduce deployed Wasm SHA
`1e87a23d6d9b13da54fddfc864951123f3c52fac81bdf7aef00a432869d35592`
before compiling changed objects. It copies archives and generated sources,
uses a new link cache, and checks historical link-input hashes at completion.
It does not copy or change game assets. Runtime qualification remains required
for two-instance menus/random stage/battle/results/rematch, including P2/P4.
