"""Exercise the actual C clock-wrapper implementation without a game runtime."""
from pathlib import Path
import os, subprocess, tempfile, unittest

class SessionClock(unittest.TestCase):
    def test_opt_in_clock_and_legacy_forwarding(self):
        source=(Path(__file__).resolve().parents[1]/'engine/yougame.c').read_text()
        clock=source[source.index('static unsigned int battle_ticks'):source.index('extern int port_yougame_menu_context')]
        program='''#include <stdlib.h>
#include <assert.h>
typedef int MNPlayersSlotVS;
'''+clock+'''
static int time_calls, count_calls;
unsigned long long __real_osGetTime(void) { time_calls++;return 123456789ULL; }
unsigned int __real_osGetCount(void) { count_calls++;return 98765u; }
int main(void) {
  int enabled=getenv("SSB64_YOUGAME_SESSION")!=NULL;
  assert(__wrap_osGetTime()==(enabled?0:123456789ULL));
  assert(__wrap_osGetCount()==(enabled?0:98765u));
  session_ticks=60;
  for(int i=0;i<10;i++) {
    assert(__wrap_osGetTime()==(enabled?46875000ULL:123456789ULL));
    assert(__wrap_osGetCount()==(enabled?46875000u:98765u));
  }
  assert(session_ticks==60); // Reading time never advances simulation.
  session_ticks=6000;
  assert(__wrap_osGetTime()==(enabled?4687500000ULL:123456789ULL));
  assert(__wrap_osGetCount()==(enabled?(unsigned int)4687500000ULL:98765u));
  assert(time_calls==(enabled?0:12));assert(count_calls==(enabled?0:12));
}
'''
        with tempfile.TemporaryDirectory(prefix='native-session-clock-') as temp:
            c=Path(temp)/'clock.c';binary=Path(temp)/'clock';c.write_text(program)
            subprocess.run(['clang','-std=c11','-Werror',str(c),'-o',str(binary)],check=True)
            env=os.environ.copy();env.pop('SSB64_YOUGAME_SESSION',None)
            subprocess.run([str(binary)],env=env,check=True)
            env['SSB64_YOUGAME_SESSION']='1';subprocess.run([str(binary)],env=env,check=True)

if __name__=='__main__':unittest.main()
