"""Read base costume frames and default mappings from the pinned local Remix ROM.

Costumes.select_ is located through the patched VS call site. Extra palettes,
custom models and skipped costume IDs use a different interpreter and are not
included by pretending they are ordinary material-animation frames.
"""
import hashlib,json,struct
from pathlib import Path
from extract_marth import ROOT,SHA256
from extract_roster import offset

def costume_tables(data):
 call=struct.unpack_from('>I',data,0x1361B4)[0]
 if call>>26!=3:raise ValueError('Unexpected costume selection call')
 select=offset(0x80000000|((call&0x3FFFFFF)<<2))
 upper,lower,add,read=struct.unpack_from('>4I',data,select+0x40)
 if upper>>16!=0x3C09 or lower>>16!=0x3529 or add!=0x01244820 or read!=0x81290000:raise ValueError('Unexpected costume-count instructions')
 counts=offset(((upper&0xFFFF)<<16)|(lower&0xFFFF))
 # Character.move_table_12 copies the native first twelve rows verbatim.
 signature=data[0xA7030:0xA7090]
 hits=[];at=0x2800000
 while True:
  at=data.find(signature,at)
  if at<0:break
  hits.append(at);at+=1
 if len(hits)!=1:raise ValueError('Ambiguous default costume table')
 return counts,hits[0]

def extract(path):
 data=Path(path).read_bytes()
 if hashlib.sha256(data).hexdigest()!=SHA256:raise ValueError('Unsupported Remix ROM')
 counts,defaults=costume_tables(data);assets=ROOT/'build/remix/main/assets'
 fighters=json.loads((assets/'extraction.json').read_text())['fighters'];rows=[]
 for f in fighters:
  i=f['id']
  if i<29:continue
  count=data[counts+i]+1;mapping=list(data[defaults+i*8:defaults+i*8+8])
  if not 4<=count<=16 or len(set(mapping[:4]))!=4 or any(c>=count for c in mapping[:4]):raise ValueError('Invalid costume mapping for '+str(i))
  rows.append(dict(id=i,count=count,defaults=mapping,unported_team_colors=[c for c in mapping[4:7] if c>=count]))
 header=['/* Generated from the pinned Remix ROM. Base material-animation costumes only. */','typedef struct {int id,count;unsigned char defaults[8];} RemixCostumes;','static const RemixCostumes remix_costumes[]={']
 header += [' {%d,%d,{%s}},'%(r['id'],r['count'],','.join(map(str,r['defaults']))) for r in rows];header+=['};']
 (assets/'costume_data.h').write_text('\n'.join(header)+'\n')
 (assets/'costume-extraction.json').write_text(json.dumps(dict(source_sha256=SHA256,count_table=counts,default_table=defaults,fighters=rows),indent=2)+'\n')
 print('Extracted base costumes:',len(rows),'fighters,',sum(r['count'] for r in rows),'frames')
if __name__=='__main__':
 import sys
 extract(sys.argv[1])
