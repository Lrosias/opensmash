import {readFile,writeFile} from 'node:fs/promises';
const sdk=await readFile(process.env.YOUGAME_SDK_PATH,'utf8');
const syncStart=sdk.indexOf('  function matchConnectionIds(');
const source=sdk.slice(sdk.indexOf('  function canon('),sdk.indexOf('  // A hidden tab'))+
 sdk.slice(syncStart>=0?syncStart:sdk.indexOf('  function makeSync('),sdk.indexOf('  /* ---------- host-authoritative kit:'));
if(!source.includes('function makeSync'))throw new Error('SDK format changed');
await writeFile(new URL('./.sdk-sync.mjs',import.meta.url),`// Generated from the actual YouGame SDK for local testing only.\nexport const loops=[];\nfunction fixedStep(o){let active=false;loops.push(()=>{if(active)o.update();});return {start(){active=true;},stop(){active=false;}};}\n${source}\nexport {makeSync};\n`);
