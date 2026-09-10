# Frozen f265 native online-results presentation contract

This is presentation after authoritative settlement. It neither calls room.finish
nor changes SDK scores, winner, ratings, Continue, Ready or round ownership.

## Entry

Call the initialized **menu/presentation iframe's** export, once per settled
round, outside a native C → JS callback. Destroy/stop the old battle rollback
session first. Do not call it in a live rollback battle or speculative KO path.

```js
const accepted = menu.contentWindow.Module._port_remix_online_results(
  firstFighter, secondFighter, winnerSeat, stocks0, stocks1
);
```

- Fighter arguments are integer curated fighter IDs in the previous session's
  fixed `players[0]`, `players[1]` seat order on both clients. Do not reorder them
  with the local user first.
- `winnerSeat` is `0` or `1` in that same global seat order. Use `-1` for a draw
  and `-2` for a void/no-contest round. For a local `won` event, map with
  `event.won ? previous.seat : 1 - previous.seat`.
- `stocks0/1` are nonnegative integer remaining stocks indexed by those player
  IDs (normally 0–3); use 0 if absent. The explicit winner overrides stock ties.
- Return 0 means rejected (not Remix, unknown fighter or invalid winner); keep
  the HTML result presentation. Return 1 means the scene switch is queued.
- There is no Promise/callback. Keep ticking the unhidden menu engine. After
  scene creation, `Module.remixResults` reports `{winner, fighters, animated:true}`.
  That object is diagnostic and persists; do not use its mere presence to detect
  a new round or drive settlement. Key application presentation by settled round.
- These arguments do not include full online KO/fall statistics; the SDK's HTML
  result remains authoritative for those statistics.

The frozen shared app reference is `source/yougame/src/app.mjs` lines91–99 in the
candidate. Its `resultsPresentation` flag exempts this scene from a paused private
lobby menu, and launch/cleanup clear that flag. Treat it as a lifecycle example,
not as a replacement for your newer competitive frontend.

## Lifetime and controls

The export rebuilds menu-side transfer state for two demo fighters and requests
the native VSResults scene. It plays winner/loser animations, a native fanfare,
then the results theme. It does not reuse the destroyed match's simulated state.

After a 60-native-frame input delay, the scene emits through
`Module.onYouGameMenu(action, value)`:

- A/Start: `(3, 0)`, a rematch intent; it remains on the result scene and debounces
  for 30 frames. It does not start a battle or call room.ready itself.
- B: `(2, 0)`, a leave intent; it also queues the native VS-mode scene.

For the current SDK-owned result/Continue dialog, keep native input neutral while
that dialog owns controls and keep the application/SDK Continue/Ready handler as
the sole lifecycle owner. Do not automatically translate native `(3,0)` into a
second room.ready or programmatically click Continue. You can render the animated
native scene behind the HTML results overlay and ignore its input intents while
the overlay is active. Do not remove an iframe synchronously from its C → JS
callback; queue cleanup with a task/microtask appropriate to your engine wrapper.

On SDK Continue/new round, clear presentation/input state, hide or dispose the
presentation engine according to your existing lifecycle, and launch the usual
new battle/counterpick flow. On exit, dispose or return the menu through the
existing application path. The native scene requires no additional finish/leave
call and must never decide the next room round independently.

## Acceptance

Check both local seats, winner/draw/void, visible ticking animations, correct
fighter order and winner, controller/keyboard neutrality over the SDK dialog,
exactly one Continue/Ready transition, and a fresh round with no held input.
Also measure the new sound-bank startup cost with two real hosted clients against
the existing 45-second preparation deadline and check checkpoint memory/cost.
