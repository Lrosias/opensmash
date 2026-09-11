#!/usr/bin/env python3
"""Stage extracted Melee assets as bounded static files and generate a WasmFS manifest."""
from pathlib import Path
import hashlib
import json
import zlib

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'build/melee4mac/build/native/recomp/private/GALE01r2'
OUT = ROOT / 'build/melee-web/dist/assets'
HEADER = ROOT / 'build/melee-web/generated/asset_manifest.inc'
BLOCK = 4 * 1024 * 1024

def main():
    dol = SOURCE / 'sys/main.dol'
    if hashlib.sha1(dol.read_bytes()).hexdigest() != '08e0bf20134dfcb260699671004527b2d6bb1a45':
        raise SystemExit('Expected the verified GALE01 revision 2 executable.')
    OUT.mkdir(parents=True, exist_ok=True)
    HEADER.parent.mkdir(parents=True, exist_ok=True)
    files = []
    blocks = []
    omitted = []
    for path in sorted(SOURCE.rglob('*')):
        if not path.is_file():
            continue
        if path.suffix.lower() == '.mth':
            omitted.append({'path':path.relative_to(SOURCE).as_posix(),'size':path.stat().st_size})
            continue
        first = len(blocks)
        digest = hashlib.sha256()
        with path.open('rb') as source:
            while data := source.read(BLOCK):
                name = f'{len(blocks):05d}.bin'
                target = OUT / name
                encoded = zlib.compress(data, level=9)
                block_hash = hashlib.sha256(encoded).hexdigest()
                if not target.exists() or hashlib.sha256(target.read_bytes()).hexdigest() != block_hash:
                    target.write_bytes(encoded)
                digest.update(data)
                blocks.append({'path': f'assets/{name}', 'size': len(encoded), 'decodedSize':len(data), 'sha256': block_hash})
        files.append({'path': path.relative_to(SOURCE).as_posix(), 'size': path.stat().st_size,
                      'first': first, 'blocks': len(blocks) - first, 'sha256': digest.hexdigest()})
    keep = {Path(b['path']).name for b in blocks}
    for old in OUT.glob('*.bin'):
        if old.name not in keep: old.unlink()
    manifest = {'codec':'zlib','blockSize': BLOCK, 'files': files, 'blocks': blocks,
                'omittedMovies':omitted}
    (OUT.parent / 'assets-manifest.json').write_text(json.dumps(manifest, separators=(',', ':')))
    HEADER.write_text('static constexpr AssetEntry assets[] = {\n' + ''.join(
        f'  {{{json.dumps(f["path"])}, {f["size"]}ULL, {f["first"]}}},\n' for f in files) + '};\n')
    print(f'{len(files)} game files → {len(blocks)} static blocks, {sum(f["size"] for f in files):,} bytes')
    print(f'Excluded {len(omitted)} unreachable movies: {sum(f["size"] for f in omitted):,} bytes')
    print(f'Compressed asset transfer: {sum(b["size"] for b in blocks):,} bytes')

if __name__ == '__main__':
    main()
