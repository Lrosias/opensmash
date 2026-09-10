# YouGame release

Version **1.8** is live at https://yougame.co/g/opensmash, deployed through the YouGame MCP as a minor update on September 8, 2026.

- Upload ID: `f9030ddb66294964b696f67a4fb3d9e4`
- Build fingerprint: `9a8d3115150547c6`
- Archive: `opensmash-yougame.zip` (42 files; 16,169,578 bytes)
- ZIP SHA256: `32457f196442c9086eff29d558655de625e968869e40e27d87d082e844951cd1`
- Friends/invites use YouGame's visible lobby, Ready and result/Continue cards. Private hosts disable public fill; both players confirm Ready explicitly.
- Online → Friends → choose fighter → Start opens the real YouGame friend picker. Invite links go to native fighter selection before joining the existing room.
- Casual/ranked native flow, rollback netplay, mobile controls, keyboard layout and bundled assets retained.
- All 35 tests, syntax, whitespace and MCP build checks passed. Two real SDK dev clients joined a private room, waited for both Ready presses, and launched native battles with matching fighters and seed.
- Separate-account/device live matches and physical iOS/Android performance remain unverified.
- Existing screenshots, thumbnail, demo, game URL, and ratings retained. Minor update: zero notifications.
- No single-player leaderboard is intended; ranked competition uses multiplayer ratings.
- Initial automatic approval review required specific upload authorization. The user approved with “yes go”; upload and MCP update then succeeded.

See `VERIFICATION.md` and `ROLLBACK.md` for test details and limitations, and `media/README.md` for media provenance.
