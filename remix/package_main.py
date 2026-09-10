"""Stage the Remix asset archive with the main engine, without altering base assets."""
from pathlib import Path
import shutil,json,hashlib,os
from extract_marth import ROOT
out=ROOT/'build/remix/main/engine';out.mkdir(parents=True,exist_ok=True)
base=ROOT/'BattleShip/web-dist'
for name in ['manifest.json','files']:
 src=base/name;dst=out/name
 if src.is_dir():shutil.copytree(src,dst,dirs_exist_ok=True)
 else:shutil.copyfile(src,dst)
for name in ['BattleShip.js','BattleShip.wasm']:shutil.copyfile(ROOT/'BattleShip'/os.environ.get('YOUGAME_BUILD_DIR','build-wasm')/name,out/name)
shutil.copyfile(ROOT/'build/remix/main/assets/BattleShip.o2r',out/'files/BattleShip.o2r')
for name in ['roster.json','stages.json']:shutil.copyfile(ROOT/'build/remix/main/assets'/name,out/name)
shutil.copyfile(ROOT/'remix/MAIN.md',out/'Remix-notes.md')
p=out/'manifest.json';m=json.loads(p.read_text());m['remix']=True
for f in m['files']:
 if f['path']=='/BattleShip.o2r':
  b=(out/'files/BattleShip.o2r').read_bytes();f['size']=len(b)
  if 'sha256' in f:f['sha256']=hashlib.sha256(b).hexdigest()
for src in sorted((ROOT/'build/remix/main/assets/voices').glob('*.wav')):
 dst=out/'files/assets/remix/voices'/src.name;dst.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(src,dst)
 m['files'].append(dict(path='/assets/remix/voices/'+src.name,url='files/assets/remix/voices/'+src.name,size=src.stat().st_size))
p.write_text(json.dumps(m,indent=2)+'\n')
