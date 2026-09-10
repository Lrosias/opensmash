// Stage a reviewed frozen native payload over the latest released frontend.
// Usage: node tools/stage-remix-candidate.mjs <base> <frozen-candidate> <new-output>
import {cp,mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const [baseArg,candidateArg,outArg]=process.argv.slice(2);
if(!baseArg||!candidateArg||!outArg)throw Error('Expected base, frozen candidate and new output');
const base=path.resolve(baseArg),candidate=path.resolve(candidateArg),out=path.resolve(outArg);
if(out===base||out.startsWith(base+path.sep)||out===candidate||out.startsWith(candidate+path.sep))throw Error('Output must be separate');
const digest=b=>createHash('sha256').update(b).digest('hex');
const frozen=await readFile(path.join(candidate,'manifest.json'));
if(digest(frozen)!=='64bbec5d6ef19192ba54235f919c9cfb232e8dca9acb7406488a4808149bad90')throw Error('Unreviewed candidate manifest');
const manifest=JSON.parse(frozen);
const engineFiles=Object.entries(manifest.files).filter(([f])=>f.startsWith('engine/')&&f!=='engine/Remix-notes.md');
if(engineFiles.length!==45)throw Error('Unexpected native overlay');
for(const [f,sha] of engineFiles)if(digest(await readFile(path.join(candidate,f)))!==sha)throw Error('Frozen native file changed: '+f);
const keyboard=await readFile(path.join(root,'yougame/src/keyboard.mjs'));
if(!keyboard.equals(await readFile(path.join(base,'keyboard.mjs'))))throw Error('Base does not contain the current keyboard release');
if(!(await readFile(path.join(base,'game-profile.mjs'),'utf8')).includes("PROFILES['remix']"))throw Error('Base is not the Remix edition');
await mkdir(out);await cp(base,out,{recursive:true});
for(const [f] of engineFiles){await mkdir(path.dirname(path.join(out,f)),{recursive:true});await cp(path.join(candidate,f),path.join(out,f));}
const authored=['app.mjs','native-results.mjs','competitive-ui.mjs','style.css'];
for(const name of authored){let b=await readFile(path.join(root,'yougame/src',name),'utf8');if(name==='app.mjs')b=b.replaceAll('../../controllers/','./controllers/');await writeFile(path.join(out,name),b);}
for(const name of ['gc-adapter.mjs','gc-adapter-ui.mjs'])await cp(path.join(root,'controllers',name),path.join(out,'controllers',name));
const files=[];
async function walk(relative=''){for(const e of (await readdir(path.join(out,relative),{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const f=path.posix.join(relative,e.name);if(e.isDirectory())await walk(f);else files.push(f);}}
await walk();const identity=createHash('sha256');
for(const f of files){identity.update(f);identity.update(await readFile(path.join(out,f)));}
const build=identity.digest('hex').slice(0,16);
await writeFile(path.join(out,'app.mjs'),(await readFile(path.join(out,'app.mjs'),'utf8')).replaceAll('YOUGAME_BUILD',build));
const allowed=new Set([...engineFiles.map(([f])=>f),...authored,'controllers/gc-adapter.mjs','controllers/gc-adapter-ui.mjs']);
const changes=[],checks=[],hashes={};
for(const f of files){const b=await readFile(path.join(out,f));hashes[f]=digest(b);let old;try{old=await readFile(path.join(base,f));}catch(e){if(e.code!=='ENOENT')throw e;}
 if(!old?.equals(b)){if(!allowed.has(f))throw Error('Unexpected frontend change: '+f);changes.push({path:f,before:old?digest(old):null,after:hashes[f]});}
 const row={path:f,size:b.length};if(f==='yougame.json'||(/\.(html|css|m?js)$/.test(f)&&!f.startsWith('engine/')))row.text=b.toString();checks.push(row);
}
await writeFile(out+'-check.json',JSON.stringify({files:checks}));
await writeFile(out+'-release.json',JSON.stringify({candidate:manifest.build,base,out,build,nativeSha256:hashes['engine/BattleShip.wasm'],changes,hashes},null,2));
console.log(JSON.stringify({out,build,files:files.length,changed:changes.length,nativeSha256:hashes['engine/BattleShip.wasm']}));
