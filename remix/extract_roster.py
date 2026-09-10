#!/usr/bin/env python3
"""Extract the ROM's indexed roster, assets and supported attack bytecode offline."""
import argparse, hashlib, json, struct, subprocess, tempfile, zipfile
from pathlib import Path
from extract_marth import Rom, ROOT, SHA256, BASE

OUT = ROOT / 'build/remix/assets'

def offset(address):
    if 0x80400000 <= address < 0x80800000:
        return address - 0x80000000 + 0x2800000
    if 0x80390000 <= address < 0x803a0000:
        return address - 0x80288a20
    if 0x80100000 <= address < 0x80140000:
        return address - 0x80084800
    raise ValueError(f'Unmapped address {address:#x}')

def roster(b):
    result=[]
    # The ROM stores the name pointers and corresponding fighter IDs separately.
    for i in range(95):
        p=struct.unpack_from('>I',b,0x2ce3e84+4*i)[0]
        if not 0x804e0000 <= p < 0x804f0000: break
        at=offset(p); name=b[at:b.index(0,at)].decode('ascii')
        rid=b[0x2ce4000+i]
        if name=='Random':continue
        address=struct.unpack_from('>I',b,0x92610+4*rid)[0]
        result.append(dict(id=rid,name=name,name_pointer=p,id_table_offset=0x2ce4000+i,record_rom_offset=offset(address)))
    assert len({r['id'] for r in result})==len(result)
    assert next(r for r in result if r['name']=='Marth')['record_rom_offset']==0x2cbe960
    return result

def script(b,address,relocations=None,depth=0):
    """Inline bounded ROM branches; retain native events with known layout.

    Only absolute ROM scripts use this translator. Relocated relative scripts
    remain in their original asset and use the engine's existing interpreter.
    """
    sizes={3:5,4:5,7:2,12:2,13:2,31:4,34:2,36:2,38:4,39:4,46:2}
    omit={12,13,38,39,44,46,49,50,51,52,53,54}
    if depth>8:raise ValueError('Excessive parallel script depth')
    at=offset(address); stack=[]; loops=[]; words=[]; omissions=[]; seen={}; waits=[]; parallel=[]
    def finish(main):
        for slot,child,fixups in parallel:
            base=len(main);relocations.append((slot,base));relocations.extend((base+p,base+t) for p,t in fixups);main.extend(child)
        return main,omissions
    for _ in range(2048):
        if not stack and not loops:seen.setdefault(at,len(words))
        word=struct.unpack_from('>I',b,at)[0]; op=word>>26
        if op>54: raise ValueError(f'Unknown extension {word:#010x} at {at:#x}')
        byte=word>>24
        if byte==0xdb:return finish(words+[word])
        if byte>=0xdc:raise ValueError(f'Unsupported extension branch {word:#x}')
        n=2 if byte in (0xd6,0xd9) else sizes.get(op,1);event=struct.unpack_from('>'+'I'*n,b,at);at+=n*4
        if op in (34,36):
            target=offset(event[1])
            if op==36 and target in seen and not stack and not loops:
                start=seen[target]
                if relocations is None or not any(p>=start for p in waits):raise ValueError('Unterminated/cyclic script')
                words.append(36<<26);relocations.append((len(words),start));words.append(0)
                return finish(words)
            if op==34:stack.append(at)
            if len(stack)>8:raise ValueError('Excessive call depth')
            at=offset(event[1]);continue
        if op==35:
            if not stack:return finish(words+[0])
            at=stack.pop();continue
        if op==32:
            count=word&0x3ffffff
            if not 0<count<=100:raise ValueError('Unbounded loop')
            loops.append([at,count]);continue
        if op==33:
            if not loops:
                # Pinned 2.0.1 Mewtwo USP_END has an END_LOOP without LOOP.
                # Stop this malformed tail after its two visibility events.
                if at-4==offset(0x8055c080):
                    omissions.append(dict(rom_offset=at-4,opcode=op,words=event,repair='terminate_unmatched_mewtwo_loop_end'))
                    return finish(words+[0])
                raise ValueError('Unmatched loop')
            loops[-1][1]-=1
            if loops[-1][1]:at=loops[-1][0]
            else:loops.pop()
            continue
        if op==46 and relocations is not None:
            child_fixups=[]
            try:child,child_omissions=script(b,event[1],child_fixups,depth+1)
            except (ValueError,struct.error):pass
            else:
                words.append(word);parallel.append((len(words),child,child_fixups));words.append(0);omissions.extend(child_omissions);continue
        if op==12 and relocations is not None:
            throw=list(struct.unpack_from('>7I',b,offset(event[1])))
            words.append(word);parallel.append((len(words),throw,[]));words.append(0);continue
        # The native effect dispatcher supports these shared effects; custom
        # Remix effect IDs still require explicit handlers and remain recorded.
        safe_effect=op in (38,39) and ((word>>10)&511) in ({0,6,7,8,37,40,41,42,43,44,46,54,70,71,74,76,77,87,90,91}|set(range(10,35)))
        safe_trail=op==51 and ((word>>18)&255)<23
        if (safe_effect or safe_trail):words.extend(event);continue
        if op in omit and byte not in (0xd0,0xd1,0xd4,0xd5,0xd7,0xda):omissions.append(dict(rom_offset=at-n*4,opcode=op,words=event))
        else:
            if op in (1,2) and (word&0x3ffffff)>0:waits.append(len(words))
            words.extend(event)
        if op==0:return finish(words)
    raise ValueError('Unterminated/cyclic script')

def normalize_relocations(rom):
    """Null the inspected out-of-file references that need Remix runtime patches.

    These references occur in fighter-main headers and one special asset.
    Keep a source checksum and exact repair record; never enlarge an allocation
    to disguise an invalid pointer. Unexpected cases still reject the build.
    """
    allowed={(3102,4),(3102,8),(2939,8),(3693,4),(3886,4),(4093,4),(4093,8),
             (4289,4),(4495,4),(5144,3708),(5144,3712),(4974,4)}
    for fid,f in rom.files.items():
        raw=bytearray(f['raw']);repairs=[]
        f['source_sha256']=hashlib.sha256(raw).hexdigest()
        for label in ('intern','extern'):
            chain=[];head=f[label];index=0
            while head!=0xffff:
                loc=head*4;next_head,target=struct.unpack_from('>HH',raw,loc)
                dep=f['deps'][index] if label=='extern' else fid
                if target*4>=len(rom.files[dep]['raw']):
                    if (fid,loc) not in allowed:raise ValueError(f'Unexpected invalid relocation {fid}:{loc} -> {dep}:{target*4}')
                    repairs.append(dict(slot=loc,target_file=dep,target_offset=target*4,action='null_unported_runtime_reference'))
                    struct.pack_into('>I',raw,loc,0)
                else:chain.append((head,target,dep))
                head=next_head;index+=1
            f[label]=chain[0][0] if chain else 0xffff
            for i,(head,target,dep) in enumerate(chain):
                struct.pack_into('>HH',raw,head*4,chain[i+1][0] if i+1<len(chain) else 0xffff,target)
            if label=='extern':f['deps']=[dep for _,_,dep in chain]
        f['raw']=bytes(raw)
        if repairs:f['relocation_repairs']=repairs

def extract(rom,out,selected=None):
    fighters=roster(rom.data)
    if selected is not None: fighters=[f for f in fighters if f['id'] in selected]
    allanimations=set(); lines=[]
    for f in fighters:
        r=struct.unpack_from('>30I',rom.data,f['record_rom_offset'])
        assert all(0<=x<5455 for x in r[:9]) and 180<=r[27]<500,(f,r)
        main=[struct.unpack_from('>3I',rom.data,offset(r[25])+12*i) for i in range(r[27])]
        subcount=struct.unpack_from('>I',rom.data,offset(r[28]))[0]
        assert subcount<100
        sub=[struct.unpack_from('>3I',rom.data,offset(r[26])+12*i) for i in range(subcount)]
        animations={row[0] for row in main+sub if row[0] and not row[2]&2}
        for fid in set(r[:9])|animations:
            if fid:rom.file(fid)
        allanimations |= animations
        scripts={}; unsupported={};relative=[]
        # Marth's special hitboxes and timing flags use the same interpreter.
        # Keep their provenance separate from the normal-attack count.
        for i in range(len(main)):
            fid,addr,flags=main[i]
            if not fid or addr in (0,0x80000000):continue
            if addr<0x100000:relative.append(i);continue
            try:
                relocations=[];words,omissions=script(rom.data,addr,relocations)
                scripts[i]=dict(rom_address=addr,words=words,omitted_events=omissions,branch_relocations=relocations)
            except (ValueError,struct.error) as e:unsupported[i]=str(e)
        key=f"fighter_{f['id']}"
        for i,s in scripts.items():lines.append(f'static u32 {key}_attack_{i}[]={{'+','.join(f'0x{w:08x}' for w in s['words'])+'};')
        for label,descs in [('main',main),('sub',sub)]:
            lines.append(f'static FTMotionDesc {key}_{label}[]={{')
            for fid,addr,flags in descs:
                mapped=BASE+fid if fid and not flags&2 else fid
                val=addr if addr<0x100000 else 0x80000000
                lines.append(f'{{{mapped},0x{val:08x},{{0x{flags:08x}}}}},')
            lines.append('};')
        lines.append(f'static void {key}_bind(void){{')
        for i in scripts:
            src=f'{key}_attack_{i}'
            lines.append(f'void *p{i}=malloc(sizeof({src}));if(!p{i})abort();memcpy(p{i},{src},sizeof({src}));{key}_main[{i}].offset=(intptr_t)p{i};')
            for slot,target in scripts[i]['branch_relocations']:lines.append(f'((u32*)p{i})[{slot}]=PORT_REGISTER((u32*)p{i}+{target});')
        lines.append('}')
        f.update(main_file_id=r[0],model_file_id=r[3],file_ids=list(r[:9]),attributes_offset=r[24],
                 main_motion_descriptors=main,sub_motion_descriptors=sub,
                 normal_attack_scripts={i:s for i,s in scripts.items() if i<189},
                 special_attack_scripts={i:s for i,s in scripts.items() if i>=195},
                 relative_normal_attacks=[i for i in relative if i<189],relative_special_attacks=[i for i in relative if i>=195],
                 unsupported_normal_attacks={i:s for i,s in unsupported.items() if i<189},
                 unsupported_special_attacks={i:s for i,s in unsupported.items() if i>=195},animation_count=len(animations))
        print(f"{f['id']:2} {f['name']:18} model={r[3]} animations={len(animations):3} normal={len(scripts)+len(relative):2} unsupported={len(unsupported)}",flush=True)
    normalize_relocations(rom)
    lines.append('typedef struct {int id;const char *name;unsigned int files[9];intptr_t attributes;FTMotionDesc *main,*sub;int main_count,sub_count;void (*bind)(void);} RemixFighter;')
    lines.append('static RemixFighter remix_fighters[]={')
    for f in fighters:
        k=f"fighter_{f['id']}";ids=','.join(str(BASE+x if x else 0) for x in f['file_ids'])
        lines.append('{'+f"{f['id']},{json.dumps(f['name'])},{{{ids}}},{f['attributes_offset']},{k}_main,{k}_sub,{len(f['main_motion_descriptors'])},{len(f['sub_motion_descriptors'])},{k}_bind"+'},')
    lines.append('};')
    lines.append('static int remix_animation_file(unsigned int id){switch(id){')
    lines.extend(f'case {BASE+fid}:' for fid in sorted(allanimations));lines.append('return 1;default:return 0;}}')
    lines.append('static const char *remix_asset_path(unsigned int id){switch(id){')
    lines.extend(f'case {BASE+fid}:return "remix/roster/{BASE+fid}";' for fid in sorted(rom.files));lines.append('default:return 0;}}')
    out.mkdir(parents=True,exist_ok=True)
    (out/'roster_data.h').write_text('\n'.join(lines)+'\n')
    with zipfile.ZipFile(ROOT/'BattleShip/web-dist/files/BattleShip.o2r') as src,zipfile.ZipFile(out/'BattleShip.o2r','w',zipfile.ZIP_DEFLATED) as dst:
        sample=next(n for n in src.namelist() if n.startswith('reloc_fighters_main/'));header=src.read(sample)[:64]
        for name in src.namelist():dst.writestr(name,src.read(name))
        for fid,f in sorted(rom.files.items()):
            payload=struct.pack('<IHHI',BASE+fid,f['intern'],f['extern'],len(f['deps']))
            payload+=struct.pack('<'+'H'*len(f['deps']),*(BASE+d for d in f['deps']))
            payload+=struct.pack('<I',len(f['raw']))+f['raw']
            dst.writestr(f'remix/roster/{BASE+fid}',header+payload)
    report=dict(source_sha256=SHA256,version='2.0.1',extension_dispatch_rom_offset=0x2c6fbe4,extension_table_rom_offset=0x2c70820,fighters=fighters,assets=[{k:v for k,v in f.items() if k!='raw'}|dict(size=len(f['raw']),sha256=hashlib.sha256(f['raw']).hexdigest()) for f in rom.files.values()])
    (out/'extraction.json').write_text(json.dumps(report,indent=2)+'\n')
    public=[{k:f[k] for k in ['id','name','main_file_id','model_file_id','animation_count']}|dict(normal_attacks=sum(int(i)<189 for i in f['normal_attack_scripts'])+len(f['relative_normal_attacks']),unsupported_normal_attacks=f['unsupported_normal_attacks']) for f in fighters]
    (out/'roster.json').write_text(json.dumps(public,indent=2)+'\n')
    print(f'Extracted {len(fighters)} fighters and {len(rom.files)} shared assets into {out}')

def main():
    ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('rom',type=Path);args=ap.parse_args()
    with tempfile.TemporaryDirectory(prefix='remix-vpk-') as tmp:
        lib=Path(tmp)/'vpk0.dylib'
        subprocess.run(['cc','-shared','-fPIC','-O2',str(ROOT/'BattleShip/torch/lib/libvpk0/vpk0.c'),'-o',str(lib)],check=True)
        extract(Rom(args.rom,lib),OUT)
if __name__=='__main__':main()
