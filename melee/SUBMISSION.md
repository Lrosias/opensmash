# OpenSmash Melee submission

## Just-in-time loading v1.14 — September 11, 2026

**v1.14 is live** at https://yougame.co/g/opensmash-melee, upload `f0890ab382d64d30a89514de58e5a1c5`,
a wrapper-only minor update on the v1.13 package (assets and engine
`e7e6cfaf1cc448cecc65ff34ac934c5fc7db2497e439d91c5746d25f5ccb7fa4` unchanged).
Details and measurements: [PROGRESSIVE-LOADING.md](PROGRESSIVE-LOADING.md).

- The title screen downloads the engine and the menu data at once and keeps both
  in CacheStorage; a warm reload needs no network before the roster.
- The menu gate is 14.1 MB (was 22.6 MB): region twins the NTSC-U game never
  opens are out of every group.
- In the menus a plan preloads match essentials, the roster in tier order, the
  three selectable tournament stages, then the rest, decoded into memory within a
  budget; placed tokens jump ahead and abort planned downloads.
- A small corner pill (top-left, in the letterbox gutter on 16:9) replaces the
  box that covered the P4 name plate; it names what is loading and turns yellow
  only while play is blocked.
- Nine loader unit tests and the two catalog tests pass; headless Chromium runs at
  50 Mbps and 6 Mbps covered roster, picks, stage select, an Onett match and pause
  with zero missing reads on the fast line, and a 2 s blocked pick on the slow one.
- Package: `/Volumes/OpenSmashBuilds/publisher/build/melee-jit-loading-20260911-r1/melee`
  (`manifest.json` records the base package, commit and changed-file hashes).

## Competitive release v1.7 — September 10, 2026

**v1.7 is live** at https://yougame.co/g/opensmash-melee, upload
`9468c4ede9db40ea9ac10066434b5fb6`. The public versioned files match the tested
build after known hosting stamps. The listing enables local and online play
and the ranked ladder while preserving media and history. This release preserves
v1.6 ThinLTO, exact-FMA, Lite Fountain,
persistent pipeline caching and HTTP-gzip streaming. It adds configured native
online matches and the competitive flows in [COMPETITIVE.md](COMPETITIVE.md).

- Native engine SHA256: `ec79f2015598d73f4031613634cb0ee4463e58b10290862ed67116141bc983f6`.
- 32 unit tests pass against deployed SDK `25aa37a75b1d36daa03156e134da58a95adcc50b1b6ab62427c23d0666e7e4f4`.
- Independent native boots agree on RAM checksums; 240 equal input frames and
  seven-frame save/load/replay converge; a real four-stock elimination agrees.
- Kirby/Zelda on Fountain and Sheik/Ice Climbers on Stadium verify exact selected
  starting forms and stage metadata, four stocks and eight-minute rules.
- Real SDK + two native engines complete a ranked 2–0 set, Fountain→Final
  Destination, with ordered character counterpicks and exactly one agreed report.
  This uses a delayed/lossy local transport fixture; hosted identity/rating
  acceptance is separately recorded by the final upload's test report.
- Actual DOM flows, raw/standard controller focus, portrait touch, startup failure
  cleanup and immediate teardown of a hung engine pass.
- Hosted two-identity checks verify natural ranked results and ratings, Casual
  results/rematch, forfeit and neutral startup faults. Exact final-build checks
  verify fresh-invite controls, held-key release across results, clean retry and
  different rematch stages. With the final SDK and Player fix, pending-invite
  cancellation/retry and private→Ranked→Casual transitions pass without reloading.
  All disposable test sessions are closed.
- Full snapshots are 88,833,524 bytes, around20–21ms save/6–7ms load on the test
  machine. Production uses `maxRollback:0`, delay3. Seven-frame rollback is a
  correctness option, not a demonstrated full-speed configuration.

Deployment, local source commits and exact upload evidence are tracked in
[competitive release coordination](../docs/competitive-release-2026-09-10.md).
Physical USB hardware, every fighter/stage combination and voice/payments are
not covered by these local tests.

## Historical v1.5 submission

**Historical version: 1.5**, minor CPU update at
https://yougame.co/g/opensmash-melee, owned by OpenSmash (@opensmash).

The validated CPU runtime optimizations are integrated with v1.4 progressive
loading. In the controlled Bowser/Kirby Onett comparison, mean FPS improved from
48.69 to 59.06 (+21.29%), with zero asset requests/missing reads/errors during all
measurement windows. ThinLTO remains absent. Shader hitches and performance below
60 FPS in other scenarios remain; online rollback is not included.

- Upload: `38db343b7bf748398f43ac9627648517`; 1,257 files, 428,256,084 staged bytes
- Engine SHA-256: `57522a4bec2c20cc07fccc364f555dc80e47f32f55a29c81da05cd4554022349`
- ZIP: `build/melee-web/OpenSmash-Melee-Lite-YouGame.zip`, 426,840,386 bytes
- ZIP SHA-256: `cfd7518526e7dde526041580fb81c7a90981d40197747fd622685b5a8219858e`
- Static MCP and upload verdict: ready
- Source/details: [PERFORMANCE-CPU.md](PERFORMANCE-CPU.md)
- Release record: `melee/media/cpu-integration-release.json`
- Comparison: `build/melee-web/test-results/cpu-integration-comparison.json`
- Hosted installed-Chrome iframe: `build/melee-web/test-results/cpu-integration-hosted-chrome.json`
- Hosted match: `build/melee-web/test-results/cpu-integration-hosted-match/`

Installed Chrome 152 passed shared-memory startup, roster/Report controls and a
fresh Bowser/Kirby match on Yoshi’s Island. A 10-second combat window averaged
52.98 FPS with zero asset requests/missing reads/errors, including 250 ms simulated
network latency. Shader first-use hitches remain (one measured frame gap was
204.65 ms). This separate browser/stage smoke test is not an A/B comparison with
the controlled bundled-Chromium Onett measurements. Both staged and live engine
hashes match. update_game, my_games and the public version URL confirm v1.5.
Artwork, thumbnail, screenshots and video remain unchanged.

## Historical v1.4 submission

**Historical version: 1.4**, minor progressive-loading update at
https://yougame.co/g/opensmash-melee, owned by OpenSmash (@opensmash).

Menu-first loading requires about 24 MB of game data instead of 406 MB. Selected
fighters/stages get named progress and priority; failed downloads resume with
Retry. Matches wait for required assets; compressed background caching runs only
in menus. Artwork, thumbnail, gallery and video are retained from the prior release.

- Upload: `ba04fbbfa81b4f8182d0cefc91428bb6`; 1,257 files, 428,255,754 staged bytes
- Engine SHA-256: `df2362950db9f0bf149fe963b8953032935022eff00e01e6e4cc539e5a46a29d`
- ZIP SHA-256: `f2f2c2dd228411fc3279d88aa0a7d5143df66aa70d739bc67dd6749d8554d43d`
- ZIP: `build/melee-web/OpenSmash-Melee-Lite-YouGame.zip`, 426,839,693 bytes
- Local details: [PROGRESSIVE-LOADING.md](PROGRESSIVE-LOADING.md)
- Static MCP and upload verdict: ready
- Staged iframe evidence: `build/melee-web/test-results/progressive-hosted-embedded.json`
- Hosted match: `build/melee-web/test-results/progressive-hosted/match-active.json`
- Live entry: `https://7f360e6012e74f3484d949d090e4f931.yougame.co/v/ba04fbbfa81b4f8182d0cefc91428bb6/index.html`

The hosted Ice Climbers/Kirby Onett match had zero asset requests and zero missing
reads after its asset gate completed, including added 500 ms network latency.
Roster startup had zero missing reads. Physical gamepads, every stage combination,
mobile and online rollback are not runtime-verified. CPU/shader stalls remain.
MCP my_games and the public entry URL independently confirm the published version.

## Historical v1.3 submission

**Historical version: 1.3**, minor update at
https://yougame.co/g/opensmash-melee, owned by OpenSmash (@opensmash).

The opening screen now uses generated artwork closely matching the listing
thumbnail, with a centered Play Melee button, controls setup and loading status.
The first gallery screenshot is updated. This is a visual update; v1.2's
performance measurements and limitations still apply.

- Upload: `eef763924b6445ef9814a85eb7045199`; 1,260 files, 431,375,212 staged bytes
- Engine SHA-256: `41dc523fd7a106af0f5da48a65ebe1da3dcafad019c55418b6b23f1241effa56`
- ZIP: `build/melee-web/OpenSmash-Melee-Lite-YouGame.zip`, 426,835,356 bytes
- ZIP SHA-256: `58a0e5a1b12843329587c25a2ff812bd0981affae94a12fba4c5b2b910687289`
- Final art: `melee/src/opening-v3.jpg`, 543,420 bytes
- Original and prompt: `melee/media/opening-v3.png`, `melee/media/opening-v3-prompt.md`
- Hosted evidence: `build/melee-web/test-results/title-art-hosted-embedded.json`
- Release record: `melee/media/title-art-release.json`

The exact hosted build passed opening-screen rendering, Play/roster rendering,
Report controls, shared memory and resource-loading checks. There were no failed
loads or page/engine errors. Public v1.3, gallery paths and the live artwork were
checked after publication. The platform added a 53-byte JPEG comment watermark;
the rest of the image file is identical. The update response failed in transport;
no second update was submitted because read-only checks confirmed success.

## Historical v1.2 submission

**Historical version: 1.2**, minor update at
https://yougame.co/g/opensmash-melee, owned by OpenSmash (@opensmash).

The opening menu is redesigned and the top-left gameplay title is removed.
All game assets are prepared before simulation begins. Character-selection
stalls improved from 329.62 ms to 32.78 ms in a controlled 80 ms-latency test;
active-match throughput and first-use shader hitches remain unresolved.
First-load assets are about 406 MB and Wasm memory is about 1.1 GiB.

- Upload: `3572bfc0f1fb406db12840f0a124f143`; 1,259 files, 429,800,909 bytes with gallery
- Local ZIP: `build/melee-web/OpenSmash-Melee-Lite-YouGame.zip`, 426,294,710 bytes
- ZIP SHA-256: `3d20a85d0c983df788535f7f58e1f0b45d4d759ad0ec04b33291a897189f42ef`
- Engine SHA-256: `41dc523fd7a106af0f5da48a65ebe1da3dcafad019c55418b6b23f1241effa56`
- Static upload verdict: ready; hosted rendering/threading/Report check passed
- Hosted evidence: `build/melee-web/test-results/stalls-hosted-embedded.json` and PNG
- Detailed diagnosis: `melee/PERFORMANCE.md`; release record: `melee/media/stall-release.json`

The update response failed in transport, but read-only MCP and public-page checks
confirmed v1.2 and the exact live engine hash. No duplicate update was submitted.
Four screenshots were replaced. The prior thumbnail, video and performance-preview
description remain; version notes describe current startup/memory tradeoffs and
remaining speed limits. The source archive beside the build is refreshed below.

## Historical v1.1 submission

Destination: existing [OpenSmash Melee](https://yougame.co/g/opensmash-melee),
owned by OpenSmash (@opensmash), opensmashgamer@gmail.com. Update this listing;
do not create a duplicate. **Version 1.1 was published**, released as a minor update from staged build
`aa6fcc62b1f747e085122a7e40e1756a` after hosted verification. MCP `my_games`
independently confirmed version 1.1. The public description and four screenshots
were updated.

### Verified local package

- ZIP: `build/melee-web/OpenSmash-Melee-Lite-YouGame.zip`
- ZIP size: 426,296,787 bytes (64.4% smaller than the earlier 1,196,219,612-byte ZIP)
- ZIP SHA-256: `adfe85a44eee620f8cae7287b19b7793251dfb1ccb7829af9aa50619fe8cd2b8`
- Static folder: `build/melee-web/dist`; 427,703,563 bytes, 1,254 files
- Largest file: 4,037,764 bytes; root `index.html`; CRC check passed
- Engine: `f595159db56234c4958abb08f91ae8080d3542d265a6c606af7aa606d331c3b6`
- Package report: `build/melee-web/package-lite.json`
- Static MCP verdict: **ready**, `build/melee-web/static-check-lite.json`
- Separate source archive: `build/melee-web/OpenSmash-Melee-source.zip`

Local checks cover direct versus boot, the unlocked roster, B0XX keyboard input,
a standard Gamepad API second seat, active Onett gameplay, audio, pause/quit to
results, and a sandboxed iframe with working shared memory and Report controls.
The embedded screenshot remains on versus after Back; actual render bitmaps are
320 × 240. See `melee/PERFORMANCE.md` for measurements and limits. The exact staged origin also passed active gameplay and the hosted iframe
replica check; evidence is in `test-results/lite-hosted/` and
`test-results/lite-hosted-embedded.json`.

### Listing and media

`melee/media/lite-submission/listing.json` has the proposed updated description
and settings. Keep the title OpenSmash Melee. Desktop only; no leaderboard, paid
features, online matchmaking or rollback claims. Local versus uses the platform's
single/local category until online support exists.

Upload the thumbnail, four numbered screenshots and `gameplay-demo.mp4` from
`melee/media/lite-submission/`. The demo is 13.404 seconds with game audio; an
8-second silent alternative is also provided. Gameplay runs at original wall-clock
speed. The thumbnail reuses the previously generated art; screenshots and video
show the new Lite build.

Proposed minor-update notes: “Lite now starts directly in versus with all fighters
unlocked. Intro movies and memory-card prompts are skipped, and single-player
menus are removed. Added 240p rendering, separate CPU/graphics workers, compressed
streamed assets and B0XX-style keyboard defaults. Package size drops about 64%.
Performance remains below full speed; online rollback is not included yet.”

Use the authenticated MCP streaming upload flow when connected as @opensmash;
YouGame's legacy raw-ZIP API has a lower limit. Browser upload is authorized as a
fallback. Stage, test the hosted origin, then update existing `opensmash-melee`.

### Listing video limitation

The new Lite video uploaded successfully, but YouGame's update API retained the
previous listing video. The update tool has no video field and the Manage page
exposes no replacement control. The live listing therefore still shows the old
clip. The new 13.404-second clip is available at
https://aa6fcc62b1f747e085122a7e40e1756a.yougame.co/__video.mp4 and locally in
`melee/media/lite-submission/gameplay-demo.mp4`.
