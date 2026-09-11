"""Prepare a separate Remix release without replacing the base game's listing."""
from pathlib import Path
import shutil, hashlib, json, zipfile
ROOT=Path(__file__).resolve().parents[1]
out=ROOT/'build/remix/publish/dist'
out.mkdir(parents=True,exist_ok=True)
shutil.copytree(ROOT/'yougame/dist',out,dirs_exist_ok=True)
for name in ('remix-check.html','pair-check.html','title-check.html','sdk-test.mjs'):
 (out/name).unlink(missing_ok=True)
shutil.rmtree(out/'gallery',ignore_errors=True)
(out/'gallery').mkdir()
for path in (out/'index.html',out/'app.mjs',out/'engine/index.html'):
 text=path.read_text().replace('OpenSmash64 Remix','OpenSmash64').replace('OpenSmash64','OpenSmash64 Remix')
 path.write_text(text)
for src,name in [('thumbnail.png','thumbnail.png'),('01.png','marth-roy.png'),('02.png','sonic-mewtwo.png'),('03.png','banjo-crash.png'),('demo.mp4','demo.mp4')]:
 shutil.copyfile(ROOT/'remix/media'/src,out/'gallery'/name)
assert len(json.loads((out/'roster.json').read_text()))==34
assert len(json.loads((out/'stages.json').read_text()))==8
files=[]
for p in sorted(out.rglob('*')):
 if not p.is_file(): continue
 relative=p.relative_to(out).as_posix();row={'path':relative,'size':p.stat().st_size}
 if (p.suffix in ('.html','.css','.mjs','.js') or relative=='yougame.json') and relative!='engine/BattleShip.js': row['text']=p.read_text()
 files.append(row)
(out.parent/'check-build.json').write_text(json.dumps({'files':files}))
bundle=out.parent/'OpenSmash64-Remix.zip'
with zipfile.ZipFile(bundle,'w',zipfile.ZIP_DEFLATED) as z:
 for p in sorted(out.rglob('*')):
  if p.is_file():z.write(p,p.relative_to(out))
print(json.dumps({'zip':str(bundle),'sha256':hashlib.sha256(bundle.read_bytes()).hexdigest(),'files':len(files),'bytes':bundle.stat().st_size}))
