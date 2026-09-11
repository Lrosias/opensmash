#!/usr/bin/env python3
"""Produce a provenance record only after the complete roster check passes."""
from datetime import datetime,timezone
import hashlib,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
folder=ROOT/'build/remix/verification'
roster=json.loads((ROOT/'build/remix/assets/roster.json').read_text())
results=json.loads((folder/'results.json').read_text())
by_id={r['id']:r for r in results}
assert len(results)==len(by_id)==len(roster)==94,'Incomplete or duplicate fighter checks'
assert set(by_id)=={f['id'] for f in roster},'Roster coverage differs'
assert all(r['pass'] for r in results),'A fighter check failed'
paths=['build/remix/demo/engine/BattleShip.wasm','build/remix/demo/engine/files/BattleShip.o2r','build/remix/assets/extraction.json']
record=dict(verified_at=datetime.now(timezone.utc).isoformat(),fighters=94,combat_fighters=93,practice_dummies=1,
            gameplay_frames=sum(r['frames'] for r in results),artifacts={p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in paths})
(folder/'provenance.json').write_text(json.dumps(record,indent=2)+'\n')
rows=['# Roster gameplay verification','',f"Completed {record['verified_at']}: all 94 selectable fighters/variants passed.",'',
      'Checks cover original model/main IDs, movement, animation, visibility, active attack hitboxes and damage. Sandbag instead preserves its lack of attacks. These are smoke tests, not exhaustive moveset validation.','',
      '| ROM ID | Fighter | Result | Damage dealt in test | Screenshot |','|---:|---|---|---:|---|']
for f in roster:
    r=by_id[f['id']];rid=f['id'];rows.append(f"| {rid} | {f['name']} | Pass | {r['damage']}% | [Image]({rid}.png) |")
(folder/'report.md').write_text('\n'.join(rows)+'\n')
print(json.dumps(record,indent=2))
