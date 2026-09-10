import {GameCubeAdapter} from './gc-adapter.mjs';
import {createOpenSmashAdapter} from './platform-adapter.mjs';

export function mountAdapterControls({before=null}={}) {
  const adapter=createOpenSmashAdapter(GameCubeAdapter);
  const button=document.createElement('button');button.type='button';button.textContent='Use a GameCube controller';
  button.setAttribute('aria-label','GameCube adapter controls');
  // Keep this entry clear of YouGame's reserved bottom-right / top-left areas,
  // including Melee's pre-existing header placement on its opening screen.
  button.style.cssText='position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:20;font:12px system-ui;padding:6px 10px;border:1px solid #777;border-radius:8px;background:#171923;color:white';
  if(before)before.before(button);
  else document.body.append(button);
  const dialog=document.createElement('dialog');
  dialog.style.cssText='max-width:min(480px,85vw);max-height:75vh;overflow:auto;background:#171923;color:#fff;border:1px solid #888;border-radius:12px;font:14px system-ui;padding:20px';
  dialog.innerHTML='<h2 style="margin-top:0">GameCube adapter</h2><p data-status role="status"></p><p>Official WUP-028 adapters use YouGame desktop. Browser-compatible adapters can be paired once and reconnect automatically. Close Slippi/Dolphin before native use. USB ports 1–4 are players 1–4; empty ports stay empty. Adapter mode takes over all four controller seats.</p><button data-connect type="button">Connect adapter</button> <button data-release type="button">Use regular controls</button><div data-ports style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px"></div><p>Calibration: release both sticks and triggers, then calibrate that port. Raw values are preserved; calibration only subtracts the chosen neutral offsets. A reconnect resets calibration.</p><button data-reset type="button">Reset calibration</button> <button data-close type="button">Done</button><p data-help></p>';
  document.body.append(dialog);
  const capability=document.createElement('p');dialog.append(capability);
  const desktopLink=document.createElement('a');desktopLink.href='https://yougame.co/desktop';desktopLink.target='_blank';desktopLink.rel='noopener';desktopLink.textContent='Get YouGame desktop for WUP-028 support';dialog.append(desktopLink);
  const get=s=>dialog.querySelector(s),rows=[];
  for(let i=0;i<4;i++){
    const row=document.createElement('p'),label=document.createElement('span'),calibrate=document.createElement('button');
    calibrate.type='button';calibrate.textContent=`Calibrate port ${i+1}`;
    calibrate.onclick=async()=>{try{await adapter.calibrate(i);get('[data-help]').textContent=`Port ${i+1} calibrated.`;}catch(e){get('[data-help]').textContent=e.message;}};
    row.append(label,document.createElement('br'),calibrate);get('[data-ports]').append(row);rows.push({label,calibrate});
  }
  function render(){
    const policy=document.permissionsPolicy||document.featurePolicy;
    capability.textContent=adapter.hosted?'Adapter access is managed in YouGame Controls.':
      !globalThis.isSecureContext?'USB needs HTTPS or localhost.':!navigator.usb?
      'WebUSB is unavailable here. Try desktop Chrome/Edge, or regular controls.':
      policy?.allowsFeature&&!policy.allowsFeature('usb')?
      'This player blocks direct USB. Open YouGame Controls to connect through the platform.':'';
    const nativeRequired=['native-required','browser-blocked'].includes(adapter.state);
    desktopLink.hidden=!nativeRequired;
    const snapshot=adapter.snapshot({diagnostic:true});get('[data-status]').textContent=adapter.message;
    get('[data-connect]').disabled=adapter.busy||!!adapter.device||nativeRequired;
    get('[data-release]').disabled=adapter.busy||(!adapter.owned&&!adapter.device&&!nativeRequired);
    rows.forEach(({label,calibrate},i)=>{const p=snapshot.ports[i];label.textContent=`Port ${i+1}: ${p.connected?p.type+' · sticks '+p.axes.join(', ')+' · L/R '+p.triggers.join(', '):'no fresh controller input'}`;calibrate.disabled=!p.connected;});
    button.textContent=adapter.owned?'GameCube controller ●':'Use a GameCube controller';
    if(adapter.owned&&snapshot.stale&&adapter.device)get('[data-status]').textContent='Waiting for fresh adapter reports; input is neutral.';
  }
  button.onclick=()=>{render();dialog.showModal();button.blur();};
  get('[data-connect]').onclick=()=>{if(adapter.hosted)dialog.close();void adapter.connect().catch(e=>{get('[data-help]').textContent=e.message;if(!dialog.open)dialog.showModal();});};
  get('[data-release]').onclick=()=>{void adapter.close().catch(e=>{get('[data-help]').textContent=e.message;});};
  get('[data-reset]').onclick=async()=>{try{await adapter.resetCalibration();get('[data-help]').textContent='Nominal centers restored.';}catch(e){get('[data-help]').textContent=e.message;}};
  get('[data-close]').onclick=()=>dialog.close();
  const unsubscribe=adapter.subscribe(render),timer=setInterval(()=>{if(dialog.open)render();},250);
  const visibility=()=>adapter.suspend(document.hidden||dialog.open);
  document.addEventListener('visibilitychange',visibility);
  // Dialog interactions must not also press buttons in the running game.
  const observer=new MutationObserver(visibility);observer.observe(dialog,{attributes:true,attributeFilter:['open']});
  // A same-origin child engine may own focus; don't suspend on that transfer.
  const blur=()=>setTimeout(()=>{if(!document.hasFocus())adapter.suspend(true);},0);
  const focus=()=>{if(!dialog.open&&!document.hidden)adapter.suspend(false);};
  window.addEventListener('blur',blur);window.addEventListener('focus',focus);window.addEventListener('focusin',focus);
  window.addEventListener('pagehide',()=>{clearInterval(timer);unsubscribe();observer.disconnect();void adapter.destroy();},{once:true});
  render();return adapter;
}
