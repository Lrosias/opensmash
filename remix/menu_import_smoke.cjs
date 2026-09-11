const {chromium}=require(process.env.PLAYWRIGHT_MODULE),fs=require('node:fs/promises');
(async()=>{
 const b=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 try{
  const p=await b.newPage({viewport:{width:960,height:720}}),errors=[];p.on('pageerror',e=>errors.push(String(e)));
  await p.route('https://yougame.co/**',r=>r.abort());await p.goto('http://127.0.0.1:4199/');
  await p.waitForFunction(()=>document.querySelector('iframe')?.contentWindow.Module?.nativeScene===7,{},{timeout:60000});
  const f=p.frames().find(f=>f.url().includes('/engine/'));
  await f.locator('canvas').click();
  const key=async(k)=>{await p.keyboard.down(k);await p.waitForTimeout(80);await p.keyboard.up(k);await p.waitForTimeout(340)};
  const menu=async()=>{if(errors.length)throw Error(errors.join('\n'));return f.evaluate(()=>Module.remixMenu)};
  await key('ArrowDown');await key('KeyM');await key('KeyM');await p.waitForTimeout(600);
  await p.screenshot({path:'build/remix/main/checks/imported-menu.png'});
  const visited=new Set();for(let i=0;i<34;i++){visited.add((await menu()).hover);await key('ArrowRight')}
  if(visited.size!==34)throw Error('Not all fighter previews navigable: '+[...visited]);
  console.log('Previewed', [...visited]);for(let i=0;i<34&&(await menu()).hover!==58;i++)await key('ArrowRight');await key('KeyM');
  for(let i=0;i<34&&(await menu()).hover!==74;i++)await key('ArrowRight');await key('KeyM');
  await p.screenshot({path:'build/remix/main/checks/imported-menu-marth-roy.png'});await key('KeyM');
  if((await menu()).phase!==2)throw Error('No stage select');
  for(let i=0;i<8;i++){
   if((await menu()).stage!==i)throw Error('Stage navigation mismatch');
   await p.screenshot({path:`build/remix/main/checks/stage-menu-${i}.png`});await key('ArrowRight');
  }
  await key('ArrowDown');if((await menu()).stage!==4)throw Error('Stage grid vertical movement failed');
  await key('KeyO');if((await menu()).phase!==3)throw Error('Stage Back failed');
  await key('KeyM');await key('KeyM');
  console.log('Launching',await f.evaluate(()=>({scene:Module.nativeScene,menu:Module.remixMenu})));await f.waitForFunction(()=>Module.nativeScene===22,{},{timeout:60000});
  const probe=await f.evaluate(()=>{const a=Module._port_marth_probe()>>2;return [...HEAP32.slice(a,a+32)]});
  if(probe[0]!==58||probe[16]!==74||errors.length)throw Error('Wrong battle or browser errors: '+JSON.stringify({probe,errors}));
  await p.screenshot({path:'build/remix/main/checks/imported-menu-battle.png'});
  const report={fighters:[...visited],stages:8,selected:await menu(),probe,errors};
  console.log(report);await fs.writeFile('build/remix/main/checks/imported-menu.json',JSON.stringify(report,null,2));
 }finally{await b.close()}
})();
