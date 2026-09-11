// Stage an isolated controller candidate from an existing built edition.
// node tools/stage-gamecube.mjs n64|melee <base-build> <new-output-folder>
import {cp,mkdir,readFile,readdir,stat,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const [kind,baseArg,outArg]=process.argv.slice(2);
if(!['n64','melee'].includes(kind)||!baseArg||!outArg)throw Error('Expected n64|melee, base-build, new-output-folder');
const base=path.resolve(baseArg),out=path.resolve(outArg);
if(out===base||out.startsWith(base+path.sep))throw Error('Use a separate output directory');
await stat(path.join(base,'index.html'));await mkdir(path.dirname(out),{recursive:true});await mkdir(out);
await cp(base,out,{recursive:true});
await cp(path.join(root,'controllers'),path.join(out,'controllers'),{recursive:true});
const changed=(await readdir(path.join(root,'controllers'))).filter(name=>name.endsWith('.mjs')).sort().map(name=>'controllers/'+name);
for(const name of kind==='n64'?['app.mjs','input.mjs']:['app.mjs']){
  const source=await readFile(path.join(root,kind==='n64'?'yougame':'melee','src',name),'utf8');
  await writeFile(path.join(out,name),source.replaceAll('../../controllers/','./controllers/'));changed.push(name);
}
const hash=createHash('sha256').update(await readFile(path.join(base,'app.mjs')));
for(const name of changed)hash.update(name).update(await readFile(path.join(out,name)));
const build=hash.digest('hex').slice(0,16);
if(kind==='n64'){
  const app=path.join(out,'app.mjs');await writeFile(app,(await readFile(app,'utf8')).replaceAll('YOUGAME_BUILD',build));
}
const files=[];
async function collect(dir,prefix=''){
  for(const entry of await readdir(dir,{withFileTypes:true})){
    const relative=prefix+entry.name,file=path.join(dir,entry.name);
    if(entry.isDirectory()){await collect(file,relative+'/');continue;}
    const row={path:relative,size:(await stat(file)).size};
    if((relative==='yougame.json'||/\.(html|css|m?js)$/.test(relative))&&!relative.startsWith('engine/'))row.text=await readFile(file,'utf8');
    files.push(row);
  }
}
await collect(out);await writeFile(out+'-check.json',JSON.stringify({files}));
await writeFile(out+'-candidate.json',JSON.stringify({kind,base,out,build,changed,files:files.length,hardwareVerified:false,published:false},null,2)+'\n');
console.log(JSON.stringify({out,build,files:files.length}));
