import {REMIX_FIGHTERS,REMIX_STAGES} from './remix-roster.mjs';
// The package selects an edition, never a URL parameter or peer message.
export const PROFILES=Object.freeze({
 original:Object.freeze({id:'original',title:'OpenSmash64',mode:'opensmash64-competitive-v1',protocol:'opensmash64-rollback-v4',fighters:Object.freeze([...Array(12).keys()]),stages:Object.freeze([...Array(9).keys()]),stocks:4,minutes:8,remix:false}),
 remix:Object.freeze({id:'remix',title:'OpenSmash64 Remix',mode:'opensmash64-remix-competitive-v1',protocol:'opensmash64-remix-rollback-v4',fighters:REMIX_FIGHTERS,stages:REMIX_STAGES,stocks:3,minutes:8,remix:true})
});
export const ACTIVE_PROFILE=PROFILES['YOUGAME_EDITION']||PROFILES.remix;
export const validFighter=(id,profile=ACTIVE_PROFILE)=>Number.isInteger(id)&&profile.fighters.includes(id);
export const validStage=(id,profile=ACTIVE_PROFILE)=>Number.isInteger(id)&&profile.stages.includes(id);
export function engineParams({battle,seed,profile=ACTIVE_PROFILE}={}){
 const params=new URLSearchParams();
 if(profile.remix)params.set('SSB64_REMIX_MAIN','1');
 if(!battle){params.set('SSB64_START_SCENE','7');return params;}
 const slots=battle.participants||battle.fighters.map((_,slot)=>({slot}));
 const fighters=Array(4).fill(0),roles=Array(4).fill('o');
 slots.forEach((p,i)=>{fighters[p.slot]=battle.fighters[i];roles[p.slot]='h';});
 params.set('SSB64_BOOT_BATTLE',`${fighters[0]},${fighters[1]},${battle.stage},0,${fighters[2]},${fighters[3]}`);
 for(const [k,v]of Object.entries({SSB64_STOCKS:profile.stocks,SSB64_YOUGAME:1,SSB64_YOUGAME_ROLLBACK:1,SSB64_YOUGAME_SEED:seed,SSB64_BOOT_HUMANS:slots.length,SSB64_BOOT_SLOTS:roles.join(''),SSB64_VS_INTRO:0}))params.set(k,String(v));
 return params;
}
