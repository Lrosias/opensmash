// Apply the shared controller to an existing edition without rebuilding its engine.
// Usage: node yougame/package-touch-update.mjs <base-build> <new-output-folder>
import {cp,mkdir,readFile,readdir,stat,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';

if(process.argv.length!==4)throw new Error('Expected base-build and new-output-folder');
const base=path.resolve(process.argv[2]),out=path.resolve(process.argv[3]);
if(out===base||out.startsWith(base+path.sep))throw new Error('Output must be separate from the base build');
const source=await readFile(path.join(base,'app.mjs'),'utf8');
const previous=source.match(/const BUILD = '([a-f0-9]+)';/)?.[1];
if(!previous)throw new Error('Unrecognized build identifier');
await stat(path.join(base,'index.html'));
await mkdir(path.dirname(out),{recursive:true});
await mkdir(out); // Never overwrite a preserved release or another candidate.
await cp(base,out,{recursive:true});
const hash=createHash('sha256').update(previous),changed=[];
for(const file of ['touch.mjs','touch-state.mjs','touch-stick.mjs']){
 const bytes=await readFile(new URL('./src/'+file,import.meta.url));
 await writeFile(path.join(out,file),bytes);hash.update(file).update(bytes);changed.push(file);
}
const build=hash.digest('hex').slice(0,16);
await writeFile(path.join(out,'app.mjs'),source.replace(`const BUILD = '${previous}';`,`const BUILD = '${build}';`));
changed.push('app.mjs');
const files=[];
async function collect(dir,prefix=''){
 for(const entry of await readdir(dir,{withFileTypes:true})){
  const relative=prefix+entry.name,file=path.join(dir,entry.name);
  if(entry.isDirectory()){await collect(file,relative+'/');continue;}
  const row={path:relative,size:(await stat(file)).size};
  if((relative==='yougame.json'||/\.(html|css|m?js)$/.test(relative))&&relative!=='engine/BattleShip.js')row.text=await readFile(file,'utf8');
  files.push(row);
 }
}
await collect(out);
await writeFile(out+'-check.json',JSON.stringify({files}));
await writeFile(out+'-release.json',JSON.stringify({base,previous,build,changed,files:files.length},null,2)+'\n');
console.log(JSON.stringify({out,previous,build,changed,files:files.length}));
