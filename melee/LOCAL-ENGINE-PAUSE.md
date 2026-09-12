# Local engine suspension during online sessions

The local menu engine remains resident, but an online engine cannot boot until
the local engine acknowledges its native pause. `melee_local_pause` queues
`Core::SetState` on the runtime host worker. The pinned core waits for CPU
idleness and pauses FIFO processing and the sound stream. Browser callbacks
remain available while the CPU drains outstanding foreground asset reads.

The wrapper also suspends the local AudioContext, drains/aborts speculative
asset preparation, stops local input and metrics/cache polling, and discards
any final in-flight bitmaps while still acknowledging them. User gestures wake
only the online audio while the local engine is suspended. Leaving, failed
online startup, cancellation, and connection closure release the pause; local
frames and the existing prefetch preference resume. Overlapping session boots
share the pause until the final owner releases it. The native menu remains
active during matchmaking until a second engine actually needs to boot.

The loader's suspension does not cancel foreground reads: native pause could
otherwise deadlock while the CPU waits for one. An already running background
decompression is drained, and its cancellation is checked before Wasm allocation
and copying. Existing committed data and both engines' memory remain resident.

## Validation on Windows

- 36 Node tests pass across `local-engine-pause.test.mjs`,
  `asset-loader.test.mjs`, `native-room-session.test.mjs`, and
  `native-session.test.mjs`, with `YOUGAME_SDK_PATH` pointing to the local
  YouGame SDK.
- `native-room-app-browser.mjs` passes seven installed-Chrome scenarios:
  casual, friends, invite during boot, matchmaking cancellation, ranked exit,
  native boot failure, and connection closure. It executes the real wrapper,
  asset loader, iframe bridge, AudioContext and SDK input, with simulated
  native engines and transport. Local fixture frames stop online, audio stays
  suspended after keyboard input, and frames resume on exit.
- Native pause behavior was checked against the pinned core implementation:
  `Core::SetState`, `CPUManager::SetStepping`, `RunAdjacentSystems`, and
  `FifoManager::EmulatorState`. This is source inspection, not a compiled test.

## Release gate still outstanding

This is **not a wrapper-only update**. Rebuild the engine with
`melee/tools/build.py` in a prepared Melee browser build environment, then package
the updated engine and wrapper together. The Windows source checkout used for
this change has no Emscripten toolchain or generated Melee browser build inputs;
the new Wasm binary has not been compiled or published.

Before release, run the real local/online engines and verify native presents,
simulation, audio production, and speculative asset work stop while online is
active and resume on return. Test cancellation during pause and boot, connection
failure, sparse controller ports, and several leave/rejoin cycles. Compare an
actual online combat scene before/after on the target i7-8700 / RTX 2080 / 32 GB
PC. No FPS gain or sustained 60 FPS result has been established by fixture tests.
