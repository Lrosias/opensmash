#!/usr/bin/env python3
"""Build the Melee browser engine; package only after runtime verification."""
from pathlib import Path
import argparse
import gzip
import hashlib
import json
import os
import shutil
import subprocess
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[2]
BUILD = ROOT / 'build/melee-web'
EMSDK = ROOT / 'tools/emsdk/upstream/emscripten'

def run(args, **kwargs):
    subprocess.run([str(a) for a in args], cwd=ROOT, check=True, **kwargs)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--jobs', type=int, default=8)
    parser.add_argument('--stage-only', action='store_true')
    parser.add_argument('--native-build', type=Path, default=BUILD,
                        help='Verified native build root containing engine/ and runtime/ (stage-only)')
    parser.add_argument('--native-dist', type=Path,
                        help='Existing distribution with compressed game assets; defaults to native-build/dist')
    parser.add_argument('--output', type=Path, default=BUILD / 'dist',
                        help='Distribution destination; authored sources always come from this checkout')
    parser.add_argument('--optimize-wasm', action='store_true', help='Experimental Binaryen pass; benchmark before shipping')
    args = parser.parse_args()
    native = args.native_build.resolve()
    if native != BUILD.resolve() and not args.stage_only:
        parser.error('--native-build is only supported with --stage-only')
    if not args.stage_only:
        run([sys.executable, ROOT / 'melee/tools/prepare.py'])
        run([sys.executable, ROOT / 'melee/tools/assets.py'])
        run([sys.executable, ROOT / 'melee/tools/generate.py'])
        env = dict(os.environ)
        env['PATH'] = str(EMSDK) + ':/opt/homebrew/bin:' + env['PATH']
        env.setdefault('EM_CACHE', str(BUILD / 'emscripten-cache'))
        run([EMSDK / 'emcmake', 'cmake', '-S', BUILD / 'runtime', '-B', BUILD / 'wasm', '-G', 'Ninja',
             '-DCMAKE_BUILD_TYPE=Release', '-DBUILD_TESTING=OFF', '-DENABLE_GENERIC=ON',
             '-DENABLE_VULKAN=OFF', '-DENABLE_X11=OFF', '-DENABLE_EGL=OFF', '-DENABLE_WAYLAND=OFF',
             '-DUSE_SYSTEM_LIBS=OFF', f'-DCMAKE_C_FLAGS=-pthread -ffile-prefix-map={Path.home().as_posix()}=/build -ffile-prefix-map={ROOT.as_posix()}=/src', f'-DCMAKE_CXX_FLAGS=-pthread -ffile-prefix-map={Path.home().as_posix()}=/build -ffile-prefix-map={ROOT.as_posix()}=/src',
             '-DMODERNGEKKO_ENABLE_DYNAMIC_MODULES=OFF',
             f'-DGENERATED={BUILD / "game-small/generated"}',
             f'-DOPENSMASH_WEB_FRONTEND={ROOT / "melee/engine"}'], env=env)
        run(['cmake', '--build', BUILD / 'wasm', '--target', 'melee', '-j', args.jobs], env=env)
        if args.optimize_wasm:
            run([sys.executable, ROOT / 'melee/tools/optimize.py', '--jobs', args.jobs])
    dist = args.output.resolve()
    assets = (args.native_dist or native / 'dist').resolve()
    if assets != dist:
        if not (assets / 'assets-manifest.json').is_file():
            raise SystemExit('The supplied native distribution has no assets-manifest.json.')
        shutil.copytree(assets, dist, dirs_exist_ok=True)
    (dist / 'engine').mkdir(parents=True, exist_ok=True)
    if not all((native / 'engine' / name).is_file() for name in ('melee.wasm','melee.js')):
        raise SystemExit('Engine has not linked successfully; there is no runnable build to stage.')
    for file in (ROOT / 'melee/src').iterdir():
        if file.is_file(): shutil.copy2(file, dist / file.name)
    shutil.copytree(ROOT / 'controllers', dist / 'controllers', dirs_exist_ok=True)
    for file in dist.glob('*.mjs'):
        source = file.read_text()
        if '../../controllers/' in source:
            file.write_text(source.replace('../../controllers/', './controllers/'))
    for file in (native / 'engine').iterdir():
        if file.is_file() and file.suffix == '.js': shutil.copy2(file, dist / 'engine' / file.name)
    from asset_groups import build as build_asset_groups
    catalog = build_asset_groups(json.loads((dist / 'assets-manifest.json').read_text()))
    (dist / 'asset-groups.json').write_text(json.dumps(catalog, separators=(',', ':')))
    raw = native / 'engine/melee.wasm'
    digest = hashlib.sha256()
    compressed = dist / 'engine/melee.wasm.gz'
    with raw.open('rb') as wasm, compressed.open('wb') as output:
        with gzip.GzipFile(filename='', fileobj=output, mode='wb', compresslevel=9, mtime=0) as encoded:
            while data := wasm.read(4 * 1024 * 1024):
                digest.update(data)
                encoded.write(data)
    for old in (dist / 'engine').glob('wasm-*.bin'):
        old.unlink()
    manifest = {'codec': 'http-gzip', 'path': compressed.name,
                'sha256': digest.hexdigest(), 'transferBytes': compressed.stat().st_size,
                'decodedBytes': raw.stat().st_size}
    (dist / 'engine/wasm.json').write_text(json.dumps(manifest, separators=(',', ':')))
    # YouGame rejects nested archives; keep the source handoff beside the build.
    old_source_archive = dist / 'opensmash-melee-source.zip'
    if old_source_archive.exists(): old_source_archive.unlink()
    with zipfile.ZipFile(dist.parent / 'OpenSmash-Melee-source.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
        archive.write(ROOT / 'LICENSE', 'LICENSE')
        for source in sorted((ROOT / 'melee').rglob('*')):
            excluded = {'__pycache__', 'media', 'test-results'}
            if source.is_file() and not excluded.intersection(source.relative_to(ROOT / 'melee').parts):
                archive.write(source, source.relative_to(ROOT).as_posix())
        for source in sorted((ROOT / 'controllers').glob('*.mjs')):
            archive.write(source, source.relative_to(ROOT).as_posix())
        for source in sorted((native / 'runtime').rglob('*')):
            if source.is_file() and source.name.lower() in {'license','license.txt','license.md','copying','copying.txt','font-licenses.txt'}:
                archive.write(source, 'upstream-licenses/' + source.relative_to(native / 'runtime').as_posix())
    (dist / 'NOTICE.txt').write_text(
        'OpenSmash Melee\n\n'
        'Browser port sources, build scripts, runtime patch, pinned upstream references, '
        'and bundled dependency license notices accompany this build in OpenSmash-Melee-source.zip.\n'
        'Based on t3dotgg/melee4mac and ExpansionPak/ModernGekko/RecompCore; '
        'see melee/upstreams.json and melee/README.md inside the source archive.\n'
        'Original Melee game data: Nintendo / HAL Laboratory, Inc. '
        'Game-derived build inputs were supplied by the user.\n')
    shutil.copy2(native / 'runtime/LICENSE', dist / 'GPL-3.0.txt')
    run([sys.executable, ROOT / 'yougame/privacy/build_privacy.py', 'scan', dist])
    print(f'Engine transfer: {manifest["transferBytes"]:,} bytes as one HTTP-compressed Wasm resource')
    print(f'Staged {dist}; browser gameplay verification is still required.')

if __name__ == '__main__':
    main()
