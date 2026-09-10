// Real authored UI + actual Wasm engines, with an explicitly simulated USB device.
// No physical-device or latency claim can be made from this test.
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const root=path.resolve(process.env.GC_BUILD_ROOT||'build/gamecube'),out=path.join(root,'verification');await mkdir(out,{recursive:true});
const types={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.wasm':'application/wasm','.json':'application/json','.css':'text/css'};
const server=http.createServer(async(req,res)=>{
  const p=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
  if(!p.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  try{res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','credentialless');res.setHeader('Content-Type',types[path.extname(p)]||'application/octet-stream');res.end(await readFile(p));}catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(4198,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--disable-backgrounding-occluded-windows','--disable-renderer-backgrounding']});
const results=[];
try {
  for(const edition of ['opensmash64','opensmash64-remix','opensmash-melee']){
    const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('https://yougame.co/sdk.js',route=>route.fulfill({contentType:'text/javascript',path:'/tmp/opensmash-gc-sdk.js'}));
    await page.addInitScript(()=>{
      if(window!==window.top)return;
      let attach;
      Object.defineProperty(window,'openSmashAttachEngine',{get:()=>attach,set:fn=>{attach=win=>{
        const bridge=fn(win),original=bridge.readPorts;
        bridge.readPorts=(ptr,H)=>{original(ptr,H);window.lastNativePorts=Array.from(H.slice(ptr>>2,(ptr>>2)+16));};
        return bridge;
      };}});
      const bytes=new Uint8Array(37);bytes[0]=0x21;
      for(let i=0;i<4;i++){bytes[1+i*9]=0x10;bytes.set([128,128,128,128,0,0],4+i*9);}
      const calls=[];
      const usb=new EventTarget();
      const device={vendorId:0x057e,productId:0x0337,opened:false,configuration:null,
        async open(){this.opened=true;},async close(){this.opened=false;},
        async selectConfiguration(){this.configuration={interfaces:[{interfaceNumber:0,alternate:{alternateSetting:0},alternates:[{interfaceClass:255,alternateSetting:0,endpoints:[{direction:'in',type:'interrupt',endpointNumber:1,packetSize:37},{direction:'out',type:'interrupt',endpointNumber:2,packetSize:5}]}]}]};},
        async claimInterface(){},async transferOut(endpoint,b){calls.push(['out',endpoint,[...b]]);return {status:'ok',bytesWritten:b.length};},
        async transferIn(){await new Promise(r=>setTimeout(r,8));if(!this.opened)throw Error('closed');return {status:'ok',data:new DataView(bytes.slice().buffer)};}};
      usb.requestDevice=async options=>{calls.push(['chooser',options]);return device;};
      Object.defineProperty(navigator,'usb',{value:usb});
      window.usbTest={bytes,calls,device,usb};
    });
    await page.goto(`http://127.0.0.1:4198/${edition}/index.html`);
    await page.getByRole('button',{name:'GameCube adapter controls',exact:true}).click();
    await page.getByRole('button',{name:'Connect adapter',exact:true}).click();
    await page.getByText('Port 4: wired',{exact:false}).waitFor();
    await page.getByRole('button',{name:'Calibrate port 1',exact:true}).click();
    await page.getByText('Port 1 calibrated.',{exact:true}).waitFor();
    await page.screenshot({path:path.join(out,edition+'-adapter.png')});
    await page.getByRole('button',{name:'Done',exact:true}).click();
    if(edition==='opensmash-melee'){
      await page.locator('#play').click();
      await page.waitForFunction(()=>window.melee?.phase==='running',{},{timeout:180000});
      await page.evaluate(()=>{const m=window.melee.module,old=m._melee_input;m._melee_input=(...args)=>{window.lastNativePads||=[];window.lastNativePads[args[0]]=args.slice(1);return old(...args);};});
      await page.evaluate(()=>{usbTest.bytes[2]=1;usbTest.bytes[4]=208;usbTest.bytes[8]=80;});
      await page.waitForFunction(()=>window.lastNativePads?.[0]?.[0]===1&&window.lastNativePads[0][5]>0&&window.lastNativePads[0][5]<1);
      const sample=await page.evaluate(()=>lastNativePads[0]);assert.equal(sample[0],1);assert.equal(sample[1],80/127);assert.equal(sample[5],80/255);
      results.push({edition,boot:true,adapterUI:true,nativeInput:sample,displayedFrames:await page.evaluate(()=>melee.displayedFrames),hardware:'simulated',errors});
    }else{
      await page.waitForFunction(()=>{const f=document.querySelector('#game iframe');return f?.contentWindow.Module?.nativeScene!==undefined;},{},{timeout:90000});
      await page.evaluate(()=>{usbTest.bytes[2]=1;usbTest.bytes[4]=208;});
      await page.waitForFunction(()=>window.lastNativePorts?.[1]===32768&&window.lastNativePorts?.[2]===80);
      const nativePorts=await page.evaluate(()=>lastNativePorts);assert.equal(nativePorts[0],2);
      // Also inspect independent port output without depending on scene actions.
      const result=await page.evaluate(async()=>{
        const [{GameCubeAdapter},{createInput}]=await Promise.all([import('./controllers/gc-adapter.mjs'),import('./input.mjs')]);
        const a=new GameCubeAdapter({usb:null});a.owned=true;usbTest.bytes[2]=1;usbTest.bytes[4]=208;a.accept(usbTest.bytes);
        const input=createInput({adapter:a,allowStart:true}),ports=input.readPorts();input.destroy();await a.destroy();
        return {ports,scene:document.querySelector('#game iframe').contentWindow.Module.nativeScene};
      });
      assert.equal(result.ports[0][0],0x8000);assert.equal(result.ports[0][1],80);
      results.push({edition,boot:true,adapterUI:true,...result,nativePorts,hardware:'simulated',errors});
    }
    await page.evaluate(()=>{usbTest.bytes.fill(0,2,4);usbTest.bytes[4]=128;usbTest.bytes[8]=0;});
    await page.getByRole('button',{name:'GameCube adapter controls',exact:true}).click();
    await page.getByRole('button',{name:'Use regular controls',exact:true}).click();
    await page.getByText('Regular keyboard, touch and browser controllers enabled.',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Done',exact:true}).click();
    assert.deepEqual(errors,[]);await page.close();
    await writeFile(path.join(out,'results.json'),JSON.stringify(results,null,2));
    console.log(edition+' passed');
  }
}finally{await browser.close();server.close();}
