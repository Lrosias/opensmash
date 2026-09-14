"""Recover multiplayer entry mappings and menu events from the pinned local ROM.

Character.asm's get_entry_action_ patch supplies the relocated entry table.
Animation assets already belong to the roster archive; this adds no asset bytes.
"""
import hashlib
import json
import struct
from pathlib import Path

from extract_marth import ROOT, SHA256
from extract_roster import offset, script


def entry_table(data):
    upper, lower = (struct.unpack_from('>I', data, p)[0] for p in (0xB8664, 0xB86A4))
    if upper & 0xFFFF0000 != 0x3C0D0000 or lower & 0xFFFF0000 != 0x8DAD0000:
        raise ValueError('Unexpected entry table instructions')
    signed = (lower & 0x7FFF) - (lower & 0x8000)
    return offset(((upper & 0xFFFF) << 16) + signed)


def extract_presentation(rom_path, out=None):
    out = Path(out or ROOT / 'build/remix/main/assets')
    data = Path(rom_path).read_bytes()
    if hashlib.sha256(data).hexdigest() != SHA256:
        raise ValueError('Presentation requires the pinned Smash Remix 2.0.1 ROM')
    source = json.loads((out / 'extraction.json').read_text())
    table = entry_table(data)
    lines, bindings, entries, report = [], [], [], []
    for fighter in source['fighters']:
        fid = fighter['id']
        if fid < 29 and fid != 8:
            continue
        row = dict(id=fid, menu_scripts={}, entries=[])
        if fid >= 29:
            actions = struct.unpack_from('>II', data, table + fid * 8)
            motions = [action - 25 for action in actions]
            for motion in motions:
                if not 0 <= motion < len(fighter['main_motion_descriptors']):
                    raise ValueError(f'Invalid entry motion for {fid}')
                if not fighter['main_motion_descriptors'][motion][0]:
                    raise ValueError(f'Missing entry animation for {fid}')
            entries.append(f'case {fid}: return side ? {motions[1]} : {motions[0]};')
            row['entries'] = motions
        # Idle, three victories, selection and defeat. Preserve relative events
        # in their asset; translate absolute ROM pointers into native heap scripts.
        for motion, (asset, address, flags) in enumerate(fighter['sub_motion_descriptors'][:6]):
            if not asset or address <= 0x100000 or address == 0x80000000:
                continue
            fixups = []
            words, omissions = script(data, address, fixups)
            name = f'presentation_{fid}_{motion}'
            lines.append(f'static u32 {name}[]={{' + ','.join(f'0x{w:08x}' for w in words) + '};')
            bindings.append(f'if(f->id=={fid}){{u32 *p=malloc(sizeof({name}));if(!p)abort();memcpy(p,{name},sizeof({name}));f->sub[{motion}].offset=(intptr_t)p;')
            bindings.extend(f'p[{slot}]=PORT_REGISTER(p+{target});' for slot, target in fixups)
            bindings.append('}')
            row['menu_scripts'][motion] = dict(rom_address=address, words=words, branch_relocations=fixups, omitted_events=omissions)
        report.append(row)
    lines += ['static int remix_entry_motion(int id,int side){switch(id){', *entries, 'default:return -1;}}',
              'static void remix_presentation_bind(RemixFighter *f){', *bindings, '}']
    (out / 'presentation_data.h').write_text('\n'.join(lines) + '\n')
    (out / 'presentation-extraction.json').write_text(json.dumps(dict(source_sha256=SHA256, entry_table_rom_offset=table, fighters=report), indent=2) + '\n')
    print(f'Presentation: {len(entries)} entry pairs, {sum(len(r["menu_scripts"]) for r in report)} menu scripts')


if __name__ == '__main__':
    import sys
    extract_presentation(sys.argv[1])
