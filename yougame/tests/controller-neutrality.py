#!/usr/bin/env python3
"""Compile pinned real controller.c, not a reimplementation, with OS input doubles.
No game build, browser, USB access or shared source mutation is performed.
"""
from pathlib import Path
import argparse
import os
import subprocess
import sys
import tempfile

repository = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument('--engine-source', type=Path, default=repository / 'BattleShip')
parser.add_argument('--check-baseline', action='store_true')
args = parser.parse_args()
engine = args.engine_source.resolve()
decomp = engine / 'decomp'
revision = 'eddd0c9ba8ce0b9e80a225929ce466adc2e999fe'
source = subprocess.check_output(['git', 'show', f'{revision}:src/sys/controller.c'], cwd=decomp)
flags = ['-std=c11', '-g', '-O1', '-fsanitize=address,undefined', '-fno-omit-frame-pointer',
         '-ffunction-sections', '-fdata-sections', '-DPORT=1', '-DNON_MATCHING=1',
         '-DVERSION_US=1', '-DREGION_US=1', '-DF3DEX_GBI_2=1', '-D_LANGUAGE_C', '-DN_MICRO=1']
for include in ['decomp/include', 'decomp/src', 'decomp/src/sys', 'port',
                'libultraship/include', 'libultraship/src']:
    flags.extend(['-I', str(engine / include)])
environment = os.environ.copy()
for key in ['SSB64_PAD_SCRIPT', 'SSB64_REPLAY_PLAY']:
    environment.pop(key, None)
with tempfile.TemporaryDirectory(prefix='opensmash-controller-neutrality-') as directory:
    staging = Path(directory)
    target = staging / 'src/sys/controller.c'
    target.parent.mkdir(parents=True)
    target.write_bytes(source)
    def compile_and_run(name):
        binary = staging / name
        subprocess.run([os.environ.get('CC', 'clang'), *flags, str(target),
                        str(repository / 'yougame/tests/controller-neutrality.c'),
                        '-Wl,-dead_strip' if sys.platform == 'darwin' else '-Wl,--gc-sections',
                        '-o', str(binary)], check=True)
        return subprocess.run([str(binary)], env=environment, text=True, capture_output=True)
    if args.check_baseline:
        failed = compile_and_run('baseline')
        if failed.returncode == 0 or 'pad->button_hold == 0' not in failed.stderr:
            raise RuntimeError('Baseline did not reproduce expected held-disconnect assertion: ' + failed.stderr)
        print('Pinned unpatched baseline reproduces stale held input after P2 disconnect')
    subprocess.run(['git', 'apply', '--check', str(repository / 'yougame/patches/controller-neutrality-decomp.patch')], cwd=staging, check=True)
    subprocess.run(['git', 'apply', str(repository / 'yougame/patches/controller-neutrality-decomp.patch')], cwd=staging, check=True)
    passed = compile_and_run('corrected')
    if passed.returncode:
        raise RuntimeError(passed.stdout + passed.stderr)
    print(passed.stdout.strip())
    print('ASan/UBSan: no findings; original source and build directories untouched')
