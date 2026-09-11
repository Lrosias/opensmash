"""Validate the complete curated archive against its extraction records."""
from pathlib import Path
import json,hashlib,struct,zipfile
from extract_marth import ROOT
p=ROOT/'build/remix/main/assets'
fighters=json.loads((p/'extraction.json').read_text());stages=json.loads((p/'stage-extraction.json').read_text())
menus=json.loads((p/'menu-extraction.json').read_text())
rows=[('menu',r) for r in menus['assets']]+[('roster',r) for r in fighters['assets']]+[('stages',r) for r in stages['assets']]
bounds={r['id']:r['size'] for _,r in rows};refs=0
with zipfile.ZipFile(p/'BattleShip.o2r') as z:
 assert z.testzip() is None
 for namespace,info in rows:
  fid=info['id'];data=z.read(f'remix/{namespace}/{fid+0x4000}');mapped,intern,extern,count=struct.unpack_from('<IHHI',data,64)
  deps=struct.unpack_from('<'+'H'*count,data,76);size=struct.unpack_from('<I',data,76+count*2)[0];raw=data[80+count*2:]
  assert mapped==fid+0x4000 and list(deps)==[d+0x4000 for d in info['deps']]
  assert len(raw)==size==info['size'] and hashlib.sha256(raw).hexdigest()==info['sha256']
  for head,external in [(intern,False),(extern,True)]:
   seen=set();index=0
   while head!=0xffff:
    assert head not in seen and head*4+4<=size;seen.add(head)
    head,target=struct.unpack_from('>HH',raw,head*4)
    assert target*4< (bounds[info['deps'][index]] if external else size)
    index+=1;refs+=1
   if external:assert index==count
assert len(fighters['fighters'])==34 and len(stages['stages'])==8
assert all(not f['unsupported_normal_attacks'] for f in fighters['fighters'])
print(f'PASS: 34 fighters, 8 stages, {len(rows)} asset hashes, {refs} bounded relocations')
