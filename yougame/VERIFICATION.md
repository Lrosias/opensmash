# Verification — 2026-09-07

Final build: `26297352f5816256`. Upload archive: `opensmash-yougame.zip`
(14,885,465 bytes, 33 files). ZIP integrity passes. Extracted game assets
are bundled; players do not upload a ROM. Raw ROM images are excluded.

YouGame MCP `check_build`: **ready**, with no warnings or failures.
Detected features: SDK, multiplayer, friends, ratings.

Verified with the actual Wasm engine and real YouGame development rooms:

- The page boots into original Mode Select. Online is a fifth native menu entry.
- Casual, Ranked, matchmaking status, results, Rematch, and Back use the native game
  renderer and existing icons, menu tabs, backgrounds, and font sprites. No launcher
  cards, replacement fighter art, or external match toolbar are included.
- Both casual and ranked two-client tests navigate the original menus, move the
  original character-select hand, place a fighter token, and press Start to queue.
- Each test completes a real three-stock knockout, confirms matching non-void results,
  starts a native Rematch with fresh engines, and verifies an opponent's forfeit.
- SDK Ready and result overlays remain hidden. Native Start/Rematch drives readiness.
- Both players use clean browser profiles without ROM uploads or a ROM storage cache.
- Cancelling matchmaking returns to Online, Back returns to Mode Select, and the
  original 1P Training character-select screen remains reachable.
- Eight protocol tests pass: delayed delivery, bounded stalls, input validation,
  rematch reset, matching outcomes, desync aborts, and stale/unknown messages.
- The engine compiles and source whitespace checks pass. Native menu, result, and
  gameplay captures were visually inspected. The live preview was refreshed.

Tests use clients on one Mac through the real relay. Development rooms do not persist
ratings. Cross-machine/network play, mobile browsers, long sessions, and every fighter
matchup have not been exhaustively tested. Networking uses delayed lockstep without
rollback prediction or server-side simulation. The optional Friends picker and invite-link
flow are implemented but were not exercised with separate signed-in accounts this pass.

## Mobile pass

### Controller revision (September 7, 2026)

- Removed both custom fullscreen buttons and their request/exit/orientation-lock code;
  fullscreen remains the responsibility of the YouGame player.
- Replaced the face-button layout with a large green A, smaller red B below-left,
  gray X/Y jump buttons, and top L Shield / Z Grab buttons. Both jump buttons share
  their action safely when held together.
- Removed analog flick latching. Center, release, cancellation and deadzone samples
  are neutral immediately, including release between simulation samples. Button tap
  latching is unchanged. Explicit held reversals still work.
- All 15 unit/protocol tests passed, including new direction-release/deadzone regressions
  and simultaneous X/Y jump release. JavaScript syntax and whitespace checks passed.
- Visually checked actual-engine controls at 844 × 390 and 568 × 320 in Chrome. All
  visible buttons fit and are at least 44 × 44 px; A is 95 px at 844 × 390. Captured a
  replacement mobile gallery image. Physical-phone flick testing remains unverified.
- Preview access initially failed automatic approval because it served the repository
  root. Stopped that server and used an isolated directory containing only the packaged
  runtime and a local control fixture; that safer preview was approved.
- Rebuilt ZIP and YouGame check both passed; build fingerprint `d41269bbf13b5516`.
- Published as version 1.1 through MCP `update_game`, minor, preserving the existing URL.

### Earlier mobile verification

- Added landscape touch controls using the existing controller input path; no engine or
  multiplayer protocol changes were needed.
- Twelve automated tests pass, including simultaneous movement/buttons, independent
  releases, quick taps, analog limits/deadzone, input clearing, and online Start filtering.
- Browser UI checks exercised native Online navigation, fighter selection with the stick,
  token placement, Start, ranked matchmaking, and cancellation through the touch controls.
- The actual CPU-battle fixture exercised Jump and Attack and showed the full combat layout.
- Layouts checked at 844 × 390, 667 × 375, 568 × 320, and portrait 390 × 844.
  All visible control buttons meet the 44 px minimum, including the compact layout.
- Fullscreen entered and exited successfully in the desktop Chromium preview. Portrait
  showed the rotate prompt. These checks used pointer-driven browser controls, not a
  physical multitouch phone. Physical iPhone/Android behavior and performance are unverified.
- Prior complete casual/ranked matches and rematches were verified before this input-only
  mobile pass. This pass exercised ranked matchmaking and real local gameplay rather than
  repeating full online matches. The new hold-to-leave gesture was implemented but not held
  through a live ranked match in this pass.


### Recording-driven mobile correction (September 7, 2026)

- Inspected the supplied 18-second screen recording locally, including 60 fps frames
  around 5.5 seconds. The thumb briefly moves upward before a downward flick, with
  a corresponding upward menu step. The old fixed-center pointerdown mapping can
  reproduce this when a finger lands above center; the recording does not expose raw
  pointer events, so physical-device confirmation remains necessary.
- Each contact now establishes a neutral origin. Drags are measured from that origin;
  release/cancel stays immediately neutral. Explicit held direction reversals work.
- Removed the portrait prompt and portrait input gate. Try native landscape lock, with
  an immediate rotated play surface if the viewport is portrait. YouGame still owns
  fullscreen. The fallback remaps pointer axes and safe-area edges; it only applies
  when the game's own viewport is portrait, avoiding double rotation by the host.
- All 18 tests passed, including off-center touchdown/down-flick regressions and
  all four rotated-axis mappings. Syntax, whitespace and YouGame build checks passed.
- Chrome actual-engine checks: 844×390 off-center drag stepped 1P → VS; off-center
  contact alone did not move selection. At 390×844 the rotated drag stepped VS →
  Option and A opened Options. At 320×568 the CPU battle ran and all seven control
  buttons were in bounds with a minimum dimension of 44 px. No rotation prompt.
- Packaged build: `0e700ac3354f8d0e`, 38 files, ZIP 16,053,945 bytes.
- This is desktop browser pointer verification; the revised build has not yet been
  tested with a physical iPhone touch gesture.
- Published through MCP `update_game` as version 1.2, minor; existing media and URL retained.


### Right-thumb layout and fight input (September 7, 2026)

- Moved Shield and Grab from the top corners into a row immediately under the
  right-hand face buttons. Start / online Hold to leave is top-right in the black
  margin. The left side contains movement only.
- Limited contact-relative neutral origins to menus. Fights again use the visible
  fixed stick center and apply the initial contact immediately, removing the extra
  drag needed by v1.2 before any movement was sent. Full-strength contacts, held
  reversals and release-to-zero are tested in both rotation modes.
- All 19 tests, JavaScript syntax, whitespace and YouGame build checks passed.
- Actual-engine layout checks at 844×390, 568×320 and rotated 320×568 confirmed
  all action buttons are clustered on the right and all button targets are at least
  44 pixels in each dimension. Start sits fully in the reserved black margin.
- Refreshed the mobile gallery screenshot. Build `92947ec4ac6f940c`, 38 files;
  ZIP 16,046,910 bytes. Physical iPhone dash timing remains unverified.
- Published as v1.3 through MCP, minor, preserving URL, thumbnail and demo; mobile gallery updated.


### Single-jump action cluster (September 7, 2026)

- One Jump button above the large central A; Special left, Shield right, Grab below.
  Start remains top-right. The gameplay and menu stick implementations are unchanged.
- Actual-engine browser checks at 844×390 and 568×320 confirmed exactly one visible
  Jump button, a dominant 95 px / 72 px A button, and all controls in bounds with
  minimum 44 px targets. Updated the mobile gallery screenshot.
- All 19 existing tests and the YouGame build check passed; whitespace check passed.
- Build `3595af0225838ad0`, 38 files, ZIP 16,050,984 bytes.
- Published through MCP as v1.4, minor; refreshed mobile screenshot, retained existing URL and other media.


### Diagonal actions and expanded movement area (September 7, 2026)

- Jump upper-left, B lower-left, Shield upper-right and Grab lower-right around A.
  Retained bottom spacing per the creator's correction; no platform-controls clearance
  strip. Start stays top-right. The creator will move YouGame's own controls separately.
- Moved stick pointer handling/capture onto a larger rectangular left-side region.
  At 844×390 the zone is 199×326 px versus the visible 117 px circle. Analog mapping
  continues to use the visible center in fights, and contact-relative origins in menus.
- A local browser input probe confirmed touchdown at (170,301), outside the circle,
  immediately produced [0,80,0]. Dragging to (260,301), beyond the hit region, held
  that value until release, which produced [0,0,0]. Repeated in rotated 390×844 with
  the same input results. The probe is local-only and excluded from the package.
- Actual-engine layout at 844×390 and 568×320: correct diagonals, action targets at least
  48 px and Start 44 px tall, A 95 px / 80 px, no action overlap. Updated gallery screenshot.
- All 19 existing tests, syntax, whitespace and YouGame build checks passed.
- Initial preview-server permission review timed out; the permitted retry succeeded.
- Build `2de6ee8aae7d61ea`, 38 files, ZIP 16,051,034 bytes. Physical iPhone feel remains
  unverified; browser pointer handling was verified directly.
- Published through MCP as v1.5, minor, preserving the URL and updating the mobile screenshot.


### Inward mobile controls and B0XX keyboard layout (September 7, 2026)

- Smaller actions now arc from Special lower-left through Jump and Grab to Shield
  above A. Grab and Shield were swapped per the final creator correction.
- Inset the stick and left edge of the picture by 32–48 px, preserving stick size
  and the expanded movement region. At 844×390 the stick moves 42 px inward and
  the hit region grows to 241×326 px. Touch analog mapping remains unchanged.
- Adopted the documented B0XX-AHK keyboard defaults, adapted to Smash 64, with
  WASD/arrows/Enter aliases. Added basic ModX/ModY magnitudes, normalized diagonals,
  most-recent opposite-direction priority without reactivation, blur/visibility
  cleanup, and one-sample short keyboard taps. Native C buttons remain native
  Smash 64 jump/costume inputs; this does not emulate Melee-specific firmware.
- All 26 tests passed. Native menu browser checks confirmed 3/M selection and O
  back. JavaScript syntax and whitespace checks passed.
- Actual-engine mobile layout checked at 844×390 and 568×320, then final swapped
  controls at 844×390 and rotated 390×844. All controls remain in bounds; actions
  have at least 48 px targets and Start is 44 px tall. A is 95 px at 844×390.
- Chrome viewport screenshots required clearing/reapplying the viewport override
  after reload; DOM bounds and the refreshed screenshots agree.
- Refreshed mobile gallery screenshot. YouGame MCP check_build returned ready.
  Build bebc52e72ad6a442, 39 files, ZIP 16,045,878 bytes.
- Physical iPhone feel remains unverified. The game cannot receive touches that
  iOS or browser chrome intercepts; the added inset provides more room inside it.
- Published through YouGame MCP as v1.6, minor, preserving URL, thumbnail and demo.


### Merged v1.7 rollback release

- Combined published v1.6 source (fingerprint bebc52e72ad6a442) with the native rollback integration. Confirmed no concurrent source changes appeared during the merge.
- All 31 Node tests passed, including the actual downloaded SDK rollback algorithm, keyboard, touch, legacy protocol regression tests, and checkpoint history tests.
- JavaScript syntax, Git whitespace checks, and reverse-application checks for all three native patches passed.
- Browser: new M keyboard binding opens the native Online menu; landscape combat shows the inset stick, action arc and top-right Start.
- Two actual Wasm engines with 3–5 frames of simulated delay and one dropped bundle in seven: 59 rollbacks each, matching confirmed state at frame 227 (4.9 seconds for the accelerated test).
- Complete three-stock scenario: matching confirmed state at frame 858, both clients report p0 winning 3–0 exactly once (10.5 seconds accelerated).
- MCP build check and staged upload check both returned ready. The staged HTTPS origin loaded the actual native menu without a ROM prompt.
- Build 0fab2d72406e99b5, 42 files, ZIP 16,148,955 bytes. Published using update_game as v1.7; existing listing media and URL preserved.
- Transport tests use two engines in one desktop browser with the real SDK algorithm and a simulated relay. Separate-account live play and physical mobile performance remain unverified.

### Local browser performance build (not deployed)

- Applied offline rAF pacing, AudioWorklet PCM playback with SDL fallback, dynamic
  texture scratch, 192 MiB initial Wasm memory, and opt-in bounded browser logs
  and WAV diagnostics. Native menus and YouGame rollback remain in place.
- Build d75c5bc145139c10; 46 files. YouGame MCP build check returned ready.
- All 44 Node tests pass. Release Wasm compiled and native patches passed reverse
  checks. Chrome native replay, delayed-input and full-match rollback tests pass.
- Final 30-second muted Chrome sample: 60 ticks/s, maximum tick interval 21.51 ms,
  no interval above 25 ms, no new audio underruns, no file or Wasm-memory growth.
- See performance/OPTIMIZATIONS.md and performance/chrome-optimized.json for
  methodology, implementation details and limits. Physical phones, hosted
  isolation/fallback behavior and native desktop comparisons remain unverified.
- Published v1.7 is unchanged.

### Combined v1.9 performance release

Merged latest upstream 419d195, published v1.8 Friends fixes, browser performance
changes and the other task’s exact Wasm checkpoint comparator. All 52 combined
Node tests and five upstream tests pass. Two native clients matched through 59
rollbacks each at frame 227; full match matched at 858 and settled 3–0 exactly
once each. Staged HTTPS native menu startup verified. Static checks returned
ready; runtime limitations remain as documented in performance/RELEASE-MERGE.md.
Build dee501eab8c6cd45 published as v1.9 through MCP, minor, no notifications.
