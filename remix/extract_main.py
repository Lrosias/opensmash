"""Build the curated main distribution from the locally supplied 2.0.1 ROM."""
import sys,json,struct,zipfile,hashlib,subprocess,tempfile
from pathlib import Path
from extract_marth import Rom,ROOT,BASE
from extract_roster import extract,normalize_relocations
IDS=list(range(12))+[29,30,31,32,33,52,55,56,57,58,59,62,63,64,65,68,73,72,34,38,74,75]
STAGES=[(6,'Dream Land',None,6),(16,'Final Destination',None,16),(9,'Frays Stage',0x898,0x37),(10,'First Destination',0x877,0x2a),(11,'Pokemon Stadium',0x880,0x2d),(12,'Pokemon Stadium II',0xe69,0xa4),(13,'Goomba Road',0xa4c,0x6f),(14,'Battlefield',0x871,0x31)]
out=ROOT/'build/remix/main/assets'
if __name__=='__main__':
 with tempfile.TemporaryDirectory() as tmp:
  lib=Path(tmp)/'vpk.dylib';subprocess.run(['cc','-shared','-fPIC','-O2',str(ROOT/'BattleShip/torch/lib/libvpk0/vpk0.c'),'-o',str(lib)],check=True)
  rom=Rom(Path(sys.argv[1]),lib);extract(rom,out,IDS)
  stage_rom=Rom(Path(sys.argv[1]),lib)
  for _,_,fid,_ in STAGES:
   if fid:stage_rom.file(fid)
  normalize_relocations(stage_rom)
  lines=['static const char *remix_stage_asset_path(unsigned int id){switch(id){']
  with zipfile.ZipFile(out/'BattleShip.o2r','a',zipfile.ZIP_DEFLATED) as z:
   header=z.read(next(n for n in z.namelist() if n.startswith('reloc_fighters_main/')))[:64]
   for fid,f in sorted(stage_rom.files.items()):
    name=f'remix/stages/{BASE+fid}'
    payload=struct.pack('<IHHI',BASE+fid,f['intern'],f['extern'],len(f['deps']))+struct.pack('<'+'H'*len(f['deps']),*(BASE+d for d in f['deps']))+struct.pack('<I',len(f['raw']))+f['raw']
    z.writestr(name,header+payload);lines.append(f'case {BASE+fid}: return "{name}";')
  lines+=['default:return 0;}}'];(out/'stage_data.h').write_text('\n'.join(lines)+'\n')
  public=json.loads((out/'roster.json').read_text());public.sort(key=lambda f:IDS.index(f['id']))
  (out/'roster.json').write_text(json.dumps(public,indent=2)+'\n')
  stages=[dict(id=i,name=n,file_id=f,rom_id=r,offset=20 if f else None) for i,n,f,r in STAGES]
  (out/'stages.json').write_text(json.dumps(stages,indent=2)+'\n')
  (out/'stage-extraction.json').write_text(json.dumps(dict(stages=stages,assets=[dict(id=fid,size=len(f['raw']),sha256=hashlib.sha256(f['raw']).hexdigest(),deps=f['deps']) for fid,f in stage_rom.files.items()]),indent=2)+'\n')
  print('Curated:',len(public),'fighters,',len(stages),'stages;',len(stage_rom.files),'stage assets')

  report=json.loads((out/'extraction.json').read_text());sizes={x['id']:x['size'] for x in report['assets']};lines=[]
  for label,field in [('main','main_file_id'),('anim',None)]:
   lines.append('static int remix_'+label+'_size(int id){switch(id){')
   for fighter in report['fighters']:
    size=sizes[fighter[field]] if field else max([sizes[row[0]] for row in fighter['main_motion_descriptors']+fighter['sub_motion_descriptors'] if row[0] and not row[2]&2]+[0])
    lines.append(f"case {fighter['id']}:return {size};")
   lines.append('default:return 0;}}')
  (out/'main_sizes.h').write_text('\n'.join(lines)+'\n')

  from extract_menu import extract_menu
  extract_menu(Rom(Path(sys.argv[1]),lib),out)

  from extract_voices import extract_voices
  extract_voices(sys.argv[1], IDS)

  from extract_sounds import extract_sounds
  extract_sounds(sys.argv[1])

  from extract_normals import extract_normals
  extract_normals(sys.argv[1])

  from extract_kirby import extract_kirby
  extract_kirby(sys.argv[1])

  from extract_trails import extract_trails
  extract_trails(sys.argv[1])
