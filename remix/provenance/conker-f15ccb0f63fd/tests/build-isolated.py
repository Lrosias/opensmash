from pathlib import Path
import subprocess,shlex,os,json
root=Path.cwd();out=root/'build/remix/conker-fix';build=root/'BattleShip/build-wasm'
obj='CMakeFiles/ssb64_game.dir/port/stubs/remix_marth.c.o'
cmd=shlex.split(subprocess.check_output(['ninja','-C',str(build),'-t','commands',obj],text=True).splitlines()[-1])
cmd[cmd.index('-o')+1]=str(out/'remix_marth.c.o');cmd[cmd.index('-c')+1]=str(out/'stubs/remix_marth.c')
if '-MF' in cmd:cmd[cmd.index('-MF')+1]=str(out/'remix_marth.c.o.d')
cmd.insert(1,'-I'+str(root/'BattleShip/port/stubs'))
link=subprocess.check_output(['ninja','-C',str(build),'-t','commands','BattleShip.js'],text=True).splitlines()[-1]
args=shlex.split(link);start=next(i for i,v in enumerate(args) if v.endswith('/em++'));end=args.index('&&',start) if '&&' in args[start:] else len(args);args=args[start:end]
args[args.index(obj)]=str(out/'remix_marth.c.o');args[args.index('-o')+1]=str(out/'BattleShip.js')
(out/'build-commands.json').write_text(json.dumps([cmd,args],indent=2))
env=os.environ.copy();env['PATH']=str(root/'tools/emsdk/python/3.13.3_64bit/bin')+':'+str(root/'.venv/bin')+':'+env['PATH']
subprocess.run(cmd,cwd=build,env=env,check=True)
subprocess.run(args,cwd=build,env=env,check=True)
