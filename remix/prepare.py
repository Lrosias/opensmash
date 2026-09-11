#!/usr/bin/env python3
"""Install the small opt-in Marth bridge into the existing local engine."""
from pathlib import Path
import shutil
import sys

ROOT = Path(__file__).resolve().parents[1]
ENGINE = ROOT / 'BattleShip'


def replace(path, before, after):
    text = path.read_text()
    if after in text:
        return
    if text.count(before) != 1:
        raise RuntimeError(f'Unexpected engine source at {path}; expected unique patch anchor')
    path.write_text(text.replace(before, after))


def install_hooks():
    replace(ENGINE / 'port/port.cpp', '\tport_fighter_seed_vanilla();',
            '\tport_fighter_seed_vanilla();\n\tport_marth_init();')
    replace(ENGINE / 'port/port.cpp', '#include "fighter_registry.h"',
            '#include "fighter_registry.h"\nextern "C" void port_marth_init(void);')
    path = ENGINE / 'port/bridge/lbreloc_bridge.cpp'
    replace(path, '#include "resource/RelocFile.h"',
            '#include "resource/RelocFile.h"\nextern "C" const char *port_marth_asset_path(unsigned int);\nextern "C" int port_marth_animation_file(unsigned int);')
    replace(path, 'static bool portRelocIsFighterFigatreeFile(u32 file_id)\n{',
            'static bool portRelocIsFighterFigatreeFile(u32 file_id)\n{\n\tif (port_marth_animation_file(file_id)) return true;')
    replace(path, 'static std::shared_ptr<RelocFile> portLoadRelocResource(u32 file_id)\n{',
            'static std::shared_ptr<RelocFile> portLoadRelocResource(u32 file_id)\n{\n\tif (const char *path = port_marth_asset_path(file_id)) {\n\t\treturn std::dynamic_pointer_cast<RelocFile>(Ship::Context::GetInstance()->GetResourceManager()->LoadResource(path));\n\t}')


def main():
    full = '--roster' in sys.argv
    shutil.copyfile(ROOT / ('remix/roster.c' if full else 'remix/marth.c'), ENGINE / 'port/stubs/remix_marth.c')
    header = 'roster_data.h' if full else 'marth_data.h'
    shutil.copyfile(ROOT / ('build/remix/assets' if full else 'build/marth/assets') / header, ENGINE / 'port/stubs' / header)
    install_hooks()
    print('Installed opt-in roster source bridge.' if full else 'Installed opt-in Marth source bridge.')


if __name__ == '__main__':
    main()
