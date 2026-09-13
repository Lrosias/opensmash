// Production app + native iframe bridge + actual SDK input; the platform transport and
// the native engines are fixtures. The mode menu itself is native (Menu.cpp); the
// fixture drives its callback exactly as the engine does (action 6 = pick a queue,
// 2 = back, 4 = try again) and checks what the page does with it.
import {createRequire} from 'node:module';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'../..');
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const sdk=await readFile(process.env.YOUGAME_SDK_PATH||'/Users/luis/Documents/YouGame-Library-Lobby-Retrofit-20260911/tested-sdk.js','utf8');
const server=createServer(async(req,res)=>{try{const name=path.join(root,new URL(req.url,'http://test').pathname);if(!name.startsWith(root+path.sep))throw Error('path');const data=await readFile(name);res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','credentialless');res.setHeader('content-type',name.endsWith('.mjs')||name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.html')?'text/html':'application/octet-stream');res.end(data);}catch{res.statusCode=404;res.end();}});
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
port.onmessage=({data})=>{let value={};if(data.method==='boot'){if(parent.failNative){port.postMessage({id:data.id,error:'Fixture native boot failed'});return;}if(!data.args[0].nativeSession)throw Error('Expected a native session');mask=data.args[0].slots.reduce((m,s)=>m|(1<<s),0);parent.fixtureLaunch=data.args[0];}
if(data.method==='boot'||data.method==='step'){if(data.method==='step'){frame++;parent.fixturePads=data.args[0];}value={frame,hash:12,result:null,nativeSession:{phase:1,battleId:0,seatMask:mask,receipt:null}};}
port.postMessage({id:data.id,value});};});</script>`;
const localEngine=`const RealAudioContext=window.AudioContext;window.AudioContext=class extends RealAudioContext{constructor(...args){super(...args);window.localAudio=this;}};
window.createMelee=async options=>{
 window.localFixture={frames:0,paused:false,transitions:[],pads:[]};
 new Uint32Array(options.wasmMemory.buffer,0,4).set([0,0,0,8192]);
 const canvas=new OffscreenCanvas(320,240);canvas.getContext('2d');
 return {_melee_prepare_assets:()=>0,_melee_shader_cache_format:()=>0,_melee_audio_ring:()=>0,
  _melee_stats:()=>localFixture.frames,_melee_speed:()=>1,_melee_vps:()=>60,_melee_asset_misses:()=>0,
  _melee_shader_count:()=>0,_melee_shader_millis:()=>0,_melee_shader_max:()=>0,_melee_downloaded_bytes:()=>0,
  _melee_frame_ack(){},_melee_input(seat,...pad){localFixture.pads[seat]=pad;},ccall(){},FS:{readFile(){throw Error('empty');}},
  _melee_local_pause(sequence,paused){setTimeout(()=>{localFixture.paused=!!paused;localFixture.transitions.push(!!paused);options.onMeleeLocalPause(sequence,1);},20);return 1;},
  callMain(){setInterval(()=>{if(!localFixture.paused){localFixture.frames++;options.onMeleeFrame(canvas.transferToImageBitmap());}},16);}
 };
};`;
try{
 for(const mode of ['casual','friends','invite','cancel','ranked-disabled','engine-failure','close','escape','waiting']){
  const context=await browser.newContext({viewport:{width:1000,height:800}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));const console_=[];page.on('console',m=>console_.push(m.text()));
  await context.route('https://yougame.co/sdk.js',r=>r.fulfill({contentType:'text/javascript',body:sdk+'\n'+fixture+(mode==='invite'?"Object.defineProperty(YouGame.multiplayer,'invite',{value:'fixture-invite'});":'')}));
  await context.route('**/engine/melee.js',r=>r.fulfill({contentType:'text/javascript',body:localEngine}));
  await context.route('**/engine/wasm.json',r=>r.fulfill({json:{sha256:'a'.repeat(64)}}));
  await context.route('**/assets-manifest.json',r=>r.fulfill({json:{codec:'zlib',blocks:[],files:[]}}));
  await context.route('**/asset-groups.json',r=>r.fulfill({json:{groups:{},plan:[]}}));
  await context.route('**/match.html',r=>r.fulfill({contentType:'text/html',headers:{'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'credentialless'},body:engine}));
  await page.goto(url);await page.waitForFunction(()=>window.localFixture?.frames>0);
  assert.equal(await page.locator('#welcome').count(),0);assert.equal(await page.locator('#online').count(),0);assert.equal(await page.locator('#competitive').count(),0);assert.equal(await page.locator('header').count(),0);
  assert.equal(await page.locator('dialog').count(),0);
  assert.equal(await page.getByRole('button',{name:'GameCube adapter controls'}).count(),0);
  const kind={casual:0,'ranked-disabled':1,friends:2,cancel:0,'engine-failure':0,close:0,escape:0,waiting:2}[mode];
  if(mode==='waiting')await page.evaluate(()=>{
   const join=YouGame.multiplayer.joinLobby;
   YouGame.multiplayer.joinLobby=async options=>{const room=await join(options);room.participants=room.participants.slice(0,1);return room;};
  });
  if(mode==='cancel')await page.evaluate(()=>window.cancelNext=true);
  if(mode==='engine-failure')await page.evaluate(()=>window.failNative=true);
  if(mode!=='invite')await page.evaluate(k=>melee.menuAction(6,k),kind);
  if(mode==='waiting'){
   await page.waitForFunction(()=>melee.room&&!melee.session.engine);
   assert.equal(await page.evaluate(()=>melee.localPause.blocked),false);
   await page.keyboard.down('KeyZ');
   await page.waitForFunction(()=>localFixture.pads[0]?.[0]===2);
   await page.keyboard.up('KeyZ');
   await page.evaluate(()=>melee.menuAction(2,0));
   await page.waitForFunction(()=>!melee.session&&melee.menu.phase===0);
   assert.equal(await page.evaluate(()=>fixtureRoom.left),true);
  }else if(mode==='ranked-disabled'){
   await page.waitForTimeout(150);
   assert.equal(await page.evaluate(()=>calls.length),0);
   assert.equal(await page.evaluate(()=>melee.session),null);
  }else if(mode==='cancel'){
   await page.waitForFunction(()=>calls.length===1&&melee.menu.phase===0&&!melee.session);assert.equal(await page.locator('iframe.native-match').count(),0);
  }else if(mode==='engine-failure'){
   await page.waitForFunction(()=>melee.menu.phase===6&&!melee.session&&!melee.localPause.blocked&&!localFixture.paused);
   assert.deepEqual(await page.evaluate(()=>localFixture.transitions),[true,false]);
   assert.equal(await page.locator('iframe.native-match').count(),0);
  }else{
   try{await page.waitForFunction(()=>melee.session?.running);}catch(error){console.error(mode,'never ran',await page.evaluate(()=>({menu:melee.menu,room:!!melee.room,session:!!melee.session,phase:melee.phase,calls:calls.length,iframes:document.querySelectorAll('iframe').length})),errors,console_.slice(-12));throw error;}
   const call=await page.evaluate(()=>calls[0]);
   const queue=mode==='invite'?'friends':['close','escape'].includes(mode)?'casual':mode;
   assert.equal(call.mode,'opensmash-melee-native-menu-v1');assert.equal(call.queue,queue);assert.equal(call.players,queue==='friends'?4:2);assert.equal(call.maxLocalPlayers,queue==='friends'?4:1);
   assert.equal(await page.evaluate(()=>melee.menu.phase),1);
   assert.equal(await page.evaluate(()=>localFixture.paused&&melee.localPause.blocked&&melee.assetLoader.backgroundPaused),true);
   const frames=await page.evaluate(()=>localFixture.frames);
   await page.keyboard.press('KeyA'); // Global audio wake must not resume the local AudioContext.
   await page.waitForTimeout(120);
   assert.equal(await page.evaluate(()=>localAudio.state),'suspended');
   assert.equal(await page.evaluate(()=>localFixture.frames),frames,'local simulation stays paused while online runs');
   assert.deepEqual(await page.evaluate(()=>fixtureLaunch),{nativeSession:true,slots:[1,3]});assert.equal(await page.evaluate(()=>inputSetups),1);
   await page.evaluate(async()=>{const n=()=>[0,0,0,0,0,0,0],a=Array.from({length:4},n),b=Array.from({length:4},n);a[1]=[256,0,0,0,0,0,0];b[0]=[512,0,0,0,0,0,0];const {encodeNativePads}=await import('./native-room-session.mjs');await fixtureSync.options.step(0,{a:encodeNativePads(a),b:encodeNativePads(b)},{replaying:false});});
   assert.deepEqual(await page.evaluate(()=>fixturePads.map(p=>p[0])),[0,256,0,512]);
   // BACK from the native menu (or Escape) leaves the room and the session iframe.
   if(mode==='escape')await page.keyboard.press('Escape');else if(mode==='close')await page.evaluate(()=>fixtureRoom.emit('close',{}));else await page.evaluate(()=>melee.menuAction(2,0));
   await page.waitForFunction(()=>!melee.session);assert.equal(await page.locator('iframe.native-match').count(),0);assert.equal(await page.evaluate(()=>fixtureRoom.left),true);
   await page.waitForFunction(previous=>!melee.localPause.blocked&&!localFixture.paused&&localFixture.frames>previous,frames);
   assert.deepEqual(await page.evaluate(()=>localFixture.transitions),[true,false]);
   assert.equal(await page.evaluate(()=>melee.menu.phase),mode==='escape'||mode==='close'?6:0);
  }
  assert.deepEqual(errors,[]);results.push({mode,passed:true});await context.close();
 }
 const output=process.env.MELEE_RESULTS||'melee/test-results/native-room-app';await mkdir(output,{recursive:true});await writeFile(path.join(output,'verification.json'),JSON.stringify({scope:'Production app + iframe bridge + actual SDK input driven through the native menu callback; transport/native engine are fixtures. No native gameplay or hosted acceptance claim.',results},null,2));console.log(JSON.stringify(results));
}finally{await browser.close();await new Promise(r=>server.close(r));}
