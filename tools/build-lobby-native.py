"""Reproduce a released native link before replacing only the online bridge."""
from pathlib import Path
import hashlib,json,os,shlex,subprocess,sys
ROOT=Path(__file__).resolve().parents[1]
SHARED=Path('/Users/luis/Documents/ChatGPT/OpenSmash')
NINJA=SHARED/'.venv/bin/ninja'
BUILD=Path('/private/tmp/opensmash-controller-original-cache/BattleShip/build-rollback') if sys.argv[1]=='original' else SHARED/'BattleShip/build-wasm'
OUT=ROOT/'build/lobby-native'/sys.argv[1];OUT.mkdir(parents=True,exist_ok=True)
obj='CMakeFiles/ssb64_game.dir/port/stubs/yougame.c.o'
def command(target):
 command_build=Path('/Users/luis/.codex/worktrees/cbb7/OpenSmash/BattleShip/build-rollback') if sys.argv[1]=='original' else BUILD
 return shlex.split(subprocess.check_output([NINJA,'-C',command_build,'-t','commands',target],text=True).splitlines()[-1])
args=command('BattleShip.js');start=next(i for i,v in enumerate(args) if v.endswith('/em++'));end=args.index('&&',start) if '&&' in args[start:] else len(args);link=args[start:end]
if sys.argv[1]=='original':
 plan=json.loads(Path('/private/tmp/opensmash-original-controller-neutrality-b667a73454b1/build-evidence/execution-plan-before-python-fix.json').read_text())
 link=plan['stages']['baseline-link'][0]['argv'][:]
if sys.argv[1]=='remix':
 link[link.index('CMakeFiles/ssb64_game.dir/port/stubs/remix_marth.c.o')]=str(SHARED/'build/remix/conker-fix/remix_marth.c.o')
(OUT/'baseline').mkdir(exist_ok=True)
link[link.index('-o')+1]=str(OUT/'baseline/BattleShip.js')
env=os.environ.copy();env['PATH']=str(SHARED/'tools/emsdk/python/3.13.3_64bit/bin')+':'+str(SHARED/'.venv/bin')+':'+env['PATH']
subprocess.run(link,cwd=BUILD,env=env,check=True)
expected='13bb168874cef631c1645e6b458cd349a039e78c9f74ee48af62702e4ca16cbe' if sys.argv[1]=='original' else 'f15ccb0f63fdc02e8113239a273449a159a05a2049ac8c1606ec60b26a107c6e'
actual=hashlib.sha256((OUT/'baseline/BattleShip.wasm').read_bytes()).hexdigest()
if actual!=expected:raise SystemExit(f'Baseline mismatch: {actual} != {expected}; no candidate produced')
compile=command(obj);compile[compile.index('-c')+1]=str(ROOT/'yougame/engine/yougame.c');compile[compile.index('-o')+1]=str(OUT/'yougame.c.o')
if '-MF' in compile:compile[compile.index('-MF')+1]=str(OUT/'yougame.c.o.d')
subprocess.run(compile,cwd=BUILD,env=env,check=True)
bridge_input=next(v for v in link if v.endswith(obj))
link[link.index(bridge_input)]=str(OUT/'yougame.c.o');link[link.index('-o')+1]=str(OUT/'BattleShip.js')
subprocess.run(link,cwd=BUILD,env=env,check=True)
(OUT/'provenance.json').write_text(json.dumps({'baseline':actual,'candidate':hashlib.sha256((OUT/'BattleShip.wasm').read_bytes()).hexdigest(),'compile':compile,'link':link},indent=2))
print('Qualified native candidate',OUT)
