"""Compile the production C-stick adapter against attack-check spies."""
from pathlib import Path
import subprocess, tempfile, unittest

class CStick(unittest.TestCase):
    def test_native_controls(self):
        root=Path(__file__).resolve().parents[1]
        source=(root/'engine/cstick.c').read_text().replace('#include <ft/fighter.h>', '')
        names=[line.split('(')[1].split(',')[0] for line in source.splitlines() if line.startswith('CSTICK_CHECK(')]
        header='''#include <assert.h>
#include <string.h>
typedef int sb32;
typedef struct { signed char x,y; } Stick;
typedef struct { unsigned short button_hold,button_tap,button_update,button_release; Stick stick_range; } SYController;
SYController gSYControllerDevices[4];
enum { nFTPlayerKindMan = 0 };
typedef struct FTStruct { struct FTStruct *link_next; int hitlag_tics,pkind,is_control_disable,tap_stick_x,tap_stick_y; struct { SYController pl; SYController *controller; unsigned short button_mask_a; } input; } FTStruct;
typedef FTStruct GObj;
#define ftGetStruct(g) (g)
#define EMSCRIPTEN_KEEPALIVE
enum { nGCCommonLinkIDFighter=0 };
GObj *gGCCommonLinks[1];
static int injected,expect_x,expect_y,calls;
static sb32 check(GObj *fp) {
 calls++;
 if(injected) { assert(fp->input.pl.button_tap & 0x8000);assert(fp->tap_stick_x==0);assert(fp->tap_stick_y==0);assert(fp->input.pl.stick_range.x==expect_x);assert(fp->input.pl.stick_range.y==expect_y); }
 else { assert(fp->input.pl.button_tap==0);assert(fp->input.pl.stick_range.x==40);assert(fp->input.pl.stick_range.y==-20); }
 return injected;
}
'''
        spies='\n'.join('sb32 __real_'+n+'(GObj *g){return check(g);}' for n in names)
        main='''
int main(void) {
 FTStruct fp={0}; fp.input.button_mask_a=0x8000;fp.input.pl.stick_range=(Stick){40,-20};fp.tap_stick_x=12;fp.tap_stick_y=20;
 const int masks[]={0x41,0x42,0x40,0x44},xs[]={80,-80,0,0},ys[]={0,0,80,-80};
 for(int port=0;port<4;port++) for(int d=0;d<4;d++) {
  SYController *p=&gSYControllerDevices[port];fp.input.controller=p;
  *p=(SYController){.button_hold=masks[d]|8,.button_tap=masks[d]|8};
  port_yougame_cstick_read(port,p,1);assert(p->button_hold==8);assert(p->button_tap==8);
  injected=1;expect_x=xs[d];expect_y=ys[d];FTStruct before=fp;
  assert(__wrap_ftCommonAttackAirCheckInterruptCommon(&fp));assert(memcmp(&fp,&before,sizeof(fp))==0);
  if(d<2)assert(__wrap_ftCommonAttackS4CheckInterruptCommon(&fp));
  if(d==2)assert(__wrap_ftCommonAttackHi4CheckInterruptCommon(&fp));
  if(d==3)assert(__wrap_ftCommonAttackLw4CheckInterruptCommon(&fp));
  assert(memcmp(&fp,&before,sizeof(fp))==0);
  injected=0;
  if(d<2)assert(!__wrap_ftCommonAttackHi4CheckInterruptCommon(&fp));
  else assert(!__wrap_ftCommonAttackS4CheckInterruptCommon(&fp));
  *p=(SYController){.button_hold=masks[d]};port_yougame_cstick_read(port,p,1);
  assert(!__wrap_ftCommonAttackAirCheckInterruptCommon(&fp)); // held stick doesn't repeat
  *p=(SYController){.button_hold=masks[d],.button_tap=masks[d]};port_yougame_cstick_read(port,p,0);
  assert(p->button_hold==(d==2?8:masks[d]&7));assert(!__wrap_ftCommonAttackAirCheckInterruptCommon(&fp));
 }
 // A CPU, disabled player, disconnected or neutral port cannot inherit a flick.
 SYController *p=&gSYControllerDevices[3];*p=(SYController){.button_hold=0x41,.button_tap=0x41};port_yougame_cstick_read(3,p,1);
 fp.pkind=1;assert(!__wrap_ftCommonAttackAirCheckInterruptCommon(&fp));fp.pkind=0;
 fp.is_control_disable=1;assert(!__wrap_ftCommonAttackAirCheckInterruptCommon(&fp));fp.is_control_disable=0;
 *p=(SYController){0};port_yougame_cstick_read(3,p,0);assert(!__wrap_ftCommonAttackAirCheckInterruptCommon(&fp));
 // A flick during hitlag survives release, runs on the final frozen tick,
 // and expires immediately after that eligible frame.
 gGCCommonLinks[0]=&fp;fp.hitlag_tics=3;
 *p=(SYController){.button_hold=0x40,.button_tap=0x40};port_yougame_cstick_read(3,p,1);
 *p=(SYController){0};fp.hitlag_tics=2;port_yougame_cstick_read(3,p,1);
 fp.hitlag_tics=1;port_yougame_cstick_read(3,p,1);injected=1;expect_x=0;expect_y=80;
 assert(__wrap_ftCommonAttackHi4CheckInterruptCommon(&fp));
 fp.hitlag_tics=0;port_yougame_cstick_read(3,p,1);injected=0;
 assert(!__wrap_ftCommonAttackHi4CheckInterruptCommon(&fp));
 // An already-processed attack must not replay after entering hitlag.
 *p=(SYController){.button_hold=0x41,.button_tap=0x41};port_yougame_cstick_read(3,p,1);
 injected=1;expect_x=80;expect_y=0;assert(__wrap_ftCommonAttackAirCheckInterruptCommon(&fp));
 *p=(SYController){0};fp.hitlag_tics=3;port_yougame_cstick_read(3,p,1);
 fp.hitlag_tics=1;port_yougame_cstick_read(3,p,1);injected=0;
 assert(!__wrap_ftCommonAttackAirCheckInterruptCommon(&fp));
 assert(calls>40);
}
'''
        with tempfile.TemporaryDirectory(prefix='cstick-') as temp:
            c=Path(temp)/'test.c';exe=Path(temp)/'test';c.write_text(header+source+spies+main)
            subprocess.run(['clang','-std=c11','-Wall','-Werror',str(c),'-o',str(exe)],check=True)
            subprocess.run([str(exe)],check=True)

if __name__=='__main__':unittest.main()
