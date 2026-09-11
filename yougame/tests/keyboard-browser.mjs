import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const out=new URL('../../build/keyboard-standard/evidence/',import.meta.url);await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
try{
 for(const edition of ['original','remix']){
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.addInitScript(()=>{
   let attach;
   Object.defineProperty(window,'openSmashAttachEngine',{configurable:true,get:()=>attach,set(fn){attach=win=>{
    const bridge=fn(win),read=bridge.readPorts;
    bridge.readPorts=(ptr,H)=>{read(ptr,H);window.keyboardTestPad=Array.from(H.slice((ptr>>2)+1,(ptr>>2)+4));};
    return bridge;
   };}});
  });
  await page.goto(process.env[edition.toUpperCase()+'_URL']||`http://127.0.0.1:8088/${edition}/`);
  await page.waitForFunction(()=>document.querySelector('iframe[title$="native menus"]')?.contentWindow.Module?.nativeScene===7,null,{timeout:90000});
  const engine=page.frameLocator('iframe[title$="native menus"]');await engine.locator('canvas').click();
  const check=async(keys,expected)=>{
   for(const key of keys)await page.keyboard.down(key);
   await page.waitForFunction(e=>JSON.stringify(window.keyboardTestPad)===JSON.stringify(e),expected,{timeout:5000});
   for(const key of [...keys].reverse())await page.keyboard.up(key);
   await page.waitForFunction(()=>JSON.stringify(window.keyboardTestPad)==='[0,0,0]',null,{timeout:5000});
  };
  for(const [key,x,y] of [['ArrowUp',0,80],['ArrowDown',0,-80],['ArrowLeft',-80,0],['ArrowRight',80,0]])await check([key],[0,x,y]);
  await check(['ArrowLeft','ArrowRight'],[0,0,0]);await check(['ShiftLeft','ArrowRight'],[0,40,0]);
  for(const [key,mask] of [['c',8],['s',8],['q',0x2000],['w',0x2000],['d',0x10],['i',8],['k',4],['j',2],['l',1],['t',0x800],['g',0x400],['f',0x200],['h',0x100],['z',0x4000],['x',0x8000],['Enter',0x1000]])await check([key],[mask,0,0]);
  await check(['AltLeft','Enter'],[0,0,0]);
  await page.screenshot({path:new URL(edition+'-keyboard.png',out).pathname});
  assert.deepEqual(errors,[]);
  await writeFile(new URL(edition+'-keyboard.json',out),JSON.stringify({url:page.url(),browser:browser.version(),passed:true,keys:'arrows, Shift, X/Z, C/S, Q/W/D, Enter, IJKL, TGFH, Alt+Enter',errors},null,2));
  console.log(edition+': all keys reached native controller input; release, modifiers, opposed directions and Start guard passed.');await page.close();
 }
}finally{await browser.close();}
