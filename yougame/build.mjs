import { checkBuildPrivacy } from "./privacy/check-build.mjs";
import {cp,mkdir,readFile,writeFile,readdir,stat,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const out=path.join(root,'yougame/dist');
const engine=path.resolve(process.env.YOUGAME_ENGINE_DIR||path.join(root,'BattleShip/web-dist'));
for(const file of ['BattleShip.js','BattleShip.wasm','manifest.json'])await stat(path.join(engine,file));
const manifest=JSON.parse(await readFile(path.join(engine,'manifest.json'),'utf8'));
if(!manifest.files.some(f=>f.path==='/BattleShip.o2r'))throw new Error('Direct-play builds require the game assets. Package the engine with PACKAGE_O2R=1.');
await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});
const ENGINE_SRC=['engine.html','rom-extract.mjs','torch-worker.mjs'];
for(const file of await readdir(path.join(root,'yougame/src')))if(!ENGINE_SRC.includes(file))await cp(path.join(root,'yougame/src',file),path.join(out,file));
await writeFile(path.join(out,'game-profile.mjs'),(await readFile(path.join(out,'game-profile.mjs'),'utf8')).replace("PROFILES['YOUGAME_EDITION']","PROFILES['"+(manifest.remix?'remix':'original')+"']"));
await cp(path.join(root,'controllers'),path.join(out,'controllers'),{recursive:true});
for(const name of ['app.mjs','input.mjs'])await writeFile(path.join(out,name),(await readFile(path.join(out,name),'utf8')).replaceAll('../../controllers/','./controllers/'));
if(manifest.remix)for(const name of ['roster.json','stages.json','Remix-notes.md'])await cp(path.join(engine,name),path.join(out,name));
await mkdir(path.join(out,'licenses'),{recursive:true});
for(const [source,name] of [['LICENSE','OpenSmash.txt'],['BattleShip/LICENSE','BattleShip.txt'],['BattleShip/libultraship/LICENSE','libultraship.txt'],['BattleShip/torch/LICENSE','Torch.txt']])await cp(path.join(root,source),path.join(out,'licenses',name));
// Bundle the supplied ROM's extracted game assets for direct play. The raw
// ROM, browser extractor, dev harness, and server are not runtime dependencies.
await mkdir(path.join(out,'engine'),{recursive:true});
for(const file of ['BattleShip.js','BattleShip.wasm','manifest.json','files'])
 await cp(path.join(engine,file),path.join(out,'engine',file),{recursive:true});
// The kosher edition (a YouGame patch listing) leaves the ROM-derived files out and ships the
// browser extractor instead; see package-kosher.mjs, which turns a direct-play package into one.
for(const file of ['rom-extract.mjs','torch-worker.mjs'])await cp(path.join(root,'yougame/src',file),path.join(out,'engine',file));
const hash=createHash('sha256');
async function fingerprint(dir){for(const e of (await readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const f=path.join(dir,e.name);if(e.isDirectory())await fingerprint(f);else hash.update(await readFile(f));}}
await fingerprint(path.join(root,'yougame/src'));await fingerprint(path.join(root,'controllers'));await fingerprint(path.join(out,'engine'));
const build=hash.digest('hex').slice(0,16);
for(const [source,target] of [['app.mjs','app.mjs'],['engine.html','engine/index.html']]){
 const content=await readFile(path.join(root,'yougame/src',source),'utf8');
 await writeFile(path.join(out,target),content.replaceAll('YOUGAME_BUILD',build).replaceAll('../../controllers/','./controllers/'));
}
const files=[];
await mkdir(path.join(out,'gallery'),{recursive:true});
await cp(path.join(root,'yougame/media/opensmash64-thumbnail.png'),path.join(out,'gallery/opensmash64-thumbnail.png'));
for(const name of ['01-online-modes.png','02-fighter-roster.png','03-landscape-touch.png','04-dream-land-action.png'])
 await cp(path.join(root,'yougame/media',name),path.join(out,'gallery',name));
async function collect(dir,prefix=''){for(const e of await readdir(dir,{withFileTypes:true})){
 const relative=prefix+e.name,f=path.join(dir,e.name);if(e.isDirectory())await collect(f,relative+'/');else{
 if(/\.(z64|n64|v64|zip|sh|py)$/i.test(relative))throw new Error(`Unexpected private or unsupported file: ${relative}`);
 const row={path:relative,size:(await stat(f)).size};
 // Generated Emscripten glue contains embedded virtual-filesystem paths;
 // scan the authored loaders and game modules instead, plus every file's size.
 if((relative==='yougame.json'||/\.(html|css|m?js)$/.test(relative))&&!['engine/BattleShip.js','engine/torch/torch.js'].includes(relative))row.text=await readFile(f,'utf8');files.push(row);
 }}}
await collect(out);
checkBuildPrivacy(out);

await writeFile(path.join(root,'yougame/build-check.json'),JSON.stringify({files}));
console.log(`YouGame build ${build}: ${files.length} files in ${out}`);
