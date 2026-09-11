#!/usr/bin/env python3
"""Relink a pinned released browser engine, then replace only session prerequisites.

Run the external-volume status helper first. Historical sources/objects stay
read-only. This narrow recipe intentionally fails on any baseline mismatch.
"""
from pathlib import Path
import argparse, hashlib, json, os, shutil, subprocess

ROOT=Path(__file__).resolve().parents[2]
RELEASE=Path('/Volumes/OpenSmashBuilds/lobby/build/lobby-native')
OUT=Path('/Volumes/OpenSmashBuilds/publisher/build/native-menu-session-20260911')
MAIN=Path('/Users/luis/Documents/ChatGPT/OpenSmash')
EXPECTED={'original':'e1bd04b872248b3cc14786381d4a6c1fa628a7b2d046ecf44d5718800ce7af9e',
          'remix':'85ae4743f6c27d57e29d00fbfbf9a18c8e29fa6e03a633fa218ca3373092f22f'}
def sha(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for b in iter(lambda:f.read(4*1024*1024),b''):h.update(b)
    return h.hexdigest()
def main():
    parser=argparse.ArgumentParser();parser.add_argument('edition',choices=EXPECTED);parser.add_argument('--resume',action='store_true');parser.add_argument('--attempt',default='');args=parser.parse_args();edition=args.edition
    assert not args.attempt or args.attempt.replace('-','').isalnum(),'Attempt must be a simple directory suffix'
    out=OUT/(edition+('-'+args.attempt if args.attempt else ''))
    out.mkdir(parents=True,exist_ok=args.resume)
    assert not (out/'provenance.json').exists(),'Completed candidate is immutable'
    cwd=Path('/private/tmp/opensmash-controller-original-cache/BattleShip/build-rollback') if edition=='original' else MAIN/'BattleShip/build-wasm'
    recipe=json.loads((RELEASE/edition/'provenance.json').read_text())
    link=recipe['link'][:]
    inputs={str((Path(a) if a.startswith('/') else cwd/a).resolve()):sha(Path(a) if a.startswith('/') else cwd/a) for a in link if a.endswith(('.a','.o'))}
    source_inputs={str(ROOT/p):sha(ROOT/p) for p in ['yougame/engine/yougame.c','yougame/patches/battleship.patch']+(['remix/main.c'] if edition=='remix' else [])}
    env=os.environ.copy();env['PATH']=str(MAIN/'tools/emsdk/python/3.13.3_64bit/bin')+':'+str(MAIN/'.venv/bin')+':'+env['PATH']
    steps=json.loads((out/'commands.json').read_text()) if args.resume else []
    def run(name,argv):
        steps.append({'name':name,'argv':argv,'cwd':str(cwd)})
        (out/'commands.json').write_text(json.dumps(steps,indent=2))
        with (out/(name+'.log')).open('w') as log:subprocess.run(argv,cwd=cwd,env=env,stdout=log,stderr=subprocess.STDOUT,check=True)
        print(name+' complete',flush=True)
    for name in ['baseline','candidate','source']:(out/name).mkdir(exist_ok=args.resume)
    link[link.index('-o')+1]=str(out/'baseline/BattleShip.js')
    if not args.resume:run('baseline-link',link)
    actual=sha(out/'baseline/BattleShip.wasm')
    if actual!=EXPECTED[edition]:raise SystemExit(f'Baseline mismatch {actual}; expected {EXPECTED[edition]}. No candidate compiled.')
    print('Exact released baseline reproduced: '+actual,flush=True)
    source=out/'source/yougame.c';shutil.copy2(ROOT/'yougame/engine/yougame.c',source)
    compile=recipe['compile'][:];compile[compile.index('-c')+1]=str(source);compile[compile.index('-o')+1]=str(out/'yougame.c.o')
    if '-MF' in compile:compile[compile.index('-MF')+1]=str(out/'yougame.c.o.d')
    run('compile-session-bridge',compile)
    old=next(a for a in link if a.endswith('yougame.c.o'));link[link.index(old)]=str(out/'yougame.c.o')
    if edition=='remix':
        frozen=MAIN/'build/remix/conker-fix'
        # The authored HEAD now includes session changes; compare the frozen
        # released stub to its pre-session source, not the new candidate HEAD.
        prior=subprocess.check_output(['git','show','063f569:remix/main.c'],cwd=ROOT)
        if prior!=(frozen/'stubs/remix_marth.c').read_bytes():raise SystemExit('Remix authored baseline differs from released source')
        shutil.copytree(frozen/'stubs',out/'source/stubs',dirs_exist_ok=args.resume);shutil.copy2(ROOT/'remix/main.c',out/'source/stubs/remix_marth.c')
        compile=json.loads((frozen/'build-commands.json').read_text())[0][:]
        compile[compile.index('-c')+1]=str(out/'source/stubs/remix_marth.c');compile[compile.index('-o')+1]=str(out/'remix_marth.c.o')
        if '-MF' in compile:compile[compile.index('-MF')+1]=str(out/'remix_marth.c.o.d')
        run('compile-remix-menu',compile)
        old=next(a for a in link if a.endswith('remix_marth.c.o'));link[link.index(old)]=str(out/'remix_marth.c.o')
    link.append('-Wl,--wrap=osGetTime,--wrap=osGetCount,--wrap=scVSBattleStartScene')
    link[link.index('-o')+1]=str(out/'candidate/BattleShip.js');run('candidate-link',link)
    assert all(sha(Path(p))==h for p,h in inputs.items()),'Historical inputs changed during build'
    assert all(sha(Path(p))==h for p,h in source_inputs.items()),'Authored source changed during build'
    report={'edition':edition,'baselineSha256':actual,'baselineReproduced':True,'inputFiles':inputs,'historicalInputsUnchanged':True,
            'sourceFiles':{str(p.relative_to(out)):sha(p) for p in sorted((out/'source').rglob('*')) if p.is_file()},'authoredSourceInputs':source_inputs,
            'candidate':{p.name:{'sha256':sha(p),'size':p.stat().st_size} for p in sorted((out/'candidate').iterdir()) if p.is_file()},
            'sourceBase':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),
            'sourceDiff':subprocess.check_output(['git','diff','--','yougame/engine/yougame.c','yougame/patches/battleship.patch','remix/main.c'],cwd=ROOT,text=True),
            'assets':'unchanged; parent stages exact released edition assets','runtimeVerification':'not_run','commands':steps}
    (out/'provenance.json').write_text(json.dumps(report,indent=2));print(json.dumps({'edition':edition,'candidate':report['candidate']}),flush=True)
if __name__=='__main__':main()
