# Just-in-time loading — September 11, 2026

Engine SHA-256 unchanged: `e7e6cfaf1cc448cecc65ff34ac934c5fc7db2497e439d91c5746d25f5ccb7fa4`
(v1.13). This is a wrapper-only release; the hooks below are the ones the engine
already had.

## Player experience

- The title screen starts the engine (20.4 MB) and the menu data downloading at
  once, so Play usually only waits for what is still in flight. Both are kept in
  CacheStorage (`opensmash-melee-engine-v1`, `opensmash-melee-assets-v1`); a warm
  reload needs no network for the menus or the engine. A cached engine that fails
  to instantiate is deleted and downloaded again on the same load. `saveData` or
  `?noprefetch` turns the page-load prefetch and the in-menu plan off; picks still
  download on demand.
- The menu gate is 14.1 MB instead of 22.6 MB: GALE01 (NTSC-U) opens the `.usd`
  twin of a `.dat` file (`lbFileGetFullName`) and the `audio/us/` twin of a voice
  bank (`lbaudio_ax`), so the other twins are dropped from every group. A full
  roster → stage select → Onett match → pause with Bowser/Kirby produced zero
  demand reads and zero missing reads.
- In the menus the loader follows a plan: match essentials (6.9 MB every match
  needs and the old code only fetched at the gate), the eight most-picked fighters,
  the three selectable tournament stages (Yoshi's Story, Fountain, Stadium), the
  rest of the roster, the rest of the stage select, and last the five stages the
  local stage select keeps locked. Up to three planned blocks download at once and
  are decoded into Wasm memory while a budget lasts (192 MB of decoded blocks in
  total on an 8 GB machine, `defaultDecodeBudget`), then kept compressed. At 50 Mbps the whole roster is in
  memory about 15 s after the roster appears; heap rose from 538 MB to 627 MB
  there and to 821 MB with the earlier 256 MB budget, which is why the budget was
  lowered.
- Token placement fires the fighter hint (the engine's `lbDvd_80018254` scene
  preload runs when the preload cache changes), so picked fighters jump ahead of
  the plan at priority 1 and the three tournament stages move ahead of the
  remaining roster, which other players may still be browsing. Planned downloads holding the slots are aborted for foreground work.
  Worst case measured at 6 Mbps with Play pressed immediately and Bowser (last in
  the plan) placed 3.6 s after the roster appeared: 2.0 s blocked, three planned
  downloads aborted, then play resumed.
- The corner pill replaces the 300 px box that covered the P4 name plate. It sits
  top-left (in the letterbox gutter on 16:9), never over a menu option, and honours
  `--yg-ui-top/left` once the host layout is ready. States: `Loading Bowser 0.0 /
  0.3 MB · starting when ready` (yellow, play is blocked), `Loading Bowser 1.4 /
  2.6 MB` (a pick downloading, play continues), `Preloading Samus · 31%` (dimmed,
  planned work with the plan's overall progress), and `Download paused` with a
  Retry button. Planned failures never show an error; they pause the plan for 30 s.

## Verification

- Nine Node tests (`node --test melee/tests/asset-loader.test.mjs`): plan start
  and limits, a pick ahead of the plan with aborts and stage promotion, foreground
  work joining a download after its abort (a review-found hang), the match gate, urgent vs planned failures and retry, decode budget and compressed reuse,
  blocks fetched before the engine exists, status kinds, corrupt cache recovery.
  Two Python tests (`python3 melee/tests/asset-groups.test.py`) still pass with the
  trimmed groups.
- Headless full Chromium 151 (Metal) on the local server with CDP throttling.
  50 Mbps / 40 ms cold: title screen ready in under 9 s; Play → roster 4.6 s;
  no blocked frames through roster, Bowser/Kirby placement, Start, Onett, match
  and pause; match gate satisfied instantly. Warm reload: 0 network bytes, roster
  in 4.5 s. 6 Mbps / 60 ms cold with Play at once: roster in 52 s, then the
  blocking case above. Evidence and screenshots were captured in the session
  scratchpad; the pill was checked at 1280×720, 1000×620, 960×720 and the title
  screen at 375×812 (no horizontal scroll).

## Follow-ups

- Hover hints: the roster only tells the browser about a fighter when its token is
  placed. A hook where the character select highlights a portrait would start the
  download a few seconds earlier; it needs an engine rebuild (`lite.py`).
- The local stage select keeps Dream Land, Battlefield, Final Destination and the
  two other 64 stages locked; unlocking them is a save-flag change in `lite.py`.

# Progressive loading — September 9, 2026

Engine SHA-256: `df2362950db9f0bf149fe963b8953032935022eff00e01e6e4cc539e5a46a29d`.

## Player experience

- Load the opening artwork and engine, then the versus menus. The menu group is
  23,747,924 compressed bytes; the cold run transferred 21,602,811 bytes because
  identical regional blocks share a verified cache entry. The engine is another
  21,108,921 compressed bytes. Previously all 405,761,344 asset bytes were required.
- Selected fighters and stages override speculative downloads. The corner widget
  names the content, shows completed/total MB and explains that play resumes when
  ready. It sits above YouGame's reserved bottom-right controls.
- A failed download keeps the engine safely waiting. Retry resumes the same
  selection/match. Completed blocks do not download again.
- While in menus, cache fighters in the 13th community tier-list order, then stages
  with the six competitive stages first. This is a prefetch hint, not a gameplay
  ranking. Source: https://www.ssbwiki.com/List_of_SSBM_tier_lists_(NTSC).
- Background prefetch pauses at match entry. Only one speculative request runs at
  once; it yields to foreground work. An already running request may finish.

## Implementation

`asset_groups.py` maps external GALE01r2 CharacterKind and StKind IDs to manifest
blocks. Fighter groups include every costume, transformation partners, clone
shared effects, Nana and Kirby's copy assets. Stage groups include transformations
and alternate music; a test reads original archive stage parameters to validate
all selectable stage music dependencies. Shared match files include items, HUD,
pause/results, victory audio and shared runtime tables.

The browser verifies compressed SHA-256 hashes before cache reuse or decompression.
Blocks allocate Wasm memory on demand and remain immutable after commit. Native
engine workers wait on a condition variable with the asset mutex released. The
browser remains responsive and performs fetch/decompression outside engine locks.
No synchronous worker HTTP request remains in the disc-read backend.

Version-checked hooks issue selection hints at Player_80031CB0 and Stage_802251B4.
A gmVsMelee_EnterVs hook reads four 0x24-byte player slots and the stage ID, waits
for the JS group check, then proceeds into the original match. EnterCss resumes
prefetch. Unknown late dependencies still get a visible, recoverable loading
fallback and appear in Report events; they must be added to groups when found.

Cached downloads use SHA-keyed CacheStorage entries under the same game origin,
so updates can reuse unchanged blocks. Browser storage is optional and may be
evicted; if unavailable, speculative prefetch stops and foreground downloads
continue. Decoded blocks remain until reload; there is no mid-match eviction.
Playing many different fighters/stages can eventually increase memory usage.

## Verification

- Five Node tests: priority/deduplication, complete match gate, failed-download
  retry, compressed-only background storage, corrupt-cache recovery and warm reuse.
- Two Python tests: every stage's actual alternate music, full roster,
  Zelda/Sheik partner symmetry, Nana and Kirby copy dependencies.
- Headed Chromium using Metal, 250 ms simulated network latency: versus roster
  reached with zero missing-asset reads; approximately 538 MiB Wasm memory there.
- Bowser and Kirby selected through keyboard and standard Gamepad API controls.
  Named fighter download indicator captured.
- Onett download deliberately interrupted by offline mode; Retry resumed the same
  match. After the corrected match gate, asset-miss count stayed at eight (all
  eight occurred during selection/loading), with no later asset requests.
  Match memory was about 635 MiB, compared with roughly 1.1 GiB for full preparation.
- A subsequent warm reload required **zero network bytes for menu game data**.
- Evidence: `build/melee-web/test-results/progressive-verified/` screenshots and
  `warm-menu.json`; early diagnostic run in `progressive-cold/`.

This is a loading improvement, not a 60 FPS fix. Onett remained around 48–50 FPS
in the corrected test; earlier sampling saw roughly 109 ms first-use shader work.
Other fighter/stage combinations are catalog-checked but not all runtime-tested.
Actual physical controllers, mobile, online play and rollback remain unverified.

## YouGame release

Published as v1.4 through the MCP streaming helper and update_game on the existing
OpenSmash listing. Both static checks returned ready. The staged sandboxed iframe
passed shared-memory startup, Report controls and resource/error checks. The hosted
Ice Climbers/Kirby match on Onett also passed: after match-ready at 85,059 ms there
were zero asset requests and zero demand events through the active-match snapshot
at 98,488 ms. Network latency was set to 500 ms for stage selection. About 634 MiB
Wasm memory; around 45 FPS, so CPU/graphics optimization remains necessary.

Evidence: `test-results/progressive-hosted/menu.json`, `match-start.json`,
`match-active.json`, and `progressive-hosted-embedded.json` under `build/melee-web/`.
The public listing points to upload `ba04fbbfa81b4f8182d0cefc91428bb6`, and MCP
my_games confirms v1.4. The prior listing artwork/media remain in place.

Final live version-path iframe check passed roster rendering, shared memory, Report
controls and zero asset misses. The live engine hash matches the tested build. One
host-injected Cloudflare analytics request (`cdn-cgi/rum`) returned HTTP 405; game
resources and page/engine errors were clear. See `progressive-live-embedded.json`.
