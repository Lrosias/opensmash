# Competitive Melee experience

The authored app now includes fighter setup, Casual/Ranked/Friends entry points,
starter strikes, counterpicks, game history, set scores, ranked result presentation
and an interactive flow preview. Native match integration uses the deployed
uGames asynchronous controller. Release-specific native and hosted acceptance
results are recorded in SUBMISSION.md; menu tests alone do not prove netplay.

## Player flow

Choose **Online** from the title screen. Select one of 26 starting fighters,
including separate Zelda/Sheik starting forms, and one of four costume choices.
Lock the fighter before selecting a queue. The UI supports pointer/touch,
keyboard focus and arrows, and SDK or raw GameCube adapter focus/confirm/back input. Mobile has a
quick Continue button so the player need not scroll through the roster to lock.

The modes use the same `opensmash-melee-sets-v1` platform mode identifier:

- **Ranked:** one best-of-three set is one platform round. The starters are
  Battlefield, Final Destination, Dream Land, Yoshi’s Story and Fountain of
  Dreams. The two players strike in 1–2–1 order. Pokémon Stadium is available
  only as a counterpick. After a game: winner bans one stage, loser picks a stage
  except the stage of their last win, winner picks a character, loser responds.
  Matching mirror costumes are separated, including Zelda/Sheik pairs. A tied
  game awards no win and replays the same fighters/stage.
- **Casual:** one game per platform round, with a deterministic shuffled bag of
  the six competitive stages. The remaining bag carries across same-room
  rematches; every stage appears before the bag refills.
- **Friends:** uses uGames’ private invitations with the same unrated one-game
  competitive-stage rotation. Unlike Slippi Direct, this initial implementation
  does not expose arbitrary stages or custom match rules.

Online matches configure four stocks, eight minutes, no items and unfrozen
Stadium through version-checked GALE01r2 scene hooks. Local versus keeps its
existing native menus. Each online game boots a fresh isolated engine with the
shared seed, fighters, costumes and stage, then compares initial RAM checksums.

The platform supplies connecting/searching, invitations, Ready, connection
errors/cancellation, results and Continue. A game between two set games never
calls `room.finish`. Both peers must agree on their engines’ **confirmed** outcome
before the game advances. The whole set submits a single matching platform result.
Only the next SDK `ready` starts a rematch, keeping the last selected fighter.

The rank card accepts `result.myRating` and `rank.placed` from uGames. Provisional
ratings are hidden, Casual/Friends have no ranked display, and void results never
show a rating change. There is no local Elo, invented rank, fake match history,
account cache or separate points leaderboard. The real pre-set ladder remains
available on the platform; this SDK has no documented personal ladder fetch API.

## Implementation and engine handoff

- `src/competitive-rules.mjs`: deterministic, validated game/set transitions,
  legal stage filtering, costumes, launch settings, stage rotation and rank text.
- `src/competitive-room.mjs`: two-peer menu protocol, build/rules handshake,
  sender/round validation, ordered host commits, game-result agreement and one
  platform settlement. Host ordering covers simultaneous engine-ready and
  Continue actions; both peers independently validate game outcomes. This is
  client-side consistency checking, not server-authoritative anti-cheat.
- `src/competitive-ui.mjs` and `competitive.css`: responsive screens and explicit
  offline preview. Preview result buttons are never available in a real room.
- `app.mjs`: Online entry, host-layout reservation and input integration.

`competitive-adapter.mjs` binds `room.rollbackAsync` to `native-match.mjs` and
`native-match-host.mjs`. The host runs in a fresh iframe per game; destroying it
releases its worker environment. Preparation preloads assets and waits for both
engines to reach a deterministic gameplay boundary. Input/checksum protocols
include build identity, SDK round and set game number.

The default is buffered play with three delayed frames and `maxRollback: 0`.
This avoids expensive full-emulator checkpoints. The adapter also supports
seven-frame rollback with awaited save/load/discard, but enabling it for release
requires a measured frame budget. The SDK's confirmed events are the only source
of results; both peers must report the same frame/checksum/outcome. Native handles
never cross the network. The checksum currently covers emulated main RAM, not all
CPU/device state and not anti-cheat.

Technical errors and disagreements submit `room.finish({void:true})`, stop the
controller and discard the engine. Intentional departure uses the platform's
normal leave policy. The platform now supports neutral technical cancellation;
this is no longer a requested API addition. Per-selection tournament penalties
and Slippi's server-enforced decision timers are not implemented.

## Verification and local review

`node --test melee/tests/competitive.test.mjs` passes eight tests: strike order,
illegal actions, three-game score progression, last-win stage restriction, draws,
shuffle-bag continuity, locked character/costume/rank handling, two-client BO3
agreement, duplicate/foreign/stale traffic and technical disagreement/cleanup.
The five prior rollback adapter/timeline tests also pass.

`node melee/tests/competitive-browser.mjs` runs Chrome against a local server.
Set `PLAYWRIGHT_PATH` to the installed Playwright package and `MELEE_URL` to
override the URL. It exercises a full 2–1 ranked preview, stage and character
counterpicks, Casual rotation, portrait touch, keyboard/virtual-gamepad actions,
enabled live queues, and routing/cancellation for all three SDK queue choices.
**The platform and native engine are deliberately stubbed in that browser test.**
It proves the actual DOM flows, not two-account matchmaking or native combat.
Screenshots and the machine-readable scope are in `melee/test-results/competitive`.

For a review server with real Local Play available from an existing native build:

```sh
python3 melee/tests/serve-competitive.py --port 8275 --native-dist /path/to/build/melee-web/dist
```

Open localhost:8275 → Online → Lock fighter → Preview Ranked/Casual/Friends.
This serves current authored files over unchanged engine/assets from the chosen
build. It does not stage or rebuild that binary. Normal build staging already
copies all `src` files, including these new modules and stylesheet.

Native matches and complete SDK sets now pass. Remaining release checks include two hosted
identities, real invitations, persisted rating changes, Continue/rematch,
technical aborts, tab backgrounding, and actual host-control overlap in embedded
and fullscreen modes. No physical controller was available; browser tests feed
the same input path programmatically.

## References

The source findings and shared decisions are recorded in
[competitive UX research](../docs/competitive-ux-research.md). The
[rollback integration contract](YOUGAME-ROLLBACK-CONTRACT.md) remains required.
