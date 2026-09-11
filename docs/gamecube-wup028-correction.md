# WUP-028 connection failure and discovery UX

Luis reproduced the same error on Windows and macOS: WUP-028 appears in the browser USB chooser as Paired, but Controls says a compatible vendor-specific interface was not found. Pairing authorizes discovery; it does not establish a working input transport.

## Cause

Our WebUSB implementation and successful simulated transport tests required class 255. The official WUP-028 (`057e:0337`) instead exposes interface 0, alternate 0, class 3 HID, interrupt IN endpoint 1 with a 37-byte maximum packet, and interrupt OUT endpoint 2 with a 5-byte maximum packet. The [driver author's descriptor capture](https://www.linuxquestions.org/questions/linux-kernel-70/ask-for-review-kernel-driver-for-gamecube-controller-adapter-udev-rule-priority-4175729083/) records these exact values.

The [WebUSB specification](https://wicg.github.io/webusb/) protects HID interfaces. Removing the class check would move the failure to claimInterface. The [gca-js implementation author](https://yonicdev.github.io/gca-js/index.html) also documents why the adapter's HID-like descriptor and Slippi-style WinUSB/USBKit driver configurations do not provide a general WebHID workaround. Do not promise that granting permission, closing Slippi, or changing a driver makes official WUP-028 WebUSB work.

[Slippi's pinned implementation](https://github.com/project-slippi/dolphin/blob/41a7a3a110ed52999486ae1901c8fbb9a63d4f13/Source/Core/InputCommon/GCAdapter.cpp) checks the exact VID/PID, claims interface 0 through native libusb, obtains endpoints by direction, and sends interrupt initialization byte 0x13. Native USB access is the appropriate route. Keep the raw 37-byte decoder, independent triggers, immutable four-port snapshots and stale-input neutralization.

## YouGame implementation contract

1. Make **Use a GameCube controller** visible from the game/player entry before any device is known. This advertises a capability; never label an unobserved adapter Detected. Keep the complete hit target clear of host controls and fighter selectors.
2. On browser startup, enumerate previously granted devices via getDevices, then use connect/disconnect events. This does not require another chooser. The browser cannot silently discover arbitrary ungranted devices; the first grant needs an explicit action. See [Chrome's USB guide](https://developer.chrome.com/docs/capabilities/usb).
3. When an authorized official HID-class WUP-028 is found, show **GameCube adapter detected — open in YouGame desktop**, with a working desktop/download route and retained game URL. Do not repeat an unusable Connect flow or generic driver advice. Permission and HID/native eligibility are distinct states.
4. In the native app, enumerate the exact supported VID/PID and compatible interrupt endpoints automatically on launch/hotplug. Accept the official HID class through native libusb. No browser USB chooser is needed. Surface busy/driver/access errors only after a real native attempt and show the actual action needed.
5. Successfully connected native controllers become the default input. Preserve physical port numbers, empty-port neutrality, independent triggers, suspension and stale-input handling. Do not claim another unrelated device or allow the same controller to feed both raw and ordinary gamepad paths.
6. An explicit regular-controls choice wins over auto-acquisition. Do not reopen after teardown or let asynchronous enumeration replace a manually opened device. No repeated prompts or tight retry loop.
7. Verify physical WUP-028 on both Windows and macOS: startup already plugged, plug after startup, first grant where applicable, reload, all four ports, unplug/replug, Slippi occupying interface, native routing, and return to regular controls. Simulated descriptor tests are regression coverage, not hardware acceptance.

## Release dependency

The platform owner confirmed native version 0.3.0 also requires interface class 255 and therefore rejects the official adapter. Do not present that installer as the fix. Release the corrected native transport/installer with the browser routing change, verify the actual published hashes, and complete physical-device acceptance. The new host state is `browser-blocked`; the OpenSmash direct fallback uses `native-required`, and the game dialog handles both.

## OpenSmash fallback changes

The corrected fallback identifies HID-class adapters before claim, closes the handle, keeps regular input available and exposes state `native-required` with precise explanation. Its dialog shows a YouGame desktop link. Compatible previously granted vendor-specific devices auto-open on startup/hotplug. Six new regressions cover real WUP-028 descriptor rejection, no-grant/no-chooser behavior, automatic default acquisition, user optout, async cancellation, and blocked enumeration/unrelated devices.

Hosted OpenSmash uses the YouGame controller facade, so the platform transport/status/discovery changes must be released centrally. The local fallback does not fix the deployed host by itself.
