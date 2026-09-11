// Actual game wrapper + real YouGame SDK, fake native menu bridge and sockets.
// Hosted acceptance must additionally exercise the unchanged native scene.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,'yougame/test-results/native-online-cancel');
const sdk=process.env.YOUGAME_SDK_PATH;if(!sdk)throw Error('Set YOUGAME_SDK_PATH to the reviewed current SDK');
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'/Users/luis/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname;
 const file=pathname==='/yougame/src/app.mjs'&&process.env.APP_SOURCE_PATH?process.env.APP_SOURCE_PATH:pathname==='/yougame/src/engine/index.html'?path.join(root,'yougame/tests/native-online-cancel-engine.html'):path.resolve(root,'.'+pathname);
 if(file!==process.env.APP_SOURCE_PATH&&!file.startsWith(root+path.sep))throw Error('Invalid path');
 res.setHeader('Content-Type',path.extname(file)==='.html'?'text/html':path.extname(file)==='.css'?'text/css':'text/javascript');res.end(await readFile(file));
}catch{res.writeHead(404);res.end();}});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
let browser,watchdog,currentPage;const evidence=[];
try{
 browser=await chromium.launch({headless:true,args:['--mute-audio']});watchdog=setTimeout(()=>browser.close(),120000);
 for(const edition of ['original','remix'])for(const width of [1440,1000,375]){
  const context=await browser.newContext({viewport:{width,height:812}});const page=await context.newPage(),errors=[];currentPage=page;page.setDefaultTimeout(10000);
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/game-profile.mjs',async route=>route.fulfill({body:(await readFile(path.join(root,'yougame/src/game-profile.mjs'),'utf8')).replace('YOUGAME_EDITION',edition),contentType:'text/javascript'}));
  await page.route('https://yougame.co/sdk.js',route=>route.fulfill({path:sdk,contentType:'text/javascript'}));
  await page.route('**/api/multiplayer/ticket',route=>{const request=route.request().postDataJSON();return route.fulfill({json:{url:'https://rooms.example.invalid',ticket:'test-ticket',queue:request.room?'private':request.queue,room:request.room}});});
  await page.addInitScript(()=>{
   window.sockets=[];
   window.WebSocket=class{
    static OPEN=1;static CLOSED=3;
    constructor(url){this.url=url;this.readyState=0;this.closed=false;sockets.push(this);queueMicrotask(()=>{if(!this.closed){this.readyState=1;this.onopen?.({});}});}
    send(){} close(code=1000,reason=''){if(this.closed)return;this.closed=true;this.readyState=3;this.closeReason=reason;queueMicrotask(()=>this.onclose?.({code,reason}));}
   };
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/yougame/src/index.html`);
  const native=page.frameLocator('iframe[title="OpenSmash64 native menus"]');
  await native.getByRole('button',{name:'Casual',exact:true}).waitFor();
  await page.evaluate(()=>{window.originalMenu=document.querySelector('iframe').contentWindow.Module;});
  for(const queue of ['Casual','Ranked','Casual']){
   await native.getByRole('button',{name:queue,exact:true}).click();
   await page.getByRole('button',{name:'Cancel',exact:true}).click();
   await native.getByRole('button',{name:'Casual',exact:true}).waitFor();
   assert.equal(await page.locator('#competitive').isVisible(),false,'Native entry must not return to the custom mode picker');
   assert.equal(await page.evaluate(()=>document.querySelector('iframe').contentWindow.bridge.menuState().phase),0);
   assert.equal(await page.evaluate(()=>sockets.every(s=>s.closed)),true,'Cancel closes the pending queue before retry');
   assert.equal(await page.evaluate(()=>document.querySelector('iframe').contentWindow.Module===originalMenu),true);
  }
  // Native Back cancels Friends while its room connection is pending. Late
  // connection rejection must not revive a browser picker or orphan a room.
  await native.getByRole('button',{name:'Friends',exact:true}).click();
  await page.waitForFunction(()=>sockets.some(s=>!s.closed&&s.url.includes('/room/')));
  await native.getByRole('button',{name:'Back',exact:true}).click();
  await native.getByRole('button',{name:'Casual',exact:true}).waitFor();
  assert.equal(await page.locator('#competitive').isVisible(),false);
  assert.equal(await page.evaluate(()=>sockets.every(s=>s.closed)),true);
  // The native scene is the only online entry; the old browser button is gone.
  assert.equal(await page.getByRole('button',{name:'Competitive online',exact:true}).count(),0,'No separate browser online entry');
  assert.equal(await page.locator('#online-entry').count(),0);
  await native.getByRole('button',{name:'Casual',exact:true}).click();
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await native.getByRole('button',{name:'Casual',exact:true}).waitFor();
  assert.equal(await page.locator('#competitive').isVisible(),false,'A later native entry must restore native ownership');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);await page.screenshot({path:path.join(out,`cancel-${edition}-${width}.png`)});
  evidence.push({edition,width,realSdk:true,nativeBridgeFixture:true,casualRankedCancelRetry:true,friendsPendingLeave:true,originalMenuPreserved:true,browserEntryRemoved:true,errors});await context.close();
 }
 await writeFile(path.join(out,'verification.json'),JSON.stringify({scope:'Actual app and real SDK with mocked network/native bridge; no hosted or native gameplay claim',evidence},null,2));console.log(JSON.stringify({passed:evidence.length,out}));
}catch(error){if(currentPage&&!currentPage.isClosed()){await currentPage.screenshot({path:path.join(out,'failure.png')});console.log(await currentPage.evaluate(()=>({text:document.body.innerText,sockets:sockets.map(s=>({url:s.url,closed:s.closed})),phase:document.querySelector('iframe')?.contentWindow.bridge?.menuState()})));}throw error;}finally{clearTimeout(watchdog);await browser?.close();await new Promise(resolve=>server.close(resolve));}
