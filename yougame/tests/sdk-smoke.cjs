// Uses real YouGame dev rooms. No recorded ratings and no published game.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required']});
 try{
  const context=await browser.newContext();const pages=await Promise.all([context.newPage(),context.newPage()]);
  for(const p of pages){p.on('pageerror',e=>console.log('pageerror',e.message));await p.goto('http://127.0.0.1:4173');}
  for(const ranked of [false,true]){
   console.log('Connecting',ranked?'ranked':'casual');
   await Promise.all(pages.map(p=>p.evaluate(ranked=>{
    window.testEvents=[];
    window.matchPromise=YouGame.multiplayer.findMatch({players:2,mode:'opensmash-sdk-smoke-v1',ranked,ui:false,lobby:true,onStatus:s=>{
     if(s.room){window.testRoom=s.room;if(s.type==='lobby'&&s.room.full)s.room.ready();}
    }}).then(r=>{window.testRoom=r;r.on('ready',e=>window.testEvents.push(e.round));return true;});
   },ranked)));
   await Promise.all(pages.map(p=>p.evaluate(()=>window.matchPromise)));
   console.log('Matched',await pages[0].evaluate(()=>({code:testRoom.code,queue:testRoom.queue,players:testRoom.players.length})));
   await Promise.all(pages.map(p=>p.evaluate(()=>{window.resultPromise=testRoom.finish({winner:testRoom.players[0].id});})));
   console.log('Results',await Promise.all(pages.map(p=>p.evaluate(()=>window.resultPromise.then(r=>({void:r.void,won:r.won,queue:r.queue}))))));
   await Promise.all(pages.map(p=>p.evaluate(()=>testRoom.ready())));
   await Promise.all(pages.map(p=>p.waitForFunction(()=>testEvents.includes(2),{timeout:20000})));
   console.log('Rematch ready on both clients');
   await Promise.all(pages.map(p=>p.evaluate(()=>testRoom.leave())));
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
