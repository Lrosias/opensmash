"""Extract the inspected character-select assets and tables from the user's ROM."""
from pathlib import Path
import json,struct,zipfile,hashlib,sys
from extract_marth import Rom,ROOT,BASE
from extract_main import IDS,STAGES

def extract_menu(rom,out):
 # Located using the official CharacterSelect.asm table signatures; every
 # offset and portrait below is read from the actual, checksum-pinned ROM.
 layout_at=0x2d20e18;table_at=0x2d20ebc
 layout=list(rom.data[layout_at:layout_at+30])+[34,38,74,75]
 assert set(layout)==set(IDS) and len(set(layout))==34
 offsets=struct.unpack_from('>76I',rom.data,table_at)
 for fid in (0xa05,0xa06,0x11,0x12,0x15,0xa04,0x1e):rom.file(fid)
 stage_table_at=0x2c56c9c
 stage_offsets=[struct.unpack_from('>I',rom.data,stage_table_at+4*r)[0] for _,_,_,r in STAGES]
 for offset in stage_offsets:
  assert struct.unpack_from('>HH',rom.files[0xa04]['raw'],offset+4)==(40,30)
 portraits=rom.files[0xa05]['raw']
 for fid in layout:
  assert struct.unpack_from('>HH',portraits,offsets[fid]+4)==(32,32)
  assert offsets[fid]+68<=len(portraits)
 archive=out/'BattleShip.o2r';temporary=out/'menu-archive.tmp'
 with zipfile.ZipFile(archive) as src,zipfile.ZipFile(temporary,'w',zipfile.ZIP_DEFLATED) as dst:
  header=src.read(next(n for n in src.namelist() if n.startswith('reloc_fighters_main/')))[:64]
  for item in src.infolist():
   if not item.filename.startswith('remix/menu/'):dst.writestr(item,src.read(item))
  for fid,f in rom.files.items():
   payload=struct.pack('<IHHI',BASE+fid,f['intern'],f['extern'],len(f['deps']))+struct.pack('<'+'H'*len(f['deps']),*(BASE+d for d in f['deps']))+struct.pack('<I',len(f['raw']))+f['raw']
   dst.writestr(f'remix/menu/{BASE+fid}',header+payload)
 temporary.replace(archive)
 lines=['static const char *remix_menu_asset_path(unsigned int id){switch(id){']
 lines += [f'case {BASE+fid}:return "remix/menu/{BASE+fid}";' for fid in rom.files]
 lines += ['default:return NULL;}}','static const int remix_menu_layout[]={'+','.join(map(str,layout))+'};','static const unsigned int remix_portrait_offsets[]={'+','.join(hex(offsets[f]) for f in layout)+'};']
 (out/'menu_data.h').write_text('\n'.join(lines)+'\n')
 with (out/'menu_data.h').open('a') as f:f.write('static const unsigned int remix_stage_icon_offsets[]={'+','.join(hex(o) for o in stage_offsets)+'};\n')
 (out/'menu-extraction.json').write_text(json.dumps(dict(layout_rom_offset=layout_at,portrait_table_rom_offset=table_at,layout=layout,portraits=[dict(id=f,offset=offsets[f]) for f in layout],assets=[dict(id=fid,size=len(f['raw']),deps=f['deps'],sha256=hashlib.sha256(f['raw']).hexdigest()) for fid,f in rom.files.items()]),indent=2)+'\n')
 metadata=json.loads((out/'menu-extraction.json').read_text())
 metadata.update(stage_table_rom_offset=stage_table_at,stage_icons=[dict(id=s[0],rom_id=s[3],offset=o) for s,o in zip(STAGES,stage_offsets)])
 (out/'menu-extraction.json').write_text(json.dumps(metadata,indent=2)+'\n')
 print('Imported menu:',len(layout),'portraits;',len(rom.files),'ROM assets')

if __name__=='__main__':
 extract_menu(Rom(Path(sys.argv[1]),Path(sys.argv[2])),ROOT/'build/remix/main/assets')
