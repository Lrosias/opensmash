// Actual authored app + real set/session modules; fake SDK/controller transport
// and initialized engine. Separate native release acceptance remains required.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,'yougame/test-results/native-results-app');
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'/Users/luis/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{try{
 const pathname=new URL(req.url,'http://localhost').pathname;
 const file=pathname==='/yougame/src/engine/index.html'?path.join(root,'yougame/tests/native-results-engine-fixture.html'):path.resolve(root,'.'+pathname);
 if(!file.startsWith(root+path.sep))throw Error('Invalid path');
 res.setHeader('Content-Type',path.extname(file)==='.html'?'text/html':path.extname(file)==='.css'?'text/css':'text/javascript');res.end(await readFile(file));
}catch{res.writeHead(404);res.end();}});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
let browser;const evidence=[];
try{
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio']});
 for(const seat of [0,1])for(const outcome of ['won','lost','draw','void']){
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('https://yougame.co/sdk.js',route=>route.fulfill({path:path.join(root,'yougame/tests/native-results-sdk-fixture.js'),contentType:'text/javascript'}));
  await page.goto(`http://127.0.0.1:${server.address().port}/yougame/src/index.html?seat=${seat}&outcome=${outcome}`);
  await page.waitForFunction(()=>resultFixture.frames[0]?.ticks>1);
  await page.evaluate(()=>{resultFixture.originalMenu=document.querySelector('iframe').contentWindow.Module;});
  // Prove that the fixture exposes held raw adapter input to this actual app.
  await page.evaluate(()=>{resultFixture.held=true;window.focus();});
  await page.waitForFunction(()=>resultFixture.frames[0].ports[1]!==0&&resultFixture.frames[0].ports[2]>0);
  await page.evaluate(()=>{resultFixture.held=false;});
  // Native Online scene: Casual through the menu bridge, no browser picker.
  await page.evaluate(()=>document.querySelector('iframe').contentWindow.fixtureBridge.menuAction(6,0));
  await page.waitForFunction(()=>resultFixture.syncs[0]?.started);
  assert.equal(await page.evaluate(()=>resultFixture.exports.length),0,'No presentation before native result');
  await page.evaluate(()=>resultFixture.advance());
  await page.waitForFunction(()=>resultFixture.reports.length===1);
  assert.equal(await page.evaluate(()=>resultFixture.exports.length),0,'Native completion must wait for platform settlement');
  await page.evaluate(()=>resultFixture.room.emit('result',{round:0,won:true}));
  assert.equal(await page.evaluate(()=>resultFixture.exports.length),0,'Stale round must be ignored');
  await page.evaluate(()=>resultFixture.settle());
  await page.waitForFunction(()=>resultFixture.exports.length===1);
  const expectedWinner=outcome==='void'?-2:outcome==='draw'?-1:outcome==='won'?seat:1-seat;
  const stocks=outcome==='draw'?[1,1]:((outcome==='lost'?1-seat:seat)===0?[2,0]:[0,2]);
  assert.deepEqual(await page.evaluate(()=>resultFixture.exports),[[58,59,expectedWinner,...stocks]]);
  assert.equal(await page.locator('body.native-results').count(),1);
  assert.equal(await page.locator('#competitive.native-result').count(),1);
  assert.equal(await page.locator('iframe[title="OpenSmash64 online battle"]').count(),0);
  assert.equal(await page.locator('iframe[title="OpenSmash64 native menus"]').isVisible(),false);
  assert.equal(await page.locator('iframe[title="OpenSmash64 native results"]').isVisible(),true);
  assert.equal(await page.evaluate(()=>document.querySelector('iframe[title="OpenSmash64 native results"]').contentWindow.Module.nativeScene),27,'Cold menu initialization must complete before result export');
  assert.equal(await page.evaluate(()=>!!resultFixture.frames.find(f=>f.result).premature),false);
  assert.equal(await page.locator('#sdk-result-fixture').isVisible(),true);
  const oldTicks=await page.evaluate(()=>resultFixture.frames.findLast(f=>f.result).ticks);
  await page.evaluate(()=>{resultFixture.held=true;for(const frame of document.querySelectorAll('iframe')){frame.contentWindow.fixtureBridge.menuAction(3,0);frame.contentWindow.fixtureBridge.menuAction(2,0);}resultFixture.room.emit('result',{round:1,won:false});});
  await page.waitForFunction(ticks=>resultFixture.frames.findLast(f=>f.result).ticks>ticks+3,oldTicks);
  assert.deepEqual(await page.evaluate(()=>resultFixture.frames.findLast(f=>f.result).ports),[2,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0],'Native result input stays neutral behind dialog');
  assert.deepEqual(await page.evaluate(()=>[resultFixture.exports.length,resultFixture.readyCalls,resultFixture.leaveCalls]),[1,0,0]);
  await page.screenshot({path:path.join(out,`seat-${seat}-${outcome}.png`)});
  await page.evaluate(()=>{resultFixture.held=false;});
  await page.getByRole('button',{name:'Continue (SDK fixture)',exact:true}).click();
  await page.waitForFunction(()=>resultFixture.syncs.length===2&&resultFixture.syncs[1].started);
  await page.evaluate(()=>{resultFixture.room.emit('ready',{round:2});resultFixture.room.emit('result',{round:1,won:true});});
  assert.equal(await page.locator('body.native-results').count(),0);
  assert.equal(await page.locator('#competitive.native-result:visible').count(),0);
  assert.deepEqual(await page.evaluate(()=>[resultFixture.frames.filter(f=>f.battle).length,resultFixture.syncs.length,resultFixture.exports.length,resultFixture.readyCalls]),[2,2,1,1]);
  assert.equal(await page.locator('iframe[title="OpenSmash64 native results"]').count(),0);
  assert.equal(await page.evaluate(()=>resultFixture.frames.find(f=>f.result).disposed),true);
  // Continue while the separate results engine is still booting must cancel it.
  await page.evaluate(()=>{resultFixture.advance();resultFixture.deferResults=true;});
  await page.waitForFunction(()=>resultFixture.reports.length===2);
  await page.evaluate(()=>resultFixture.settle());
  await page.waitForFunction(()=>typeof resultFixture.releaseResultBoot==='function');
  assert.equal(await page.evaluate(()=>resultFixture.exports.length),1);
  await page.getByRole('button',{name:'Continue (SDK fixture)',exact:true}).click();
  await page.waitForFunction(()=>resultFixture.syncs.length===3&&resultFixture.syncs[2].started);
  await page.evaluate(()=>resultFixture.releaseResultBoot());
  assert.equal(await page.evaluate(()=>resultFixture.frames.filter(f=>f.result).every(f=>f.disposed)),true);
  assert.equal(await page.evaluate(()=>resultFixture.exports.length),1,'Late boot cannot revive a cancelled result');
  await page.evaluate(pending=>{resultFixture.deferResults=pending;delete resultFixture.releaseResultBoot;resultFixture.advance();},outcome==='void');
  await page.waitForFunction(()=>resultFixture.reports.length===3);
  await page.evaluate(()=>resultFixture.settle());
  if(outcome==='void')await page.waitForFunction(()=>typeof resultFixture.releaseResultBoot==='function');else await page.waitForFunction(()=>resultFixture.exports.length===2);
  await page.evaluate(async()=>{document.querySelector('#sdk-result-fixture').remove();if(resultFixture.deferResults){resultFixture.duringResultBoot=()=>resultFixture.room.emit('leave',{});await resultFixture.releaseResultBoot();}else resultFixture.room.emit('leave',{});});
  assert.equal(await page.evaluate(()=>resultFixture.exports.length),outcome==='void'?1:2,'Late boot after Leave must not export');
  await page.locator('#competitive').waitFor({state:'hidden'});
  assert.equal(await page.locator('iframe').count(),1);
  assert.equal(await page.locator('#competitive').isVisible(),false);
  assert.deepEqual(await page.evaluate(()=>{const m=document.querySelector('iframe').contentWindow.Module;return {same:m===resultFixture.originalMenu,roster:m.savedRoster,ports:m.savedPorts,exports:resultFixture.frames[0].exports,scene:m.nativeScene};}),{same:true,roster:[58,59,7,11],ports:['human','cpu','off','human'],exports:0,scene:7});
  await page.evaluate(()=>{resultFixture.owned=false;resultFixture.frames[0].localButtons=0;document.querySelector('iframe').contentWindow.focus();});
  await page.keyboard.press('KeyX');await page.keyboard.press('Enter');
  await page.waitForFunction(()=>(resultFixture.frames[0].localButtons&0x9000)===0x9000);
  assert.equal(await page.locator('iframe[title="OpenSmash64 native results"]').count(),0);
  assert.deepEqual(errors,[]);
  evidence.push({seat,outcome,args:[58,59,expectedWinner,...stocks],settlementRequired:true,duplicateAndStaleIgnored:true,rawHeldInputNeutral:true,resultTicksBehindDialog:true,nativeActionsCannotReadyOrLeave:true,freshRematchOnce:true,coldBootBeforeExport:true,pendingContinueCancelled:true,leaveDuringBootCancelled:outcome==='void',originalMenuAndRosterPortsPreserved:true,localAAndStartWork:true,errors});await page.close();
 }
 await writeFile(path.join(out,'verification.json'),JSON.stringify({scope:'Actual app/set/session with fake SDK transport, raw controller provider, and initialized engine; no native gameplay or deployed SDK claim',muted:true,cases:evidence},null,2));
 console.log(JSON.stringify({passed:evidence.length,out}));
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
