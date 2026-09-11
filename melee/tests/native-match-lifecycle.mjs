import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
const base=process.env.MELEE_URL||'http://127.0.0.1:8277/';
try {
  const page=await browser.newPage();
  await page.route('**/__lifecycle.html',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Native lifecycle fixture</title>'}));
  await page.route('**/match.html',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><script>window.addEventListener('message',e=>{if(e.data.kind==='melee-native-port'){const p=e.ports[0];p.onmessage=()=>{};}});</script>`}));
  await page.goto(new URL('__lifecycle.html',base).href);
  const cancellation=await page.evaluate(async()=>{
    const {createNativeMatch}=await import('./native-match.mjs');const abort=new AbortController();
    const pending=createNativeMatch({},()=>{},abort.signal).then(()=>({resolved:true}),e=>({message:e.message}));
    await new Promise(r=>setTimeout(r,100));abort.abort();
    return {...await pending,iframes:document.querySelectorAll('.native-match').length};
  });
  assert.equal(cancellation.iframes,0);assert.match(cancellation.message,/closed/);
  await page.unroute('**/match.html');
  await page.route('**/engine/melee.js',r=>r.fulfill({contentType:'text/javascript',body:'window.createMelee=options=>{options.instantiateWasm({},()=>{});return new Promise(()=>{});};'}));
  await page.route('**/engine/wasm.json',r=>r.fulfill({status:503,body:'Unavailable'}));
  const failure=await page.evaluate(async()=>{
    const {createNativeMatch}=await import('./native-match.mjs');const start=performance.now();
    try{await createNativeMatch({nativeSession:true,slots:[0,1]});return {resolved:true};}
    catch(error){return {message:error.message,ms:performance.now()-start,iframes:document.querySelectorAll('.native-match').length};}
  });
  assert.match(failure.message,/manifest.*unavailable|metadata|manifest|engine.*unavailable/i);
  assert.ok(failure.ms<5000,JSON.stringify(failure));assert.equal(failure.iframes,0);
  console.log('Native iframe cancellation and failed-engine startup cleanup passed.');
} finally {await browser.close();}
