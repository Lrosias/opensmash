# YouGame release

Version **1.7** is live at https://yougame.co/g/opensmash, deployed through the YouGame MCP as a minor update.

- Upload ID: `ff44fa3f8a7e4c648b92ab30e7fc20c5`
- Build fingerprint: `0fab2d72406e99b5`
- Archive: `opensmash-yougame.zip` (42 files; 16,148,955 bytes)
- ZIP SHA256: `c5fadfa21096ac858004f866f65d520469827729ff563eb4a183ac55cd7a44fa`
- Merged the published v1.6 mobile and B0XX keyboard changes with native rollback.
- Casual, ranked, and friend matches use YouGame rollback: 60 Hz, 2-frame input delay, 10-frame prediction window, confirmed result settlement.
- Original native menus, direct asset loading, automatic landscape, inset stick, expanded touch region, action arc, and top-right Start retained.
- All 31 Node tests, syntax, whitespace, native patch checks, and YouGame build checks passed.
- Two actual Wasm clients matched through 59 rollbacks each under simulated latency/loss; a complete three-stock match settled the same result exactly once per client.
- Staged YouGame origin loaded the native menus without a ROM picker.
- Existing screenshots, thumbnail, demo, game URL, and ratings retained. Minor update: zero notifications.
- No single-player leaderboard is intended; ranked competition uses multiplayer ratings.
- Separate-account/device live matches and physical iOS/Android performance remain unverified.

See `VERIFICATION.md` and `ROLLBACK.md` for test details and limitations, and `media/README.md` for media provenance.
