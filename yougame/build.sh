#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node yougame/prepare-engine.mjs
export EMSDK_QUIET=1
source "${YOUGAME_EMSDK_DIR:-$PWD/tools/emsdk}/emsdk_env.sh"
node yougame/build-page-compare.mjs
python_env="${YOUGAME_PYTHON_ENV:-$PWD/.venv}"
engine_build="${YOUGAME_BUILD_DIR:-build-wasm}"
export PATH="$python_env/bin:$PATH"
remix_rom="${1:-${SSB64_REMIX_ROM:-$HOME/Documents/SmashRemix/Smash Remix 2.0.1.z64}}"
python3 remix/extract_main.py "$remix_rom"
python3 remix/verify_main.py
python3 remix/prepare_main.py
emcmake cmake -S BattleShip -B "BattleShip/$engine_build" -G Ninja \
  -DCMAKE_BUILD_TYPE=Release -DSSB64_VERSION=us \
  -DPython3_EXECUTABLE="$python_env/bin/python3" -DFETCHCONTENT_FULLY_DISCONNECTED=ON
cmake --build "BattleShip/$engine_build" --target BattleShip.js -j 6
PACKAGE_O2R=1 BattleShip/scripts/package_web.sh "$engine_build" web-dist
python3 remix/package_main.py
YOUGAME_ENGINE_DIR="$PWD/build/remix/main/engine" node yougame/build.mjs
node --test yougame/tests/*.test.mjs
python3 remix/bundle_main.py
echo 'OpenSmash64 Remix is ready in yougame/dist and build/OpenSmash64-Remix.zip.'
