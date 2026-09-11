// Stage reviewed app changes over immutable published assets. Never uploads.
import {cp,mkdir,readFile,writeFile,readdir,stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const destination=process.argv[2];if(!destination||!path.isAbsolute(destination))throw Error('Supply a new absolute output directory');
try{await stat(destination);throw Error('Output already exists; choose a new directory');}catch(error){if(error.code!=='ENOENT')throw error;}
const pins={
 original:{release:'/Volumes/OpenSmashBuilds/lobby/build/lobby-original',candidate:'/Volumes/OpenSmashBuilds/publisher/build/native-menu-session-20260911/original/candidate',wasm:'1480d4fe20b9d7f5e228b42329a564c2c6068bdb27a91443156879416f716691'},
 remix:{release:'/Volumes/OpenSmashBuilds/lobby/build/lobby-remix',candidate:'/Volumes/OpenSmashBuilds/publisher/build/native-menu-session-20260911/remix-r2/candidate',wasm:'bd7ccdfba04c8db6c3a886435bdaa621ac543d57c54faf2800097f9f3e4a1dde'}
};
async function digest(file){const hash=createHash('sha256');for await(const bytes of createReadStream(file))hash.update(bytes);return hash.digest('hex');}
async function files(dir,prefix=''){const result=[];for(const entry of (await readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const relative=prefix+entry.name;if(entry.isSymbolicLink())throw Error('Unexpected symlink '+relative);if(entry.isDirectory())result.push(...await files(path.join(dir,entry.name),relative+'/'));else result.push(relative);}return result;}
const manifest={scope:'Local staging only; no upload or publication',sourceCommit:'fb84dc9',fingerprint:'SHA-256 of sorted relative paths plus NUL and bytes, with app BUILD placeholder before substitution; includes every staged asset',editions:{}};
for(const [edition,pin]of Object.entries(pins)){
 if(await digest(path.join(pin.candidate,'BattleShip.wasm'))!==pin.wasm)throw Error('Candidate hash changed: '+edition);
 const target=path.join(destination,edition);await mkdir(destination,{recursive:true});await cp(pin.release,target,{recursive:true,errorOnExist:true,force:false});
 const app=(await readFile(path.join(root,'yougame/src/app.mjs'),'utf8')).replaceAll('../../controllers/','./controllers/');
 await writeFile(path.join(target,'app.mjs'),app);await cp(path.join(root,'yougame/src/native-room-session.mjs'),path.join(target,'native-room-session.mjs'));
 for(const name of ['BattleShip.js','BattleShip.wasm'])await cp(path.join(pin.candidate,name),path.join(target,'engine',name));
 const loader=await readFile(path.join(root,'yougame/src/engine.html'));
 if(!loader.equals(await readFile(path.join(pin.release,'engine/index.html'))))await writeFile(path.join(target,'engine/index.html'),loader);
 const stagedFiles=await files(target),buildHash=createHash('sha256');
 for(const relative of stagedFiles){buildHash.update(relative+'\0');for await(const bytes of createReadStream(path.join(target,relative)))buildHash.update(bytes);}
 const build=buildHash.digest('hex').slice(0,16);await writeFile(path.join(target,'app.mjs'),app.replaceAll('YOUGAME_BUILD',build));
 const released=new Set(await files(pin.release)),changed=[];
 for(const relative of stagedFiles){const hash=await digest(path.join(target,relative));if(!released.has(relative)||hash!==await digest(path.join(pin.release,relative)))changed.push({path:relative,sha256:hash,size:(await stat(path.join(target,relative))).size});released.delete(relative);}
 if(released.size)throw Error('Staging removed released files');
 const allowed=new Set(['app.mjs','native-room-session.mjs','engine/BattleShip.js','engine/BattleShip.wasm','engine/index.html']);if(changed.some(row=>!allowed.has(row.path)))throw Error('Unexpected changed files');
 manifest.editions[edition]={directory:target,base:pin.release,candidate:pin.candidate,build,files:stagedFiles.length,changed};
}
await writeFile(path.join(destination,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify(manifest,null,2));
