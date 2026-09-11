// Apply this checkout's browser wrapper (melee/src + controllers) to a released Melee
// package without rebuilding its engine or repacking its assets.
// Usage: node melee/tools/package-touch-update.mjs <released-package-dir> <new-output-dir>
import {cp,mkdir,readFile,readdir,stat,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execSync} from 'node:child_process';
import path from 'node:path';

if(process.argv.length!==4)throw new Error('Expected released-package-dir and new-output-dir');
const root=new URL('../../',import.meta.url).pathname;
const base=path.resolve(process.argv[2]),out=path.resolve(process.argv[3]);
if(out===base||out.startsWith(base+path.sep))throw new Error('Output must be separate from the base package');
for(const name of ['index.html','engine/wasm.json','assets-manifest.json'])await stat(path.join(base,name));
await mkdir(path.dirname(out),{recursive:true});
await mkdir(out); // Never overwrite a preserved release or another candidate.
await cp(base,out,{recursive:true});
const changed=[];
async function overlay(from,to,rewrite){
 for(const entry of await readdir(from,{withFileTypes:true})){
  if(!entry.isFile())continue;
  let bytes=await readFile(path.join(from,entry.name));
  if(rewrite&&/\.(mjs|html)$/.test(entry.name))bytes=Buffer.from(bytes.toString('utf8').replaceAll('../../controllers/','./controllers/'));
  const target=path.join(out,to,entry.name);
  let before=null;try{before=await readFile(target);}catch{}
  if(before&&before.equals(bytes))continue;
  await writeFile(target,bytes);changed.push(path.posix.join(to,entry.name).replace(/^\.\//,''));
 }
}
await overlay(path.join(root,'melee/src'),'.',true);
await mkdir(path.join(out,'controllers'),{recursive:true});
await overlay(path.join(root,'controllers'),'controllers',false);
const files=[];
async function collect(dir,prefix=''){
 for(const entry of await readdir(dir,{withFileTypes:true})){
  const relative=prefix+entry.name,file=path.join(dir,entry.name);
  if(entry.isDirectory()){await collect(file,relative+'/');continue;}
  const row={path:relative,size:(await stat(file)).size};
  if(!relative.startsWith('assets/')&&(relative==='yougame.json'||/\.(html|css|m?js)$/.test(relative))&&relative!=='engine/melee.js')row.text=await readFile(file,'utf8');
  files.push(row);
 }
}
await collect(out);
let sourceCommit='unknown';try{sourceCommit=execSync('git rev-parse HEAD',{cwd:root}).toString().trim();}catch{}
const engine=JSON.parse(await readFile(path.join(out,'engine/wasm.json'),'utf8')).sha256;
const hash=createHash('sha256');for(const row of files.sort((a,b)=>a.path<b.path?-1:1))hash.update(row.path).update(String(row.size));
const manifest={scope:'Wrapper-only Melee release: engine and assets copied from the base package',base,sourceCommit,engine,changed,files:files.length,treeSizeSha256:hash.digest('hex'),date:new Date().toISOString()};
await writeFile(path.join(out,'..',path.basename(out)+'-check.json'),JSON.stringify({files}));
await writeFile(path.join(out,'..',path.basename(out)+'-release.json'),JSON.stringify(manifest,null,2)+'\n');
await writeFile(path.join(out,'..',path.basename(out)+'-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({out,engine,changed,files:files.length}));
