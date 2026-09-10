#!/usr/bin/env python3
"""Create an isolated runtime source tree from the verified macOS build."""
from pathlib import Path
import argparse
import ctypes
import os
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SOURCE = ROOT / 'build/melee4mac/build/native/recomp/upstream/ModernGekko-Template/lib/ModernGekko'
TARGET = ROOT / 'build/melee-web/runtime'

def copy_file(source, target):
    if hasattr(ctypes.CDLL(None), 'clonefile'):
        if ctypes.CDLL(None).clonefile(os.fsencode(source), os.fsencode(target), 0) == 0:
            return target
    return shutil.copy2(source, target)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=DEFAULT_SOURCE)
    args = parser.parse_args()
    if not (args.source / 'vendor/dolphin/GXRuntime').is_dir():
        parser.error('Complete the pinned macOS build first, or supply its runtime source tree.')
    if not TARGET.exists():
        shutil.copytree(args.source, TARGET, copy_function=copy_file,
                        ignore=shutil.ignore_patterns('.git'))
    patch = ROOT / 'melee/engine/browser.patch'
    if patch.is_file():
        if subprocess.run(['git', 'apply', '--reverse', '--check', str(patch)],
                          cwd=TARGET, capture_output=True).returncode != 0:
            subprocess.run(['git', 'apply', '--check', str(patch)], cwd=TARGET, check=True)
            subprocess.run(['git', 'apply', str(patch)], cwd=TARGET, check=True)
    for source in (ROOT / 'melee/engine').glob('*.h'):
        shutil.copy2(source, TARGET / source.name)
    for source in (ROOT / 'melee/engine').glob('*.cpp'):
        shutil.copy2(source, TARGET / source.name)
    print(TARGET)

if __name__ == '__main__':
    main()
