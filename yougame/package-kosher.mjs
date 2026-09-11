// Turns a direct-play package (a release dir, or yougame/dist) into the kosher edition: the
// same build minus every ROM-derived file (BattleShip.o2r and the stage select-screen PNGs
// Torch derives from the ROM), plus Torch compiled to wasm so the player's own ROM is
// extracted in their browser. Published on YouGame as a patch listing (kind "patch"), where the
// site hands the ROM to the build through YouGame.baseGame() (engine.html + rom-extract.mjs).
//
//   node yougame/package-kosher.mjs <package-dir> <out-dir> [web-dist-with-torch]
//
// The third argument is an engine build dir that carries torch/ (BattleShip/web-dist by
// default); its torch.wasm must match the package's BattleShip.o2r.recipe.
import {cp,mkdir,readFile,writeFile,rm,readdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const [,,base,out,webDist=path.join(root,'BattleShip/web-dist')]=process.argv;
if(!base||!out)throw new Error('usage: node yougame/package-kosher.mjs <package-dir> <out-dir> [web-dist]');
await rm(out,{recursive:true,force:true});
await cp(base,out,{recursive:true});
await rm(path.join(out,'engine/files/BattleShip.o2r'),{force:true});
await rm(path.join(out,'engine/files/assets/css_icons'),{recursive:true,force:true});
const manifestPath=path.join(out,'engine/manifest.json');
const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
manifest.files=manifest.files.filter(f=>f.path!=='/BattleShip.o2r'&&!f.path.startsWith('/assets/css_icons/'));
if(!manifest.files.some(f=>f.path==='/BattleShip.o2r.recipe'))throw new Error('The package has no BattleShip.o2r.recipe; Torch cannot be matched to it.');
await writeFile(manifestPath,JSON.stringify(manifest,null,1)+'\n');
await mkdir(path.join(out,'engine'),{recursive:true});
await cp(path.join(webDist,'torch'),path.join(out,'engine/torch'),{recursive:true});
for(const file of ['rom-extract.mjs','torch-worker.mjs'])await cp(path.join(root,'yougame/src',file),path.join(out,'engine',file));
// A package built before engine.html learned the kosher path gets the current shell, BUILD kept.
const shellPath=path.join(out,'engine/index.html');
const shell=await readFile(shellPath,'utf8');
if(!shell.includes('rom-extract.mjs')){
 const build=(await readFile(path.join(out,'app.mjs'),'utf8')).match(/BUILD\s*=\s*['"]([a-f0-9]{16})['"]/)?.[1];
 let src=await readFile(path.join(root,'yougame/src/engine.html'),'utf8');
 if(build)src=src.replaceAll('YOUGAME_BUILD',build);
 await writeFile(shellPath,src);
}
async function walk(dir,prefix=''){const rows=[];for(const e of await readdir(dir,{withFileTypes:true})){const rel=prefix+e.name,f=path.join(dir,e.name);if(e.isDirectory())rows.push(...await walk(f,rel+'/'));else{if(/\.(z64|n64|v64|zip|sh|py)$/i.test(rel)||rel==='engine/files/BattleShip.o2r')throw new Error('unexpected file '+rel);rows.push([rel,(await stat(f)).size]);}}return rows;}
const files=await walk(out);
console.log(`kosher edition: ${files.length} files, ${(files.reduce((s,[,n])=>s+n,0)/1e6).toFixed(1)} MB in ${out}`);
