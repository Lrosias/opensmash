#!/usr/bin/env python3
"""Zip the verified static build, with index.html at the archive root."""
from pathlib import Path
import hashlib
import json
import zipfile

ROOT = Path(__file__).resolve().parents[2]
BUILD = ROOT / 'build/melee-web'

def main():
    dist = BUILD / 'dist'
    files = sorted(p for p in dist.rglob('*') if p.is_file())
    if not (dist / 'index.html').is_file():
        raise SystemExit('Missing root index.html')
    if len(files) > 5000 or sum(p.stat().st_size for p in files) > 5_000_000_000:
        raise SystemExit('Package exceeds YouGame build limits')
    if any(p.stat().st_size > 100_000_000 for p in files):
        raise SystemExit('An individual file exceeds the upload limit')
    output = BUILD / 'OpenSmash-Melee-Lite-YouGame.zip'
    with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=3) as archive:
        for p in files:
            archive.write(p, p.relative_to(dist).as_posix())
    with zipfile.ZipFile(output) as archive:
        invalid = archive.testzip()
        if invalid:
            raise SystemExit(f'Archive verification failed: {invalid}')
    report = {'archive': output.name, 'sha256': hashlib.sha256(output.read_bytes()).hexdigest(),
              'zipBytes': output.stat().st_size, 'unpackedBytes': sum(p.stat().st_size for p in files),
              'files': len(files), 'largestFileBytes': max(p.stat().st_size for p in files),
              'engine': json.loads((dist / 'engine/wasm.json').read_text())['sha256']}
    (BUILD / 'package-lite.json').write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))

if __name__ == '__main__':
    main()
