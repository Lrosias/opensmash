# Published online mode live test — September 9, 2026

## Assessment

The core online flow works in the published builds with two distinct identities through the real YouGame service. Six complete matches passed (Casual, Ranked and Friends for each edition), and four rematches started successfully. This is a functional desktop smoke test, not a blanket production-readiness certification. Remix remains an experimental fighter port and is not ready for serious ranked competition because its custom specials and character-specific mechanics are incomplete.

## Builds and environment

| Game | Published version | Build fingerprint | Upload |
|---|---|---|---|
| [OpenSmash64](https://yougame.co/g/opensmash64) | 1.0 | `0631767507ead4db` | `633422739ed3427eafb5d4d15db4c682` |
| [OpenSmash64 Remix](https://yougame.co/g/opensmash64-remix) | 2.1 | `c115dc3da40b1e4e` | `2010b14df15e46f7b9cf0e88f550f2f1` |

Tests used signed-in Chrome and a separate signed-out Codex browser on one Mac and network. The guest received a distinct YouGame identity, so account creation was unnecessary. All game actions used the published player, native keyboard menus, and real lobby controls. No mock multiplayer service or local game build was used for these live matches. The existing working tree contains substantial earlier changes; application code and published builds were not modified by this test.

The current public SDK was downloaded separately for local regression tests. SHA-256: `76f192893ca4fc1130128effb993e42b3382703b7e6f52696d6f73595d472e16`.

## Live results

| Check | Original | Remix |
|---|---|---|
| Published player boots without a ROM upload | Pass | Pass |
| Native Online → Casual → selection → real matchmaking | Pass | Pass |
| Distinct identities and matching fighter/stage/seed parameters | Pass | Pass |
| Complete stock-loss match with opposite win/loss outcomes | Pass | Pass |
| Native Casual Rematch boots fresh battle engines | Pass | Pass |
| Ranked match and persistent result/rating | Pass | Pass |
| Native Friends picker and invite-link recipient selection | Pass | Pass |
| Private lobby starts with neither player Ready | Pass | Pass |
| One player Ready waits for the other | Pass | Pass |
| Private match starts after both Ready | Pass | Pass |
| Private complete result and Continue/rematch | Pass | Pass |
| Explicit Escape during play | Pass; opponent wins by forfeit | Not directly exercised; live browser reload/navigation tested |
| Opponent reload/navigation during play | Not separately exercised | Pass; opponent wins by forfeit and returns to menu |
| Cancel an active public queue search with native Back | Pass | Not separately exercised |
| Brief desktop background-tab check | Pass in the in-app browser | Not separately exercised |

### Match evidence

- Original Casual: Luigi versus Luigi, Dream Land, seed `3412070390`; both peers entered round 1, followed by opposite win/loss results. Round 2 used seed `315805429`; guest Escape produced `YOU LEFT THE MATCH` and `YOU WIN BY FORFEIT` on the other client.
- Original Ranked: Luigi versus Luigi, Dream Land, seed `163533985`; completed match. Signed-in rating changed from 1000 / placements 0 of 5 to 1020 / placements 1 of 5. A subsequent fresh visit showed the public ladder with one win and the guest with one loss at 980.
- Remix Casual: Ganondorf versus Marth (`30,58`), Dream Land, seed `2634816203`. Both screens showed matching movement/attack scenes and stock counts; final win/loss outcomes agreed. Rematch seed `2753394203` reached round 2; refreshing the guest caused a forfeit win and menu recovery for the remaining player.
- Remix Ranked: Luigi versus Mario (`4,0`), Pokémon Stadium (`11`), seed `1941638425`. Both clients agreed on the selected stage. Completed win/loss result moved the signed-in rating to 1020 and guest to 980, each placements 1 of 5. The refreshed public ladder showed the same result.
- Remix Friends: native Friends → fighter → stage → real friend picker → Copy invite link created a private room. Opening the page-level copied link in the guest browser automatically booted selection with `SSB64_START_SCENE=16&SSB64_YOUGAME_INVITE=1`. Both seats remained unready until explicitly readied. The match was Mario versus Donkey Kong (`0,2`) on Final Destination (`16`), seed `1573105455`. Both result cards agreed on 3–0; rating remained 1020. Continue from each result card started round 2 with seed `3339421548`. Navigating the host away produced a forfeit win for the guest.
- Original Friends: invite recipient also automatically entered native fighter selection; both players joined without automatic Ready, and one Ready did not start the match. Luigi versus Luigi on Dream Land, seed `3010425509`, remained active through 400 seconds remaining on both clients. The eventual result cards agreed on 3–0 and the signed-in rating remained 1020. Both Continue actions launched the private rematch.
- Original private rematch: seed `1648587823`, round 2. Opened another tab in the guest browser, waited 15 seconds, then closed that tab. The match continued and both game timers agreed at 421 seconds remaining on return. This desktop in-app-browser behavior is not evidence of mobile suspension handling or network-outage recovery. Guest Escape then returned the host to `YOU WIN BY FORFEIT`.
- Original cancellation: from a fresh Online → Casual selection, confirmed the native `SEARCHING`/Waiting screen before pressing O (Back). Search status cleared and the native Casual/Ranked/Friends menu returned.

Movement inputs deliberately caused stock loss to exercise deterministic match completion quickly. These were not competitive human matches or exhaustive combat/moveset tests. No messages or challenges were sent to real friends, and coin/voice features were not used.

## Findings to address

1. **Wrong controls in the original public listing.** It advertises J attack/select, K special/back and L shield. The working published build uses M, O and Q respectively. M/O were exercised live. This can prevent a new keyboard player from getting through selection. Update the listing and ensure the platform controls help agrees with the build.
2. **The outer Casual/Ranked selector does not reflect native Ranked selection.** The page continued displaying Casual while the native Ranked path started a match that actually changed ratings. Observed on both games. Make the selected queue unambiguous and consistent across the native menu and platform player.
3. **Private lobby instructions contradict its configuration.** Both SDK overlays say open seats fill with online players, while the page-level lobby correctly says seats stay open for friends. The room did wait for the invited player. Correct the overlay copy for `fill:false` private rooms.
4. **The page-level lobby remains on “Round in progress” after the game has finished.** Observed alongside native win/loss screens on both games and private result cards. It updates when players Ready/Continue or leave. Synchronize this state with result settlement.
5. **The legacy automated live smoke runner is stale.** `yougame/tests/game-smoke.cjs` still searches for the exact battle title `OpenSmash online battle`; published titles are `OpenSmash64 online battle` and `OpenSmash64 Remix online battle`. The shared helper now follows Remix selection, which differs from the original cursor/Start flow. This run used direct live UI testing; the existing script must be updated before treating it as a reliable regression gate for both editions.

Remix's incomplete custom specials/mechanics are a documented product limitation, not a newly discovered networking regression. Reliable networking alone does not establish moveset accuracy or competitive balance.

## Local regression results

`YOUGAME_SDK_PATH=/tmp/opensmash-online-qa-sdk.js node --test yougame/tests/*.test.mjs`: **59 passed, 0 failed, 0 skipped**. This includes the actual downloaded SDK rollback algorithm, speculative result handling, checkpoint storage, input handling, Friends integration and Remix metadata validation. Output is saved in `yougame/test-results/live-online-2026-09-09/unit-tests.txt`.

These tests cover the current local source. They supplement, rather than substitute for, the published-build UI checks. Reviewed browser error logs for both games were empty; native startup messages appear at warning level and are not themselves failures.

## Remaining release coverage

- Two physical devices on independent networks, including realistic long-distance latency, jitter, packet loss and a genuine network outage/reconnection.
- Physical iPhone and Android controls, sustained frame pacing, audio and background/resume behavior; Safari and Firefox.
- Full eight-minute timer expiry and draw settlement, extended session/soak testing, many consecutive rematches, and concurrent-room/load testing.
- All original/Remix fighter matchups and all eight Remix stages. This live run covered original Luigi, Remix Ganondorf/Marth/Luigi/Mario/Donkey Kong and Dream Land/Pokémon Stadium/Final Destination.
- Competitive integrity and abuse resistance. Existing checksums are diagnostic, not server-authoritative simulation or a complete anti-cheat solution.

The ranked smoke tests intentionally created one real ranked win/loss per game. Those records persist on the public ladders. Private and Casual results did not add ranked wins.

All test rooms were left and temporary test tabs were closed after verification. No game or listing update was published.
