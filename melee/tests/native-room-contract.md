# Melee native room source candidate

Casual and Friends use `MeleeNativeRoomSession` and `createNativeSession` directly.
The platform lobby assigns controller ports. The game owns native fighter/rule/
stage selection, Start, results and rematches. Ranked keeps its existing rules UI.
There are no Casual/Friends custom fighter, Ready, Start or result screens.

The coordinator agrees the earliest paused native VI using build identity, room
round/revision, canonical participant roster and `[frame, phase, battleId, hash,
seatMask]`. It auto-begins after every frozen connection is prepared, then arms
all connections before starting `room.rollbackAsync`. The adapter uses 60 Hz,
fixed delay 3 and maxRollback 0, without save/load/replay/checkpoint commands.

Every connection supplies four complete GameCube samples, encoded into 140
base64 characters to stay inside the SDK input cap. Buttons and native float32
axes round-trip exactly. Participant.localIndex
selects that device's sample; participant.slot selects the immutable native port.
Unassigned ports get neutral samples and stay disconnected through the boot mask.
Changing membership while playing never changes that map. After settlement, a
changed roster cold-boots an agreed new seat epoch. An unchanged roster continues
the same engine and PRNG at the exact absolute frame where the receipt appeared.

A final native receipt stops the SDK synchronously inside the completed step;
the step does not await its own stop promise. Peer receipt agreement and platform
settlement wait until that SDK operation drains. SDK stop-on-result dispatch ends
before the next round's controller is registered. Both SDK input packets and
barrier/result messages are scoped to the build/round/match/roster/checkpoint.

Unique human FFA receipts score the winning participant. Native CPU, team,
no-contest or ambiguous outcomes finish neutrally with `void:true`, without a
fabricated draw or game report. Only a locally agreed unscored receipt permits
such a void to resume the native results screen. A VS-exit phase and the old
heuristic result field never settle a game.

Validation:

- `node --test melee/tests/native-room-session.test.mjs`: 16 cases using the
  extracted production SDK async loop, deterministic fake timers/transport and
  explicitly fake native engines. `YOUGAME_SDK_PATH` can choose the SDK fixture.
- `PLAYWRIGHT_PATH=... node melee/tests/native-room-app-browser.mjs`: production
  app, iframe bridge and real SDK input with fake room/native engine. Casual,
  Friends, fresh invitation, queue cancellation, Ranked routing, sparse ports and
  leaving passed. Its temporary server/browser are closed after the run.
- Existing competitive, party, native-launch and SDK bridge tests also pass.

This source candidate is not native or hosted acceptance. The engine team's
post-results determinism investigation must pass before native session release.
No general SDK behavior is changed, and no replay/performance claim is made.
