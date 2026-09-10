# Competitive release — September 10, 2026

Original Smash64 **v1.3**, Smash Remix **v2.3** and Melee **v1.7** are live and
verified. Runtime publication and Git source merges are tracked separately below.

## Exact artifacts

| Edition | Version/status | Upload | Local build folder |
|---|---|---|---|
| [Original](https://yougame.co/g/opensmash64) | v1.3 live | `c059f29d3bf84977b2107d43a1c72c4a` | `build/competitive-original-invite-layout-final` |
| [Remix](https://yougame.co/g/opensmash64-remix) | v2.3 live | `48647ce497494966baa57efcd351800c` | `build/competitive-remix-invite-layout-final` |
| [Melee](https://yougame.co/g/opensmash-melee) | v1.7 live | `9468c4ede9db40ea9ac10066434b5fb6` | `build/competitive-melee-complete/dist` |

Content fingerprints, respectively:

- Original: `b0f5793f303a60edb7f82d04956d7ba8ab5d6ccde15c6ae44f95b0527ab71f47`.
- Remix: `920667374a643c888f9b33d0868e38a8513b426dda78b18f22a9762717695ad3`.
- Melee: `e911cc556344bb7bbd538361e6cb5c94b14388536f4c5e1b93e8dc8aa162dfc3`.

All final uploads have static ready verdicts. The public 64 listing entries and
versioned index, app, competitive UI and styles match their staged artifacts
after normalization of observed hosting stamps. The coordinator independently
repeated those comparisons. Melee's native startup, isolation and HTTP gzip also
pass. Its public listing resolves to the exact final upload, and all seven
app/room/UI/adapter/style/manifest comparisons match after observed hosting-stamp
normalization. Public COOP is same-origin and COEP is credentialless. The
ownership-checked listing update enables local and online play and its ladder,
preserves media/history, and leaves the mobile flag false.

## Competitive experience

All editions provide fighter setup before Casual, Ranked or Friends entry.
YouGame owns matchmaking, invitations, Ready, results, Continue and connection
errors. Incoming invitations preserve the recipient's selected fighter through
Back and retry. The game's stage/character decisions surround that shared flow.

- Ranked plays best-of-three sets, with one placement/rating update per set.
  Original and Remix use Dream Land and ordered character counterpicks.
  Original has 12 fighters/four stocks; Remix has 34 fighters/three stocks.
- Melee has 26 fighters, four stocks, eight-minute matches, five starter stages,
  1–2–1 striking, Stadium as a counterpick, winner bans, last-win stage restriction
  and winner-first character selection.
- Casual and Friends use one-game rounds and a shuffled legal-stage bag.
  Continue starts another round; it does not submit another result.
- Native stock/time outcomes determine the result. Intentional departure is a
  forfeit; technical startup failure is neutral and does not change ratings.
  Captured round identities reject stale callbacks and duplicate final reports.
- Competitive content reserves host-control space. Separate adapter pairing
  buttons are hidden while the picker or native match owns the screen, and
  return with the local menu.

## Runtime acceptance

Both 64 editions pass 105 unit tests and actual two-Wasm three-game sets with
delayed/lost packets, rollback and agreeing 2–1 results. Hosted disposable-player
tests separately cover natural ranked completion, rating changes, rematch,
forfeit and startup faults with zero recorded matches or ratings.

Exact final original session `abbd229a0cea49a38c6b41edbd8019cf` verified Ness
selection, Ready, Fox–Ness four-stock play and actual recipient movement.
Exact final Remix session `43c8c2276a1748c29f2a7d0ded1cdb55` verified Sonic
selection, Back/retry, Ready, Marth–Sonic three-stock play and recipient movement.
Both sessions are closed. Reports: `/tmp/opensmash-final-original-css-evidence`
and `/tmp/opensmash-final-remix-css-evidence`.

All 32 Melee unit tests pass against the final deployed SDK SHA25aa. Melee's
native engine SHA256 is
`ec79f2015598d73f4031613634cb0ee4463e58b10290862ed67116141bc983f6`.
Independent native boots agree on checksums, 240 input frames, seven-frame
save/load/replay and real four-stock elimination. Selected Zelda/Sheik forms
and stage metadata are verified. Two native engines with the real SDK finish
a 2–0 set, Fountain→Final Destination, with character counterpicks and one
agreed report per peer. Hosted tests separately prove actual ratings, natural
Casual results, random-stage rematch, ranked completion, forfeit and neutral
startup failure.

Exact final Melee session `ba62b636db354559a9d5c1ecf5b2a24c` verified fresh
invitation movement/attack without an Online click, neutral fault/retry, held-key
clearing across natural results, clean Continue and a different rematch stage.
It exposed one remaining platform issue: the consumed invitation redirected a
later explicit Ranked choice back to the private room. The deployed platform fix
passed final session `28db5c98f05e4122802d0fae1785a5ad`: invitation cancellation
and retry retain the pending room; successful Ready consumes it; the same pages
then enter public Ranked and Casual without a reload. Ranked stage strikes,
native four-stock idle state, movement and attacks also pass. All sessions are
closed. Evidence:
`/tmp/opensmash-melee-complete-evidence`,
`melee/test-results/complete-public*`, and the consolidated report
`/tmp/opensmash-hosted-acceptance-report.md`.
The focused final report is
`/tmp/opensmash-melee-consumed-invite-final-report.json`; the live file comparison
is `build/competitive-melee-complete/dist-live.json`.

## YouGame platform fixes

Technical cancellation previously lost `void:true`. YouGame PR68 is merged at
`939351bf62e4ed161def5712fc38fb98718fa5fc` and production rooms version
`170b748e-9c26-4052-a433-ec11bb45f436` is deployed. Neutral results are restricted
to participants, survive retries, and do not rate the match. The dedicated SQL
refund test passed; no production money rows or schema were changed.

Local YouGame commits `ec905b3` and `d46d17b` additionally fix input suspension
and consumed invitations. Opening a modal clears held inputs; key releases over
editable controls still register; Controls/dialog suspension prevents gameplay
input leakage. Invitations remain pending through cancellation and are consumed
only after successful Ready/start. Explicit public-queue requests then bypass
the old invitation in both the SDK and Player host page.

The full platform suite passes **270 tests**, typecheck and lint (zero errors,
three existing warnings). Actual Chrome tests exercise the full SDK through
hosted-style and standalone fixtures. Production runtime deployment was
separately approved and completed:

- Production web: `3b5ea046-e5f0-456f-ab5c-528ce1434088`.
- Public SDK SHA256: `25aa37a75b1d36daa03156e134da58a95adcc50b1b6ab62427c23d0666e7e4f4`, independently verified.
- Testing web: `c2470c1d-9ed7-457b-b298-d3bc88e504e1`.
- Testing rooms: `eccc82be-ccd6-421d-9452-b2a7418d5f42` (unchanged room logic).

The invitation fix requires both updated SDK and Player. Players with an old
host page already open must refresh that page once to receive both.

## Limits and source integration

Melee preserves v1.6 ThinLTO, exact FMA, Lite Fountain, shader caching and HTTP
compression. Its default online configuration is **three-frame delay and
`maxRollback: 0`**. Full snapshots are 88,833,524 bytes and cost approximately
20–21 ms to save and 6–7 ms to load on the test machine. Seven-frame rollback
correctness is verified; full-speed predictive rollback is not established.

Desktop and phone-layout fixtures pass, but physical-phone native gameplay and
official WUP-028 adapter hardware are not certified by these tests. The separate
native-adapter update remains in progress. Remix v2.3 deliberately preserves
the verified immutable v2.2 native payload; the newer experimental gameplay and
native victory presentation are not part of this release. See
[native provenance](../yougame/NATIVE-RELEASE-PROVENANCE.md).

OpenSmash source is committed locally on `codex/competitive-release-20260910`
through `eb00e0c`; the stable 64 release corresponds to `b800d23`. Existing
upstream/performance history is integrated, and unrelated dirty media is excluded.
The original shared checkout was not reset. YouGame changes are locally committed
through `d46d17b` on `codex/competitive-input-release`.

**GitHub merges remain blocked.** Automatic approval review rejected source
exports to `Lrosias/opensmash` and `Lrosias/yougame` pending explicit destination
and payload authorization. Questions are pending with the user. No alternate
push or proxy was attempted. Approved runtime deployment is not a Git merge.

The separate standard-keyboard update now owns subsequent game publication and
uses these exact three artifacts as baselines. The hardware task owns the next
platform deployment and must retain YouGame commit `d46d17b`. Neither subsequent
update is claimed as part of the versions recorded here.
