"""Check Conker's installed special descriptors against the pinned ROM table.

Usage: python3 verify_conker_actions.py ROM SOURCE
Rejects both out-of-range motion indices and in-range but incorrect mappings.
"""
from pathlib import Path
import hashlib,json,re,struct,sys

ROM_SHA256='7efec9e0983656bb0219a23c511cd1505a5f84d524e50ad4284dc1c7eb4d1403'
def verify(rom,source):
    assert hashlib.sha256(rom).hexdigest()==ROM_SHA256, 'Unexpected ROM revision'
    def offset(address):
        if 0x80400000<=address<0x80800000:return address-0x80000000+0x2800000
        if 0x80390000<=address<0x803a0000:return address-0x80288a20
        raise AssertionError(f'Unexpected ROM address {address:#x}')
    def u(at):return struct.unpack_from('>I',rom,at)[0]
    record=offset(u(0x92610+56*4))
    motion_count=u(record+27*4)
    table=offset(u(offset(0x804a05d0)+56*4))
    def array(name):
        match=re.search(r'\bint '+name+r'\[\]\s*=\s*\{([^}]+)\}',source)
        assert match, f'Missing explicit {name} descriptor mapping'
        return [int(x.strip(),0) for x in match[1].split(',')]
    actions,motions=array('actions'),array('motions')
    assert len(actions)==len(motions)==13 and len(set(actions))==13
    assert 's->mflags.motion_id=motions[i];' in source
    rows=[]
    for action,motion in zip(actions,motions):
        assert 0<=motion<motion_count, f'Action {action}: motion {motion} exceeds {motion_count} entries'
        at=table+(action-220)*20;expected=u(at)>>22
        assert motion==expected, f'Action {action}: {motion} differs from ROM {expected}'
        rows.append(dict(action=action,motion=motion,rom_offset=at))
    return dict(rom_sha256=ROM_SHA256,motion_count=motion_count,actions=rows)

if __name__=='__main__':
    print(json.dumps(verify(Path(sys.argv[1]).read_bytes(),Path(sys.argv[2]).read_text()),indent=2))
