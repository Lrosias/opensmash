const menuFrame=p=>p.locator('iframe[title$="native menus"]');
const battleFrame=p=>p.locator('iframe[title$="online battle"]');
const scene=(p,n)=>p.waitForFunction(n=>document.querySelector('iframe[title$="native menus"]')?.contentWindow.Module?.nativeScene===n,n,{timeout:90000});
async function key(p,k,ms=75){await p.keyboard.down(k);await p.waitForTimeout(ms);await p.keyboard.up(k);await p.waitForTimeout(200);}
async function openOnline(p,ranked=false){
 await scene(p,7);await p.waitForTimeout(400);await menuFrame(p).contentFrame().locator('canvas').click();
 await key(p,'ArrowUp');await key(p,'KeyM');await scene(p,9);await p.waitForTimeout(400);
 if(ranked)await key(p,'ArrowDown');
}
async function chooseFighter(p,seat=0){
 await key(p,'KeyM');await scene(p,16);await p.waitForTimeout(1200);
 if(seat)await key(p,'ArrowRight');
 await key(p,'KeyM');await p.waitForTimeout(400);
 await key(p,'KeyM');
 await p.waitForFunction(()=>document.querySelector('#status').textContent.includes('SEARCHING'),{},{timeout:10000});
}
module.exports={menuFrame,battleFrame,scene,key,openOnline,chooseFighter};
