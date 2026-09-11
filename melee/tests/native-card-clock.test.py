#!/usr/bin/env python3
"""Compile the actual patched new-card clock expression with observable clocks."""
from pathlib import Path
import importlib.util
import re
import subprocess
import tempfile

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('native_build', HERE / 'build-native-session.py')
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)

header_source = (build.BASE / 'runtime/vendor/dolphin/Source/Core/Core/HW/GCMemcard/GCMemcard.cpp').read_text()
header_init = re.search(r'void InitializeHeaderData\(.*?\n}', header_source, re.S).group()

with tempfile.TemporaryDirectory(prefix='melee-card-clock-') as folder:
    temp = Path(folder)
    for relative in build.CARD_SOURCES:
        source = build.copy_patched_card(temp / 'runtime', relative)
        text = source.read_text()
        expression = re.search(r'    const u64 format_time =\n.*?;', text, re.S).group()
        # The patched expression remains in the missing-card branch before native Format.
        if relative.name == 'GCMemcardRaw.cpp':
            assert text.index('file.ReadBytes(') < text.index('  else\n') < text.index(expression)
            assert text.index(expression) < text.index('Memcard::GCMemcard::Format(')
        else:
            assert text.index(expression) < text.index('Memcard::InitializeHeaderData(')
            assert 'sram_language, format_time + i);' in text
            assert text.index('Memcard::InitializeHeaderData(') < text.index('std::make_unique<CEXIChannel>')
        fixture = r'''
#include <array>
#include <atomic>
#include <cassert>
#include <cstdint>
using u8 = uint8_t; using u16 = uint16_t; using u32 = uint32_t; using u64 = uint64_t;
using CardFlashId = std::array<u8, 12>;
struct HeaderData {
  std::array<u8, 12> m_serial; u64 m_format_time;
  u32 m_sram_bias, m_sram_language, m_dtv_status;
  u16 m_device_id, m_size_mb, m_encoding;
};
''' + header_init + r'''
static u64 host_time = 946684900, emulated_time = 42;
static int host_reads = 0, emulated_reads = 0;
std::atomic<bool> melee_rb_mode{false};
namespace Core { struct System { static System& GetInstance() { static System s; return s; } }; }
namespace Common::Timer { u64 GetLocalTimeSinceJan1970() { ++host_reads; return host_time; } }
namespace ExpansionInterface { struct CEXIIPL {
  static constexpr u64 GC_EPOCH = 946684800;
  static u64 GetEmulatedTime(Core::System&, u64 epoch) {
    assert(epoch == GC_EPOCH); ++emulated_reads; return emulated_time;
  }
}; }
auto& m_system = Core::System::GetInstance();
u64 actual_clock() {
''' + expression + r'''
return format_time;
}
int main() {
  assert(actual_clock() == 100);
  ++host_time;
  assert(actual_clock() == 101);
  assert(host_reads == 2 && emulated_reads == 0);
  melee_rb_mode = true;
#ifdef __EMSCRIPTEN__
  HeaderData a{}, b{}, second_slot{};
  CardFlashId flash_id{};
  InitializeHeaderData(&a, flash_id, 128, false, 0, 0, actual_clock());
  assert(a.m_format_time == 42);
  host_time += 300000;
  InitializeHeaderData(&b, flash_id, 128, false, 0, 0, actual_clock());
  assert(a.m_format_time == b.m_format_time && a.m_serial == b.m_serial); // Different wall time cannot change card bytes.
  assert(host_reads == 2 && emulated_reads == 2);
  emulated_time = 43;
  assert(actual_clock() == 43); // Uses emulated progression, not a frozen constant.
  assert(emulated_reads == 3);
  InitializeHeaderData(&second_slot, flash_id, 128, false, 0, 0, a.m_format_time + 1);
  assert(second_slot.m_format_time == 43 && second_slot.m_serial != a.m_serial);
#else
  assert(actual_clock() == 101); // Native builds retain the original branch.
  assert(host_reads == 3 && emulated_reads == 0);
#endif
  melee_rb_mode = false;
  assert(actual_clock() == host_time - ExpansionInterface::CEXIIPL::GC_EPOCH);
}
'''
        cpp = temp / (relative.name + '.fixture.cpp')
        cpp.write_text(fixture)
        for browser in (False, True):
            exe = temp / (relative.name + ('.browser' if browser else '.native'))
            subprocess.run(['c++', '-std=c++17', '-Wall', '-Wextra', '-Werror',
                            *(['-D__EMSCRIPTEN__'] if browser else []), str(cpp), '-o', str(exe)], check=True)
            subprocess.run([str(exe)], check=True)
        assert build.sha(build.BASE / 'runtime' / relative) == build.CARD_SOURCES[relative]
print('PASS: actual raw-card and EXI folder-card clocks use emulated time in browser rollback; native/offline and historical source unchanged')
