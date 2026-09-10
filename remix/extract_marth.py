#!/usr/bin/env python3
"""Extract Marth from the user's Smash Remix 2.0.1 ROM, entirely offline.

Outputs are local build artifacts; this script contains no ROM asset bytes.
"""
import argparse
import ctypes
import hashlib
import json
from pathlib import Path
import struct
import subprocess
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[1]
SHA256 = '7efec9e0983656bb0219a23c511cd1505a5f84d524e50ad4284dc1c7eb4d1403'
TABLE, DATA, COUNT, BASE = 0x1AC870, 0x1BC830, 5455, 0x4000
MARTH_DATA = 0x2CBE960
NORMAL_ATTACKS = (165,166,167,170,174,176,179,182,183,184,185,186,187,188)


def normal_script(data, address):
    """Translate the inspected, straight-line normal attacks.

    Preserve original timing, sword hitboxes, damage, knockback and flags.
    Omit cosmetic/voice/sword-trail events and Remix extensions whose engine
    handlers are not ported. Reject unexpected instructions rather than
    interpreting arbitrary machine code as motion bytecode.
    """
    sizes = {3:5,4:5,7:2,38:4,39:4}
    keep = {0,1,2,3,4,5,6,7,8,9,10,11,19,21,22,23,24,47}
    omitted = {14,17,20,38,39,43,51}
    known_extensions = {0xd801035f,0xda000000,0xd0004000}
    at = rom_offset(address)
    words, omissions = [], []
    for _ in range(128):
        word = struct.unpack_from('>I', data, at)[0]
        op = word >> 26
        n = sizes.get(op, 1)
        event = struct.unpack_from('>' + 'I' * n, data, at)
        if op in keep:
            words.extend(event)
        elif op in omitted or word in known_extensions:
            omissions.append(dict(rom_offset=at, opcode=op, words=event))
        else:
            raise ValueError(f'Unrecognized attack event {word:#x} at {at:#x}')
        at += n * 4
        if op == 0:
            return words, omissions
    raise ValueError('Unterminated attack script')


def rom_offset(address):
    if 0x80400000 <= address < 0x80800000:
        return address - 0x80400000 + 0x2C00000
    raise ValueError(f'Unmapped ROM RAM address {address:#x}')


class Rom:
    def __init__(self, path, library):
        self.data = path.read_bytes()
        if hashlib.sha256(self.data).hexdigest() != SHA256:
            raise ValueError('This extractor supports only the inspected Smash Remix 2.0.1 ROM (SHA-256 mismatch).')
        self.lib = ctypes.CDLL(str(library))
        self.lib.vpk0_decode.argtypes = [ctypes.c_void_p, ctypes.c_size_t, ctypes.c_void_p, ctypes.c_size_t]
        self.lib.vpk0_decode.restype = ctypes.c_uint32
        self.files = {}

    def file(self, fid):
        if fid in self.files:
            return self.files[fid]
        if not 0 <= fid < COUNT:
            raise ValueError(f'Invalid asset id {fid}')
        first, intern, packed, extern, size = struct.unpack_from('>I4H', self.data, TABLE + 12 * fid)
        start = DATA + (first & 0x7fffffff)
        end = DATA + (struct.unpack_from('>I', self.data, TABLE + 12 * (fid + 1))[0] & 0x7fffffff)
        raw = self.data[start:start + packed * 4]
        if first >> 31:
            # The roster includes one VPK payload whose byte count exceeds
            # the directory's word-truncated size by one. Honor the bounded
            # payload header, then restore four-byte engine alignment.
            decoded_size = struct.unpack_from('>I', raw, 4)[0]
            if abs(decoded_size - size * 4) > 3:
                raise ValueError(f'Asset {fid}: inconsistent VPK size')
            dst = ctypes.create_string_buffer(max(size * 4, decoded_size))
            count = self.lib.vpk0_decode(raw, len(raw), dst, len(dst))
            if count != decoded_size:
                raise ValueError(f'Asset {fid}: decoded {count}, expected {size * 4}')
            raw = dst.raw
            raw += bytes((-len(raw)) % 4)
        if not size * 4 <= len(raw) <= size * 4 + 4:
            raise ValueError(f'Asset {fid}: wrong size')
        deps_raw = self.data[start + packed * 4:end]
        deps = list(struct.unpack('>' + 'H' * (len(deps_raw) // 2), deps_raw))
        # There can be alignment padding after the external IDs. Walk the
        # actual relocation chain to determine exactly how many are used.
        def chain(head):
            seen = set()
            while head != 0xffff:
                if head in seen or head * 4 + 4 > len(raw):
                    raise ValueError(f'Asset {fid}: malformed relocation chain')
                seen.add(head)
                head, target = struct.unpack_from('>HH', raw, head * 4)
            return len(seen)
        chain(intern)
        extern_count = chain(extern)
        if len(deps) < extern_count:
            raise ValueError(f'Asset {fid}: missing external dependency IDs')
        deps = deps[:extern_count]
        result = dict(id=fid, rom_offset=start, intern=intern, extern=extern, deps=deps, raw=raw)
        self.files[fid] = result
        for dep in deps:
            self.file(dep)
        return result


def extract(rom, out, archive):
    b = rom.data
    record = struct.unpack_from('>30I', b, MARTH_DATA)
    assert record[0] == 3274 and record[3] == 3275
    main = [struct.unpack_from('>3I', b, rom_offset(record[25]) + 12 * i) for i in range(record[27])]
    sub_count = struct.unpack_from('>I', b, rom_offset(record[28]))[0]
    sub = [struct.unpack_from('>3I', b, rom_offset(record[26]) + 12 * i) for i in range(sub_count)]
    # The shield-pose flag makes anim_file_id a pose number, not a file ID.
    animations = {row[0] for row in main + sub if row[0] and not row[2] & 2}
    for fid in set(record[:9]) | animations:
        if fid:
            rom.file(fid)
    out.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(archive) as src:
        sample = next(n for n in src.namelist() if n.startswith('reloc_fighters_main/'))
        header = src.read(sample)[:64]
        with zipfile.ZipFile(out / 'BattleShip.o2r', 'w', zipfile.ZIP_DEFLATED) as dst:
            for name in src.namelist():
                dst.writestr(name, src.read(name))
            for fid, f in sorted(rom.files.items()):
                payload = struct.pack('<IHHI', BASE + fid, f['intern'], f['extern'], len(f['deps']))
                payload += struct.pack('<' + 'H' * len(f['deps']), *(BASE + d for d in f['deps']))
                payload += struct.pack('<I', len(f['raw'])) + f['raw']
                dst.writestr(f'remix/marth/{BASE + fid}', header + payload)
    rows, scripts = [], {}
    for i in NORMAL_ATTACKS:
        words, omissions = normal_script(b, main[i][1])
        scripts[i] = dict(rom_address=main[i][1], words=words, omitted_events=omissions)
        rows.append(f'static u32 marth_attack_{i}[] = {{' + ','.join(f'0x{w:08x}' for w in words) + '};')
    for name, descs in [('main', main), ('sub', sub)]:
        rows.append(f'static FTMotionDesc marth_{name}[] = {{')
        for fid, offset, flags in descs:
            mapped = BASE + fid if fid and not flags & 2 else fid
            # Vanilla relative scripts still use the extracted parent motion
            # file. Absolute Remix scripts require an explicit translation.
            script_offset = offset if offset < 0x100000 else 0x80000000
            rows.append(f'    {{{mapped}, 0x{script_offset:08x}, {{0x{flags:08x}}}}}, /* ROM script {offset:#x} */')
        rows.append('};')
    rows.append('static const unsigned int marth_file_ids[9] = {' + ','.join(str(BASE + x if x else 0) for x in record[:9]) + '};')
    rows.append(f'#define MARTH_ATTRIBUTES_OFFSET {record[24]}')
    rows.append('static int marth_animation_file(unsigned int id) { switch(id) {')
    rows.extend(f'case {BASE + fid}:' for fid in sorted(animations))
    rows.append('return 1; default: return 0; }}')
    rows.append('static const char *marth_asset_path(unsigned int id) { switch(id) {')
    rows.extend(f'case {BASE + fid}: return "remix/marth/{BASE + fid}";' for fid in sorted(rom.files))
    rows.append('default: return 0; }}')
    rows.append('static void marth_bind_scripts(void) {')
    # The engine distinguishes native script pointers from reloc-file offsets
    # at 1 MiB. Wasm static data may live below that boundary; heap storage
    # provides an unambiguous native pointer on both Wasm and desktop.
    for i in NORMAL_ATTACKS:
        rows.append(f'void *p{i} = malloc(sizeof(marth_attack_{i}));')
        rows.append(f'if (!p{i}) abort();')
        rows.append(f'memcpy(p{i}, marth_attack_{i}, sizeof(marth_attack_{i}));')
        rows.append(f'marth_main[{i}].offset = (intptr_t)p{i};')
    rows.append('}')
    (out / 'marth_data.h').write_text('\n'.join(rows) + '\n')
    report = dict(source_sha256=SHA256, version='2.0.1', character='Marth',
                  record_rom_offset=MARTH_DATA, model_file_id=3275, main_file_id=3274,
                  main_motion_descriptors=main, sub_motion_descriptors=sub,
                  assets=[{k: v for k, v in f.items() if k != 'raw'} | {'size': len(f['raw']), 'sha256': hashlib.sha256(f['raw']).hexdigest()} for f in rom.files.values()],
                  normal_attack_scripts=scripts,
                  limitations=['14 normal attacks translated; custom specials, voices and cosmetic motion events are not ported.'])
    (out / 'extraction.json').write_text(json.dumps(report, indent=2) + '\n')
    print(f'Extracted {len(rom.files)} assets, {len(animations)} animation files, {len(main)} main descriptors into {out}')


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('rom', type=Path)
    ap.add_argument('--out', type=Path, default=ROOT / 'build/marth/assets')
    ap.add_argument('--archive', type=Path, default=ROOT / 'BattleShip/web-dist/files/BattleShip.o2r')
    args = ap.parse_args()
    with tempfile.TemporaryDirectory(prefix='marth-vpk-') as tmp:
        lib = Path(tmp) / 'vpk0.dylib'
        subprocess.run(['cc', '-shared', '-fPIC', '-O2', str(ROOT / 'BattleShip/torch/lib/libvpk0/vpk0.c'), '-o', str(lib)], check=True)
        extract(Rom(args.rom, lib), args.out, args.archive)


if __name__ == '__main__':
    main()
