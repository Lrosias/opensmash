#!/usr/bin/env python3
"""Isolated relink with exact live baseline gate; never overwrite an output root."""
from pathlib import Path
import argparse, hashlib, importlib.util, json, os, re, shlex, shutil, subprocess

ROOT = Path(__file__).resolve().parents[2]
BASE = Path('/Users/luis/.codex/worktrees/6e4e/OpenSmash/build/melee-simd-only-20260910/source/build/melee-web')
LIVE = Path('/Volumes/OpenSmashBuilds/lobby/build/melee-lobby-native')
EXPECTED = '1e87a23d6d9b13da54fddfc864951123f3c52fac81bdf7aef00a432869d35592'
AR = '/Users/luis/Documents/ChatGPT/OpenSmash/tools/emsdk/upstream/bin/llvm-ar'
CARD_SOURCE = Path('vendor/dolphin/Source/Core/Core/HW/GCMemcard/GCMemcardRaw.cpp')
CARD_BASELINE = '0390526631b3434a2c3bf66e9db398d93ab4c5e50b7292e31b84c5eec7ba93a9'
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def copy_patched_card(destination):
    """Apply only the new card fix to a frozen copy of the qualified runtime."""
    original=BASE/'runtime'/CARD_SOURCE
    assert sha(original)==CARD_BASELINE, 'Qualified memory-card source changed'
    source=destination/CARD_SOURCE;source.parent.mkdir(parents=True,exist_ok=True)
    shutil.copy2(original,source)
    patch=(ROOT/'melee/engine/browser.patch').read_text()
    section=next(part for part in re.split(r'(?=^--- a/)',patch,flags=re.M) if part.startswith('--- a/'+str(CARD_SOURCE)+'\n'))
    subprocess.run(['patch','--batch','--fuzz=0','-p1'],input=section,text=True,cwd=destination,check=True)
    return source
def main():
    parser=argparse.ArgumentParser();parser.add_argument('output',type=Path);opts=parser.parse_args()
    out=opts.output.resolve()
    if not str(out).startswith('/Volumes/OpenSmashBuilds/publisher/build/') or out.exists():
        raise SystemExit('A fresh external publisher/build output directory is required.')
    out.mkdir(parents=True);(out/'baseline').mkdir();(out/'candidate').mkdir()
    authored=[ROOT/'melee'/p for p in ['engine/main.cpp','engine/Rollback.cpp','engine/MeleeRollback.h','engine/NativeResultReceipt.h','engine/browser.patch','tools/lite.py','tests/build-native-session.py']]
    authored_inputs={str(p):sha(p) for p in authored}
    env=dict(os.environ,EM_CACHE=str(BASE/'emscripten-cache'),EM_FROZEN_CACHE='1',EMCC_CORES='4',PATH='/opt/homebrew/bin:'+os.environ['PATH'],PYTHONPYCACHEPREFIX=str(out/'pycache'))
    recipe=shlex.split((LIVE/'baseline-link-command.txt').read_text().strip()[5:-5])
    live_args=[str(LIVE/'libmelee_game.a') if a=='opensmash-web/libmelee_game.a' else str(LIVE/'libcore.a') if a=='vendor/dolphin/Source/Core/Core/libcore.a' else a.replace("'_melee_match_configure',","'_melee_match_configure','_melee_match_configure_slots',") for a in recipe]
    inputs={}
    for arg in live_args:
        if arg.startswith('-'): continue
        p=Path(arg) if arg.startswith('/') else BASE/'wasm'/arg
        if p.is_file(): inputs[str(p)]=sha(p)
    inputs[str(BASE/'runtime'/CARD_SOURCE)]=sha(BASE/'runtime'/CARD_SOURCE)
    def link(args,destination):
        args=list(args);args[args.index('-o')+1]=str(destination/'melee.js')
        args=[re.sub(r'(?<=--thinlto-cache-dir=).*',str(out/'thinlto-cache'),a) for a in args]
        subprocess.run(args,cwd=BASE/'wasm',env=env,check=True)
        return sha(destination/'melee.wasm')
    print('Reproducing exact live native runtime first',flush=True)
    baseline=link(live_args,out/'baseline');assert baseline==EXPECTED,(baseline,EXPECTED)
    (out/'baseline-proof.json').write_text(json.dumps({'expected':EXPECTED,'actual':baseline},indent=2))
    print('Exact live SHA verified; compiling isolated changed objects',flush=True)
    chunks=out/'chunks';chunks.mkdir()
    shutil.copy2(LIVE/'generated.h',out/'generated.h')
    for name in set(re.findall(r'chunk_[\w]+\.c',(ROOT/'melee/tools/lite.py').read_text())):
        source=LIVE/'chunks'/name
        if not source.exists(): source=BASE/'game-small/generated/chunks'/name
        shutil.copy2(source,chunks/name)
    before={p.name:sha(p) for p in chunks.glob('*.c')}
    spec=importlib.util.spec_from_file_location('lite',ROOT/'melee/tools/lite.py');lite=importlib.util.module_from_spec(spec);spec.loader.exec_module(lite);lite.CHUNKS=chunks;lite.main()
    changed=[p for p in chunks.glob('*.c') if sha(p)!=before[p.name]]
    assert sorted(p.name for p in changed)==['chunk_0836_text1_801A5140.c','chunk_0837_text1_801A5940.c'],[p.name for p in changed]
    for name in ['libcore.a','libmelee_game.a']: shutil.copy2(LIVE/name,out/name)
    card=copy_patched_card(out/'runtime')
    commands=json.loads((BASE/'wasm/compile_commands.json').read_text());sources=[ROOT/'melee/engine/main.cpp',ROOT/'melee/engine/Rollback.cpp',card,*changed]
    for source in sources:
        entry=next(c for c in commands if Path(c['file']).name==source.name and (source.name!='main.cpp' or '/melee/engine/' in c['file']))
        args=shlex.split(entry['command']);obj=out/(source.name+'.o');args[args.index('-o')+1]=str(obj);args[args.index('-c')+1]=str(source)
        args.insert(1,'-I'+str(ROOT/'melee/engine'))
        print('Compiling '+source.name,flush=True);subprocess.run(args,cwd=entry['directory'],env=env,check=True)
        if source.name!='main.cpp':
            archive=out/('libcore.a' if source.name in ['Rollback.cpp','GCMemcardRaw.cpp'] else 'libmelee_game.a')
            members=subprocess.check_output([AR,'t',str(archive)],text=True).splitlines()
            assert members.count(obj.name)==1, ('Expected exactly one existing archive member',obj.name)
            subprocess.run([AR,'r',str(archive),str(obj)],check=True)
    candidate=[str(out/'libmelee_game.a') if a==str(LIVE/'libmelee_game.a') else str(out/'libcore.a') if a==str(LIVE/'libcore.a') else str(out/'main.cpp.o') if a=='opensmash-web/CMakeFiles/melee.dir/main.cpp.o' else a.replace("'_melee_match_configure_slots',","'_melee_match_configure_slots','_melee_session_configure',") for a in live_args]
    assert str(out/'main.cpp.o') in candidate
    digest=link(candidate,out/'candidate')
    assert all(sha(Path(p))==value for p,value in inputs.items()),'Historical link inputs changed during build'
    assert all(sha(Path(p))==value for p,value in authored_inputs.items()),'Authored source changed during build'
    proof={'baseline':baseline,'candidate':digest,'sourceCommit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'sources':{str(p):sha(p) for p in [*sources,*authored]},'unchangedHistoricalInputs':inputs,'artifacts':{p.name:sha(p) for p in (out/'candidate').iterdir() if p.is_file()}}
    (out/'provenance.json').write_text(json.dumps(proof,indent=2));print(json.dumps({'candidate':str(out/'candidate'),'wasm':digest}),flush=True)
if __name__=='__main__':main()
