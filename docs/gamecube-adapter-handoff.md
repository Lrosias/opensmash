# GameCube adapters: OpenSmash implementation and YouGame handoff

> **WUP-028 correction, 2026-09-10:** The official adapter has a class `0x03` HID interface, not the vendor-specific interface used in our simulated WebUSB tests. Chromium protects HID interfaces from WebUSB even after its chooser says Paired. USB permission delegation alone cannot enable the official adapter. Use the native YouGame transport; see [the diagnosis and UX contract](gamecube-wup028-correction.md). Earlier browser-test results below demonstrate protocol/game integration with a simulated vendor-specific transport, not official WUP-028 browser compatibility.

**For the YouGame implementation agent: the game-side implementation is done and staged locally for OpenSmash64, OpenSmash64 Remix and OpenSmash Melee. YouGame must provide/verify USB access in the hosted player, or implement the host-owned transport below. Do not feed raw GameCube input through the existing standard-gamepad mapper.**

Prepared 2026-09-10 UTC. No production listing was updated. No physical adapter was attached in the inspected USB inventory. Slippi Launcher is installed on this Mac; reference behavior was checked against pinned Slippi source, not inferred from its UI. This is direct browser USB support, with a tested simulated transport. It is **not a claim of measured Slippi-equivalent latency, physical adapter compatibility, or native OS driver support**.

## 1. What is implemented

| Component | Source | Behavior |
|---|---|---|
| Shared transport and decoder | `controllers/gc-adapter.mjs` | WebUSB chooser, descriptor discovery, initialization, continuous interrupt reads, atomic four-port snapshots, disconnect/reconnect, stale-input neutralization, explicit calibration |
| Controls dialog | `controllers/gc-adapter-ui.mjs` | Connect, regular-controls fallback, port diagnostics, per-port calibration, reset; notices for unsupported browser or blocked USB policy |
| Smash 64 + Remix | `yougame/src/input.mjs`, `yougame/src/app.mjs` | Physical ports map to local seats 1–4; online local input uses physical port 1; mapped once into the existing N64 input timeline |
| Melee | `melee/src/app.mjs` | Raw adapter values take precedence over SDK seats; both local play and the development rollback lab use this path |
| Melee native conversion | `melee/engine/main.cpp` | Preserve raw stick byte zero through the existing Dolphin Touch input override by allowing -128/127 at the float boundary |
| Build integration | `yougame/build.mjs`, `melee/tools/build.py`, `tools/stage-gamecube.mjs` | Include the shared modules and rewrite their source-relative imports when staging |
| Tests | `yougame/tests/gc-adapter.test.mjs`, `yougame/tests/gc-adapter-browser.mjs` | Protocol/lifecycle/mapping tests and actual Chrome + Wasm boundary checks using a simulated USB device |

One Nintendo-protocol adapter with four ports is supported. The allowlist is USB VID `0x057e`, PID `0x0337`, and a vendor-specific interface with interrupt IN/OUT endpoints. Compatible adapters must expose this protocol in Wii U/Switch mode. This does not cover every product sold as a GameCube adapter, PC-mode HID mappings, arbitrary vendor IDs, or a second adapter. No device firmware, system driver, Slippi setting, or operating-system configuration was changed.

The adapter owns all four game seats after a successful connection, including empty ports. This deliberately prevents a physical controller being read a second time through the SDK/Gamepad API, and prevents unplugging port 1 from moving port 2 into its place. Keyboard/touch/ordinary gamepads return through **Use regular controls**. Ownership remains during unplug/read failure until an explicit release or successful reconnect. For this first implementation, mixed raw-adapter/keyboard seats and per-seat reassignment are not implemented.

Melee's existing emulated controller devices remain configured; an empty physical port receives neutral input. This change does not implement GameCube serial-bus device insertion/removal inside that runtime. N64's existing port bridge can mark empty ports disconnected.

## 2. Slippi reference and what transfers

Read [Slippi's pinned GCAdapter.cpp](https://github.com/project-slippi/dolphin/blob/41a7a3a110ed52999486ae1901c8fbb9a63d4f13/Source/Core/InputCommon/GCAdapter.cpp), particularly `ReadThreadFunc`, adapter setup, `ProcessInputPayload`, and `Input`. Revision: `41a7a3a110ed52999486ae1901c8fbb9a63d4f13`. The downloaded source SHA-256 is `84aad1be9db3e33fd3852f67610da2f949b928bf8f9d00f0b1bc0dd6d356a8ea`.

The useful architectural properties are separate device acquisition and game sampling, stable port identity, coherent snapshots, raw analog values, and explicit connection state. The browser implementation was written separately from the protocol facts; it does not embed Slippi's C++ code. The shared new JavaScript is covered by this repository's MIT license. Melee's existing Dolphin-derived dependencies retain their own licenses. If YouGame copies upstream Slippi/Dolphin code instead, retain and review that upstream source's license rather than assuming the new JavaScript's license applies to it.

Important differences remain. Slippi uses a native read thread, mutex-protected state and controller-origin handling. The current browser reader uses one asynchronous WebUSB read loop on the game document's main thread and explicit user calibration. It does not reproduce Slippi's first-input origin flag, native scheduling, polling-rate instrumentation, rumble, or platform driver management. Treat those as separate engineering work.

## 3. Wire protocol and conversion contract

The currently implemented setup is:

1. In the actual Connect button gesture, call `navigator.usb.requestDevice({filters:[{vendorId:0x057e,productId:0x0337}]})`.
2. Open the selected device. Select configuration 1 if none is selected.
3. Inspect descriptors; choose a vendor-specific interface (`interfaceClass === 255`) with interrupt IN and OUT endpoints. Require an IN packet size of at least 37. Claim the actual interface number and select its alternate setting when necessary. Endpoint numbers are discovered, not hardcoded.
4. Write the single byte `0x13` to the OUT endpoint; check status and byte count.
5. Maintain exactly one pending `transferIn(inEndpoint,37)`. Start the next transfer when the previous one resolves. Do not put acquisition behind `requestAnimationFrame` or an arbitrary polling timer.
6. Accept only successful, exactly 37-byte reports whose first byte is `0x21`. Invalid reports increment a diagnostic counter and do not refresh the last-valid timestamp.

For zero-based physical port `p`, its block starts at `1 + 9*p`:

| Block byte | Meaning |
|---|---|
| 0 | Status: bit 4 wired; otherwise bit 5 wireless; neither means absent. Wired takes precedence if both are set. Other bits alone do not indicate a connected controller. |
| 1 | Bits 0–7: A, B, X, Y, D-pad Left, Right, Down, Up |
| 2 | Bits 0–3: Start, Z, R digital click, L digital click |
| 3–6 | Main X, main Y, C X, C Y, each an unsigned byte; positive Y is up |
| 7–8 | L and R analog travel, independent unsigned bytes |

The shared decoded `buttons` field is `byte1 | ((byte2 & 15) << 8)`. It is a **wire-layout mask**, not Dolphin's `PAD_BUTTON_*` mask, the N64 mask, or the Melee Touch-control mask. Use the explicit converters rather than passing this mask into an engine directly. Raw axis and trigger arrays are frozen copies; snapshots do not alias the USB buffer.

### Melee

The existing native bridge takes `[buttons,x,y,cx,cy,l,r]`. Sticks use `(raw - origin)/127`; triggers use `max(0,raw-origin)/255`. Default origins are `[128,128,128,128,0,0]`. Native axis conversion maps back around byte 128. Its lower bound now permits `-128/127`, allowing raw zero to round-trip. All 256 values are exercised in the conversion tests. Dolphin's Touch override applies these values after ordinary stick deadzone/gate processing; analog trigger overrides are separate from digital trigger overrides. The code path was inspected in the local pinned runtime's `GCPadEmu.cpp`, `AnalogStick.cpp`, `MixedTriggers.cpp`, and `ControllerEmu.h`.

No smoothing, circular normalization, snapping, deadzone, button-edge latching, or trigger-click synthesis is applied to this raw path. A tiny stick deviation remains a tiny deviation. A full digital L click does not automatically replace the analog L measurement with 255. Likewise, analog trigger movement does not invent a digital click. These distinctions matter for movement and shielding.

### Smash 64 and Remix

These engines consume N64 input, so conversion is necessarily game-specific. A/B stay A/B; X/Y become C-up/jump; Z becomes N64 R/grab; either L/R click or calibrated trigger travel of at least 43 becomes N64 Z/shield. C-stick thresholds are ±40 units and map to their corresponding N64 C buttons. D-pad directions remain N64 D-pad bits. Main X/Y are independent raw offsets clamped to ±80; Y stays positive-up. There is no radial remapping. Start is stripped from online gameplay through the existing `allowStart` policy.

The N64 thresholds are explicit OpenSmash mapping choices, not assertions about Slippi's settings. Smash 64 has a digital shield, so it cannot express Melee light-shield travel.

### Calibration, freshness and lifecycle

Calibration is explicit: release sticks/triggers, then click that port's calibration button. It captures neutral offsets without altering stored raw reports. Reset returns to nominal centers. A controller disconnect/type change resets that port; closing/reopening the adapter resets all four. Calibration is session-local, not persisted by product name or shared across unidentified controllers.

Each valid report increments a sequence and receives a monotonic browser arrival timestamp. The timestamp is **not** a hardware sampling timestamp. All four ports publish together. A snapshot older than 250 ms is neutral; that threshold is configurable on `GameCubeAdapter` and is a recovery policy, not a latency target. A blocked browser thread cannot run a watchdog on time; the check occurs when sampling resumes.

Hidden documents, lost page focus, and the adapter dialog suppress game input; diagnostics can still inspect fresh raw reports while calibrating. A same-origin engine iframe receiving focus should remain active. Closing cancels outstanding reads; generation checks prevent results from an earlier connection, including a delayed chooser, from reviving it. A previously owned matching device reconnects through the USB connect event. The corrected fallback restores previously granted compatible devices through `getDevices()` on a new page and listens for granted-device hotplug without opening a chooser. Explicitly choosing regular controls disables automatic acquisition for that instance.

## 4. YouGame changes — minimum unblock

**The game cannot grant itself USB permission through `yougame.json`, CSS, the SDK's touch overlay, or its own nested iframe. Check and fix the outer YouGame player first.**

For direct game-owned WebUSB, authorize the precise game origin in the player's permission policy and delegate USB on the iframe. Illustrative configuration (replace the origin with the actual stable/versioned game origin):

```http
Permissions-Policy: usb=(self "https://GAME-ORIGIN.yougame.co")
```

```html
<iframe src="https://GAME-ORIGIN.yougame.co/index.html"
        allow="autoplay; gamepad; fullscreen; usb"
        sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-forms allow-modals allow-popups">
</iframe>
```

These snippets illustrate USB delegation; preserve the platform's actual existing policies and other permissions. Check every embedding ancestor, response-header policy, iframe allow attribute, and actual origin after redirects/version updates. Do not broadly enable USB for arbitrary unrelated frames. A permissive child cannot override a restrictive ancestor. A policy grant permits the browser chooser; it does not substitute for the user's device consent. See [Chrome's WebUSB guide](https://developer.chrome.com/docs/capabilities/usb) and the [WebUSB permission-policy integration](https://wicg.github.io/webusb/#permissions-policy).

In these builds the outer **game document** owns USB; its same-origin N64 engine iframe receives only mapped pads. Adding `usb` to that inner engine iframe alone will not fix a restriction imposed by YouGame. Melee's shared-memory/isolation requirements are separate from USB permissions. Keep the existing isolation behavior working when changing the player.

No claim has been made that today's live iframe policy is already enabled or disabled: the SDK/reference inspection does not prove its runtime headers. Verify in the **hosted game frame**:

```js
({
  secure: isSecureContext,
  usb: !!navigator.usb,
  policy: (document.permissionsPolicy || document.featurePolicy)?.allowsFeature('usb'),
  origin: location.origin,
  isolated: crossOriginIsolated
})
```

Then test the actual Connect button with hardware. Exercise embedded, fullscreen, reopen/reload, and a versioned build. Report permission denial, occupied interface, unsupported mode, device absence and unsupported browser separately. Existing WebUSB support is browser/OS/driver-dependent. Provide ordinary controls where it is unavailable; do not silently install/change a system driver. Close Slippi/Dolphin before the browser claims the same device interface.

## 5. YouGame changes — reusable platform implementation

**Recommended long-term design: YouGame owns acquisition at a stable, trusted origin and exposes raw controller snapshots separately from action mapping.** This is a proposed API, not something the current SDK already supports. The inspected SDK SHA-256 was `7aee8d9980b4e50dabda76a13d40f7b0237d9c2d561449480629d51ecd3d310a` from [sdk.js](https://yougame.co/sdk.js). Its current `readPad` path uses radial deadzone/rescaling, mapped booleans, and automatic Gamepad API seat assignment. `YouGame.input.state` is useful for action games but insufficient as a raw GameCube contract.

### Acquisition owner

Put Connect/Disconnect/Calibrate and hardware status in YouGame's Controls UI. Run the chooser in that UI's actual user gesture. Keep one owner for an adapter. Where supported and measured beneficial, move continuous acquisition into a dedicated worker; feature-test that browser path. A worker proposal alone does not establish lower latency. Keep rendering, SDK menus, network processing, and raw acquisition logically separate.

For an eventual desktop/native YouGame client, a libusb backend with a dedicated reader can supply the same snapshot interface. That is a separate delivery target. A normal website cannot inherit Slippi Launcher's native USB access just because Slippi is installed. Avoid an unauthenticated localhost USB bridge; if a companion is necessary, require pairing, exact allowed origins, per-session authorization and narrow commands rather than arbitrary USB transfers.

### Suggested SDK surface

```ts
// PROPOSED — not implemented in today's YouGame SDK.
YouGame.controllers.capabilities();
YouGame.controllers.connect({kind: 'gamecube-adapter'});
YouGame.controllers.disconnect(adapterId);
YouGame.controllers.assign({adapterId, port: 0, seat: 0});
YouGame.controllers.snapshot();
YouGame.controllers.on('devices', listener);
YouGame.controllers.on('error', listener);
```

Suggested snapshot fields:

```ts
{
  schema: 1,
  session: 'opaque-session-id',
  sequence: 123,                  // monotonic within the transport session
  receivedAt: 12345.6,            // monotonic arrival clock, with documented domain
  stale: false,
  source: 'webusb',               // or a later native backend
  ports: [{
    adapterId: 'session-local-id', port: 0, seat: 0,
    connected: true, type: 'wired',
    buttons: 1,                  // documented wire-layout bit mask
    axes: [128,128,128,128],      // unsigned raw bytes; +Y is up
    triggers: [0,0],             // independent of digital L/R
    origin: [128,128,128,128,0,0],
    calibrationRevision: 0
  } /* all assigned ports, including holes */]
}
```

Keep raw bytes and calibration metadata available even if a higher-level mapped view is also offered. Never rewrite raw values with the user's standard-controller deadzone, circular normalization, sensitivity curve or remapped trigger thresholds. Do not conflate D-pad directions with the analog stick. A consuming game may choose a transformation explicitly. Changing calibration or seat assignment must be visible and must not silently change during a match.

Use session-scoped identifiers; avoid exposing hardware serial numbers to games or analytics. Support explicit source ownership so one raw device cannot simultaneously claim standard-gamepad seats. Keep holes on disconnect. An adapter with no attached controllers is different from no adapter, no USB permission, stale input, or an occupied interface. Multi-adapter support should add an adapter identity above physical port number, not concatenate an unstable list of currently active pads.

### Transport into untrusted game frames

Use an explicit SDK handshake and one `MessagePort` for the active game. Verify `event.source` and exact `event.origin`, bind the channel to the active build/session, validate message schema/length/ranges, and revoke it on navigation/disposal. Only send controller data to the authorized active game. Do not broadcast reports with wildcard origins. Games should not receive a generic USB device handle or arbitrary transfer capability.

If using a shared-memory mailbox in an isolated configuration, commit the four-port packet atomically. A sequence counter around the write, or double-buffered slots with an atomic published index, prevents a consumer seeing buttons from one report and axes from another. Avoid waiting on the main thread. Keep a bounded history only when a consumer actually needs it; never accumulate an unbounded input queue.

Document clock domains. `performance.now()` values in host, iframe and worker are not interchangeable without an offset/origin contract. Prefer an explicit common clock conversion or an age measured at handoff; keep the transport sequence for ordering. A native backend with a genuine device timestamp should identify its origin and units separately from browser arrival time.

### Simulation and rollback

Read the newest complete report at the engine's established input boundary, map it once, and store it as the local input for that simulation frame. Resimulation consumes the recorded frame input, not whatever the adapter is doing now. Do not add report sequence, arrival times, device IDs or connection-local origins to deterministic state checksums. Keep calibration/assignment fixed or synchronized as configuration when needed.

Smash 64's current game path samples at its native tick / rollback timeline callback. Melee's normal browser input update is still driven by `requestAnimationFrame` before crossing into a worker-driven emulator. Its development rollback lab calls the new shared read path when gathering timeline input. **A true engine-poll-aligned Melee mailbox is still work to do**; the JS adapter change does not remove the existing presentation-to-simulation sampling interval.

Do not latch every hardware press into a later frame: that changes input semantics and can create an action the simulation never sampled. If report history is retained for diagnostics, keep it separate from the frame input timeline. The stale timeout is a failure-recovery mechanism; define separately how focus loss, dialog opening, USB failure and peer disconnection affect online match state.

Rumble is not implemented here. A future output path should be bounded to known adapter rumble commands, stop on disconnect/focus loss, serialize writes, and reconcile speculative effects during rollback. It must not duplicate effects every time a frame is replayed.

### Integrity and measurement

Raw-preserving transport avoids accidental distortion. It is not anti-cheat: a client or USB device can synthesize inputs. Do not infer tournament legality, authenticity, or a player's fairness from VID/PID, a device name or an SDK source label.

Before advertising latency improvements, measure report-arrival intervals, invalid reports, sampling age at each simulated frame, repeated sequences, missed sequences, browser long tasks, controller-to-simulation latency, and end-to-end motion-to-display latency. Report distributions (including p95/p99), hardware/firmware, OS/driver, browser version, foreground/background, fullscreen, GPU load, and whether the adapter is overclocked. Do not label a fast transfer loop “1000 Hz hardware sampling” without measuring that hardware path.

## 6. Candidates and verification

Final isolated local candidates:

| Edition | Folder | Candidate fingerprint |
|---|---|---|
| OpenSmash64 | `build/gamecube-final/opensmash64` | `fafc431c55c3c869` |
| OpenSmash64 Remix | `build/gamecube-final/opensmash64-remix` | `77106302058e769e` |
| OpenSmash Melee | `build/gamecube-final/opensmash-melee` | `ce9f99f649ae3ea9` |

The Melee Wasm SHA-256 is `96a63fa86fe3dd7fd7e51b4c5060bb8ee2bd0cd1be95888bd71917d546175ba5`. N64 candidates reuse their respective preserved engine/assets and overlay the current authored `app.mjs`, `input.mjs` and shared controller modules. Melee includes the rebuilt native bridge. These are candidates from this existing working tree, which already contained unrelated ongoing work; they are not a claim that the entire candidate diff against production consists only of adapter changes.

**Completed:** 14 focused adapter tests plus 7 existing N64 keyboard tests passed. The separate Melee keyboard/rectangle test passed. Chrome launched each actual Wasm build, operated Connect/Calibrate/Done/Use regular controls through rendered buttons, and accepted simulated USB reports with no page errors. N64/Remix tests observed A plus +80 X delivered to the running native port buffer. Melee observed A, +80/127 X, and 80/255 analog L at its actual native input function. Melee displayed frames after boot. These were boot/input smoke checks, not full matches.

Each final candidate received YouGame MCP `check_build` verdict **ready**, which means static files/references passed. Runtime evidence is separate: `build/gamecube-final/verification/results.json`, three `*-adapter.png` screenshots, and `*-static-report.json` alongside the candidates. The browser harness mocks only the USB device and serves the inspected SDK locally; it runs actual game engines. Its USB timing is deliberately synthetic.

**Not yet verified:** real adapters/controllers or OS driver claims; hosted permission/chooser flow; motion-to-display latency; four people playing a match; wireless-controller hardware; hotplug during real matches; browser/OS compatibility matrix; hosted Casual/Ranked/Friends and rollback with real hardware. No build was uploaded or published, and YouGame platform code was not changed in this workspace.

### Commands

```sh
node --test yougame/tests/gc-adapter.test.mjs yougame/tests/keyboard.test.mjs
node melee/tests/keyboard.mjs

# Rebuild native Melee after changing the float boundary:
python3 melee/tools/prepare.py
EMSDK_PYTHON=/opt/homebrew/bin/python3 cmake --build build/melee-web/wasm --target melee -j 8
/opt/homebrew/bin/python3 melee/tools/build.py --stage-only

# Separate NEW output folders are required; preserved builds are not overwritten:
node tools/stage-gamecube.mjs n64 build/opensmash64-touch-update <new-n64-folder>
node tools/stage-gamecube.mjs n64 build/remix/publish/dist <new-remix-folder>
node tools/stage-gamecube.mjs melee build/melee-web/dist <new-melee-folder>

# Set PLAYWRIGHT_PATH to an installed Playwright module; CHROMIUM_PATH is optional.
GC_BUILD_ROOT=build/gamecube-final PLAYWRIGHT_PATH=/path/to/playwright node yougame/tests/gc-adapter-browser.mjs
```

### Platform acceptance checklist

1. Enable/verify hosted permission delegation, or deliver the host-owned raw API and adapt the two OpenSmash consumers. Use an actual click and actual device consent.
2. Test a Nintendo adapter and at least one compatible adapter on supported Windows/macOS/Linux environments. Cover occupied interface with Slippi open, unsupported PC mode, canceled chooser, denied/revoked permission, unplug/replug, adapter connected with no pads, and controller replacement per port.
3. Compare a recorded physical report trace with every converter output. Test tiny stick values, diagonal sweeps, independent C-stick, analog trigger travel without click, click without forced analog saturation, all face buttons, d-pad, and port holes. Verify calibration neutral/reconnect behavior.
4. Verify source exclusivity and ownership changes, including a second Gamepad API device, focus moving to/from the nested engine, dialogs, fullscreen, background tabs, and leaving/reopening the game.
5. Run real local matches in each edition. For online-capable modes, validate frame input recording and replay, disconnect handling, and results with two real identities. Do not treat Melee's development rollback lab as production online support.
6. Measure latency under load. Only then make platform-level integrity/performance claims, stage the exact candidates through YouGame's test session workflow, and update the existing listings after the normal release checks.

The most reusable deliverable is `controllers/gc-adapter.mjs` plus its fixtures. Keep its raw decoder and independent analog/digital semantics when moving acquisition into YouGame. The game-specific `n64Pad` and `meleePad` converters should remain explicit consumers of that raw contract.
