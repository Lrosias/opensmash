"""Read original victory typography and franchise emblems from the pinned ROM."""
import json, struct
from extract_roster import offset


def jump(data, at):
    word = struct.unpack_from('>I', data, at)[0]
    if word >> 26 not in (2, 3):
        raise ValueError('Expected results-table jump')
    return offset(0x80000000 | ((word & 0x3ffffff) << 2))


def table(data, at, reg):
    hi, lo = struct.unpack_from('>II', data, at)
    if hi & 0xffff0000 != 0x3c000000 | (reg << 16) or lo & 0xffff0000 != 0x34000000 | (reg << 21) | (reg << 16):
        raise ValueError('Expected results-table LUI/ORI pair')
    return offset(((hi & 65535) << 16) | (lo & 65535))


def extract_results(rom, out):
    data=rom.data
    name_code=jump(data,0x1535e0)
    tables={k:table(data,name_code+delta,13) for k,delta in [('scale',0),('x',16),('name',32)]}
    tables['zoom']=table(data,0x152a8c,15)
    tables['wins_x']=table(data,jump(data,0x1534dc)+52,14)
    for k,patch,reg in [('dobj',0x151e18,15),('mobj',0x151e64,13),('anim',0x151e88,11)]:
        tables[k]=table(data,jump(data,patch),reg)
    logos=rom.file(0x23)['raw'];rom.file(0x25)
    from extract_main import IDS
    rows=[]
    for fid in IDS:
        row={'id':fid}
        for k,t in tables.items():
            value=struct.unpack_from('>f' if k in ('scale','x','wins_x','zoom') else '>I',data,t+fid*4)[0]
            if k=='name':
                at=offset(value) if value>=0x80400000 else value-0x80131b00+0x150ca0
                # Original twelve strings reside in the results overlay.
                value=data[at:data.index(0,at,at+64)].decode('ascii')
                if any(c not in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .!&' for c in value):raise ValueError('Invalid winner string')
            elif k in ('dobj','mobj','anim'):
                if not 0<=value<len(logos):raise ValueError('Results emblem offset out of bounds')
            elif not (0<value<=320):raise ValueError('Invalid results typography')
            row[k]=value
        rows.append(row)
    lines=['typedef struct {int id;const char *name;float x,scale,wins_x,zoom;unsigned int dobj,mobj,anim;} RemixResultArt;',
           'static const RemixResultArt remix_result_art[]={']
    for row in rows:
        lines.append('{%d,%s,%sf,%sf,%sf,%sf,%d,%d,%d},'%(row['id'],json.dumps(row['name']),float(row['x']),float(row['scale']),float(row['wins_x']),float(row['zoom']),row['dobj'],row['mobj'],row['anim']))
    lines+=['};','static const RemixResultArt *remix_results_art(int id){for(int i=0;i<sizeof(remix_result_art)/sizeof(*remix_result_art);i++)if(remix_result_art[i].id==id)return &remix_result_art[i];return NULL;}']
    (out/'results_data.h').write_text('\n'.join(lines)+'\n')
    (out/'results-extraction.json').write_text(json.dumps({'tables':tables,'fighters':rows},indent=2)+'\n')
