const {chromium}=require(process.env.PLAYWRIGHT_MODULE),fs=require('node:fs');
(async()=>{let browser;try{
browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--enable-unsafe-swiftshader','--mute-audio']});
const page=await browser.newPage();let cdp=await page.context().newCDPSession(page);await cdp.send('Debugger.enable');
cdp.on('Debugger.paused',p=>{fs.writeFileSync('build/remix/conker-fix/paused.json',JSON.stringify(p,null,2));console.log('PAUSED',p.callFrames.map(f=>[f.functionName,f.location]));});
page.on('pageerror',e=>console.log('ERROR',String(e)));page.on('console',m=>{if(m.text().startsWith('FRAME'))console.log(m.text())});
await page.goto('http://127.0.0.1:4207/remix-check.html?battle=58,56,'+(process.env.STAGE||13)+',0&SSB64_REMIX_TEST=1&SSB64_YOUGAME_MUTE=1');await page.waitForFunction(()=>window.driver,{},{timeout:60000});
await page.evaluate(()=>{for(let i=0;(window.state?.[4]||0)<30&&i<900;i++)driver.step()});
await page.screenshot({path:'build/remix/conker-fix/initial.png'});
let rows=[];for(let n=0;n<260;n++){
const timer=setTimeout(()=>{console.log('HANG frame',n);cdp.send('Debugger.pause').catch(()=>{});},5000);
let result=await Promise.race([page.evaluate(n=>{pads=[[0,0,0],n<36?[0,80,0]:n===37?[16384,0,0]:[0,0,0]];console.log('FRAME',n,JSON.stringify(probe()));driver.step();return {state,probe:probe()};},n),new Promise((_,rej)=>setTimeout(()=>rej(Error('frame timeout '+n)),9000))]);clearTimeout(timer);rows.push(result);fs.writeFileSync('build/remix/conker-fix/trace.json',JSON.stringify(rows));
}
console.log('PASS');
}finally{if(browser)await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
