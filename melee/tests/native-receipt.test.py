"""Compile the actual GALE01 native-result decoder against MatchEnd fixtures."""
from pathlib import Path
import subprocess, tempfile, unittest

class NativeReceipt(unittest.TestCase):
    def test_completed_native_placements(self):
        engine=Path(__file__).resolve().parents[1]/'engine'
        program=r'''
#include "NativeResultReceipt.h"
#include <array>
#include <cassert>
std::array<unsigned char,0x227c> data;
auto read=[](unsigned offset) { return data.at(offset); };
void setup() {
  data.fill(0); data[4]=2; data[5]=1;
  for(int i=0;i<6;i++) data[0x58+i*0xa8]=3;
  data[0x58+0xa8]=0; data[0x58+3*0xa8]=0;
  data[0x58+0xa8+5]=1; data[0x58+3*0xa8+5]=0;
}
void unscored() { auto r=melee_native_receipt(read,7,10);assert(r.kind==2 && r.winner==-1); }
int main() {
  setup();auto r=melee_native_receipt(read,7,10);
  assert(r.battle_id==7 && r.kind==1 && r.winner==3);
  assert(r.present==10 && r.humans==10 && r.places[0]==-1 && r.places[2]==-1);
  // A timeout whose native sudden-death merge made P2 first uses that placement,
  // regardless of old stocks, original n_winners or original winner-list fields.
  setup();data[4]=1;data[5]=0;data[0xd]=2;data[0x10]=3;
  data[0x58+0xa8+5]=0;data[0x58+3*0xa8+5]=1;
  data[0x58+0xa8+8]=0;data[0x58+3*0xa8+8]=9;
  r=melee_native_receipt(read,8,10);assert(r.kind==1 && r.winner==1);
  for(int outcome: {0,3,4,5,6,7,8,9}) { setup();data[4]=outcome;unscored(); }
  for(int mode: {2,3}) { setup();data[5]=mode;unscored(); }
  setup();data[6]=1;unscored();
  setup();data[0x58+3*0xa8]=1;unscored(); // CPU winner
  setup();data[0x58+0xa8]=1;unscored(); // CPU loser
  setup();data[0x58+0xa8+5]=0;unscored(); // unresolved shared first place
  setup();data[0x58+3*0xa8+5]=1;unscored(); // no native winner
  setup();data[0x58+4*0xa8]=0;unscored(); // extra native participant
  setup();assert(melee_native_receipt(read,1,3).kind==2); // assigned roster differs
  setup();assert(melee_native_receipt(read,0,10).kind==0); // no begun battle
  return 0;
}
'''
        with tempfile.TemporaryDirectory() as directory:
            src=Path(directory)/'test.cpp';exe=Path(directory)/'test'
            src.write_text(program)
            subprocess.run(['c++','-std=c++17','-Wall','-Wextra','-Werror','-I'+str(engine),str(src),'-o',str(exe)],check=True,capture_output=True,text=True)
            subprocess.run([str(exe)],check=True,capture_output=True,text=True)

if __name__=='__main__': unittest.main()
