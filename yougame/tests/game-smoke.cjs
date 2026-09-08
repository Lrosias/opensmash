const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs/promises');
const assert=require('node:assert/strict');
const {menuFrame,battleFrame,key,openOnline,chooseFighter}=require('./native-helpers.cjs');
const base=process.env.GAME_URL||'http://127.0.0.1:4174';
async function watchBattle(p,field){
 await p.waitForFunction(()=>document.querySelector('iframe[title="OpenSmash online battle"]')?.contentWindow?.HEAP32,{},{timeout:120000});
 await p.evaluate(field=>{
  const M=document.querySelector('iframe[title="OpenSmash online battle"]').contentWindow.Module;
  const old=M.onYouGameState;window[field]=null;
  M.onYouGameState=(...args)=>{window[field]=args;old(...args);};
 },field);
 await p.waitForFunction(field=>window[field]?.[4]>120,field,{timeout:90000});
}
(async()=>{
 await fs.mkdir('yougame/test-results',{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required','--disable-background-timer-throttling','--disable-renderer-backgrounding']});
 let pages=[];
 try{
  const contexts=await Promise.all([0,1].map(()=>browser.newContext({viewport:{width:1280,height:800}})));
  pages=await Promise.all(contexts.map(c=>c.newPage()));const errors=[];
  for(const p of pages){
   p.on('pageerror',e=>{errors.push(e.message);console.log('error',e.message);});
   await p.goto(base);
   assert.equal(await p.locator('input[type="file"],#fighters,#casual,#ranked,#arena').count(),0,'No external launcher or ROM picker');
   await openOnline(p,process.env.RANKED==='1');
  }
  await pages[0].screenshot({path:'yougame/test-results/native-online.png'});
  await Promise.all(pages.map((p,i)=>chooseFighter(p,i)));
  await Promise.all(pages.map(p=>p.waitForFunction(()=>YouGame.multiplayer.room?.playing,{},{timeout:60000})));
  for(const p of pages)await p.evaluate(()=>YouGame.multiplayer.room.on('result',r=>window.gameResult=r));
  console.log('Both players started from native menus');
  await Promise.all(pages.map(p=>watchBattle(p,'lastGameState')));
  console.log('Game running',await Promise.all(pages.map(p=>p.evaluate(()=>lastGameState))));
  await pages[0].screenshot({path:'yougame/test-results/match.png'});
  const guest=(await pages[0].evaluate(()=>YouGame.multiplayer.room.isHost))?pages[1]:pages[0];
  await battleFrame(guest).contentFrame().locator('canvas').click();await guest.keyboard.down('ArrowRight');
  await Promise.all(pages.map(p=>p.waitForFunction(()=>window.gameResult,{},{timeout:150000})));
  await guest.keyboard.up('ArrowRight');
  const results=await Promise.all(pages.map(p=>p.evaluate(()=>({void:gameResult.void,won:gameResult.won,scores:gameResult.scores}))));
  assert.equal(results[0].void,false);assert.equal(results[1].void,false);assert.notEqual(results[0].won,results[1].won);assert.deepEqual(results[0].scores,results[1].scores);
  console.log('Engine knockout results',results);
  for(const p of pages){
   await menuFrame(p).waitFor({state:'visible'});assert.equal(await battleFrame(p).count(),0);
   assert.equal(await p.locator('#yg-root [data-a="ready"]:visible,#yg-root [data-a="close"]:visible').count(),0,'SDK overlays stay hidden');
  }
  await pages[0].waitForTimeout(600);await pages[0].screenshot({path:'yougame/test-results/native-result.png'});
  for(const p of pages){await menuFrame(p).contentFrame().locator('canvas').click();await key(p,'KeyM');}
  await Promise.all(pages.map(p=>p.waitForFunction(()=>YouGame.multiplayer.room?.round===2&&YouGame.multiplayer.room.playing,{},{timeout:20000})));
  await Promise.all(pages.map(p=>watchBattle(p,'secondRoundState')));
  console.log('Native rematch running');
  await battleFrame(pages[1]).contentFrame().locator('canvas').click();await pages[1].keyboard.press('Escape');
  await pages[0].waitForFunction(()=>document.querySelector('#status').textContent==='YOU WIN BY FORFEIT',{},{timeout:20000});
  console.log('Disconnect returned to native menu');
  for(const p of pages)assert.equal(await p.evaluate(async()=> (await indexedDB.databases()).some(db=>db.name==='opensmash-rom')),false);
  if(errors.length)throw new Error(errors.join('\n'));
 }catch(e){for(let i=0;i<pages.length;i++)await pages[i].screenshot({path:`yougame/test-results/failure-${i}.png`}).catch(()=>{});throw e;}
 finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
