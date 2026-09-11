// Apply this checkout's browser wrapper (melee/src + controllers) to a released Melee
// package without repacking its assets. Wrapper files the checkout no longer has are
// removed from the copy; --engine <dir> also replaces engine/melee.js, melee.wasm.gz
// and wasm.json from a freshly built and compressed engine.
// Usage: node melee/tools/package-touch-update.mjs <released-package-dir> <new-output-dir> [--engine <dir>]
import {cp,mkdir,readFile,readdir,rm,stat,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const args=process.argv.slice(2),engineAt=args.indexOf('--engine'),engineDir=engineAt>=0?path.resolve(args.splice(engineAt,2)[1]):null;
if(args.length!==2)throw new Error('Expected released-package-dir and new-output-dir');
const root=fileURLToPath(new URL('../../',import.meta.url));
const base=path.resolve(args[0]),out=path.resolve(args[1]);
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
const current=new Set((await readdir(path.join(root,'melee/src'))));
for(const entry of await readdir(out,{withFileTypes:true})){
 if(!entry.isFile()||current.has(entry.name)||!/\.(mjs|css|html|jpg|png)$/.test(entry.name))continue;
 await rm(path.join(out,entry.name));changed.push('-'+entry.name);
}
await mkdir(path.join(out,'controllers'),{recursive:true});
await overlay(path.join(root,'controllers'),'controllers',false);
if(engineDir){
 for(const name of ['melee.js','melee.wasm.gz','wasm.json'])await stat(path.join(engineDir,name));
 await overlay(engineDir,'engine',false);
}
const files=[];
async function collect(dir,prefix=''){
 for(const entry of await readdir(dir,{withFileTypes:true})){
  const relative=prefix+entry.name,file=path.join(dir,entry.name);
  if(entry.isDirectory()){await collect(file,relative+'/');continue;}
  const bytes=await readFile(file),row={path:relative,size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
  if(!relative.startsWith('assets/')&&(relative==='yougame.json'||/\.(html|css|m?js)$/.test(relative))&&relative!=='engine/melee.js')row.text=bytes.toString('utf8');
  files.push(row);
 }
}
await collect(out);
let sourceCommit='unknown';try{sourceCommit=execSync('git rev-parse HEAD',{cwd:root}).toString().trim();}catch{}
const engine=JSON.parse(await readFile(path.join(out,'engine/wasm.json'),'utf8')).sha256;
const hash=createHash('sha256');for(const row of files.sort((a,b)=>a.path<b.path?-1:1))hash.update(row.path).update(row.sha256);
const manifest={scope:engineDir?'Melee release: assets copied from the base package, engine and wrapper from this checkout':'Wrapper-only Melee release: engine and assets copied from the base package',base,sourceCommit,engine,changed,files:files.length,treeSha256:hash.digest('hex'),date:new Date().toISOString()};
// Sidecars stay beside the package (the upload takes the folder as is) and never overwrite.
for(const [suffix,body] of [['-check.json',JSON.stringify({files})],['-release.json',JSON.stringify(manifest,null,2)+'\n']]){
 await writeFile(path.join(path.dirname(out),path.basename(out)+suffix),body,{flag:'wx'});
}
console.log(JSON.stringify({out,engine,changed,files:files.length}));
