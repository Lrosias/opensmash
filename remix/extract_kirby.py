"""Extract Kirby's extended action, copy, and accessory tables from the ROM."""
import hashlib,json,re,struct,sys
from pathlib import Path
from extract_marth import ROOT,SHA256
from extract_roster import offset

def extract_kirby(path):
 b=Path(path).read_bytes();assert hashlib.sha256(b).hexdigest()==SHA256
 u=lambda p:struct.unpack_from('>I',b,p)[0]
 source=(ROOT/'build/remix/reference/upstream/src/Kirby/Kirby.asm').read_text()
 names=re.findall(r'^\s*Character.add_new_action\(KIRBY,\s*(\w+),\s*([^,]+)',source,re.M)
 table=offset(u(offset(0x804a05d0)+8*4));rows=[]
 for i,(name,base) in enumerate(names):
  a=303+i;w=struct.unpack_from('>5I',b,table+(a-220)*20)
  assert 276<=w[0]>>22<431,(a,name,w)
  rows.append(dict(action=a,name=name,base=int(base,0),motion=w[0]>>22,attack=w[0]>>16&63,flags=w[0]&65535,rom_offset=table+(a-220)*20))
 # The patched inhale routine loads this extended table with LUI / ORI.
 hi,lo=u(0xdcabc),u(0xdcac0);assert hi>>26==15 and lo>>26==13
 copy_at=offset(((hi&65535)<<16)|(lo&65535))
 copies=[struct.unpack_from('>HhII',b,copy_at+12*i) for i in range(97)]
 assert copies[58][:2]==(58,28) and copies[74][:2]==(74,44)
 needle=struct.pack('>8i',12,0x900,-1,-1,0x1360,-1,-1,0)
 hat_at=b.find(needle);assert hat_at>=0 and b.find(needle,hat_at+1)<0
 hats=[struct.unpack_from('>8i',b,hat_at+32*i) for i in range(33)]
 out=ROOT/'build/remix/main/assets';lines=['/* ROM-derived Kirby tables. */','typedef struct {int action,motion,attack,flags,base;} RemixKirbyAction;','static const RemixKirbyAction remix_kirby_actions[]={']
 lines += ['{%d,%d,%d,%d,%d},'%(r['action'],r['motion'],r['attack'],r['flags'],r['base']) for r in rows];lines+=['};']
 lines += ['enum { '+','.join('RK_'+r['name']+'='+str(r['action']) for r in rows)+' };']
 lines += ['static const int remix_kirby_copies[97][2]={']+['{%d,%d},'%c[:2] for c in copies]+['};','static const int remix_kirby_hats[33][8]={']+['{'+','.join(map(str,h))+'},' for h in hats]+['};']
 (out/'kirby_data.h').write_text('\n'.join(lines)+'\n');(out/'kirby-extraction.json').write_text(json.dumps(dict(source_sha256=SHA256,actions=rows,copy_table=copy_at,copies=copies,hat_table=hat_at,hats=hats),indent=2)+'\n')
 print('Kirby:',len(rows),'extended actions,',len(hats),'accessories')
if __name__=='__main__':extract_kirby(sys.argv[1])
