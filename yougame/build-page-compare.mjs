// Rebuild the small, portable Wasm checkpoint helper. No engine rebuild needed.
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
execFileSync(process.env.YOUGAME_WASM_CC||(process.env.YOUGAME_EMSDK_DIR||root+'tools/emsdk')+'/upstream/bin/wasm32-clang',[
 '-O3','-msimd128','-nostdlib','-Wl,--no-entry','-Wl,--import-memory','-Wl,--export=equal','-Wl,--export=first_diff','-Wl,--strip-all',
 root+'yougame/engine/page-compare.c','-o',root+'yougame/src/page-compare.wasm'
],{stdio:'inherit'});
