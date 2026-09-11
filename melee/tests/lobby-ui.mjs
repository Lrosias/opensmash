import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const output=process.env.MELEE_RESULTS||'melee/test-results/lobby-ui';await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage(),measurements=[];
 await page.route('**/__lobby-ui.html',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="./style.css"><link rel="stylesheet" href="./competitive.css"><section id="lobby" class="competitive"></section>'}));
 await page.goto(new URL('__lobby-ui.html',process.env.MELEE_URL||'http://127.0.0.1:8329/').href);
 await page.evaluate(async()=>{
  const {MeleeCompetitiveUI}=await import('./competitive-ui.mjs');
  const handlers=new Map();window.room={me:'a',players:[{id:'a',name:'Alice'}],participants:[{id:'a',name:'Alice',connectionId:'a',slot:0,localIndex:0}],size:4,revision:1,round:1,queue:'private',connected:true,playing:false,isHost:true,lobby:{minPlayers:2,maxLocalPlayers:4},localParticipants:[{id:'a'}],send(){},leave(){},on(e,f){if(!handlers.has(e))handlers.set(e,new Set());handlers.get(e).add(f);},off(e,f){handlers.get(e)?.delete(f);}};
  window.sdk={ready:async()=>{},multiplayer:{joinLobby:async()=>room,leave(){}}};
  window.ui=new MeleeCompetitiveUI({root:document.getElementById('lobby'),sdk});ui.setAdapter(()=>({prepare(){},play(){},stop(){}}),'fixture-build');
 });
 await page.getByRole('button',{name:'Friends',exact:true}).click();
 await page.waitForSelector('[data-action="lobby-fighter"]');
 assert.equal(await page.getByText('Open slot',{exact:true}).count(),3);
 assert.equal(await page.getByRole('button',{name:'Start game',exact:true}).isDisabled(),true);
 assert.equal(await page.getByText('CPU',{exact:true}).count(),0);
 for(const width of [1280,1000,375]){
  await page.setViewportSize({width,height:width===375?812:800});
  const m=await page.evaluate(()=>({viewport:innerWidth,scroll:document.getElementById('lobby').scrollWidth,width:document.getElementById('lobby').clientWidth,escaped:[...document.querySelectorAll('button,article')].filter(e=>{const r=e.getBoundingClientRect();return r.left<0||r.right>innerWidth+1;}).map(e=>e.textContent)}));
  measurements.push(m);assert.ok(m.scroll<=m.width+1,JSON.stringify(m));assert.deepEqual(m.escaped,[]);await page.screenshot({path:`${output}/lobby-${width}.png`});
 }
 await page.evaluate(()=>{room.playing=true;room.matchParticipants=[{id:'other',connectionId:'other'}];ui.render();});
 assert.equal(await page.getByRole('button',{name:'Ready',exact:true}).count(),1,'waiting next-game participant can choose and get ready');
 await writeFile(`${output}/verification.json`,JSON.stringify(measurements,null,2));console.log('Friends joins before selections; no CPU; waiting-next selection and375/1000/1280layouts passed');
}finally{await browser.close();}
