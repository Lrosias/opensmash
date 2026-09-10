# Smash64 competitive online experience

This is the historical initial prototype/design record. The competitive flows
have since been published for Original, Remix and Melee; see the
[verified release record](competitive-release-2026-09-10.md) and subsequent
[Remix native release](remix-native-release-2026-09-10.md). The outstanding checks
and platform requests below describe that earlier prototype, not current release
status. In particular, technical failures now use non-rating void settlement,
with hosted evidence confirming unchanged ratings after an engine-load failure.

## Flow

1. **Competitive online** on the native menu opens the full curated fighter roster. The existing native Online route reaches the same screen. Keyboard, gamepad, and touch work on the new controls.
2. **Casual**, **Ranked**, and **Friends** open the corresponding uGames interface with `YouGame.multiplayer.open`. The platform owns matching, invitations, cancellation, Ready, the result card, and Continue. Incoming invites enter the platform flow automatically with the current/default fighter.
3. The two clients exchange their locked first-game fighters and build/rules identity after the platform's Ready event. Casual/friends play one game on the curated random stage rotation; Ranked plays a best-of-three set on Dream Land.
4. Each game runs the existing `RollbackDuelSession`. A terminal result can advance the set only after the existing rollback confirmation guard, followed by agreement on winner, remaining stocks, and terminal hash from both clients.
5. Between ranked games the previous winner locks a character first; the previous loser then counterpicks. The score and game history remain visible. Dream Land is the only ranked stage, so there are no artificial bans or strikes. A tied game replays the locked characters and awards neither player a win.
6. `room.finish` is called **once at the end of the set**. Scores are game wins. The normal platform result card and **Continue** control restart only after both players press it and the next `ready` event arrives. No extra rematch handshake is used. Fighters persist; changing the initial fighter for another set requires leaving and re-entering setup.

The game calls every ranked best-of-three one SDK **round**. An internal game number namespaces the game handshake; a new deterministic native seed is derived for every game. Native rollback input transport stops before sending each confirmed result. Because uGames messages are ordered, receiving both terminal reports forms a barrier before creating the next game's SDK timeline. The new mode name `opensmash64-remix-competitive-v1` isolates incompatible older per-game clients; it also creates a distinct platform rating pool from the previous mode.

## Rules and ranking

This is explicitly **OpenSmash64 Remix**: the current curated 34-fighter roster, three stocks, eight minutes, no items. It does not claim exact original Smash64 tournament compliance. The present North American original-game reference uses four stocks and Dream Land, with the winner's character choice preceding the loser's. Existing Remix game settings were preserved.

Casual/friends use all eight already supported stages in a deterministic shuffled bag: Dream Land, Final Destination, Frays Stage, First Destination, Pokémon Stadium, Pokémon Stadium II, Goomba Road, Battlefield. Every stage appears once per eight same-room casual rounds. The first room seed is retained for the rotation because the SDK updates `room.seed` for each Ready event. Starting another room starts another bag.

The ranked ladder is entirely the existing uGames ladder. The queue and result cards show its placements, tiers and progression. Our result details use only the platform's `myRating.rank.label` and `before`/`after`. Casual ratings are hidden. There is no local Elo calculation, fake rank, single-player leaderboard, or copied Slippi rating scale.

## Evidence and limits

- Ten competitive model/integration tests cover a 2–1 set, draw replay, ordered character choices, duplicate/stale messages, result disagreement, an opponent result arriving while the local simulation is still running, stage-bag coverage, authentic rank presentation, provisional rating privacy, and rejected platform settlement.
- The integration test drives **the downloaded real uGames SDK rollback algorithm**, two `RollbackDuelSession` instances, simulated deterministic engines and delayed messages through all three games in one SDK round. Both clients settle exactly the same 2–1 result once. It is not a real native-combat or hosted-server test.
- Existing rollback and curated-roster handshake tests also pass against that downloaded SDK.
- Chrome exercised the rendered setup controls with keyboard and landscape touch, all three queue buttons, cancellation/retry, the character counterpick lock, and virtual-gamepad focus/confirm events. A physical controller was not available for verification. The queue lifecycle was deliberately **stubbed** to assert routing without involving real players. The counterpick screenshot comes from a test fixture. Screenshots: `yougame/test-results/competitive/desktop-setup.png`, `mobile-setup.png`, `counterpick.png`; machine-readable scope: `browser.json`.
- The local test server supplies the existing binary from the original project's build and new authored shell files from this worktree. These UI checks do not establish native three-game performance or hosted multiplayer correctness. This worktree does not contain the BattleShip checkout needed to rebuild that binary.
- Hosted two-identity Ready, real match completion, invite delivery, result persistence, Continue, disconnect settlement, fullscreen transitions, and host-control overlap remain to be verified on a staged build before release. No claim of a ready-to-publish build is made.

Run focused tests with:

```sh
YOUGAME_SDK_PATH=/path/to/downloaded/sdk.js node --test yougame/tests/competitive-set.test.mjs yougame/tests/competitive-rollback.test.mjs yougame/tests/rollback-session.test.mjs yougame/tests/remix-session.test.mjs
```

`yougame/build.mjs` already copies every authored file in `src` and fingerprints the complete source tree. The new modules require no build manifest additions, dependencies, network assets, or source-specific absolute paths. Start `yougame/tests/serve-competitive.mjs` with `YOUGAME_NATIVE_DIST` pointing to an existing build folder and optionally `PORT`. The browser verifier accepts `PLAYWRIGHT_PATH`, `YOUGAME_SDK_PATH`, and `COMPETITIVE_URL`; tests/fixtures are not packaged by the build.

## Initial uGames requests

**Non-rating technical abort/void.** The pre-existing rollback failure path reports a draw so a runtime error is not immediately treated as a forfeit. The new set controller follows that fallback for preparation timeout or disagreeing terminal reports. A draw can still change Elo; the client cannot promise otherwise. Add an authenticated set/session abort API with explicit no-rating settlement for technical failure, and distinguish it from intentional leaving/forfeiting. Do not simply leave the room: the current platform classifies mid-set departure as a loss.

**Timeline identity.** A public per-game timeline ID in rollback input/checksum messages would strengthen the existing ordered-message barrier and make game-to-game SDK reuse explicit. This implementation adds game identity to its own handshake messages but does not alter private SDK internals.

**Series-aware platform presentation.** Current integration needs no new set API: one SDK round is the entire set. Optional metadata (`bestOf`, current game, game scores, rules version) would let the platform show “set” and “game” consistently and audit game transcripts. The current platform result card can otherwise describe the set as a round.

## Primary references

- [Slippi matchmaking entry flow](https://slippi.gg/netplay).
- [Slippi ranked setup source](https://github.com/project-slippi/slippi-ssbm-c/blob/d7174ca0f1e6f19d0e8ec5152a3b53943f5b1c34/Scenes/Ranked/GameSetup.c) (adapted to Smash64's own stage rules).
- [Slippi casual stage bag](https://github.com/project-slippi/Ishiiruka/blob/e9d048ac6f2d77f96fcd1c0b04bc1533a7ff81e1/Source/Core/Core/HW/EXI_DeviceSlippi.cpp#L2741).
- [Current Smash64 rules and character-choice order](https://smash64.net/rules).
- [uGames SDK: online menu, results, ratings and rematches](https://yougame.co/sdk.md).
