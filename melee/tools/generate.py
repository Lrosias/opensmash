#!/usr/bin/env python3
"""Generate smaller portable game functions from the verified native compilation input."""
from pathlib import Path
import os
import hashlib
import json
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[2]
NATIVE = ROOT / 'build/melee4mac/build/native/recomp'
OUTPUT = ROOT / 'build/melee-web/game-small/generated'

def main():
    tool = NATIVE / 'build/dolrecomp/dolrecomp'
    source = NATIVE / 'private/recompiled/generated/main.dol'
    if not tool.is_file() or not source.is_file():
        raise SystemExit('Complete the pinned native build first.')
    signature = {'source': hashlib.sha256(source.read_bytes()).hexdigest(),
                 'tool': hashlib.sha256(tool.read_bytes()).hexdigest(), 'instructionsPerChunk': 512}
    marker = OUTPUT / 'codegen.json'
    current = json.loads(marker.read_text()) if marker.is_file() else None
    if current != signature or not (OUTPUT / 'generated.h').is_file():
        if OUTPUT.exists(): shutil.rmtree(OUTPUT)
        env = dict(os.environ, DOLRECOMP_C_CHUNK_INSTRUCTIONS='512')
        subprocess.run([str(tool), '--gamecube', '--cpu', 'gekko', '--backend', 'c', '-j6',
                        str(source), str(OUTPUT.parent)], env=env, check=True)
        shutil.copy2(source, OUTPUT / 'main.dol')
        marker.write_text(json.dumps(signature, indent=2))
    print(OUTPUT)
    subprocess.run([os.sys.executable, str(ROOT / 'melee/tools/lite.py')], check=True)

if __name__ == '__main__':
    main()
