# Remix v2.24 release

Published as a minor update to https://yougame.co/g/opensmash64-remix.

- Version: 2.24; build `a3530b428018b3cb`.
- Upload: `e3bcff104ad7492d8a91acfb9dbbe019`; 92 files, 68,382,002 bytes.
- Source: `ae30909ab47328c0111e5a9555c9ccaa7c99ae10`, pushed on
  `lrosias/codex/remix-native-victory`, includes latest main `7fa59a7f`.
- No major-update notifications; existing listing and media preserved.

Includes original victory presentation, ROM costume colors, simplified loading,
and A/Start/B returning to character select. Four-stock defaults remain.
See the native-victory and victory-navigation checkpoint documents for local
animation, costume, four-player navigation and rollback validation.

The exact uploaded build passed static checks and actual hosted-origin keyboard
play through menu, selection, a complete match, victory and Start returning to
character select, with no page or asset-load errors. The hosted two-identity test
service again returned `Not found`; signed-in Friends/ranked acceptance was not
rerun. This limitation is distinct from the successful local paired-engine checks.

Release metadata and evidence:
`/Volumes/OpenSmashBuilds/main/build/remix/native-victory-select-20260914`.
The live source branch is not merged into main; future builds must include the
recorded live source commit as well as freshly fetched main.
