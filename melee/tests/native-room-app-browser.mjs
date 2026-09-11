// Production app, native iframe bridge and SDK input. Transport/engine are fixtures.
import {createRequire} from 'node:module';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'../..');
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const sdk=await readFile(process.env.YOUGAME_SDK_PATH||'/Users/luis/Documents/YouGame-Library-Lobby-Retrofit-20260911/tested-sdk.js','utf8');
const server=createServer(async(req,res)=>{try{const name=path.join(root,new URL(req.url,'http://test').pathname);if(!name.startsWith(root+'/'))throw Error('path');const data=await readFile(name);res.setHeader('content-type',name.endsWith('.mjs')||name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.html')?'text/html':'application/octet-stream');res.end(data);}catch{res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}/melee/src/index.html`;
const browser=await chromium.launch({channel:'chrome',headless:true}),results=[];
const fixture=`
window.calls=[];window.inputSetups=0;const setup=YouGame.input.setup;YouGame.input.setup=function(...a){inputSetups++;return setup.apply(this,a)};
YouGame.ready=async()=>{};YouGame.multiplayer.leave=()=>{};
YouGame.multiplayer.joinLobby=async options=>{
 calls.push(options);if(window.cancelNext){window.cancelNext=false;throw Error('Cancelled');}
 const listeners=new Map(),participants=[{id:'p2',name:'You',connectionId:'a',slot:1,localIndex:1},{id:'p4',name:'Other',connectionId:'b',slot:3,localIndex:0}];
 const room=window.fixtureRoom={me:'a',isHost:true,queue:options.queue==='friends'?'private':options.queue,playing:false,round:1,revision:1,seed:5,connected:true,participants,players:[{id:'a',name:'You'},{id:'b',name:'Other'}],localParticipants:[participants[0]],size:options.players,lobby:{minPlayers:2},
 on(e,f){if(!listeners.has(e))listeners.set(e,new Set());listeners.get(e).add(f);},off(e,f){listeners.get(e)?.delete(f);},emit(e,d){for(const f of [...listeners.get(e)||[]])f(d);},
 send(data){if(data.type==='native-prepared'||data.type==='native-armed'||data.type==='native-terminal')queueMicrotask(()=>room.emit('message',{from:'b',data:structuredClone(data)}));},
 beginMatch(){this.playing=true;this.matchId='round-'+this.round;this.matchParticipants=structuredClone(participants);this.emit('ready',{});return Promise.resolve();},
 reportGame(){return Promise.resolve();},finish(){return Promise.resolve();},leave(){this.left=true;},
 rollbackAsync(options){const sync=window.fixtureSync={options,running:false,start(){this.running=true;},stop(){this.running=false;return Promise.resolve();},receive(){},on(){}};return sync;}};return room;
};`;
const engine=`<!doctype html><body>Fixture native Melee canvas<script>
addEventListener('message',event=>{if(event.data.kind!=='melee-native-port')return;const port=event.ports[0];let frame=5,mask=0;
port.onmessage=({data})=>{let value={};if(data.method==='boot'){if(!data.args[0].nativeSession)throw Error('Expected normal native menu');mask=data.args[0].slots.reduce((m,s)=>m|(1<<s),0);parent.fixtureLaunch=data.args[0];}
if(data.method==='boot'||data.method==='step'){if(data.method==='step'){frame++;parent.fixturePads=data.args[0];}value={frame,hash:12,result:null,nativeSession:{phase:1,battleId:0,seatMask:mask,receipt:null}};}
port.postMessage({id:data.id,value});};});</script>`;
try{
 for(const mode of ['casual','friends','invite','cancel','ranked']){
  const context=await browser.newContext({viewport:{width:1000,height:800}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await context.route('https://yougame.co/sdk.js',r=>r.fulfill({contentType:'text/javascript',body:sdk+'\n'+fixture+(mode==='invite'?"Object.defineProperty(YouGame.multiplayer,'invite',{value:'fixture-invite'});":'')}));
  await context.route('**/engine/melee.js',r=>r.fulfill({contentType:'text/javascript',body:'/* Native engine fixture in match.html */'}));
  await context.route('**/engine/wasm.json',r=>r.fulfill({json:{sha256:'a'.repeat(64)}}));
  await context.route('**/match.html',r=>r.fulfill({contentType:'text/html',body:engine}));
  await page.goto(url);await page.waitForFunction(()=>melee.competitive.adapterFactory);
  if(mode!=='invite'){await page.locator('#online').click();if(mode==='cancel')await page.evaluate(()=>window.cancelNext=true);await page.locator(`[data-action=queue][data-value=${mode==='cancel'?'casual':mode}]`).click();}
  if(mode==='cancel'){
   await page.waitForFunction(()=>!melee.competitive.connecting);assert.equal(await page.locator('iframe.native-match').count(),0);assert.equal(await page.locator('[data-action=lobby-fighter]').count(),0);assert.equal(await page.locator('[data-action=queue]').count(),3);
  }else if(mode==='ranked'){
   await page.locator('[data-action=lobby-fighter]').first().waitFor();assert.equal(await page.locator('iframe.native-match').count(),0);assert.equal(await page.evaluate(()=>calls[0].mode),'opensmash-melee-sets-v1');
  }else{
   await page.waitForFunction(()=>melee.competitive.session?.running);assert.equal(await page.locator('#competitive').isVisible(),false);assert.equal(await page.locator('[data-action=lobby-fighter]').count(),0);assert.equal(await page.getByRole('button',{name:'Ready',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'Start game',exact:true}).count(),0);
   assert.deepEqual(await page.evaluate(()=>fixtureLaunch),{nativeSession:true,slots:[1,3]});assert.equal(await page.evaluate(()=>inputSetups),1);
   await page.evaluate(async()=>{const n=()=>[0,0,0,0,0,0,0],a=Array.from({length:4},n),b=Array.from({length:4},n);a[1]=[256,0,0,0,0,0,0];b[0]=[512,0,0,0,0,0,0];const {encodeNativePads}=await import('./native-room-session.mjs');await fixtureSync.options.step(0,{a:encodeNativePads(a),b:encodeNativePads(b)},{replaying:false});});
   assert.deepEqual(await page.evaluate(()=>fixturePads.map(p=>p[0])),[0,256,0,512]);
   await page.getByRole('button',{name:'Leave online',exact:true}).click();assert.equal(await page.locator('iframe.native-match').count(),0);assert.equal(await page.locator('#welcome').isVisible(),true);assert.equal(await page.evaluate(()=>fixtureRoom.left),true);
  }
  assert.deepEqual(errors,[]);results.push({mode,passed:true});await context.close();
 }
 const output=process.env.MELEE_RESULTS||'melee/test-results/native-room-app';await mkdir(output,{recursive:true});await writeFile(path.join(output,'verification.json'),JSON.stringify({scope:'Production app + iframe bridge + actual SDK input; transport/native engine are fixtures. No native gameplay or hosted acceptance claim.',results},null,2));console.log(JSON.stringify(results));
}finally{await browser.close();await new Promise(r=>server.close(r));}
