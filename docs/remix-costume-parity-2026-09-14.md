# Remix costume parity checkpoint

This unpublished candidate builds on the actual v2.23 source, commit `b527de28`,
in `codex/remix-costume-parity`. PR #27 holds that released source; its merge to
main is pending explicit user approval after automatic approval review rejected
that protected-branch operation. The public game remains v2.23.

## Implemented

- Extract 141 base material-animation costumes for all 22 imported fighters
  from the checksum-verified local Smash Remix 2.0.1 ROM.
- Follow the patched VS costume-selection call to decode the count table;
  identify the relocated default-color table uniquely and validate every row.
- Use native material-animation color changes in character previews.
- Cycle colors with C-left/right (including the controller's C-stick in menus).
- Automatically choose unused colors for duplicate picks, including simultaneous
  confirmations. Native booted duplicate matches also use the ROM default mappings.
- Preserve manually selected colors in battle, results, rematches and remembered
  character selection. Include choice/kind fields in the native session hash.
- Increase the character-select display-list allocation after four detailed
  previews plus labels demonstrably exceeded its 22,000-byte buffer.

This covers base costume frames, not every extra palette, alternate model or
shade in Smash Remix's extended costume interpreter. Unsupported team indices
are recorded during extraction and do not index nonexistent base frames.

## Validation

- All 141 imported colors cycle, wrap and match the actual native fighter costume.
- Four same-character players receive four distinct colors; simultaneous picks
  remain distinct. Manual P3 color change persists through a full match/rematch.
- Forty frames of native online costume input replay exactly, including hashes.
- A booted Banjo ditto uses distinct original default costumes 0 and 2.
- Native online cursor controls continue to pass.
- All 34 selection poses, all 102 victory poses and the four-player results/rematch regression pass.
- Paired lost/delayed inputs: confirmed frame 227, 59 rollbacks on each client.
- Paired four-stock settlement: confirmed frame 1048, both report p0 with 4–0 stocks.
- 25 Python tests pass, including signed/table-opcode and ambiguity rejection.
- Compiled selection/ranking/C-stick contract tests pass.

Evidence and the local preview live in
`/Volumes/OpenSmashBuilds/main/build/remix/costumes-20260914`.

Official references used to interpret the local ROM:
- https://github.com/JSsixtyfour/smashremix/blob/master/src/Costumes.asm
- https://github.com/JSsixtyfour/smashremix/blob/master/src/Character.asm

## Remaining multiplayer parity

Extended costume palette/model/shade handling; character-specific entrance props
and custom animation events; franchise fanfares and stage music; full rules and
team/options UI; wider stage parity; exact Remix balance and frame-data checks.
Hosted disposable-player verification remains unavailable (`start_test_session`
returns `Not found`); it was not replaced with a claim of signed-in acceptance.
