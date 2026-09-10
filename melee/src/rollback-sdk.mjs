import {neutralPad,validPad} from './rollback-engine.mjs';

export const MELEE_SYNC_PROTOCOL='opensmash-melee-async-v1';
export const MELEE_CHECKSUM_FORMAT='melee-main-ram-crc32-v1';

// Caller owns deterministic setup and the shared-state barrier. Construction
// leaves the SDK stopped; no room can drive an unrelated local game by accident.
export async function createMeleeSync({room,engine,input,delay=3,maxRollback=0,
  protocol=MELEE_SYNC_PROTOCOL,checksumEvery=30,onConfirm=()=>{},onError=()=>{},onStatus=()=>{}}) {
  const players=room.players.map(p=>p.id);
  if(players.length!==2||new Set(players).size!==2||!players.includes(room.me))throw Error('Melee requires two distinct room players');
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
    hz:60,delay,maxRollback,neutral:neutralPad(),checksumEvery,catchUp:4,engineTimeout:30000,stallTimeout:30000,
    input:frame=>{const pad=input(frame);if(!validPad(pad))throw Error('Invalid local Melee controller input');return [...pad];},
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
      const pads=players.map(id=>inputs[id]);
      if(!pads.every(validPad))throw Error('Invalid remote Melee controller input');
      const output=await engine.step([...pads,neutralPad(),neutralPad()],{replaying});
      stats.steps++;if(replaying)stats.replayed++;
      return {checksum:output.hash,engineFrame:output.frame};
    },
  });
  sync.on('confirmed',onConfirm);
  sync.on('error',fail);
  for(const event of ['desync','timeout','leave'])sync.on(event,details=>fail(Error(`Melee session ${event}: ${JSON.stringify(details)}`)));
  for(const event of ['stall','resume','overload','recovered'])sync.on(event,details=>onStatus(event,details));
  return {sync,stats,baseFrame,get requiresReload(){return requiresReload;},get checkpoints(){return held.size;},start:()=>sync.start(),stop:()=>sync.stop()};
}
