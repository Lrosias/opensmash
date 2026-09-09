# YouGame release

Version **1.9** is live at https://yougame.co/g/opensmash, published through the
YouGame MCP as a minor update on September 9, 2026.

- Upload ID: `b4c282cefbbc4612b11016d43c26000d`
- Build fingerprint: `dee501eab8c6cd45`
- Archive: `opensmash-performance-release.zip` (49 files; 16,156,170 bytes)
- ZIP SHA256: `96a1d199d1f707bb94d6219be1cce13e139f0303f930c2ad04c4be9beb33f2ad`
- Merged upstream `419d195`, published v1.8 Friends fixes, and both agents’ completed browser and rollback performance improvements.
- 52 combined Node tests and five upstream tests pass. Native delayed-input rollback and full-match result settlement pass; staged HTTPS native menu startup verified.
- Existing URL, media, ratings and comments retained. Minor update: zero notifications.
- No single-player leaderboard is intended; competitive play uses multiplayer ratings.
- Active Remix expansion is not part of this release.
- Separate-account live matches, physical mobile performance and embedded isolation on all browsers remain unverified.

See `performance/RELEASE-MERGE.md`, `VERIFICATION.md`, and `ROLLBACK.md` for details.
