# Browser N64 controller disconnect audit and correction

Scope: Original and Remix browser/Wasm input consumers. This source correction is not a
published engine update. No browser, game build, USB access or runtime mutation was used
for this audit. The current accepted publisher artifacts were left untouched.

## Confirmed affected artifacts

| Artifact | Engine SHA256 | Evidence |
| --- | --- | --- |
| Original 1.6, `build/competitive-original-gamepad-ports-v1` in publisher worktree 6e4e; source d35cd3c, upload e8858c50348643b4be93cd3adc8c432e | `13bb168874cef631c1645e6b458cd349a039e78c9f74ee48af62702e4ca16cbe` | Named Wasm functions and exact emitted JS inspected |
| Remix 2.5, `build/competitive-remix-conker-v4`; upload 83a161be757b48a8886840a1a6c36954 | `f15ccb0f63fdc02e8113239a273449a159a05a2049ac8c1606ec60b26a107c6e` | Exact stripped Wasm function bodies and emitted JS inspected; pinned f265/Conker source provenance |

Original 1.6 retains its 1.5 engine; the ordinary multiport frontend change did not introduce
the engine cache behavior. Earlier releases sharing that engine contain it too. Original 1.6
adds a normal local-gamepad route that can reach the per-port problem. Remix 2.5's frontend
still uses the earlier ordinary single-port path; its raw adapter path can reach both cases.

Pinned source: BattleShip `3ba1814ec34c376b1d1904b4dda2ef503ee90701`, decomp
`eddd0c9ba8ce0b9e80a225929ce466adc2e999fe`. Remix's
`remix/provenance/f2654986e14088f5/reproduction.json` records those same bases and its two
decomp reconstruction differences concern fighter code, not controller.c. The Conker
adoption changes its special-move object only. Dirty shared source was not substituted
for the frozen engine when confirming the issue.

## Actual path and compiled corroboration

1. `yougame/src/input.mjs::readPorts` keeps ordinary local port 1 present as a keyboard/touch
   pad even without a gamepad. Local gamepads at indices 1–3 become null when disconnected.
   Raw adapter ownership instead preserves its four physical ports, returning null for each
   disconnected/stale/suspended port. All four can be null. Online duel pads and result/setup
   routes normally supply at least two present pads.
2. `yougame/src/app.mjs::readPorts` writes a null row as kind 1 with zero buttons and axes.
   `yougame/src/engine.html` forwards it to `Module.readPorts(ptr)`.
3. BattleShip `port/web_input.cpp::port_input_apply_pads` treats kind 1 as an engaged shell,
   clears OSContPad, writes err 8 and sets sConnected[i]=0. It does not force port 1 present.
   `port/stubs/n64_stubs.c::osContGetQuery` also returns err 8 from that connected state.
4. Decomp `src/sys/controller.c::syControllerReadDeviceData` (baseline lines 214–245)
   skips cached buttons/axes/edges/repeat updates on any nonzero errno. The global publisher
   (baseline lines 258–319) also skips those slots. The old gSYControllerDevices input survives
   despite neutral bytes at the JS/native boundary. This is reachable for an ordinary P2–P4
   held sample followed by disconnect, even with P1 still present.
5. Baseline line 326 indexes gSYControllerDevices[gSYControllerDeviceStatuses[0]]. When
   all four slots disconnect, UpdateDeviceIndexes fills the statuses with -1, so this reads
   before the controller array. The ordinary P1-present route prevents this specific case;
   the raw-owned all-null route does not. Do not conflate this with a Wasm memory trap: the
   invalid C array index can still address mapped linear memory and read unrelated data.
6. Baseline line 274 calls AnalogRemap after platform overlay. With its saved per-player
   enable setting, it reads SDL's stick again and can replace authoritative browser axes.
   The default is disabled; this finding depends on that setting. SDL quarantine does not
   make resampling correct: reading zero or unrelated SDL input can still replace shell axes.

Exact Original Wasm disassembly: syControllerUpdateGlobalData is function 2205, body file
range starting 0x1c7596, length 1906. At 0x1c7c4e a signed byte load of the first status is
multiplied by 10 and added to controller base 4667408, without a zero-count guard. The
preceding memory.fill creates the -1 sentinel. syControllerReadDeviceData is function 2801,
body 0x266935, length 6169; it contains the shell overlay and err-8 skip branches. Emitted
JS EM_ASM key 960392 calls Module.readPorts. AnalogRemap is function 1896.

Exact Remix Wasm retains the same code structure with relocated addresses, despite stripped
names: function 2242 body 0x1ce823, length 1906; at 0x1ceedb the signed status load is multiplied
by 10 and added to controller base 5069984 without a zero guard. Function 2865 body 0x26fc6b,
length 6186 calls EM_ASM key 1300433 at 0x270397; that exact emitted JS entry calls Module.readPorts.
AnalogRemap is function 1924, body 0x15d39b, length 1699. Functions were located by bounded
binary-section/body comparison and corroborated by targeted llvm-objdump disassembly; the
engine was not instantiated. Instruction addresses are from llvm-objdump, body addresses
from file code-section parsing.

## Minimal durable correction

- `controller-neutrality-decomp.patch` is byte-identical to the shared native owner's
  agreed decomp patch (SHA256 `cf8098a2921e1cccfcb83a531c4c83bb57d2fa9fbfe324032e62bbef2451f0f0`).
  Under PORT, every errored slot clears descriptor buttons, accumulated tap/release/repeat
  bits, axes and published device controls; repeat timer resets to its existing initial
  delay. Error/status fields, repeat settings and physical port identity remain intact.
  Clear on read and on global publication, covering a query between those operations.
- Guard zero connected controllers before selecting the main controller; publish a neutral
  main pad and clear the pending-update flag. No made-up connected controller is inserted.
- Shared API `port_input_platform_owned()` guards only the later AnalogRemap resample.
  Browser returns its last sEngaged value; native owner returns its latched raw ownership;
  unengaged/non-platform input retains the ordinary enhancement and saved settings.
  Decomp uses no native-helper-specific or browser-specific conditional beyond PORT.
- `controller-neutrality-battleship.patch` adds the browser API definition/declaration.
  Native owner must preserve its own native implementation when combining the web_input.cpp
  hunk; do not apply a second definition. The shared decomp patch should be applied once.
- `yougame/prepare-engine.mjs` adds these two patches after its existing patches. Both apply
  cleanly against their pinned source files and pass reverse checks. No existing release
  ref, native game build flags, gameplay logic, assets or input protocol was changed.

A frontend-only workaround that marks disconnected controllers present-neutral would make
cache updates run, but changes physical connection semantics and introduces phantom local
ports. It is not the proposed durable correction. Keep the existing null/kind-1 contract.

## Regression and remaining acceptance

Run this lightweight test against an available pinned BattleShip source/header checkout:

```sh
python3 yougame/tests/controller-neutrality.py --engine-source /path/to/BattleShip --check-baseline
```

The runner reads the exact eddd0c9 controller.c from Git into a temporary directory, applies
only the reviewed patch there, and compiles the real read/global/index functions with OS,
platform I/O and enhancement doubles. It does not rewrite a behavioral model of those
functions. Shared sources and build outputs remain untouched.

Observed: the unpatched baseline fails the held-disconnect neutral assertion for P2. The
corrected source passes under ASan/UBSan: consumed held samples then err8 on P2/P3/P4 with P1
present, buttons/sticks/edge/repeat-cache clearing, repeat-setting/error retention, first
reconnect tap with no old release, query-before-publication errors, all-four-empty input,
P4-only reconnect and safe main selection, owned remap bypass and ordinary remap restoration,
and unowned ordinary SDL error clearing. No sanitizer findings on the corrected run.

This is actual C-function regression evidence, not full Wasm/browser/hardware acceptance.
Next owner steps, after source review and a resource lease: rebuild isolated Original and
Remix engines from pinned reconstruction while preserving current game/frontend patches,
stage only reviewed engine changes, then run real hosted/native-state held→disconnect
regressions. Read final gSYControllerDevices/descriptors, not just the bridge buffer. Cover
ordinary P2–P4, raw all-null, reconnect, saved remap enabled, menus and gameplay, and verify
rollback/checkpoint determinism before publication. Native-owner review/code reuse does
not substitute for those browser-engine checks. Do not advertise physical WUP support
from this test; helper packaging, OS access and physical acceptance are separate work.
