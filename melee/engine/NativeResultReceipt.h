#pragma once

// GALE01r2 MatchEnd, finalized by gmVsMelee_ExitSuddenDeath before EnterResults.
// This decodes native placement data; it never derives a result from stocks.
struct MeleeNativeReceipt {
  int battle_id = 0, kind = 0, winner = -1, present = 0, humans = 0;
  int teams = 0, no_contest = 0, outcome = 0, match_kind = 0, extra = 0;
  int places[4] = {-1, -1, -1, -1};
};
static_assert(sizeof(MeleeNativeReceipt) == 14 * sizeof(int));

template <class ReadByte>
MeleeNativeReceipt melee_native_receipt(ReadByte read, int battle, unsigned assigned) {
  MeleeNativeReceipt r;
  if (battle < 1) return r;
  r.battle_id = battle;
  r.kind = 2; // explicit unscored completion unless representable below
  r.outcome = read(4);
  r.match_kind = read(5);
  r.teams = read(6) != 0;
  r.no_contest = r.outcome >= 7; // no contest, retry, terminated
  int count = 0, winners = 0;
  for (int i = 0; i < 6; ++i) {
    const unsigned player = 0x58u + i * 0xa8u;
    const int kind = read(player);
    if (kind == 3) continue; // native Gm_PKind_NA
    if (i >= 4) { ++r.extra; continue; }
    ++count;
    r.present |= 1 << i;
    if (kind == 0) r.humans |= 1 << i;
    r.places[i] = read(player + 5); // native is_big_loser: zero is first
    if (r.places[i] == 0) { ++winners; r.winner = i; }
  }
  if (count >= 2 && winners == 1 && !r.extra && !r.teams && !r.no_contest &&
      r.match_kind <= 1 && (r.outcome == 1 || r.outcome == 2) &&
      static_cast<unsigned>(r.present) == assigned && static_cast<unsigned>(r.humans) == assigned)
    r.kind = 1;
  else r.winner = -1;
  return r;
}
