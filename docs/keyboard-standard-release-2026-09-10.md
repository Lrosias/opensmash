# Shared Smash keyboard defaults — 2026-09-10

Luis requested Slippi defaults and publication for all three existing Smash games.
The physical action layout comes from Slippi's GCPad::LoadDefaults:
https://github.com/project-slippi/Ishiiruka/blob/slippi/Source/Core/Core/HW/GCPadEmu.cpp#L142

Arrows move; X attacks/confirms; Z specials/backs; C/S jump; Q/W shield;
D grabs; Enter starts; I/K/J/L operate C-up/down/left/right; T/G/F/H operate
the D-pad. Left Shift halves the main stick. Melee also uses Left Ctrl to
halve the C-stick. Left Alt suppresses Start. N64 C buttons and shields remain
digital. Opposing directions cancel. N64 short taps remain latched for one tick.

Melee uses SDK Move/Aim instead of the previous custom B0XX action/event path,
so movement remapping reaches native input. Its retained keyboard range is 80
units, versus full ordinary-gamepad range 127. SDK axes merge devices and use the
last source: unmodified mixed input can therefore use 127 units. Explicit keyboard
modifiers select 40-unit half-range independent of source; keyboard D-pad and
Alt/Start guard stay active with an ordinary pad. Owned raw GameCube adapter input
bypasses this conversion entirely. Previously saved YouGame mappings override
defaults and can be reset through Controls.

## Immutable release bases

- Original: v1.3, upload c059f29d3bf84977b2107d43a1c72c4a,
  competitive-original-invite-layout-final.
- Remix: v2.3, upload 48647ce497494966baa57efcd351800c,
  competitive-remix-invite-layout-final.
- Melee: v1.7, upload 9468c4ede9db40ea9ac10066434b5fb6,
  competitive-melee-complete/dist.

Base folders are under /Users/luis/.codex/worktrees/6e4e/OpenSmash/build.
The existing release owner explicitly transferred publication ownership before
these keyboard updates. No platform changes or Git source export is included.
Future Remix native/adapter adoption must preserve these keyboard modules.

## Candidates and checks

Final candidates: build/keyboard-standard/original, remix, melee-v2.
The earlier melee folder is superseded by melee-v2 and must not be published.
Each candidate differs from its immutable base in exactly app.mjs and
keyboard.mjs. All native, assets, competitive, controller and layout files are
byte-identical. The adjacent *-release.json files record changed-file hashes.
Reproduce the overlays with tools/stage-keyboard.mjs.

Unit checks: six N64 keyboard tests; Melee mapping/conversion tests; sixteen
controller/adapter tests, including all 256 raw axis/trigger bytes.
Real Chrome checks: every binding at native controller ingress in all three,
key releases, modifiers, opposed directions, N64 taps, Melee SDK Move remapping,
seat isolation, mixed ordinary gamepad+keyboard modifiers/D-pad, unchanged
ordinary pad scaling. Melee before/after screenshots confirm character-select cursor movement.
All three final candidates pass YouGame check_build with verdict ready.
Independent reviewer approved N64 and Melee-v2 under the documented merge policy.

Local evidence: build/keyboard-standard/evidence and
build/melee-web/test-results/slippi-keyboard-{before,after}.png.
Hosted evidence and publication receipts will be recorded alongside candidates.
Full online result/rematch and physical-controller acceptance belongs to the
unchanged baseline release; keyboard-specific checks do not claim to rerun those.

## Published and verified

| Game | Version | Upload |
| --- | --- | --- |
| OpenSmash64 |1.4|103b8a90b26c4560a30878ed335d0b3f|
| Smash Remix |2.4|947a9b2bdfd047bdbf40c4b2f3d74a9c|
| OpenSmash Melee |1.8|022831141b974553aa0c6889c4bcb0d8|

Each official hosted session passed native keyboard input, key release and Shift
modifier checks with no page errors (20 N64 bindings;16 Melee bindings). Sessions
were closed. The official reports remain incomplete for unchanged broader online
flows, honestly marked not run. Publication receipts and reports are in
build/keyboard-standard/publication.json. Public versioned app/keyboard files
match candidate bytes after removing only inspected YouGame prefix/suffix stamps;
see public-verification.json. A separate coordinator independently verified
app/keyboard/competitive/style files for all three.

Original and Remix description-only edits replaced obsolete keyboard instructions.
An ownership-checked helper pinned exact versions/uploads and used a compare-and-
swap description update, backing up each listing and verifying other fields were
unchanged. No media, gameplay flags or monetization settings changed.

Hosted acceptance used SDK25aa37a75b1d36daa03156e134da58a95adcc50b1b6ab62427c23d0666e7e4f4.
The platform controller owner deployed webba9e61eb-faec-4290-8ac2-e9c9656b3136
(source14dbcea) afterward, retaining that SDK. That separate deployment is not a
claim of physical GameCube adapter verification by this keyboard task.
