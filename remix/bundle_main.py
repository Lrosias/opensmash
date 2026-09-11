"""Bundle the already-built browser edition; include no developer test harness."""
from pathlib import Path
import zipfile,json,hashlib,shutil
from extract_marth import ROOT
out=ROOT/'yougame/dist'
for name in ['roster.json','stages.json']:shutil.copyfile(ROOT/'build/remix/main/assets'/name,out/name)
shutil.copyfile(ROOT/'remix/MAIN.md',out/'Remix-notes.md')
bundle=ROOT/'build/OpenSmash64-Remix.zip'
with zipfile.ZipFile(bundle,'w',zipfile.ZIP_DEFLATED) as z:
 for p in sorted(out.rglob('*')):
  if p.is_file() and p.name not in {'remix-check.html','pair-check.html','sdk-test.mjs'}:z.write(p,p.relative_to(out))
with zipfile.ZipFile(bundle) as z:
 assert z.testzip() is None
 assert 'remix-check.html' not in z.namelist()
 assert len(json.loads(z.read('roster.json')))==34
 assert len(json.loads(z.read('stages.json')))==8
print(bundle,hashlib.sha256(bundle.read_bytes()).hexdigest(),bundle.stat().st_size)
