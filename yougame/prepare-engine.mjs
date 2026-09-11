import {execFileSync,spawnSync} from 'node:child_process';
import {existsSync,copyFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const engine=path.join(root,'BattleShip');
const revision='3ba1814ec34c376b1d1904b4dda2ef503ee90701';
function git(args,cwd=engine){return execFileSync('git',args,{cwd,encoding:'utf8'}).trim();}
if(!existsSync(path.join(engine,'.git'))){
 execFileSync('git',['clone','--no-checkout','--filter=blob:none','https://github.com/turtlesoupy/BattleShip.git',engine],{stdio:'inherit'});
 git(['checkout',revision]);git(['submodule','update','--init','--recursive','--depth','1']);
}
if(git(['rev-parse','HEAD'])!==revision)throw new Error(`Expected BattleShip ${revision}; use a separate clean checkout before applying these patches.`);
for(const [dir,file] of [[engine,'battleship.patch'],[path.join(engine,'decomp'),'decomp.patch'],[path.join(engine,'libultraship'),'libultraship.patch'],[engine,'controller-neutrality-battleship.patch'],[path.join(engine,'decomp'),'controller-neutrality-decomp.patch']]){
 const patch=path.join(root,'yougame/patches',file);
 if(spawnSync('git',['apply','--reverse','--check',patch],{cwd:dir}).status===0)continue;
 git(['apply','--check',patch],dir);git(['apply',patch],dir);
}
copyFileSync(path.join(root,'yougame/engine/yougame.c'),path.join(engine,'port/stubs/yougame.c'));
console.log('Pinned engine and YouGame patches are ready.');
