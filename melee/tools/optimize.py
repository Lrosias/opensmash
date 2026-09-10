#!/usr/bin/env python3
"""Optimize the linked engine without enabling experimental Wasm features."""
from pathlib import Path
import argparse
import hashlib
import json
import os
import subprocess

ROOT = Path(__file__).resolve().parents[2]
ENGINE = ROOT / 'build/melee-web/engine'
TOOL = ROOT / 'tools/emsdk/upstream/bin/wasm-opt'

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--jobs', type=int, default=8)
    args = parser.parse_args()
    wasm = ENGINE / 'melee.wasm'
    stamp = ENGINE / 'optimization.json'
    signature = {'tool': digest(TOOL), 'flags': ['-O2', '-g']}
    previous = json.loads(stamp.read_text()) if stamp.exists() else {}
    current = digest(wasm)
    if previous.get('output') == current and previous.get('signature') == signature:
        print('Optimized engine is current.')
        return
    output = ENGINE / 'melee.optimizing.wasm'
    subprocess.run([str(TOOL), str(wasm), *signature['flags'], '-o', str(output)],
                   env=dict(os.environ, BINARYEN_CORES=str(args.jobs)), check=True)
    result = digest(output)
    output.replace(wasm)
    stamp.write_text(json.dumps({'input': current, 'output': result, 'signature': signature}, indent=2))
    print(f'Optimized engine: {wasm.stat().st_size:,} bytes')

if __name__ == '__main__':
    main()
