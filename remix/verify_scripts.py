#!/usr/bin/env python3
"""Statically walk all normal scripts, including original relocated branches."""
import json,struct,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
report=json.loads((ROOT/'build/remix/assets/extraction.json').read_text())
files={f['id']:f for f in report['assets']};raws={};links={}
sizes={3:5,4:5,7:2,12:2,13:2,31:4,34:2,36:2,38:4,39:4,46:2}
with zipfile.ZipFile(ROOT/'build/remix/assets/BattleShip.o2r') as z:
    for fid,f in files.items():
        data=z.read(f'remix/roster/{fid+0x4000}')[80+2*len(f['deps']):]
        raws[fid]=data;mapping={}
        for label in ['intern','extern']:
            head=f[label];index=0
            while head!=0xffff:
                loc=head*4;head,target=struct.unpack_from('>HH',data,loc)
                mapping[loc]=(f['deps'][index] if label=='extern' else fid,target*4);index+=1
        links[fid]=mapping

def check_event(word):
    op=word>>26
    assert op<=51,f'Untranslated opcode {op}'
    if op in (3,4,7,8,9,10):assert (word>>23&7)<4,'Invalid hitbox slot'
    if op in (5,11):assert (word&0x3ffffff)<4,'Invalid hitbox slot'
    return sizes.get(op,1)

translated=relative=events=0
for fighter in report['fighters']:
    for script in fighter['normal_attack_scripts'].values():
        words=script['words'];at=0
        while at<len(words):
            n=check_event(words[at]);assert at+n<=len(words);events+=1;at+=n
        translated+=1
    for idx in fighter['relative_normal_attacks']:
        _,start,flags=fighter['main_motion_descriptors'][idx]
        fid=fighter['file_ids'][2 if flags&0x10 else 1]
        pending=[(fid,start)];seen=set()
        while pending:
            fid,at=pending.pop()
            while (fid,at) not in seen:
                seen.add((fid,at));data=raws[fid]
                assert at+4<=len(data),(fighter['name'],idx,fid,at)
                word=struct.unpack_from('>I',data,at)[0];op=word>>26;n=check_event(word)
                assert at+n*4<=len(data);events+=1
                if op in (34,36,46):
                    assert at+4 in links[fid],(fighter['name'],idx,'unrelocated branch',fid,at)
                    pending.append(links[fid][at+4])
                if op in (0,35,36):break
                at+=n*4
        relative+=1
print(f'PASS: {translated} translated and {relative} relocated normal scripts; {events} bounded events and valid hitbox slots.')
