"""Stage pinned Melee app/native files over an immutable released distribution.

Local filesystem only. No upload/build/asset regeneration. The output directory
must be new; the verification manifest is kept outside the game directory.
"""
import argparse
import gzip
import hashlib
import json
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[2]
RUNTIME = ('app.mjs', 'competitive-ui.mjs', 'native-launch.mjs',
           'native-match-host.mjs', 'native-match.mjs',
           'native-room-session.mjs', 'rollback-engine.mjs')
ENGINE = ('melee.js', 'melee.wasm.gz', 'wasm.json')


def stream_hash(stream):
    digest = hashlib.sha256()
    size = 0
    for data in iter(lambda: stream.read(4 * 1024 * 1024), b''):
        digest.update(data)
        size += len(data)
    return digest.hexdigest(), size


def file_info(file):
    with file.open('rb') as stream:
        digest, size = stream_hash(stream)
    return {'sha256': digest, 'size': size}


def inventory(directory):
    result = {}
    for file in sorted(directory.rglob('*')):
        if file.is_symlink():
            raise ValueError('Unexpected symlink: ' + str(file))
        if file.is_file():
            result[file.relative_to(directory).as_posix()] = file_info(file)
    return result


def tree_hash(files):
    digest = hashlib.sha256()
    for name, info in sorted(files.items()):
        digest.update((name + '\0' + info['sha256'] + '\0' + str(info['size']) + '\n').encode())
    return digest.hexdigest()


def require(condition, message):
    if not condition:
        raise ValueError(message)


def stage(config, destination, check_only=False):
    require(destination.is_absolute(), 'Supply an absolute output directory')
    require(not destination.exists(), 'Output already exists; choose a new directory')
    base, candidate, package = (Path(config[key]) for key in ('release', 'candidate', 'enginePackage'))
    require(all(p.is_absolute() and p.is_dir() for p in (base, candidate, package)), 'Invalid input directories')
    baseline = inventory(base)
    require(tree_hash(baseline) == config['releaseTreeSha256'], 'Released asset tree changed')
    require(file_info(candidate / 'melee.wasm')['sha256'] == config['wasmSha256'], 'Native candidate changed')
    require(file_info(candidate / 'melee.js')['sha256'] == config['jsSha256'], 'Native JavaScript changed')
    require(file_info(package / 'melee.js') == file_info(candidate / 'melee.js'), 'QA JavaScript differs from native candidate')
    for name in ENGINE:
        require(file_info(package / name)['sha256'] == config['enginePackagePins'][name], 'Pinned engine package changed: ' + name)
    manifest = json.loads((package / 'wasm.json').read_text())
    require(manifest.get('codec') == 'http-gzip' and manifest.get('path') == 'melee.wasm.gz', 'Expected existing HTTP gzip loader format')
    require(manifest.get('sha256') == config['wasmSha256'], 'Loader references another engine')
    require(manifest.get('transferBytes') == (package / 'melee.wasm.gz').stat().st_size, 'Compressed engine size mismatch')
    with gzip.open(package / 'melee.wasm.gz', 'rb') as stream:
        decoded_hash, decoded_size = stream_hash(stream)
    require(decoded_hash == config['wasmSha256'] and decoded_size == manifest.get('decodedBytes'), 'Compressed engine does not decode to the pinned candidate')
    # Reuse the engine agent's deterministic mtime=0, level-9 gzip package. The
    # released loader uses HTTP Content-Encoding, with no Brotli sidecars.
    require(not any(name.startswith('engine/') and name.endswith('.br') for name in baseline), 'Unexpected Brotli package; review before staging')
    source_commit = subprocess.check_output(['git', 'rev-parse', config['sourceCommit']], cwd=ROOT, text=True).strip()
    require(source_commit == config['sourceCommit'], 'Pin the complete source commit')
    overlays = {}
    for name in RUNTIME:
        data = subprocess.check_output(['git', 'show', source_commit + ':melee/src/' + name], cwd=ROOT)
        require(data == (ROOT / 'melee/src' / name).read_bytes(), 'Runtime checkout differs from reviewed source: ' + name)
        overlays[name] = data.replace(b'../../controllers/', b'./controllers/')
    provenance = candidate.parent / 'provenance.json'
    native_provenance = json.loads(provenance.read_text())
    require(native_provenance.get('candidate') == config['wasmSha256'], 'Native provenance disagrees with pinned candidate')
    proof = {'scope': 'Local immutable staging only; native/hosted runtime qualification is separate',
             'sourceCommit': source_commit, 'engineSourceCommit': native_provenance.get('sourceCommit'),
             'release': str(base), 'releaseTreeSha256': tree_hash(baseline),
             'candidate': str(candidate), 'enginePackage': str(package),
             'nativeProvenance': {'path': str(provenance), **file_info(provenance)},
             'loader': manifest, 'compression': 'Existing HTTP gzip package; no Brotli sidecars',
             'runtimePaths': list(RUNTIME)}
    if check_only:
        return proof
    game = destination / 'melee'
    destination.mkdir(parents=True, exist_ok=False)
    shutil.copytree(base, game)
    for name, data in overlays.items():
        (game / name).write_bytes(data)
    for name in ENGINE:
        shutil.copyfile(package / name, game / 'engine' / name)
    staged = inventory(game)
    require(not (baseline.keys() - staged.keys()), 'Staging removed released assets')
    changes = [{'path': name, **info} for name, info in staged.items() if baseline.get(name) != info]
    allowed = set(RUNTIME) | {'engine/' + name for name in ENGINE}
    require(all(item['path'] in allowed for item in changes), 'Unrelated released asset changed')
    require(inventory(base) == baseline, 'Released assets changed during staging')
    proof.update({'directory': str(game), 'treeSha256': tree_hash(staged), 'fileCount': len(staged),
                  'unchangedFileCount': len(staged) - len(changes), 'changed': changes})
    (destination / 'manifest.json').write_text(json.dumps(proof, indent=2) + '\n')
    return proof


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('config', type=Path)
    parser.add_argument('destination', type=Path)
    parser.add_argument('--check', action='store_true', help='Verify all inputs without creating a stage')
    args = parser.parse_args()
    print(json.dumps(stage(json.loads(args.config.read_text()), args.destination, args.check), indent=2))
