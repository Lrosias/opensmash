// Repackage a verified native edition with the current shared online frontend.
// node yougame/package-edition.mjs original|remix /path/to/previous/build /path/to/new/build
import {cp,mkdir,readFile,readdir,stat,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {PROFILES} from './src/game-profile.mjs';
const [edition,baseArg,outArg]=process.argv.slice(2),profile=PROFILES[edition];
if(!profile||!baseArg||!outArg)throw new Error('Expected original|remix, base build, and new output folder');
const base=path.resolve(baseArg),out=path.resolve(outArg);
if(out===base||out.startsWith(base+path.sep))throw new Error('Output must be separate from the source');
if(!(await readFile(path.join(base,'engine/BattleShip.js'),'utf8')).includes('_port_yougame_cstick_version'))
 throw new Error('This input requires the C-stick engine. Rebuild and overlay BattleShip.js and BattleShip.wasm before packaging.');
const manifest=JSON.parse(await readFile(path.join(base,'engine/manifest.json'),'utf8'));
if(!!manifest.remix!==profile.remix)throw new Error('Native asset edition does not match selected profile');
for(const name of ['BattleShip.wasm','BattleShip.js'])await stat(path.join(base,'engine',name));
await mkdir(path.dirname(out),{recursive:true});await mkdir(out);
await cp(base,out,{recursive:true});
await cp(new URL('../controllers/',import.meta.url),path.join(out,'controllers'),{recursive:true});
const src=new URL('./src/',import.meta.url);
for(const file of await readdir(src)){
 if(file==='engine.html')continue;
 if(file.endsWith('.mjs'))await writeFile(path.join(out,file),(await readFile(new URL(file,src),'utf8')).replaceAll('../../controllers/','./controllers/'));else await cp(new URL(file,src),path.join(out,file));
}
await cp(new URL('engine.html',src),path.join(out,'engine/index.html'));
await writeFile(path.join(out,'game-profile.mjs'),(await readFile(new URL('game-profile.mjs',src),'utf8')).replace("PROFILES['YOUGAME_EDITION']","PROFILES['"+edition+"']"));
const hash=createHash('sha256');
async function digest(dir){for(const entry of (await readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const file=path.join(dir,entry.name);hash.update(path.relative(out,file));if(entry.isDirectory())await digest(file);else hash.update(await readFile(file));}}
await digest(out);const build=hash.digest('hex').slice(0,16);
for(const name of ['app.mjs','engine/index.html'])await writeFile(path.join(out,name),(await readFile(path.join(out,name),'utf8')).replaceAll('YOUGAME_BUILD',build));
await writeFile(path.join(out,'index.html'),(await readFile(path.join(out,'index.html'),'utf8')).replace('<title>OpenSmash64 · YouGame</title>',`<title>${profile.title} · uGames</title>`));
const files=[];
async function collect(dir,prefix=''){for(const entry of await readdir(dir,{withFileTypes:true})){const relative=prefix+entry.name,file=path.join(dir,entry.name);if(entry.isDirectory()){await collect(file,relative+'/');continue;}if(/\.(z64|n64|v64|zip|sh|py)$/i.test(relative))throw new Error('Unexpected build file: '+relative);const row={path:relative,size:(await stat(file)).size};if((relative==='yougame.json'||/\.(html|css|m?js)$/.test(relative))&&relative!=='engine/BattleShip.js')row.text=await readFile(file,'utf8');files.push(row);}}
await collect(out);await writeFile(out+'-check.json',JSON.stringify({files}));
await writeFile(out+'-release.json',JSON.stringify({edition,build,base,out,mode:profile.mode,fighters:profile.fighters,stages:profile.stages,stocks:profile.stocks,files:files.length},null,2)+'\n');
console.log(JSON.stringify({edition,build,out,files:files.length}));
