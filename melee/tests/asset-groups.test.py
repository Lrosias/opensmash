"""Validate stage music dependencies against the supplied GALE01r2 archives."""
import json,re,struct,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from asset_groups import ROOT,STAGES,FIGHTERS,build
class CatalogTests(unittest.TestCase):
 def test_unlocked_stage_prefetch(self):
  catalog=build({'files':[]})
  self.assertEqual(set(catalog['competitive']),{'stage:'+str(i) for i in [2,3,8,28,31,32]})
  stages=[key for key in catalog['plan'] if key.startswith('stage:')]
  self.assertEqual(len(stages),len(set(stages)))
  self.assertEqual(set(stages),{'stage:'+str(i) for i,_,_,_ in STAGES if i!=26})
 def test_all_stage_music_variants(self):
  manifest=json.loads((ROOT/'build/melee-web/dist/assets-manifest.json').read_text());catalog=build(manifest)
  source=(ROOT/'build/melee4mac/src/melee/lb/lbaudio_ax.static.h').read_text().split('static const char* hps_files[] = {')[1].split('};')[0]
  songs=re.findall(r'"([^"]+)"',source)
  for sid,name,prefix,_ in STAGES:
   d=(ROOT/f'build/melee4mac/build/native/recomp/private/GALE01r2/files/Gr{prefix}.dat').read_bytes()
   _,data_size,relocations,roots,refs=struct.unpack_from('>5I',d)
   root_start=32+data_size+4*relocations;strings=root_start+8*(roots+refs)
   for i in range(roots):
    pointer,label=struct.unpack_from('>2I',d,root_start+8*i)
    if d[strings+label:].split(b'\0')[0]!=b'grGroundParam':continue
    rows,count=struct.unpack_from('>2I',d,32+pointer+0xb0)
    for j in range(count):
     stage,*ids=struct.unpack_from('>5i',d,32+rows+j*0x64)
     if stage!=sid:continue
     blocks=set(catalog['groups']['stage:'+str(sid)]['blocks'])
     for song in {songs[v] for v in ids if 0<=v<len(songs)}:
      file=next(f for f in manifest['files'] if f['path']=='files/audio/'+song)
      self.assertTrue(set(range(file['first'],file['first']+file['blocks']))<=blocks,(name,song))
 def test_roster_and_transform_dependencies(self):
  m=json.loads((ROOT/'build/melee-web/dist/assets-manifest.json').read_text());c=build(m)
  self.assertEqual(len(FIGHTERS),26)
  self.assertEqual(set(c['groups']['fighter:18']['blocks']),set(c['groups']['fighter:19']['blocks']))
  for f in m['files']:
   if Path(f['path']).name.startswith(('PlNn','PlPp')):self.assertIn(f['first'],c['groups']['fighter:14']['blocks'])
   if Path(f['path']).name.startswith(('PlKb','EfKb')):self.assertIn(f['first'],c['groups']['fighter:4']['blocks'])
if __name__=='__main__':unittest.main()
