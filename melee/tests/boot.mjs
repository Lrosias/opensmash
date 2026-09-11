// Exercise the actual Wasm engine. A screenshot or a loaded canvas alone is not a pass.
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const output=path.resolve(import.meta.dirname,'../../build/melee-web/test-results');
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:process.env.HEADLESS==='1',
  args:['--disable-backgrounding-occluded-windows','--disable-renderer-backgrounding']});
const page=await browser.newPage({viewport:{width:1024,height:768}});
const events=[];
page.on('console',m=>{const event={type:m.type(),text:m.text()};events.push(event);if(m.type()==='error')console.log(event);});
page.on('pageerror',e=>{events.push({type:'pageerror',text:String(e)});console.error(String(e));});
page.on('requestfailed',r=>events.push({type:'requestfailed',url:r.url(),failure:r.failure()}));
try {
  await page.goto(process.env.MELEE_URL||'http://127.0.0.1:8073');
  /* the page boots on load */await page.waitForFunction(()=>['running','error'].includes(window.melee?.phase),null,{timeout:240000});
  const started=Date.now();
  let snapshot;
  for(let i=0;i<24;i++){
    await page.waitForTimeout(5000);
    snapshot=await page.evaluate(()=>({phase:melee.phase,errors:melee.errors,lastLog:melee.lastLog,lastWarning:melee.lastWarning,samples:melee.samples,isolated:crossOriginIsolated}));
    console.log(JSON.stringify({...snapshot,samples:snapshot.samples.slice(-1)}));
    if(snapshot.errors.length)break;
    if(snapshot.phase==='running'&&snapshot.samples.length>=30)break;
  }
  await writeFile(path.join(output,'boot.json'),JSON.stringify({elapsedMs:Date.now()-started,snapshot,events},null,2));
  await page.screenshot({path:path.join(output,'boot.png'),timeout:5000});
  if(snapshot?.phase!=='running'||snapshot.errors.length||!snapshot.samples.some(s=>s.presents>120))
    throw Error('The real Melee engine did not produce sustained frames; see boot.json.');
  console.log('Engine presents frames. Interactive gameplay, audio and hosted iframe verification remain separate.');
} finally {
  await writeFile(path.join(output,'console.json'),JSON.stringify(events,null,2));
  await browser.close();
}
