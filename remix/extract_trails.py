"""Read custom sword-trail geometry and colors from the pinned local ROM."""
import hashlib,json,struct,sys
from pathlib import Path
from extract_marth import ROOT,SHA256

def extract_trails(path):
    b=Path(path).read_bytes();assert hashlib.sha256(b).hexdigest()==SHA256
    first=struct.pack('>HBBIIff',58,14,2,0x00ffff00,0xffffff00,70,370)
    at=b.find(first);assert at>=0 and b.find(first,at+1)<0
    rows=[struct.unpack_from('>HBBIIff',b,at+20*i) for i in range(21)]
    assert rows[1][:3]==(56,13,2) and rows[-1][:3]==(34,0,1)
    lines=['/* ROM-derived SwordTrail structs; model parts begin at joint 4. */',
           'typedef struct {int fighter,joint,axis;SYColorRGBA first,last;float start,end;} RemixTrail;',
           'static RemixTrail remix_trails[]={']
    for fighter,part,axis,c1,c2,start,end in rows:
        colors=[','.join(str(c>>s&255) for s in (24,16,8,0)) for c in (c1,c2)]
        lines.append('{%d,%d,%d,{%s},{%s},%s,%s},'%(fighter,part+4,axis,*colors,float(start),float(end)))
    lines.append('};');out=ROOT/'build/remix/main/assets'
    (out/'trail_data.h').write_text('\n'.join(lines)+'\n')
    (out/'trail-extraction.json').write_text(json.dumps(dict(source_sha256=SHA256,rom_offset=at,rows=rows),indent=2)+'\n')
    print('Sword trails:',len(rows),'ROM records')
if __name__=='__main__':extract_trails(sys.argv[1])
