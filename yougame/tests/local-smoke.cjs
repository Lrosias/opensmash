const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const {menuFrame,scene,key,openOnline,chooseFighter}=require('./native-helpers.cjs');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required']});
 try{
  const p=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.goto(process.env.GAME_URL||'http://127.0.0.1:4174');await scene(p,7);
  await p.screenshot({path:'yougame/test-results/native-main.png'});
  await openOnline(p);await chooseFighter(p);await scene(p,9);await p.waitForTimeout(600);
  await key(p,'KeyO');
  await p.waitForFunction(()=>document.querySelector('iframe').contentWindow.Module.yougameMenu.phase===0);
  await key(p,'KeyO');await scene(p,7);await p.waitForTimeout(500);
  // Online is the fifth entry. Down wraps back to original 1P Mode.
  await key(p,'ArrowDown');await key(p,'KeyM');await scene(p,8);await p.waitForTimeout(500);
  await key(p,'ArrowDown');await key(p,'KeyM');await scene(p,18);await p.waitForTimeout(1500);
  await p.screenshot({path:'yougame/test-results/native-training.png'});
  assert.equal(await p.locator('input[type="file"],button').count(),0);
  console.log('Native cancellation, back navigation, and original training screen passed.');
  if(errors.length)throw new Error(errors.join('\n'));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
