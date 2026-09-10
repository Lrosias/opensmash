"""Decode the selected fighters' announcer calls from the pinned local ROM.
No synthesized/replacement voices. FGM -> SFX -> ALWaveTable -> VADPCM PCM.
"""
from pathlib import Path
import sys,struct,hashlib,json,wave
from extract_marth import ROOT,SHA256

sys.path.insert(0,str(ROOT/'BattleShip/tools'))
from aifc_to_wav import expand_codebook,decode_frame,clamp_s16
def extract_voices(rom_path, fighter_ids):
 b=Path(rom_path).read_bytes();assert hashlib.sha256(b).hexdigest()==SHA256
 u=lambda p:struct.unpack_from('>I',b,p)[0]
 ctl=u(0x3d750);tbl=u(0x3d754);sfx=u(0x3d790);fgm=u(0x3d798)
 # Actual ROM locations, checked with three unchanged original microcode blocks.
 fgm_base=0x2874350;sfx_base=0x2871580
 names=[499,486,483,513,498,497,535,485,496,507,508,501]
 signature=struct.pack('>12H',*names)
 # Base-game menus contain copies of the first twelve calls; only the expanded
 # roster table continues with Falco, Ganondorf and Young Link at slots 29–31.
 candidates=[];pos=0
 while (pos:=b.find(signature,pos))>=0:
  if struct.unpack_from('>3H',b,pos+58)==(726,709,741):candidates.append(pos)
  pos+=1
 assert len(candidates)==1,candidates
 at=candidates[0]
 calls=struct.unpack_from('>76H',b,at)
 resolve=lambda x:ctl+x if x<0x100000 else 0x284d9f0+x
 out=ROOT/'build/remix/main/assets/voices';out.mkdir(exist_ok=True)
 report=[]
 for fighter in fighter_ids:
  id=calls[fighter]
  if fighter<12:continue
  code=fgm_base+u(fgm+4*(id+1));assert b[code:code+3]==bytes.fromhex('de00d1'),(fighter,id)
  sid=struct.unpack_from('>H',b,code+3)[0]&0x7fff
  sound=sfx_base+u(sfx+4*(sid+1));assert b[sound]==0x60
  sample=struct.unpack_from('>H',b,sound+1)[0]&0x7fff
  rate={0x20:16000,0x60:32000}[b[sound+3]]
  param=resolve(u(ctl+0x28+4*sample));wa=resolve(u(param+8))
  start=tbl+u(wa);size=u(wa+4);book=resolve(u(wa+16));order=u(book);count=u(book+4)
  assert order==2 and 1<=count<=16 and 0<size<1000000 and start+size<=len(b)
  raw=struct.unpack_from('>'+'h'*(order*count*8),b,book+8)
  table=expand_codebook([[list(raw[(p*order+j)*8:(p*order+j+1)*8]) for j in range(order)] for p in range(count)],order,count)
  state=[0]*16;pcm=[]
  for pos in range(start,start+size-8,9):decode_frame(b[pos:pos+9],state,order,table);pcm.extend(clamp_s16(x) for x in state)
  path=out/f'{fighter}.wav'
  with wave.open(str(path),'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(rate);w.writeframes(struct.pack('<'+'h'*len(pcm),*pcm))
  report.append(dict(fighter=fighter,fgm=id,sample=sample,rom_offset=start,rom_size=size,rate=rate,samples=len(pcm),sha256=hashlib.sha256(path.read_bytes()).hexdigest()))
 (ROOT/'build/remix/main/assets/voices.json').write_text(json.dumps(dict(source_sha256=SHA256,announcer_table_rom_offset=at,voices=report),indent=2)+'\n')
 print('Decoded',len(report),'ROM announcer calls; table',hex(at))

if __name__=="__main__":
 from extract_main import IDS
 extract_voices(sys.argv[1], IDS)
