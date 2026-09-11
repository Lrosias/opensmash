import {neutralPad,validPad} from './rollback-engine.mjs';

export const MELEE_SYNC_PROTOCOL='opensmash-melee-async-v1';
export const MELEE_CHECKSUM_FORMAT='melee-main-ram-crc32-v1';

// Caller owns deterministic setup and the shared-state barrier. Construction
// leaves the SDK stopped; no room can drive an unrelated local game by accident.
export async function createMeleeSync({room,engine,input,delay=3,maxRollback=0,
  protocol=MELEE_SYNC_PROTOCOL,checksumEvery=30,onConfirm=()=>{},onError=()=>{},onStatus=()=>{}}) {
  const players=room.activeConnections?.length?room.activeConnections.slice():room.players.map(p=>p.id);
  const roster=room.activeParticipants?.length?room.activeParticipants:room.participants;
  const participants=roster?.length?structuredClone(roster):null;
  if(players.length<1||players.length>4||new Set(players).size!==players.length||!players.includes(room.me))throw Error('Invalid Melee room connections');
  if(participants&&(participants.length<2||participants.length>4||new Set(participants.map(p=>p.slot)).size!==participants.length||participants.some(p=>!players.includes(p.connectionId)||!Number.isInteger(p.slot)||p.slot<0||p.slot>3||!Number.isInteger(p.localIndex)||p.localIndex<0||p.localIndex>3)))throw Error('Invalid Melee player slots');
  const validBundle=p=>Array.isArray(p)&&p.length===4&&p.every(validPad);
  if(typeof room.rollbackAsync!=='function')throw Error('Update the uGames SDK: asynchronous rollback is unavailable');
  if(!Number.isInteger(maxRollback)||maxRollback<0||maxRollback>7)throw Error('Melee supports at most seven rollback frames');
  if(!engine.active||engine.closed||engine.pending)throw Error('Melee must be paused at its agreed starting boundary');
  if(room._sync)throw Error('Stop the previous room controller before creating another Melee session');
  if((await engine.checkpointStats()).count)throw Error('Release setup checkpoints before starting a Melee session');
  await engine.manageCheckpoints();
  const baseFrame=engine.frame,stats={saves:0,loads:0,releases:0,steps:0,replayed:0};
  const held=new Set();
  let requiresReload=false;
  const fail=error=>{
    if(requiresReload)return;
    requiresReload=true;
    // stop() drains SDK ownership; it does not terminate a Wasm runtime. The
    // caller must reload/terminate the runtime before starting another match.
    onError(error,{requiresReload:true});
  };
  const sync=room.rollbackAsync({protocol,checksumFormat:MELEE_CHECKSUM_FORMAT,round:room.round,
    hz:60,delay,maxRollback,neutral:participants?Array.from({length:4},neutralPad):neutralPad(),checksumEvery,catchUp:4,engineTimeout:30000,stallTimeout:30000,
    input:frame=>{const pad=input(frame);if(!(participants?validBundle(pad):validPad(pad)))throw Error('Invalid local Melee controller input');return structuredClone(pad);},
    save:async frame=>{
      if(engine.frame!==baseFrame+frame)throw Error('Melee save frame does not match the SDK');
      const token=await engine.save();held.add(token);stats.saves++;return token;
    },
    load:async token=>{if(!held.has(token))throw Error('SDK loaded an unowned Melee checkpoint');await engine.load(token);stats.loads++;},
    release:async token=>{
      if(!held.delete(token))throw Error('SDK released an unowned Melee checkpoint');
      // A failed native engine stays paused. Only a real page/worker teardown
      // frees its storage; destroy() alone only closes the JS driver.
      if(!engine.closed)await engine.discard(token);
      stats.releases++;
    },
    step:async(frame,inputs,{replaying})=>{
      if(engine.frame!==baseFrame+frame)throw Error('Melee step frame does not match the SDK');
      const pads=Array.from({length:4},neutralPad);
      if(participants){
        if(!players.every(id=>validBundle(inputs[id])))throw Error('Invalid remote Melee controller input');
        for(const p of participants)pads[p.slot]=inputs[p.connectionId][p.localIndex];
      }else{
        if(!players.every(id=>validPad(inputs[id])))throw Error('Invalid remote Melee controller input');
        players.forEach((id,i)=>{pads[i]=inputs[id];});
      }
      const output=await engine.step(pads,{replaying});
      stats.steps++;if(replaying)stats.replayed++;
      return {checksum:output.hash??output.checksum,engineFrame:output.frame,...('result' in output?{result:output.result}: {})};
    },
  });
  sync.on('confirmed',onConfirm);
  sync.on('error',fail);
  for(const event of ['desync','timeout','leave'])sync.on(event,details=>fail(Error(`Melee session ${event}: ${JSON.stringify(details)}`)));
  for(const event of ['stall','resume','overload','recovered'])sync.on(event,details=>onStatus(event,details));
  return {sync,stats,baseFrame,get requiresReload(){return requiresReload;},get checkpoints(){return held.size;},start:()=>sync.start(),stop:()=>sync.stop()};
}
