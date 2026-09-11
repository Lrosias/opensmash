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

with tempfile.TemporaryDirectory(prefix='melee-card-clock-') as folder:
    temp = Path(folder)
    source = build.copy_patched_card(temp / 'runtime')
    text = source.read_text()
    expression = re.search(r'    const u64 format_time =\n.*?;', text, re.S).group()
    # The patched expression remains in the missing-card branch before native Format.
    assert text.index('file.ReadBytes(') < text.index('  else\n') < text.index(expression)
    assert text.index(expression) < text.index('Memcard::GCMemcard::Format(')
    fixture = r'''
#include <atomic>
#include <cassert>
#include <cstdint>
using u64 = uint64_t;
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
  assert(actual_clock() == 42);
  host_time += 300000;
  assert(actual_clock() == 42); // Different wall time cannot change card bytes.
  assert(host_reads == 2 && emulated_reads == 2);
  emulated_time = 43;
  assert(actual_clock() == 43); // Uses emulated progression, not a frozen constant.
  assert(emulated_reads == 3);
#else
  assert(actual_clock() == 101); // Native builds retain the original branch.
  assert(host_reads == 3 && emulated_reads == 0);
#endif
  melee_rb_mode = false;
  assert(actual_clock() == host_time - ExpansionInterface::CEXIIPL::GC_EPOCH);
}
'''
    cpp = temp / 'clock.cpp'
    cpp.write_text(fixture)
    for browser in (False, True):
        exe = temp / ('browser' if browser else 'native')
        subprocess.run(['c++', '-std=c++17', '-Wall', '-Wextra', '-Werror',
                        *(['-D__EMSCRIPTEN__'] if browser else []), str(cpp), '-o', str(exe)], check=True)
        subprocess.run([str(exe)], check=True)
    assert build.sha(build.BASE / 'runtime' / build.CARD_SOURCE) == build.CARD_BASELINE
print('PASS: actual new-card clock uses emulated time in browser rollback; native/offline and historical source unchanged')
