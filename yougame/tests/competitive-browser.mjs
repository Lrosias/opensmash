import {createRequire} from 'node:module';import {mkdir,writeFile} from 'node:fs/promises';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_PATH||'/Users/luis/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base=process.env.COMPETITIVE_URL||'http://127.0.0.1:4184',sdkPath=process.env.YOUGAME_SDK_PATH||'/tmp/opensmash-slippi-research/sdk.js';
const out='yougame/test-results/competitive';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});const evidence=[];
try{for(const mobile of [false,true]){const context=await browser.newContext({viewport:mobile?{width:844,height:390}:{width:1280,height:900},hasTouch:mobile,isMobile:mobile});const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://yougame.co/sdk.js',r=>r.fulfill({path:sdkPath,contentType:'text/javascript'}));
 await page.goto(base+'/'+(mobile?'?touch=1':''));await page.getByRole('button',{name:'Competitive online',exact:true}).click();
 const marth=page.getByRole('button',{name:'Marth',exact:true});if(mobile)await marth.tap();else{await marth.focus();await page.keyboard.press('Enter');}
 if(await marth.getAttribute('aria-pressed')!=='true')throw new Error('Rendered keyboard/touch fighter selection failed');
 await page.screenshot({path:`${out}/${mobile?'mobile':'desktop'}-setup.png`});
 // Stub only the external lifecycle to verify each rendered entry's exact queue
 // and cancellation recovery. This is explicitly not a hosted matchmaking test.
 await page.evaluate(()=>{window.queueCalls=[];YouGame.multiplayer.open=async opts=>{window.queueCalls.push({queue:opts.queue,mode:opts.mode});throw new Error('Cancelled');};});
 for(const queue of ['Casual','Ranked','Friends']){const b=page.getByRole('button',{name:new RegExp('^'+queue)});if(mobile)await b.tap();else{await b.focus();await page.keyboard.press('Enter');}await page.getByRole('heading',{name:'Select your fighter'}).waitFor();}
 const queues=await page.evaluate(()=>window.queueCalls);if(queues.map(q=>q.queue).join(',')!=='casual,ranked,friends')throw new Error('Queue entry mismatch');
 await page.evaluate(async()=>{const pad={connected:true,axes:[0,0],buttons:Array.from({length:16},()=>({pressed:false}))};Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[pad]});const frames=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));pad.axes[0]=1;await frames();pad.axes[0]=0;await frames();pad.buttons[0].pressed=true;await frames();pad.buttons[0].pressed=false;await frames();});
 if(await page.getByRole('button',{name:'Mario',exact:true}).getAttribute('aria-pressed')!=='true')throw new Error('Gamepad focus/confirm failed');
 if(errors.length)throw new Error(errors.join('\n'));evidence.push({mobile,queues,virtualGamepad:true,errors});await context.close();
 }
 const preview=await browser.newPage({viewport:{width:1280,height:900}});await preview.goto(base+'/tests/competitive-preview.html');await preview.getByRole('heading',{name:'Your character counterpick'}).waitFor();await preview.getByRole('button',{name:'Roy',exact:true}).click();await preview.getByRole('button',{name:'Lock fighter',exact:true}).click();await preview.getByRole('heading',{name:'Opponent is choosing'}).waitFor();if(await preview.getByRole('button',{name:'Lock fighter',exact:true}).isEnabled())throw new Error('Counterpick lock stayed enabled out of turn');await preview.screenshot({path:`${out}/counterpick.png`});await preview.close();
 await writeFile(`${out}/browser.json`,JSON.stringify({scope:'Rendered UI and mocked SDK queue routing/cancel-retry; existing native binary. Hosted netplay not tested.',evidence},null,2));console.log(JSON.stringify(evidence));
}finally{await browser.close();}
