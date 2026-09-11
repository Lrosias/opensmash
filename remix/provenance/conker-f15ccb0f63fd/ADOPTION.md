# Source adoption record

This directory preserves a source-only subset of the reviewed frozen candidate
`build/remix/candidates/conker-f15ccb0f63fd` from the native owner workspace.
README.md and manifest.json describe that full immutable candidate; the engine
and large runtime evidence are intentionally not duplicated in this source tree.
The adopted implementation and offline verifier live in `remix/`.

The tests retain the original isolated-build recipe and regression runners.
They require the existing f265 native build objects and the native owner
reproduction server/fixture at port4207, as recorded in the candidate README.
They are provenance runners, not a self-contained clean-build test command.
Current app/native presentation tests are under `yougame/tests/`.

Manifest SHA256: 3fa66b4ff978629ea5ccba43288474ac8ed4a396370eb42ba86f2752cc61b890.
Root verified all81 frozen files/sizes and independently confirmed that only
BattleShip.wasm changed among engine files. Independent review approved the
source, pinned-ROM mapping, negative validator cases and native regression
evidence before adoption. No clean full-source native rebuild is claimed.
