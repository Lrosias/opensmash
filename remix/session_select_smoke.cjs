// Online (SESSION) select in the harness: two humans steer their own hands at once, B lifts a placed
// puck, Start fights once both are down, B backs out of the stage select, holding B leaves the screen.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE),assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--enable-unsafe-swiftshader']});try{const p=await b.newPage({viewport:{width:960,height:720}}),errors=[];p.on('pageerror',e=>errors.push(String(e)));
await p.goto('http://127.0.0.1:4199/session-check.html');await p.waitForFunction(()=>window.driver,{},{timeout:60000});
const r=await p.evaluate(()=>{const W=game.contentWindow,M=()=>W.Module.remixMenu,scene=()=>W.Module.nativeScene;const step=(n,port=0,pad=[0,0,0])=>{pads=Array.from({length:4},()=>[0,0,0]);pads[port]=pad;for(let i=0;i<n;i++)driver.step();};
const cell=i=>[39+(i%10)*24,44+Math.floor(i/10)*24];const stick=v=>{let s=Math.max(-80,Math.min(80,Math.round(v*20)));if(s&&Math.abs(s)<=8)s=Math.sign(s)*9;return s;};
const place=(port,i)=>{const [cx,cy]=cell(i),tx=cx-1,ty=cy+13;let x=44+69*port,y=168;for(let n=0;n<400&&(Math.abs(tx-x)>=1||Math.abs(ty-y)>=1);n++){const sx=stick(tx-x),sy=stick(y-ty);step(1,port,[0,sx,sy]);if(Math.abs(sx)>8)x+=Math.fround(sx/20);if(Math.abs(sy)>8)y-=Math.fround(sy/20);}step(1,port,[32768,0,0]);step(20);};
step(40);const out={start:{...M()}};place(0,3);out.p1placed={...M()};for(let i=0;i<45;i++)step(1,0,[16384,0,0]);step(5);out.p1heldB={...M(),scene:scene()};step(1,0,[32768,0,0]);step(20);out.p1replaced={...M()};place(1,15);out.bothPlaced={...M()};
step(1,1,[16384,0,0]);step(5);out.p2lifted={...M()};step(1,1,[32768,0,0]);step(20);out.p2again={...M()};
step(1,1,[4096,0,0]);step(1);out.ready={...M()};step(60);out.stages={...M()};step(1,0,[16384,0,0]);step(15);out.back={...M()};
out.sceneBefore=scene();for(let i=0;i<45;i++)step(1,0,[16384,0,0]);step(5);out.recalled={...M(),scene:scene()};for(let i=0;i<45;i++)step(1,0,[16384,0,0]);step(5);out.sceneAfter=scene();return out;});
console.log(JSON.stringify(r));assert.deepEqual(errors,[]);
assert.equal(r.start.humans,3);assert.equal(r.start.active,3);assert.equal(r.start.held,3);assert.equal(r.start.confirmed,0);
assert.equal(r.p1placed.confirmed,1);assert.equal(r.p1heldB.confirmed,0);assert.equal(r.p1heldB.held,3);assert.equal(r.p1heldB.scene,16);assert.equal(r.p1replaced.confirmed,1);assert.equal(r.p1placed.p1,0);assert.equal(r.bothPlaced.confirmed,3);assert.equal(r.bothPlaced.p2,1);assert.equal(r.bothPlaced.held,0);
assert.equal(r.p2lifted.confirmed,1);assert.equal(r.p2lifted.held,2);assert.equal(r.p2again.confirmed,3);
assert.equal(r.ready.phase,3);assert.equal(r.stages.phase,2);assert.equal(r.back.phase,0);assert.equal(r.back.confirmed,3);
assert.equal(r.sceneBefore,16);assert.equal(r.recalled.scene,16);assert.equal(r.recalled.held,1);assert.notEqual(r.sceneAfter,16);console.log('session select ok');
}finally{await b.close()}})();
