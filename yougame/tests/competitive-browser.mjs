import {createRequire} from 'node:module';import {mkdir,writeFile} from 'node:fs/promises';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_PATH||'/Users/luis/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base=process.env.COMPETITIVE_URL||'http://127.0.0.1:4184',sdkPath=process.env.YOUGAME_SDK_PATH||'/tmp/opensmash-slippi-research/sdk.js';
const out='yougame/test-results/competitive';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});const evidence=[];
try{
 // The browser mode/fighter picker is gone; the native Online scene is the only entry.
 const preview=await browser.newPage({viewport:{width:1280,height:900}});await preview.goto(base+'/tests/competitive-preview.html');await preview.getByRole('heading',{name:'Your character counterpick'}).waitFor();await preview.getByRole('button',{name:'Roy',exact:true}).click();await preview.getByRole('button',{name:'Lock fighter',exact:true}).click();await preview.getByRole('heading',{name:'Opponent is choosing'}).waitFor();if(await preview.getByRole('button',{name:'Lock fighter',exact:true}).isEnabled())throw new Error('Counterpick lock stayed enabled out of turn');await preview.screenshot({path:`${out}/counterpick.png`});await preview.close();
 await writeFile(`${out}/browser.json`,JSON.stringify({scope:'Rendered ranked counterpick card only; the native scene owns online entry. Hosted netplay not tested.',evidence},null,2));console.log(JSON.stringify(evidence));
}finally{await browser.close();}
