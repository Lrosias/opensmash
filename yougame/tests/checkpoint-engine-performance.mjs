// Serial, short, muted local tests of a released engine. PERF_BUILD_ROOT must
// be its complete package; only the checkpoint module is replaced in the after case.
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {loadavg} from 'node:os';
import {createHash} from 'node:crypto';
import path from 'node:path';
if(loadavg()[0]>14)throw Error('Host load too high for browser measurement');
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const root=path.resolve(process.env.PERF_BUILD_ROOT),out=path.resolve(process.env.PERF_OUTPUT||'yougame/test-results/checkpoint-progressive');
const candidate=await readFile(new URL('../src/checkpoints.mjs',import.meta.url));
const comparatorCandidate=await readFile(new URL('../src/page-compare.mjs',import.meta.url));
const html=`<!doctype html><style>body{margin:0;background:black}iframe{width:640px;height:480px;border:0}</style><script type="module">
import {NativeCheckpoints} from '/checkpoints.mjs';
let raw,state,pads=[[0,0,0],[0,0,0]];window.errors=[];
window.openSmashAttachEngine=()=>({menuState:()=>({phase:0}),menuAction(){},beforeTick:()=>true,afterTick(...s){state=s;},ready(r){raw=r;window.ready=true;},error(e){errors.push(String(e));},readPorts(ptr,H){for(let i=0;i<4;i++){const b=(ptr>>2)+i*4,p=pads[i];H[b]=p?2:1;H[b+1]=p?.[0]||0;H[b+2]=p?.[1]||0;H[b+3]=p?.[2]||0;}}});
const iframe=document.createElement('iframe');iframe.src='/engine/index.html?SSB64_YOUGAME_MUTE=1&SSB64_YOUGAME=1&SSB64_YOUGAME_ROLLBACK=1&SSB64_YOUGAME_SEED=1234&SSB64_BOOT_BATTLE=0,8,6,0&SSB64_BOOT_HUMANS=2&SSB64_BOOT_SLOTS=hhoo&SSB64_STOCKS=99&SSB64_VS_INTRO=0&SSB64_REMIX_MAIN=1';document.body.append(iframe);
window.measure=async()=>{
 const raf=()=>new Promise(r=>requestAnimationFrame(r));
 for(let i=0;!(state?.[4]>=30);i++){if(i>900)throw Error('Battle did not start');raw.step();if(i%8===0)await raf();}
 let covers=0,compares=0;const cover=raw.mirror.covers,first=raw.mirror.firstDifference;
 raw.mirror.covers=(...a)=>{covers++;return cover(...a);};raw.mirror.firstDifference=(...a)=>{compares++;return first(...a);};
 const store=new NativeCheckpoints(raw),samples=[];let growth=null;
 for(let i=0;i<240;i++){
  if(${process.env.PERF_FORCE_GROWTH==='1'}&&i===60){const before=raw.used(),at=iframe.contentWindow._malloc(32<<20);if(!at)throw Error('Probe allocation failed');growth={before,after:raw.used(),at};}
  await raf();pads=[[i%13<5?32768:i%17<4?16384:0,i%70<35?50:-50,i%41<3?50:0],[i%11<5?32768:0,i%70<35?-50:50,0]];
  const stepStart=performance.now();raw.step();const stepped=performance.now();covers=compares=0;store.save(i,state);const end=performance.now();
  samples.push({stepMs:stepped-stepStart,saveMs:end-stepped,covers,compares,used:raw.used(),pages:store.pages.filter(Boolean).length});
  if(raw.used()>(256<<20))break;
 }
 if(raw.used()>(256<<20))return {growth,stoppedAtHeapLimit:true,used:raw.used(),mirrorCapacity:raw.mirror.capacity,mirrorGeneration:raw.mirror.generation,errors,samples};
 const handle=store.save(240,state),expected=[];for(let i=0;i<8;i++){raw.step();expected.push([...state]);}
 const t=performance.now();store.load(handle);const loadMs=performance.now()-t;raw.rollback();
 for(let i=0;i<8;i++){raw.step();if(JSON.stringify(state)!==JSON.stringify(expected[i]))throw Error('Rewind mismatch '+i);}
 const summary=key=>{const a=samples.slice(30).map(s=>s[key]).sort((a,b)=>a-b);return {mean:a.reduce((s,n)=>s+n,0)/a.length,p95:a[Math.floor(a.length*.95)],max:a.at(-1)};};
 return {growth,stepMs:summary('stepMs'),saveMs:summary('saveMs'),covers:summary('covers'),compares:summary('compares'),loadMs,used:raw.used(),mirrorCapacity:raw.mirror.capacity,mirrorGeneration:raw.mirror.generation,exactReplay:true,errors,samples};
};</script>`;
let variant='before',browser;
const server=createServer(async(req,res)=>{try{
 const p=new URL(req.url,'http://localhost').pathname;
 res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','credentialless');
 if(p==='/'){res.setHeader('Content-Type','text/html');return res.end(html);}
 const file=path.resolve(root,'.'+decodeURIComponent(p));if(!file.startsWith(root+path.sep))throw Error('Outside root');
 res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.wasm':'application/wasm','.json':'application/json'})[path.extname(file)]||'application/octet-stream');
 res.end(variant==='after'&&p==='/checkpoints.mjs'?candidate:variant==='after'&&p==='/page-compare.mjs'?comparatorCandidate:await readFile(file));
 }catch{res.writeHead(404);res.end();}});
await mkdir(out,{recursive:true});await new Promise((r,j)=>{server.once('error',j);server.listen(0,'127.0.0.1',r);});
const cleanup=async()=>{await browser?.close();server.closeAllConnections();server.close();};
for(const signal of ['SIGTERM','SIGINT'])process.once(signal,async()=>{await cleanup();process.exit(1);});
try{
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--autoplay-policy=no-user-gesture-required']});const results=[];
 for(variant of ['before','after']){
  const context=await browser.newContext({viewport:{width:800,height:600}}),page=await context.newPage();page.setDefaultTimeout(45000);const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.ready||window.errors.length);
  if(errors.length)throw Error(errors.join(';'));
  const result={variant,...await page.evaluate(()=>measure())};if(errors.length||result.errors.length)throw Error(JSON.stringify({errors,result}));
  console.log(JSON.stringify({...result,samples:undefined}));results.push(result);await context.close();
 }
 const hash=b=>createHash('sha256').update(b).digest('hex');
 await writeFile(path.join(out,'results.json'),JSON.stringify({date:new Date().toISOString(),browser:browser.version(),root,engineHash:hash(await readFile(path.join(root,'engine/BattleShip.wasm'))),beforeHash:hash(await readFile(path.join(root,'checkpoints.mjs'))),afterHash:hash(candidate),results},null,2));
}finally{await cleanup();}
