// Actual Wasm rewind, delayed two-peer convergence, and KO settlement.
// First generate .sdk-sync.mjs with extract-sdk.mjs and YOUGAME_SDK_PATH.
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const root=path.resolve(import.meta.dirname,'..'),output=path.join(root,'test-results/performance/verification');
const allowed=new Set(['tests/rollback-engine.html','tests/rollback-pair.html','tests/.sdk-sync.mjs',
 'src/checkpoints.mjs','src/rollback-engine.mjs','src/rollback-session.mjs','src/lockstep.mjs',
 'dist/page-compare.mjs','dist/page-compare.wasm','dist/frame-clock.mjs','dist/audio-output.mjs','dist/audio-ring.mjs','dist/audio-worklet.mjs']);
const server=createServer(async(req,res)=>{try{
 const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1),file=path.resolve(root,name);
 if(!file.startsWith(root+path.sep)||(!allowed.has(name)&&!file.startsWith(path.join(root,'dist/engine/'))))throw Error('Not a fixture');
 res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','credentialless');
 res.setHeader('Content-Type',({'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.json':'application/json','.wasm':'application/wasm'})[path.extname(file)]||'application/octet-stream');
 res.end(await readFile(file));
 }catch{res.writeHead(404);res.end();}});
await mkdir(output,{recursive:true});await new Promise((r,j)=>{server.once('error',j);server.listen(0,'127.0.0.1',r);});let browser;
try{
 browser=await chromium.launch({channel:'chrome',headless:false,args:['--autoplay-policy=no-user-gesture-required']});
 for(const [name,url]of [['rewind','rollback-engine.html'],['pair','rollback-pair.html'],['ko','rollback-pair.html?ko=1']]){
  const page=await browser.newPage({viewport:{width:1024,height:800}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto('http://127.0.0.1:'+server.address().port+'/tests/'+url);
  await page.waitForFunction(()=>!document.querySelector('#run').disabled||/FAIL|ENGINE ERROR/.test(document.querySelector('#report').textContent),null,{timeout:90000});
  if(await page.locator('#run').isDisabled())throw Error(await page.locator('#report').textContent());
  await page.locator('#run').click();await page.waitForFunction(()=>/PASS:|FAIL:/.test(document.querySelector('#report').textContent),null,{timeout:120000});
  const report=await page.locator('#report').textContent();console.log(name+': '+report);
  if(errors.length||report.includes('FAIL:'))throw Error(errors.join(';')+'\n'+report);
  await writeFile(path.join(output,name+'.txt'),report);await page.screenshot({path:path.join(output,name+'.png')});await page.close();
 }
}finally{await browser?.close();await new Promise(r=>server.close(r));}
