const {chromium}=require(process.env.PLAYWRIGHT_MODULE);const fs=require('fs/promises');
(async()=>{let b=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--enable-unsafe-swiftshader']});try{let p=await b.newPage();await p.goto('http://127.0.0.1:4199/remix-check.html?battle=58,74,16,0');await p.waitForFunction(()=>window.driver,{},{timeout:45000});let result=await p.evaluate(()=>{for(let i=0;i<550;i++)driver.step();let hit=false,seen=[];
for(let i=0;i<500;i++){let r=probe(),dx=r[19]-r[3];if(Math.abs(dx)<260)break;pads=[[0,dx>0?40:-40,0],[0,0,0]];driver.step();}
pads=[[0,0,0],[0,0,0]];for(let i=0;i<30;i++)driver.step();
for(let i=0;i<250;i++){pads=[[i%35<2?32768:0,0,0],[0,0,0]];driver.step();let r=probe();seen.push([r[1],r[3],r[8],r[19],r[18]]);if(r[18]>0){hit=true;break}}
return {hit,state,probe:probe(),seen}});console.log(result);await fs.writeFile('build/remix/main/checks/combat.json',JSON.stringify(result,null,2));if(!result.hit)throw Error('Marth did not damage Roy');}finally{await b.close()}})();
