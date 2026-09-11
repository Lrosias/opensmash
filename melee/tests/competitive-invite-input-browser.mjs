// Actual SDK keyboard + production invited-page/app/adapter path. Only the room
// transport and native engine are fixtures; this does not claim hosted gameplay.
import {createRequire} from 'node:module';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const sdk=await readFile(process.env.YOUGAME_SDK_PATH,'utf8');
const asyncSDK=sdk.slice(sdk.indexOf('  function canon('),sdk.indexOf('  // A hidden tab'))+
  sdk.slice(sdk.indexOf('  function makeAsyncRollback('),sdk.indexOf('  /* ---------- host-authoritative kit:'));
assert.ok(asyncSDK.includes('function makeAsyncRollback'));
const out=process.env.MELEE_RESULTS||'melee/test-results/invite-input';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});const errors=[];
try{
 const context=await browser.newContext(),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/engine/melee.js',r=>r.fulfill({body:'/* Engine fixture supplied after invitation acceptance. */',contentType:'text/javascript'}));
 await context.route('https://yougame.co/sdk.js',r=>r.fulfill({contentType:'text/javascript',body:sdk+'\n'+asyncSDK+`
 window.inputSetups=0;window.queueCalls=[];window.onlineClicks=0;
 const originalSetup=YouGame.input.setup;YouGame.input.setup=function(...args){inputSetups++;return originalSetup.apply(this,args)};
 YouGame.ready=async()=>{};Object.defineProperty(YouGame.multiplayer,'invite',{value:'fixture-incoming-invite'});
 const handlers=new Map();
 const room=window.inviteRoom={me:'b',players:[{id:'a',name:'Host'},{id:'b',name:'Recipient'}],round:1,seed:77,ranked:false,queue:'private',playing:true,
 on(e,f){if(!handlers.has(e))handlers.set(e,new Set());handlers.get(e).add(f)},off(e,f){handlers.get(e)?.delete(f)},
 emit(e,d){for(const f of handlers.get(e)??[])f(d)},leave(){},
 send(data){if(data.kind==='engine-ready')queueMicrotask(()=>room.emit('message',{from:'a',data:{...data,ack:true}}))},
 rollbackAsync(options){return makeAsyncRollback(room,options)}};
 YouGame.multiplayer.open=async options=>{queueCalls.push(options);return room};
 document.addEventListener('click',e=>{if(e.target.closest('#online'))onlineClicks++});
 `}));
 await page.goto(process.env.MELEE_URL||'http://127.0.0.1:54738/');
 await page.getByRole('heading',{name:'Choose your fighter.'}).waitFor();
 await page.waitForFunction(()=>melee.competitive.adapterFactory);
 assert.equal(await page.evaluate(()=>inputSetups),0,'Fresh invitation bypasses the Online button setup');
 await page.getByRole('button',{name:'Lock fighter →',exact:true}).click();
 await page.waitForFunction(()=>melee.competitive.session?.adapter);
 assert.equal(await page.evaluate(()=>onlineClicks),0);assert.equal(await page.evaluate(()=>inputSetups),1);
 assert.equal(await page.evaluate(()=>melee.competitive.session.seat),1);
 await page.evaluate(async()=>{
  const adapter=window.inviteAdapter=melee.competitive.session.adapter;
  const launch={game:1,seed:77,stage:31,selections:[{fighter:20,color:0},{fighter:2,color:0}]};
  adapter.createEngine=async()=>({initial:{checksum:'fixture-start',match:{stage:31,fighters:[20,2]}},active:true,closed:false,frame:0,
   checkpointStats:async()=>({count:0}),manageCheckpoints:async()=>{},destroy(){this.closed=true;},show(){}});
  await adapter.prepare(launch);document.activeElement?.blur();document.body.tabIndex=-1;document.body.focus();
 });
 const samples=[];
 for(const [key,index,check] of [['4',1,'right'],['2',1,'left'],['m',0,'attack'],['p',0,'jump']]){
  await page.keyboard.down(key);
  await page.waitForFunction(({index,check})=>{const p=inviteAdapter.input();return check==='right'?p[index]>.6:check==='left'?p[index]<-.6:check==='attack'?!!(p[index]&1):!!(p[index]&4)},{index,check});
  const pad=await page.evaluate(()=>inviteAdapter.input());assert.equal(pad.length,7);assert.ok(pad.every(Number.isFinite));samples.push({key,pad});
  await page.keyboard.up(key);await page.waitForFunction(index=>inviteAdapter.input()[index]===0,index);
 }
 assert.equal(await page.evaluate(()=>YouGame.input.player(0).state.source),'keyboard');
 assert.deepEqual(await page.evaluate(()=>inviteAdapter.input()),[0,0,0,0,0,0,0]);
 assert.deepEqual(await page.evaluate(()=>queueCalls.map(q=>q.queue)),['friends']);
 await page.evaluate(async()=>{await melee.competitive.session.stop();});assert.deepEqual(errors,[]);
 await writeFile(out+'/verification.json',JSON.stringify({passed:true,scope:'Production fresh-invite app and prepared adapter; actual downloaded SDK keyboard, fixture room/native engine',onlineClicks:0,inputSetups:1,localRoomSeat:1,samples,neutralAfterRelease:true,errors},null,2));
 console.log('Fresh invited recipient initializes actual SDK keyboard before adapter preparation');
}finally{await browser.close();}
