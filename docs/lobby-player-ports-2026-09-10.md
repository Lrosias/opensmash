# OpenSmash64 game-owned online lobby

Implementation is isolated in `codex/lobby-player-ports` from release-source
`791f280`. Runtime candidates are staged, not published. No source export,
listing write, or production API/migration has been performed by this owner.

Friends joins YouGame membership immediately at the native mode selection.
The game renders character selection, live participant slots, local readiness
and Start. Empty slots are human controller ports waiting for people; no CPU
is inserted. Public Casual/Ranked request two human slots and one local player
per device; Friends requests up to four humans and four local players. A new
arrival during a match waits for the next game. Match controllers keep the
frozen participant/connection snapshot and ignore new waiting connections.

`controllers/online-lobby.mjs` is game code shared by the editions. YouGame
only transports opaque selection/readiness messages and owns membership,
participant allocation, invitations and Leave. The host game's Start calls
`beginMatch` once its own participants are ready. Technical loading/simulation
failures void the match. Four-player departures currently void a private match;
there is no invented individual winner for a disconnected device with guests.

The N64 bridge now exports all four stock counts and occupied-port mask. It
ends a stock fight only after at most one human remains, or after the timer.
Its winner is a native port; the JS session maps that port through the frozen
participant roster. Draw is native result4, distinct from player3. Private
matches always settle using participant IDs rather than connection order.
Ranked retains its game-owned best-of-three and character counterpicks; each
confirmed game is recorded before the final set is settled once. Private and
Casual result actions return to game-owned selection. Ranked closure preserves
the game's result presentation.

## Native provenance

`tools/build-lobby-native.py` performs an isolated baseline relink and refuses
to build a candidate unless the published Wasm hash matches exactly. Original
uses the frozen controller-qualification object cache; Remix uses the frozen
Conker replacement object with the historic link inputs. Only `yougame.c.o` is
recompiled/replaced. This is a qualified surgical relink, not a clean full build.
The shared engine checkout and generated gameplay sources were not modified.
Original profiling output must retain the name `BattleShip`: using `baseline`
changes the Wasm name custom section even when every executable/data section
is identical. Candidate generation now uses the exact original output name.

`tools/stage-lobby-64.py` keeps verified release assets/licenses and replaces
only authored frontend/controller modules plus the qualified native JS/Wasm.
Staged directories are `build/lobby-original` and `build/lobby-remix`; native
proof/commands are `build/lobby-native/<edition>/provenance.json`.

## Validation

129 N64 tests pass against the modified actual YouGame SDK. These include:

- First native Friends callback joins before selecting a fighter; invite links
  join immediately; cancellation/stale callbacks cannot bind obsolete rooms.
- Two local participants per device own four ports; new arrivals wait;
  changed membership invalidates readiness and unchanged heartbeats preserve UI.
- Actual SDK rollback carries four port bundles across two connections, rewinds
  delayed inputs and agrees on confirmed state while a late connection waits.
- Reused/sparse slots credit their current participant, not join-order position.
- Ranked three-game sets retain one final settlement, and private individual
  game recording precedes final match recording.

Actual isolated Chromium/native tests passed for Original and Remix: all four
human ports start with one stock, eliminating P1 leaves the match running,
eliminating P2 still leaves it running, and eliminating P3 produces P4 as winner.
The captured states were frames6/147/311/465, port mask15 throughout, with no
page errors. A sparse-port native test additionally exercises ports2 and4.

An actual native Remix menu path (Online → Friends) enters the new game lobby
with one local participant and three empty ports before choosing a fighter.
Choosing Fox and Ready cannot start alone. Desktop1280×800 and phone375×812
show no horizontal overflow or browser errors. This UI test uses a mocked
membership service; it does not replace hosted multi-account acceptance.

Evidence is `/tmp/opensmash-lobby-native-{original,remix}.json`, corresponding
PNGs, `/tmp/opensmash-lobby-native-sparse.json`, and
`/tmp/opensmash-lobby-ui.json` plus desktop/phone PNGs. The reproducible native
fixture is `yougame/tests/player-ports-native.html`, served at the build root.
Production platform migration/SDK deployment and hosted multi-account smoke
remain parent-task gates; physical hardware/WAN behavior is not asserted.

## Actual two-client network acceptance

After review, all three editions were exercised with the staged native build,
actual candidate YouGame SDK, an isolated local Rooms Worker, and two independent
Chromium contexts. Each device claimed two participants; the real fighter-selection
buttons and game-owned Ready/Start launched four native human ports. Original
agreed on 91 common simulation frames, Remix on 92, and Melee on 51 confirmed
frames. Both clients progressed and no browser errors were observed. This combines
real engines and real WebSocket transport; ticket identities and result callbacks
were local fixtures. It does not assert WAN performance or hosted authentication.

Local evidence: `/private/tmp/opensmash-native-network-result.json`,
`/private/tmp/opensmash-remix-network-result.json`, and
`/private/tmp/opensmash-melee-network-result.json`, with corresponding screenshots.
The platform generic network acceptance separately completed casual/private matches
and a three-game ranked report sequence, observed one final callback, and verified
both ranked clients disconnected while casual/private lobbies remained usable.
