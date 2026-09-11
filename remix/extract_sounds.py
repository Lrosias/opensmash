"""Decode the pinned ROM's expanded FGM sample bank, without network access.

The bank retains original PCM rate and sample loop bounds. Advanced FGM
sequencing/envelopes are recorded separately; this is sample playback.
"""
from pathlib import Path
import struct,hashlib,json,sys
from extract_marth import ROOT,SHA256
sys.path.insert(0,str(ROOT/'BattleShip/tools'))
from aifc_to_wav import expand_codebook,decode_frame,clamp_s16

def extract_sounds(path):
 b=Path(path).read_bytes();assert hashlib.sha256(b).hexdigest()==SHA256
 u=lambda p:struct.unpack_from('>I',b,p)[0]
 ctl=u(0x3d750);tbl=u(0x3d754);sfx=u(0x3d790);fgm=u(0x3d798)
 resolve=lambda x:ctl+x if x<0x100000 else 0x284d9f0+x
 count=u(fgm);assert count==1545
 entries=[(0,0,0,0,0)]*count;data=bytearray();decoded={};report=[];skips=[]
 base=8+count*20
 for id in range(695,count):
  code=0x2874350+u(fgm+4*(id+1));q=b[code:code+3]
  if q not in [bytes.fromhex('de00d1'),bytes.fromhex('de04d1')]:skips.append(id);continue
  sid=struct.unpack_from('>H',b,code+3)[0]&0x7fff
  sound=0x2871580+u(sfx+4*(sid+1))
  if b[sound]!=0x60 or b[sound+3] not in [0x20,0x60]:skips.append(id);continue
  sample=struct.unpack_from('>H',b,sound+1)[0]&0x7fff;rate={0x20:16000,0x60:32000}[b[sound+3]]
  key=(sample,rate)
  if key not in decoded:
   param=resolve(u(ctl+0x28+4*sample));wa=resolve(u(param+8));start=tbl+u(wa);size=u(wa+4);book=resolve(u(wa+16));order=u(book);predictors=u(book+4)
   assert order==2 and 1<=predictors<=16 and 0<size<2000000 and start+size<=len(b),(id,sample,hex(wa),size)
   raw=struct.unpack_from('>'+'h'*(order*predictors*8),b,book+8)
   table=expand_codebook([[list(raw[(p*order+j)*8:(p*order+j+1)*8]) for j in range(order)] for p in range(predictors)],order,predictors)
   state=[0]*16;pcm=[]
   for pos in range(start,start+size-8,9):decode_frame(b[pos:pos+9],state,order,table);pcm.extend(clamp_s16(x) for x in state)
   ls=le=0
   if u(wa+12):
    loop=resolve(u(wa+12));ls,le,lc=struct.unpack_from('>III',b,loop)
    if not lc or not 0<=ls<le<=len(pcm):ls=le=0
   decoded[key]=(base+len(data),len(pcm),rate,ls,le);data.extend(struct.pack('<'+'h'*len(pcm),*pcm))
  entries[id]=decoded[key];report.append(dict(fgm=id,sample=sample,rate=rate,frames=entries[id][1],loop=entries[id][3:]))
 out=ROOT/'build/remix/main/assets';out.mkdir(exist_ok=True,parents=True)
 bank=out/'sounds.bank';bank.write_bytes(b'RXS1'+struct.pack('<I',count)+b''.join(struct.pack('<5I',*e) for e in entries)+data)
 (out/'sounds.json').write_text(json.dumps(dict(source_sha256=SHA256,decoded=report,skipped=skips,sha256=hashlib.sha256(bank.read_bytes()).hexdigest(),limitations=['FGM pitch, envelope, reverb, and multi-note sequencing require native-bank playback.']),indent=2)+'\n')
 print('Decoded',len(report),'FGM samples;',len(decoded),'unique;',len(data),'PCM bytes; skipped',skips)
if __name__=='__main__':extract_sounds(sys.argv[1])
