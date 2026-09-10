#!/usr/bin/env python3
"""Capture browser compatibility edits against the pinned native source snapshot."""
from pathlib import Path
import difflib
import filecmp

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / 'build/melee4mac/build/native/recomp/upstream/ModernGekko-Template/lib/ModernGekko'
RUNTIME = ROOT / 'build/melee-web/runtime'

def main():
    diff = []
    changed = []
    for file in sorted(RUNTIME.rglob('*')):
        if not file.is_file() or (file.suffix not in {'.h','.hpp','.c','.cpp','.cmake'} and file.name != 'CMakeLists.txt'):
            continue
        relative = file.relative_to(RUNTIME)
        original = BASE / relative
        if not original.is_file() or filecmp.cmp(file, original, shallow=False):
            continue
        diff.extend(difflib.unified_diff(original.read_text().splitlines(True), file.read_text().splitlines(True),
                    fromfile=f'a/{relative}', tofile=f'b/{relative}'))
        changed.append(str(relative))
    (ROOT / 'melee/engine/browser.patch').write_text(''.join(diff))
    print(f'Captured {len(changed)} runtime compatibility edits.')

if __name__ == '__main__':
    main()
