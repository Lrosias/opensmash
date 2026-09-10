"""Read the pinned ROM's unique jab descriptors; bind audited native routines."""
import hashlib,json,struct,sys
from pathlib import Path
from extract_marth import ROOT,SHA256
from extract_roster import offset

def extract_normals(path):
 b=Path(path).read_bytes();assert hashlib.sha256(b).hexdigest()==SHA256
 u=lambda p:struct.unpack_from('>I',b,p)[0]
 functions={0:'NULL',0x800d94c4:'ftAnimEndSetWait',0x8014e8b4:'ftCommonAttack13ProcUpdate',0x8014e9e4:'ftCommonAttack13ProcInterrupt',0x8014f0d0:'ftCommonAttack100StartProcUpdate',0x8014f2a8:'ftCommonAttack100LoopProcUpdate',0x8014f388:'ftCommonAttack100LoopProcInterrupt',0x8014fe40:'ftCommonAttackS4ProcUpdate',0x800d8bb4:'ftPhysicsApplyGroundVelFriction',0x800d8c14:'ftPhysicsApplyGroundVelTransN',0x800d8ccc:'ftPhysicsApplyGroundFrictionOrTransN',0x800ddf44:'mpCommonSetFighterFallOnEdgeBreak'}
 out=ROOT/'build/remix/main/assets';fighters=json.loads((out/'extraction.json').read_text())['fighters'];rows=[]
 for f in fighters:
  if f['id']<29:continue
  table=offset(u(offset(0x804a05d0)+4*f['id']))
  for i in range(63):
   words=struct.unpack_from('>5I',b,table+i*20);flags=words[0];motion=flags>>22;attack=flags>>16&63
   if motion<195:break
   if attack not in (3,4) or not 195<=motion<len(f['main_motion_descriptors']) or words[1] not in [0x800d94c4,0x8014e8b4,0x8014f0d0,0x8014f2a8,0x8014fe40]:continue
   assert all(p in functions for p in words[1:]),(f['id'],i,words)
   rows.append(dict(fighter=f['id'],action=i+220,motion=motion,attack=attack,flags=flags&65535,routines=[functions[p] for p in words[1:]],rom_offset=table+i*20))
 lines=['typedef struct {int fighter,action,motion,attack,flags;void (*update)(GObj*),(*interrupt)(GObj*),(*physics)(GObj*),(*map)(GObj*);} RemixNormal;', 'static const RemixNormal remix_normals[]={']
 for r in rows:lines.append('{'+','.join(str(r[k]) for k in ['fighter','action','motion','attack','flags'])+','+','.join(r['routines'])+'},')
 lines.append('};');(out/'normal_data.h').write_text('\n'.join(lines)+'\n');(out/'normal-extraction.json').write_text(json.dumps(rows,indent=2)+'\n');print('Imported',len(rows),'audited native jab descriptors')
if __name__=='__main__':extract_normals(sys.argv[1])
