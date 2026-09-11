"""Stage the new game-side lobby against a verified released asset inventory."""
from pathlib import Path
import hashlib,json,shutil,sys
ROOT=Path(__file__).resolve().parents[1]
RELEASE=Path('/Users/luis/.codex/worktrees/6e4e/OpenSmash/build')
edition=sys.argv[1]
base=RELEASE/('competitive-original-gamepad-ports-v1' if edition=='original' else 'competitive-remix-conker-v4')
out=ROOT/'build'/('lobby-'+edition)
if out.exists():shutil.rmtree(out)
shutil.copytree(base,out)
for source in (ROOT/'yougame/src').iterdir():
 if source.is_file() and source.name!='engine.html':shutil.copy2(source,out/source.name)
shutil.copytree(ROOT/'controllers',out/'controllers',dirs_exist_ok=True)
for name in ['app.mjs','input.mjs']:
 p=out/name;p.write_text(p.read_text().replace('../../controllers/','./controllers/'))
p=out/'game-profile.mjs';p.write_text(p.read_text().replace("PROFILES['YOUGAME_EDITION']",f"PROFILES['{edition}']"))
native=ROOT/'build/lobby-native'/edition
proof=json.loads((native/'provenance.json').read_text())
shutil.copy2(native/'BattleShip.wasm',out/'engine/BattleShip.wasm')
(out/'engine/BattleShip.js').write_text((native/'BattleShip.js').read_text().replace('BattleShip.wasm',f"BattleShip.wasm?v={proof['candidate'][:16]}"))
fingerprint=hashlib.sha256()
for p in sorted(out.rglob('*')):
 if p.is_file():fingerprint.update(p.read_bytes())
build=fingerprint.hexdigest()[:16]
p=out/'app.mjs';p.write_text(p.read_text().replace('YOUGAME_BUILD',build))
(out/'engine/index.html').write_text((ROOT/'yougame/src/engine.html').read_text().replace('YOUGAME_BUILD',build))
print(out,build)
