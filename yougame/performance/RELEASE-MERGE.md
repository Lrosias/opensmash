# Combined performance release — September 9, 2026

Build `dee501eab8c6cd45` combines:

- The latest upstream Git commit `419d195`, merged into the release branch.
- Published v1.8 Friends/invite fixes, recovered from its exact release ZIP
  (SHA256 `32457f196442c9086eff29d558655de625e968869e40e27d87d082e844951cd1`).
- Browser pacing, audio, memory and diagnostic-allocation improvements in this task.
- The other performance task's exact Wasm checkpoint comparator and compact
  exclusion mask. It is initialized only for rollback engines. Its aligned
  scratch page is excluded from checkpoints, while allocator metadata is retained.
- YouGame's documented embedded cross-origin-isolation opt-in, with SDL fallback.

The active Remix expansion is intentionally not included. Its shared checkout is
still being modified; this release uses the validated original engine plus the
browser patches, not a partially rebuilt Remix engine.

52 combined Node tests pass, including v1.8 Friends lifecycle tests and comparator
correctness/fallback tests. Five upstream trailer-preset tests pass. Syntax,
whitespace and native patch reverse checks pass. The actual two-client Chrome test
loaded the comparator in both engines, exercised 59 rollbacks each and agreed at
confirmed frame 227 (12.2 seconds accelerated). The staged HTTPS build renders the
native mode menu without a ROM prompt. Local simulations were muted; the staged
startup check did not unlock audio.

YouGame local and staged static checks returned ready. Those checks do not prove
online runtime behavior. Separate-account live matchmaking, invite delivery,
persisted ratings, physical mobile performance and embedded isolation availability
on all browsers remain unverified.

Archive: `yougame/opensmash-performance-release.zip`, 49 files, 16,156,170 bytes.
SHA256: `96a1d199d1f707bb94d6219be1cce13e139f0303f930c2ad04c4be9beb33f2ad`.
Staged upload: `b4c282cefbbc4612b11016d43c26000d`.

The complete three-stock test also passed: identical state at frame 858 and one
3–0 p0 result per client (4.8 seconds accelerated).

Published through YouGame MCP as **v1.9**, minor, with zero notifications, preserving
listing media and the existing URL: https://yougame.co/g/opensmash.
