# Competitive flow research and implementation decisions

Reviewed September 9, 2026. Two implementations were developed in parallel:
[Smash64 Remix](smash64-competitive-experience.md) and [Melee](../melee/COMPETITIVE.md).
They share mode names, fighter setup, best-of-three ranked sets, ordered character
counterpicks, set scores and platform-owned rank/rematch handling, with each
game's supported rules stated explicitly.

## Verified Slippi behavior

The public ranked menu source implements five starter stages and **1–2–1**
striking. Between games, its steps are winner stage ban, loser stage pick,
winner character pick, loser character pick. It excludes the stage of the
counterpicking player's last win. The current stage list uses Final Destination
as a starter and Pokémon Stadium as a counterpick. Mirror-costume conflict
handling is explicit in the same file.
[GameSetup.c, pinned revision d7174ca](https://github.com/project-slippi/slippi-ssbm-c/blob/d7174ca0f1e6f19d0e8ec5152a3b53943f5b1c34/Scenes/Ranked/GameSetup.c).

The casual random-stage routine draws from a pool and removes the selected stage;
when empty, the pool refills. That motivated using shuffled bags rather than
independent random draws in our casual modes.
[EXI_DeviceSlippi.cpp, getRandomStage](https://github.com/project-slippi/Ishiiruka/blob/e9d048ac6f2d77f96fcd1c0b04bc1533a7ff81e1/Source/Core/Core/HW/EXI_DeviceSlippi.cpp#L2741).

Slippi's release notes confirm unfrozen Stadium in ranked/unranked and in-game
rank/rating presentation. Our interface uses its own layout, copy and simple
vector stage illustrations; Slippi art and menu source were not copied.
[Official release notes](https://github.com/project-slippi/Ishiiruka/releases/tag/v3.5.0).

Original Smash64 tournament rules use Dream Land and winner-first character
selection. Our existing Remix engine uses three stocks, while the cited original
game rules use four; the new Remix screen explicitly retains its own three-stock
rules rather than claiming exact original-game tournament compliance.
[Smash64.net rules](https://smash64.net/rules).

## Platform mapping

The current uGames SDK reference was retrieved through its MCP connector. We use
`multiplayer.open({players:2,mode,queue})` for platform UI and one SDK round per
ranked set. `room.finish` occurs once after set completion, with game-win scores.
Platform `result.myRating` supplies rank/placement and rating changes. Its
Continue/Ready barrier starts the next set. No local rating algorithm or second
leaderboard was added. [uGames SDK](https://yougame.co/sdk).

Mode names are versioned: `opensmash64-remix-competitive-v1` and
`opensmash-melee-sets-v1`. Ratings are scoped by game/mode/queue, so Smash64's new
mode starts a separate pool from its old per-game mode unless uGames deliberately
migrates that history. This avoids matching clients with incompatible settlement
rules; it is not a silent preservation of existing ranks.

The rank flow includes placements and authoritative result presentation, while
the game-page ladder remains platform-owned. It does not reproduce Slippi's
rating algorithm, subscriptions, numeric thresholds or rank artwork.

## uGames integration status and follow-up

Async save/load/step, canonical checksums, replay metadata and confirmed outputs
are integrated and tested with Melee's native engine. Both games namespace
gameplay traffic by build, SDK round and set game. Neutral technical cancellation
is implemented and deployed; authenticated void results do not change ratings.
Held-input suspension and consumed-invitation routing are also fixed in the
platform. Exact source, deployment and test records are in
[the release record](competitive-release-2026-09-10.md).

Remaining improvements:

1. **Melee checkpoint performance:** reduce snapshot/save costs before enabling
   predictive rollback by default. The release currently uses three delayed
   frames and no prediction; correctness tests alone do not establish frame time.
2. **Optional set metadata:** best-of, game index, game scores and rules version
   would improve platform wording and auditing. BO3 already fits one SDK round;
   this is not a blocker for set scoring.
3. **Rank history migration and reads:** decide whether to migrate the older
   Smash64 mode's ratings; expose an authenticated personal ladder/placement
   snapshot if the title screen should show current rank before a first result.
4. **Competitive decision enforcement:** server-enforced selection timers and
   tournament penalties are not implemented. Peer validation does not provide
   server-authoritative anti-cheat.
