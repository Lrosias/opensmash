#!/usr/bin/env python3
"""Validate archive payloads and every Marth relocation against file bounds."""
import hashlib
import json
from pathlib import Path
import struct
import zipfile
import sys

ROOT = Path(__file__).resolve().parents[1]
full = '--roster' in sys.argv
folder = ROOT / ('build/remix/assets' if full else 'build/marth/assets')
report = json.loads((folder / 'extraction.json').read_text())
files = {f['id']: f for f in report['assets']}
references = 0
with zipfile.ZipFile(folder / 'BattleShip.o2r') as archive:
    assert archive.testzip() is None, 'Corrupt archive member'
    for fid, info in files.items():
        data = archive.read(f'remix/{"roster" if full else "marth"}/{fid + 0x4000}')
        mapped, intern, extern, count = struct.unpack_from('<IHHI', data, 64)
        assert mapped == fid + 0x4000
        deps = struct.unpack_from('<' + 'H' * count, data, 76)
        assert list(deps) == [d + 0x4000 for d in info['deps']]
        size = struct.unpack_from('<I', data, 76 + 2 * count)[0]
        raw = data[80 + 2 * count:]
        assert len(raw) == size == info['size']
        assert hashlib.sha256(raw).hexdigest() == info['sha256']
        for head, external in [(intern, False), (extern, True)]:
            seen = set()
            index = 0
            while head != 0xffff:
                assert head not in seen and head * 4 + 4 <= size
                seen.add(head)
                head, target = struct.unpack_from('>HH', raw, head * 4)
                bound = files[info['deps'][index]]['size'] if external else size
                assert target * 4 <= bound, (fid, target * 4, bound)
                index += 1
                references += 1
            if external:
                assert index == count
fighters = report['fighters'] if full else [report]
scripts = [s for f in fighters for s in f['normal_attack_scripts'].values()]
assert all(s['words'][-1] == 0 for s in scripts)
if full:
    assert len(fighters) == 94 and len({f['id'] for f in fighters}) == 94
    assert not any(f['unsupported_normal_attacks'] for f in fighters)
else:
    assert len(scripts) == 14
print(f'PASS: {len(files)} asset checksums, {references} bounded relocations, {len(scripts)} terminated translated attack scripts.')
