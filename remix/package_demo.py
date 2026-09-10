#!/usr/bin/env python3
"""Package a local demo without modifying the published YouGame build."""
from pathlib import Path
import shutil
import sys

ROOT = Path(__file__).resolve().parents[1]
full = '--roster' in sys.argv
out = ROOT / ('build/remix/demo' if full else 'build/marth/demo')
engine = out / 'engine'
engine.mkdir(parents=True, exist_ok=True)
for name in ['index.html', 'demo.mjs']:
    source = {'index.html':'roster.html','demo.mjs':'roster.mjs'}.get(name,name) if full else name
    shutil.copy2(ROOT / 'remix' / source, out / name)
for name in ['input.mjs', 'keyboard.mjs', 'page-compare.mjs', 'page-compare.wasm']:
    shutil.copy2(ROOT / 'yougame/src' / name, out / name)
for name in ['BattleShip.js', 'BattleShip.wasm']:
    shutil.copy2(ROOT / 'BattleShip/build-wasm' / name, engine / name)
for name in ['index.html', 'manifest.json']:
    shutil.copy2(ROOT / 'BattleShip/web-dist' / name, engine / name)
shutil.copy2(ROOT / 'yougame/dist/engine/index.html', engine / 'play.html')
shutil.copytree(ROOT / 'BattleShip/web-dist/files', engine / 'files', dirs_exist_ok=True)
shutil.copy2(ROOT / ('build/remix/assets/BattleShip.o2r' if full else 'build/marth/assets/BattleShip.o2r'), engine / 'files/BattleShip.o2r')
if full: shutil.copy2(ROOT / 'build/remix/assets/roster.json', out / 'roster.json')
print(out)
