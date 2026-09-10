# Reviewed Melee rollback source handoff

This additive handoff is based on competitive release commit `cb0cdff`. It
contains only the coordinator's completed rollback modules, tests and research.
It is not a standalone Melee build: the release owner is assembling the untracked
Melee frontend/native baseline, live1.6 performance work and competitive UI.
Do not overwrite that newer work with the shared checkout's older full files.

**Rollback.cpp is intentionally excluded.** The competitive native agent was
actively extending that shared file during handoff preparation (match startup,
result extraction and a larger capacity), so a copied whole file would be an
older mixed-owner snapshot. The competitive owner retains and commits their
authoritative newest Rollback.cpp, preserving the previously reviewed SDK
managed ownership behavior. The capacity of twelve in baseline evidence/docs
describes the original tested engine; reconcile capacity and extended result
fields in the final competitive release docs after that candidate is tested.

`melee-rollback-handoff-sha256.json` identifies every copied file. The original
shared directory remains untouched at `/Users/luis/Documents/ChatGPT/OpenSmash`.
Eight unit tests pass in this isolated handoff. Native evidence is under the
shared ignored `build/melee-web/test-results/rollback-sdk-acceptance/`; the
YouGame SDK agent independently reviewed source, ownership, tests and evidence.
That prior review covers the original SDK-native boundary; it does not approve
the competitive native agent's ongoing startup/result additions.

Required baseline integration already implemented in the shared checkout:

- `main.cpp`: `rollback` selects deterministic single-core CPU/GPU, synchronous
  DSP and emulated RTC. `rollback-boot` enables the gate before execution begins.
  Preserve the newer raw GameCube axis mapping and performance configuration.
- CMake compiles `Rollback.cpp` into core, includes `MeleeRollback.h`, exports
  `_melee_rb_enable` and `_melee_rb_command`, and forwards `onMeleeRollback`.
- `browser.patch`: State exposes CPU-thread single-core canonical capture/load;
  VI marks end of field; static recomp services the marker after the outer
  timing advance; determinism/RTC use emulated time; WebGL staging supports
  framebuffer readback; replay suppresses outgoing audio samples.
- `WebSound.h` locks `melee_rb_audio_mutex` around mixer work; `GLContextWeb.h`
  suppresses presentation during replay. Preserve these when merging the
  performance agent's versions.
- `app.mjs` routes `onMeleeRollback` into the driver, stops unscheduled input
  writes while the gate is active, and arms `waitForBoot()` before callMain for
  `?rollback=boot`. The optional local lab is independent of room matchmaking.

Use `createMeleeSync` as the shared SDK adapter. The competitive owner may extend
its confirmed output with actual native match results, preserving input/frame
validation, managed token lifetime and fatal teardown requirements. Integrate
the platform controller facade at the input boundary. Test the final combined
engine again; previously tested hashes do not certify a newly combined build.

Reviewed evidence and remaining release limitations are documented in
`melee/YOUGAME-ROLLBACK-CONTRACT.md`. Research source files contain source URLs
and hashes, not proprietary game inputs. No savestates, ROMs, screenshots,
generated Wasm or creator credentials are included in this source handoff.
