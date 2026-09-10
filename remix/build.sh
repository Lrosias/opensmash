#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
rom="${1:?Usage: bash remix/build.sh /path/to/Smash-Remix-2.0.1.z64}"
export PATH="$PWD/tools/emsdk/python/3.13.3_64bit/bin:$PWD/.venv/bin:$PATH"
python3 remix/extract_marth.py "$rom"
python3 remix/verify_assets.py
python3 remix/prepare.py
cmake -S BattleShip -B BattleShip/build-wasm -DFETCHCONTENT_FULLY_DISCONNECTED=ON
cmake --build BattleShip/build-wasm --target BattleShip.js -j 6
python3 remix/package_demo.py
printf '%s\n' 'Local demo ready. Serve with: PORT=4197 node yougame/tests/serve.mjs build/marth/demo'
