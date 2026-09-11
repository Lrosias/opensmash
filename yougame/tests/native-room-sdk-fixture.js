// Game lifecycle fixture; real SDK barriers are separately covered by root.
(()=>{
 const f=window.nativeRoomFixture={engines:[],beginCalls:0,reports:[],finishes:[],terminal:false,syncs:[]},listeners=new Map();
 const participants=[{id:'p1',connectionId:'a',slot:0,localIndex:0},{id:'p3',connectionId:'a',slot:2,localIndex:1}];
 const room=f.room={me:'a',isHost:true,queue:'private',seed:33,round:1,revision:1,playing:false,participants,
 on(e,fn){if(!listeners.has(e))listeners.set(e,new Set());listeners.get(e).add(fn);},off(e,fn){listeners.get(e)?.delete(fn);},emit(e,data){for(const fn of [...listeners.get(e)||[]])fn(data);},send(){},leave(){f.left=true;},
 beginMatch(){f.beginCalls++;this.playing=true;this.matchId='match-'+this.round;this.matchParticipants=structuredClone(this.participants);this.emit('ready',{});return Promise.resolve();},
 reportGame(r){f.reports.push(r);return Promise.resolve();},finish(r){f.finishes.push(r);const round=this.round;this.round++;this.playing=false;this.emit('result',{round,void:!!r.void});return Promise.resolve();},
 lockstep(options){const sync={options,frame:0,start(){this.running=true;},stop(){this.running=false;room.off('result',end);},receive(){},on(){},advance(){options.step(this.frame++,{a:options.input()});}};const end=()=>sync.stop();room.on('result',end);f.syncs.push(sync);return sync;}};
 window.YouGame={ready:async()=>{},multiplayer:{invite:null,joinLobby:async()=>room,leave:()=>room.leave()},ui:{getLayout:()=>({insets:{}}),onChange:()=>()=>{}}};
})();
