// Reproduce YouGame's non-isolated parent and sandboxed cross-origin player.
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {writeFile} from 'node:fs/promises';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const target=process.env.MELEE_URL||'http://127.0.0.1:8075/';
const prefix=process.env.MELEE_RESULTS_PREFIX||(process.env.MELEE_URL?'lite-hosted-embedded':'lite-embedded');
const out=new URL('../../build/melee-web/test-results/',import.meta.url);
const parentHTML=`<!doctype html><meta name="viewport" content="width=device-width"><style>body{margin:0;background:#121212}iframe{border:0;width:100vw;height:100vh}</style><iframe src="${target}" sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-forms allow-modals allow-popups" allow="fullscreen; autoplay; gamepad; accelerometer; gyroscope; web-share; clipboard-write"></iframe>`;
const server=createServer((req,res)=>{
 res.writeHead(200,{'Content-Type':'text/html'});res.end(parentHTML);
});
await new Promise(resolve=>server.listen(8076,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:false,...(process.env.MELEE_BROWSER_CHANNEL?{channel:process.env.MELEE_BROWSER_CHANNEL}:{})});
const page=await browser.newPage({viewport:{width:1280,height:720}});
const failedLoads=[];page.on('response',r=>{if(r.status()>=400)failedLoads.push({url:r.url(),status:r.status()});});
const errors=[];page.on('pageerror',e=>errors.push(String(e)));
try {
 // The hosted child's CSP permits YouGame parents only. Serve this test fixture
 // locally through Playwright at an allowed parent origin; child requests remain
 // untouched and use the real CDN's CSP and isolation response headers.
 const parentURL=process.env.MELEE_URL?'https://yougame.co/__opensmash_lite_test':'http://127.0.0.1:8076';
 if(process.env.MELEE_URL)await page.route(parentURL,r=>r.fulfill({status:200,contentType:'text/html',body:parentHTML}));
 await page.goto(parentURL);
 const frame=page.frameLocator('iframe');
 if(await frame.locator('.title-art').count()){
   await frame.locator('.title-art').evaluate(img=>img.decode());
   await page.screenshot({path:new URL(prefix+'-opening.png',out).pathname});
 }
 await frame.waitForFunction(()=>['running','error'].includes(window.melee?.phase),null,{timeout:240000});
 const child=page.frames().find(f=>f.url().startsWith(new URL(target).origin));
 await child.waitForFunction(()=>window.melee?.samples?.at(-1)?.presents>180,{},{timeout:240000});
 const performanceReport=await frame.evaluate(()=>({engineSha256:window.melee.engineSha256,samples:window.melee.samples,phase:window.melee.phase}));
 if(!performanceReport.engineSha256||!performanceReport.samples.length)throw Error('Performance report is incomplete');
 if(await child.evaluate(()=>document.activeElement?.id==='report'))throw Error('Report retained keyboard focus');
 await frame.locator('#canvas').click();
 await page.keyboard.press('m');
 await page.keyboard.down('o');await page.waitForTimeout(1600);await page.keyboard.up('o');
 await page.waitForTimeout(3500);
 const report={browserVersion:browser.version(),browserChannel:process.env.MELEE_BROWSER_CHANNEL||'bundled-chromium',failedLoads,parentIsolated:await page.evaluate(()=>crossOriginIsolated),child:await child.evaluate(()=>({isolated:crossOriginIsolated,sharedMemory:typeof SharedArrayBuffer!=='undefined',phase:melee.phase,sample:melee.samples.at(-1),errors:melee.errors})),errors};
 await writeFile(new URL(prefix+'.json',out),JSON.stringify(report,null,2));
 await page.screenshot({path:new URL(prefix+'.png',out).pathname,timeout:5000});
 console.log(report);
 if(report.parentIsolated||!report.child.isolated||report.child.errors.length||errors.length)throw Error('Embedded threading failed');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
