# Original Remix victory presentation

Unpublished candidate `177296af1d2f83be` builds on fetched `lrosias/main`
`7fa59a7fc8979c41147e21cadb850e12a793da7a`, preserving the tested costume work
from `e1f3283d`. The public game remains v2.23; its source is included.

The custom branded results panels are replaced by the original `mnVSResults`
scene: textured winner-colored background, animated franchise emblem, ranked
fighter placement, player tags, confetti, announcement timing, original large
winner lettering, and the staged KO/TKO/points/placement table. Winner name
strings, spacing, model scales and emblem offsets come from the checksum-pinned
local Smash Remix 2.0.1 ROM. The additional emblem and announcement assets are
extracted locally; no ROM asset bytes are checked into source.

Expanded fighters use bounded metadata instead of indexing twelve-character
tables. The original record-book writes and unlock flow remain bypassed.
Native session rankings and externally confirmed results remain authoritative;
shared placements do not announce one player as the sole winner. No-contest and
draw handling are separate. Existing A/Start/B navigation, local rematches,
controller ownership, four-stock defaults and costume persistence remain.
R (or Z) toggles the optional damage totals using native digits and player columns.

The browser loading cards, marketing copy, gradients and shimmer are removed.
A black loading screen with a small progress indicator disappears when ready.

## Verification

- All 34 selections and 102 victory poses animate in the real Wasm build.
- Four human players complete two full matches, with P4 rematching, toggling
  stats and returning to the remembered selections; no display-list overflow.
- All 141 imported costume colors cycle and wrap; four duplicate fighters retain
  distinct colors through battle and rematch, including a manual P3 change.
- All 22 imported entrances animate and replay exactly.
- Paired engines agree at frame 227 with 59 rollbacks each under delayed inputs.
- Four-stock settlement agrees at frame 1048, with a 4–0 result on both engines.
- Thirty Python parser tests, compiled result-selection/selection-flow/C-stick/
  receipt/clock contracts, and 21 focused JavaScript tests pass.
- 3,987 asset hashes and 110,391 bounded relocations validate.
- Desktop and 568×320 loading checks pass; no page errors or horizontal overflow.
- YouGame static checker reports ready. It does not establish hosted acceptance.

The distributable contains 92 files. The frontend is preserved from v2.23;
changes are engine code/assets/loading HTML, build identity and manifests.
Native SHA-256: `d0a8ff16a8d99012612a038176e3cb8191a9c4dc22426c7aa1258e6262d590e9`.

Candidate, distributable, fixtures and evidence:
`/Volumes/OpenSmashBuilds/main/build/remix/native-victory-20260914`.
Playable local preview: http://127.0.0.1:4202/.

## Remaining differences

Franchise-specific Remix fanfares still use the previously supported native
music fallback. Advanced Remix match-stat pages are not fully ported. This is
not a claim of complete multiplayer parity. Hosted signed-in Friends/ranked
acceptance has not been rerun for this candidate; the previous release's hosted
disposable-player service was unavailable. No new version was published.

References: `JSsixtyfour/smashremix`'s `src/resultsscreen.asm` and
`src/Character.asm`, inspected alongside the pinned ROM.
