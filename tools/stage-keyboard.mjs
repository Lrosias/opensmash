// Overlay keyboard controls onto an immutable released build, preserving its engine.
// Usage: node tools/stage-keyboard.mjs <original|remix|melee> <base> <output>
import {cp,mkdir,readFile,readdir,writeFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const [edition,baseArg,outArg]=process.argv.slice(2);
if(!['original','remix','melee'].includes(edition)||!baseArg||!outArg)throw Error('Expected edition, base and new output');
const base=path.resolve(baseArg),out=path.resolve(outArg);
if(out===base||out.startsWith(base+path.sep))throw Error('Output must be separate');
await mkdir(out);await cp(base,out,{recursive:true});
const bytes=await readFile(new URL(`../${edition==='melee'?'melee':'yougame'}/src/keyboard.mjs`,import.meta.url));
await writeFile(path.join(out,'keyboard.mjs'),bytes);
let app=await readFile(path.join(out,'app.mjs'),'utf8');
if(edition==='melee'){
 const replacements=[
  ['keyboardOptions,RectangleInput,gameCubeInput','keyboardOptions,gameCubeInput'],
  ['const rectangles=Array.from({length:4},()=>new RectangleInput());\n',''],
  ["  for(const [event,pressed] of [['press',true],['release',false]])\n    input.on(event,(id,source,seat=0)=>{if(source==='keyboard')rectangles[seat]?.event(id,pressed);});\n",''],
  ['gameCubeInput(s,rectangles[seat])','gameCubeInput(s)'],['rectangles[seat].reset();',''],
 ];
 for(const [before,after] of replacements){if(app.split(before).length!==2)throw Error('Unexpected Melee app: '+before);app=app.replace(before,after);}
}else{
 const previous=app.match(/const BUILD = '([a-f0-9]+)';/)?.[1];if(!previous)throw Error('Missing build identity');
 const build=createHash('sha256').update(previous).update(bytes).digest('hex').slice(0,16);
 app=app.replace(`const BUILD = '${previous}';`,`const BUILD = '${build}';`);
}
await writeFile(path.join(out,'app.mjs'),app);
const files=[],changes=[];const digest=b=>createHash('sha256').update(b).digest('hex');
async function walk(relative=''){
 for(const entry of await readdir(path.join(out,relative),{withFileTypes:true})){
  const name=path.posix.join(relative,entry.name);if(entry.isDirectory()){await walk(name);continue;}
  const b=await readFile(path.join(out,name)),original=await readFile(path.join(base,name));
  if(!b.equals(original))changes.push({path:name,before:digest(original),after:digest(b)});
  const row={path:name,size:b.length};
  if(name==='yougame.json'||(/\.(html|css|m?js)$/.test(name)&&!name.startsWith('engine/')))row.text=b.toString();
  files.push(row);
 }
}
await walk();
if(changes.length!==2||changes.some(c=>!['keyboard.mjs','app.mjs'].includes(c.path)))throw Error('Unexpected changed files');
await writeFile(out+'-check.json',JSON.stringify({files}));
await writeFile(out+'-release.json',JSON.stringify({edition,base,out,changes,files:files.length},null,2));
console.log(JSON.stringify({edition,out,changes:changes.map(c=>c.path),files:files.length}));
