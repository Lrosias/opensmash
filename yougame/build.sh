#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node yougame/prepare-engine.mjs
export EMSDK_QUIET=1
source "${YOUGAME_EMSDK_DIR:-$PWD/tools/emsdk}/emsdk_env.sh"
python_env="${YOUGAME_PYTHON_ENV:-$PWD/.venv}"
engine_build="${YOUGAME_BUILD_DIR:-build-wasm}"
export PATH="$python_env/bin:$PATH"
rom_options=()
if [ -n "${1:-}" ]; then rom_options+=("-DSSB64_BASEROM=$1"); fi
emcmake cmake -S BattleShip -B "BattleShip/$engine_build" -G Ninja \
  -DCMAKE_BUILD_TYPE=Release -DSSB64_VERSION=us \
  -DPython3_EXECUTABLE="$python_env/bin/python3" "${rom_options[@]}"
cmake --build "BattleShip/$engine_build" --target BattleShip.js -j 6
PACKAGE_O2R=1 BattleShip/scripts/package_web.sh "$engine_build" web-dist
node yougame/build.mjs
node --test yougame/tests/*.test.mjs
echo 'Run the YouGame MCP check_build with yougame/build-check.json before distributing.'
