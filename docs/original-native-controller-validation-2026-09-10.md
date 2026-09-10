# Original64 native controller correction: staged, not published

The reviewed source correction is `13b2f87daca610c8dda4979b56c24a2ab8fcf3dc`.
Its candidate release branch is `codex/competitive-controller-release-20260910`.
The separately pending source-export branch remains frozen at
`1bc0cd1d5454caa81005f28d5e43c9a458325cb2`.

## Qualified engine and preserved release

Original1.6 remains live at upload `e8858c50348643b4be93cd3adc8c432e`.
The candidate stage is `build/competitive-original-native-neutrality-v1`,
compatibility identity `aa422ea5fca9cef0`. Of its 59 files, 56 are byte-identical
to the released Original1.6 stage. Only the corrected Wasm, its glue's Wasm cache
query, and the app compatibility identity change. All frontend/controller,
keyboard, game assets, competitive flow and presentation files are retained.
Static `check_build` returned ready; this is not runtime acceptance.

Candidate Wasm SHA256:
`b667a73454b132910d17cce2833c6cb4e9ce3131b025da3d5fc6fa7fd2053c8e`.
Packaged JS SHA256:
`197f4d81aef11801512ebe052867a816e936008afd64da054b69f9fec52bcd30`.
Complete stage content SHA256:
`7bb9534e7b7f4b4986c07b4c7925061a3e16c623c4ab499d18e4a7fb73b61e2c`.

The historical engine was found in the cbb7 performance worktree's
`BattleShip/build-rollback`, with 560 unique linker inputs (569 occurrences,
including repeated library references). An isolated baseline relink and an
unpatched two-translation-unit recompilation/relink each reproduced released
Wasm `13bb168874cef631c1645e6b458cd349a039e78c9f74ee48af62702e4ca16cbe`
and the historical packaged JS exactly. The correction replaces only
`controller.c.o` and `web_input.cpp.o`. This is a qualified surgical relink,
not a clean full-source rebuild. Original's `--profiling-funcs` is preserved.

Only `syControllerReadDeviceData` and `syControllerUpdateGlobalData` function
bodies differ in final Wasm; the other 7,405 bodies and the data/global/ABI
sections are unchanged. The browser ownership getter was optimized into the
changed controller path. The source fixture separately reproduces stale held
input on baseline C and passes under ASan/UBSan with the correction.

## Runtime results and blocking investigation

Final unmodified Wasm, explicitly simulated device reports, shipped input
mapping, and actual native controller descriptors/globals were exercised:

- P2, P3 and P4 each consume held A plus nonzero axes, clear cached controls on
  disconnect while preserving physical port holes, and reconnect with a new tap.
- An owned raw adapter consumes held input, then all four null ports produce
  zero connected controllers, neutral devices/main, and all status indexes -1.
- P4 alone reconnects in its original seat with a new tap; ordinary input
  resumes after ownership release.

These pass. They do not constitute physical-controller acceptance. The initial
failure and all passing controller observations are preserved at
`/tmp/opensmash-original-native-neutrality-evidence/verification.json`.

A stricter rollback check failed equality of captured checkpoint bytes, despite
exact replay of native gameplay diagnostics and complete controller-cache
traces. Publication stopped at this first substantive failure.

A scoped paired comparison used the identical seed12345, fighters0/1, stage6,
and 24-frame held → all-null → reconnect schedule on released13bb and corrected
b667. Both independent instances in both versions replay their diagnostics and
controller traces exactly; the two instances' traces agree within each version.
Both versions fail equality of all 34,385,920 bytes included by the shipped
checkpoint implementation at the terminal boundary:

| Version | Instance 0 differing words | Instance 1 differing words |
|---|---:|---:|
| Released13bb | 157 | 166 |
| Correctedb667 | 167 | 160 |

These are retained baseline nonrepeatability and an unresolved state-contract
investigation, not evidence of full rollback acceptance. No differences were
normalized, masked, or added to the exclusion list.

All included initial/terminal/replay pages, offset maps, hashes, every differing
word, input traces, and fixture hashes are frozen under
`/tmp/opensmash-original-neutrality-replay-frozen-{baseline,corrected}` and
summarized in `/tmp/opensmash-neutrality-paired-analysis/summary.json`.

Exact stack and scene exclusion bounds were recovered from each saved native
checkpoint, without a rerun. Their static output buffers are at7754896 and
7469732 respectively, established by the final unchanged export disassembly.
Every terminal/replay pair has identical stack bounds (42 entries/21 pairs),
identical scene bounds, and currentCoroutine0. Exactly13 differing words per
instance lie wholly within declared unused ranges on partially retained pages.
This membership is recorded separately; source/liveness interpretation remains
subject to review. Confirmed host-timing/profiling fields and main Asyncify stack
residue account for other subsets; dynamic heap-field classification remains
incomplete. No blanket harmlessness conclusion is made.

Both frozen comparison browsers and temporary servers are closed. The heavy
resource lease was released. Saved AnalogRemap behavior, authored-app/hosted
smoke, final runtime approval and publication remain pending. The release
candidate must not be described as shipped or as full-state rollback verified.
