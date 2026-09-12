// Real Wasm engines, local pause export, graphics and audio; no network peer.
// Serve a rebuilt dist with melee/tools/serve.py and set MELEE_URL.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const out=process.env.MELEE_RESULTS||'build/melee-web/test-results/local-pause-native';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:process.env.MELEE_HEADED!=='1'});
const logs=[],errors=[],cycles=[];
let page;
let rejectStartup;
const startupFailure=new Promise((_,reject)=>{rejectStartup=reject;});startupFailure.catch(()=>{});
try {
  const diagnostics=await browser.newBrowserCDPSession();
  const {gpu}=await diagnostics.send('SystemInfo.getInfo');
  await writeFile(path.join(out,'environment.json'),JSON.stringify({browser:browser.version(),headless:process.env.MELEE_HEADED!=='1',gpu},null,2));
  await diagnostics.detach();
  page=await browser.newPage({viewport:{width:960,height:720}});
  if(process.env.YOUGAME_SDK_PATH){const sdk=await readFile(process.env.YOUGAME_SDK_PATH,'utf8');await page.route('https://yougame.co/sdk.js',route=>route.fulfill({contentType:'text/javascript',body:sdk}));}
  page.on('console',message=>{
    const line=message.text();logs.push(line);
    if(line.includes('Melee initialization failed:'))rejectStartup(Error(line));
  });page.on('pageerror',error=>errors.push(error.message));
  await page.goto(process.env.MELEE_URL||'http://127.0.0.1:8073/');
  await Promise.race([startupFailure,page.waitForFunction(()=>['running','error'].includes(window.melee?.phase),null,{timeout:240000})]);
  assert.equal(await page.evaluate(()=>melee.phase),'running',logs.slice(-20).join('\n'));
  await page.mouse.click(10,10);
  await page.waitForFunction(()=>melee.module._melee_menu_active()===1,null,{timeout:60000});
  const sample=()=>page.evaluate(()=>({frames:melee.module._melee_stats(),displayed:melee.displayedFrames,
    audioProduced:Atomics.load(new Uint32Array(melee.module.wasmMemory.buffer,melee.module._melee_audio_ring(),4),0),
    decoded:melee.assetStats.decodedBytes,blocked:melee.localPause.blocked}));
  await page.screenshot({path:path.join(out,'local-before.png')});
  for(let cycle=0;cycle<3;cycle++){
    await page.evaluate(async()=>{window.releaseLocal=await melee.localPause.acquire();});
    await page.waitForTimeout(500);const paused=await sample();assert.equal(paused.blocked,true);
    await page.keyboard.press('KeyA');await page.waitForTimeout(1200);
    const after=await sample();assert.equal(after.frames,paused.frames);assert.equal(after.audioProduced,paused.audioProduced);assert.equal(after.displayed,paused.displayed);assert.equal(after.decoded,paused.decoded);
    await page.evaluate(()=>{releaseLocal();window.releaseLocal=null;});
    await page.waitForFunction(frames=>!melee.localPause.blocked&&melee.module._melee_stats()>frames,after.frames,{timeout:30000});
    cycles.push({paused,after,resumed:await sample()});
  }
  // Boot and step a real second engine while the preserved menu is paused.
  await page.evaluate(async()=>{
    window.releaseLocal=await melee.localPause.acquire();
    const {createNativeSession}=await import('./native-match.mjs');
    window.pauseTestEngine=await createNativeSession({slots:[0,1]},status=>console.log('pause-test-online',JSON.stringify(status)));
    pauseTestEngine.show();
  });
  const onlineBefore=await sample();
  const stepped=await page.evaluate(async()=>{
    const first=pauseTestEngine.frame;
    for(let i=0;i<120;i++)await pauseTestEngine.step(Array.from({length:4},()=>[0,0,0,0,0,0,0]),{replaying:false});
    return {first,last:pauseTestEngine.frame};
  });
  assert.equal(stepped.last-stepped.first,120);const onlineAfter=await sample();
  assert.equal(onlineAfter.frames,onlineBefore.frames);assert.equal(onlineAfter.audioProduced,onlineBefore.audioProduced);
  assert.equal(onlineAfter.decoded,onlineBefore.decoded);
  await page.screenshot({path:path.join(out,'online-native-menu.png')});
  await page.evaluate(()=>{pauseTestEngine.destroy();releaseLocal();});
  await page.waitForFunction(frames=>!melee.localPause.blocked&&melee.module._melee_stats()>frames,onlineAfter.frames,{timeout:30000});
  await page.screenshot({path:path.join(out,'local-resumed.png')});
  assert.deepEqual(errors,[]);
  assert.deepEqual(await page.evaluate(()=>melee.errors),[]);
  await writeFile(path.join(out,'verification.json'),JSON.stringify({passed:true,browser:browser.version(),cycles,stepped,onlineBefore,onlineAfter,
    scope:'Real rebuilt local and native-session engines; controlled frame stepping, no network peer or combat FPS claim.'},null,2));
  console.log('Native local pause/resume and second-engine stepping passed.');
}catch(error){
  if(page){
    await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});
    const state=await page.evaluate(()=>({phase:window.melee?.phase,errors:window.melee?.errors,lastLog:window.melee?.lastLog,lastWarning:window.melee?.lastWarning,samples:window.melee?.samples?.slice(-3)})).catch(()=>null);
    await writeFile(path.join(out,'failure-state.json'),JSON.stringify(state,null,2));
  }
  throw error;
}finally{await writeFile(path.join(out,'console.log'),logs.join('\n'));await writeFile(path.join(out,'errors.json'),JSON.stringify(errors));await browser.close();}
