# Frozen native source provenance

The adopted native candidate is `f2654986e14088f5`, Wasm SHA256
`923e92de4588a7e07a69dbf0629eeacf476b330bfabf271b436cd0fcbe2e6440`.
The supplement manifest records 67 reviewed preparation/generated source inputs.
The candidate's 290 file hashes and the supplement's 67 hashes were verified
before adoption. The prepared base script and three patches already match this
checkout; candidate browser frontend files were deliberately not copied.

`reproduction.json` records the pinned upstream commits and recipe comparison.
The two `.diff` files record differences between clean recipe output and the
frozen generated sources: an additional Peach float check and twelve blank lines.
They document the exact native build inputs; the unchanged binary was adopted
without claiming a byte-identical rebuild. Apply them only to a separate prepared
engine checkout if reproducing those exact generated sources.

Generated engine/ROM assets remain build artifacts and are not included here.
The active shared engine checkout must not be overwritten during reproduction.
