// Test-only SDK/transport fixture. This does not exercise the deployed SDK,
// a real opponent, or native game simulation; the app and set/session are real.
(() => {
 const query=new URLSearchParams(location.search),seat=Number(query.get('seat')||0),kind=query.get('outcome')||'won';
 const winner=kind==='lost'?1-seat:seat,draw=kind==='draw',voided=kind==='void';
 const fixture=window.resultFixture={seat,kind,winner,held:false,owned:true,exports:[],frames:[],syncs:[],reports:[],sent:[],readyCalls:0,leaveCalls:0,opens:0,
  terminal:draw?{result:2,stocks:[1,1]}:{result:winner,stocks:winner===0?[2,0]:[0,2]}};
 const events=new Map(),players=[{id:'a',name:'First player'},{id:'b',name:'Second player'}];
 const room=fixture.room={players,me:players[seat].id,seed:12345,round:1,playing:true,ranked:false,queue:'casual',
  on(event,fn){if(!events.has(event))events.set(event,new Set());events.get(event).add(fn);},
  off(event,fn){events.get(event)?.delete(fn);},
  emit(event,data){for(const fn of [...events.get(event)||[]])fn(data);},
  send(data){fixture.sent.push(structuredClone(data));if(data.type==='hello'||data.type==='result')queueMicrotask(()=>{
   const peer={...data};if(data.type==='hello')peer.fighter=seat===0?59:58;
   room.emit('message',{from:players[1-seat].id,data:peer});
  });},
  rollback(options){const sync={options,started:false,frame:0,on(){},receive(){},start(){this.started=true;},stop(){this.started=false;}};fixture.syncs.push(sync);return sync;},
  finish(report){fixture.reports.push(structuredClone(report));return Promise.resolve();},
  ready(){fixture.readyCalls++;room.playing=true;room.emit('ready',{round:room.round});},
  leave(){fixture.leaveCalls++;},settings(){},
 };
 fixture.advance=()=>{const sync=fixture.syncs.at(-1);if(!sync?.started)throw Error('Fixture simulation not started');for(let i=0;i<15&&sync.started;i++)sync.options.step(sync.frame++,{a:[0,0,0],b:[0,0,0]});};
 fixture.settle=()=>{
  const round=room.round;room.playing=false;room.round=round+1;
  room.emit('result',{round,won:winner===seat,draw,void:voided,scores:{a:1,b:0}});
  const dialog=document.createElement('dialog');dialog.id='sdk-result-fixture';
  const button=document.createElement('button');button.textContent='Continue (SDK fixture)';button.onclick=()=>{dialog.close();dialog.remove();room.ready();};dialog.append(button);document.body.append(dialog);dialog.showModal();
 };
 const ports=()=>Array.from({length:4},(_,port)=>({port,connected:port===0,type:'gamecube',buttons:fixture.held?1:0,axes:[fixture.held?210:128,128,128,128],triggers:[0,0],origin:[128,128,128,128,0,0]}));
 window.YouGame={ready:async()=>{},mode:'hosted',controllers:{on:()=>()=>{},capabilities:()=>({host:true}),snapshot:()=>({owned:fixture.owned,state:'connected',stale:false,suspended:false,ports:ports()})},
  multiplayer:{invite:null,open:async options=>{fixture.opens++;options.onStatus({room});return room;},leave(){}},
  ui:{getLayout:()=>({insets:{top:0,bottom:0,left:0,right:0}}),onChange:()=>()=>{}}};
})();
