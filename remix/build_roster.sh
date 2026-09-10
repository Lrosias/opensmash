#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
rom="${1:?Usage: bash remix/build_roster.sh /path/to/Smash-Remix-2.0.1.z64}"
export PATH="$PWD/tools/emsdk/python/3.13.3_64bit/bin:$PWD/.venv/bin:$PATH"
python3 remix/extract_roster.py "$rom"
python3 remix/verify_assets.py --roster
python3 remix/verify_scripts.py
python3 remix/test_scripts.py
python3 remix/prepare.py --roster
cmake -S BattleShip -B BattleShip/build-wasm -DFETCHCONTENT_FULLY_DISCONNECTED=ON
cmake --build BattleShip/build-wasm --target BattleShip.js -j 6
python3 remix/package_demo.py --roster
printf '%s\n' 'Roster ready. Serve with: PORT=4198 node yougame/tests/serve.mjs build/remix/demo'
