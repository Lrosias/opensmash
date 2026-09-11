import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,'yougame/test-results/native-room-app');
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'/Users/luis/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname;const file=pathname==='/yougame/src/engine/index.html'?path.join(root,'yougame/tests/native-room-engine-fixture.html'):path.resolve(root,'.'+pathname);if(!file.startsWith(root+path.sep))throw Error('Invalid path');res.setHeader('Content-Type',path.extname(file)==='.html'?'text/html':path.extname(file)==='.css'?'text/css':'text/javascript');res.end(await readFile(file));}catch{res.writeHead(404);res.end();}});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
let browser,timer;const evidence=[];
try{browser=await chromium.launch({headless:true,timeout:15000,args:['--mute-audio']});timer=setTimeout(()=>browser.close(),90000);
 for(const edition of ['original','remix'])for(const outcome of ['winner','unscored']){
  const page=await browser.newPage({viewport:{width:1000,height:812}}),errors=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://yougame.co/sdk.js',route=>route.fulfill({path:path.join(root,'yougame/tests/native-room-sdk-fixture.js'),contentType:'text/javascript'}));
  await page.route('**/game-profile.mjs',async route=>route.fulfill({body:(await readFile(path.join(root,'yougame/src/game-profile.mjs'),'utf8')).replace('YOUGAME_EDITION',edition),contentType:'text/javascript'}));
  await page.goto(`http://127.0.0.1:${server.address().port}/yougame/src/index.html`);
  await page.evaluate(()=>document.querySelector('iframe').contentWindow.bridge.menuAction(6,2));
  await page.waitForFunction(()=>nativeRoomFixture.syncs[0]?.running);
  assert.equal(await page.locator('#competitive').isVisible(),false,'Casual/Friends has no custom fighter or readiness UI');
  assert.equal(await page.evaluate(()=>nativeRoomFixture.beginCalls),1);
  const frame=page.frameLocator('iframe[title="OpenSmash64 online battle"]');await frame.locator('canvas').click();
  await page.keyboard.down('Enter');await page.evaluate(()=>nativeRoomFixture.syncs[0].advance());await page.keyboard.up('Enter');
  assert.deepEqual(await page.evaluate(()=>{const ports=nativeRoomFixture.engines.find(e=>e.native).ports;return [ports[0],ports[4],ports[8],ports[12],!!(ports[1]&4096)];}),[2,1,2,1,true],'Native Start and global controller holes reach the engine');
  await page.evaluate(outcome=>{nativeRoomFixture.unscored=outcome==='unscored';nativeRoomFixture.terminal=true;nativeRoomFixture.syncs[0].advance();},outcome);await page.waitForFunction(()=>nativeRoomFixture.syncs[1]?.running);
  assert.deepEqual(await page.evaluate(()=>nativeRoomFixture.finishes),[outcome==='unscored'?{void:true}:{winner:'p3'}]);assert.equal(await page.evaluate(()=>nativeRoomFixture.reports.length),outcome==='unscored'?0:1);
  assert.equal(await page.evaluate(()=>nativeRoomFixture.engines.filter(e=>e.native).length),1,'Settlement keeps the same native engine');
  await page.evaluate(()=>nativeRoomFixture.syncs[1].advance());
  assert.equal(await frame.locator('body').evaluate(()=>Module.nativeScene),27);
  assert.equal(await page.locator('#competitive').isVisible(),false,'Native results do not open an HTML results card');
  assert.equal(await page.evaluate(()=>nativeRoomFixture.finishes.length),1);
  await page.screenshot({path:path.join(out,`${edition}-${outcome}-native-result.png`)});
  await page.keyboard.press('Escape');await page.waitForFunction(()=>nativeRoomFixture.left===true);
  assert.equal(await page.locator('iframe').count(),1);assert.equal(await page.evaluate(()=>nativeRoomFixture.engines.filter(e=>e.native).every(e=>e.disposed)),true);assert.deepEqual(errors,[]);
  evidence.push({edition,outcome,noCustomSelection:true,startEnabled:true,globalPortHoles:true,sameEngineResultContinuation:true,leaveDisposesSession:true,errors});await page.close();
 }
 await writeFile(path.join(out,'verification.json'),JSON.stringify({scope:'Actual app/coordinator with explicit SDK and engine fixtures; native/hosted qualification belongs to root',evidence},null,2));console.log(JSON.stringify({passed:evidence.length,out}));
}finally{clearTimeout(timer);await browser?.close();await new Promise(resolve=>server.close(resolve));}
