import {REMIX_FIGHTERS,REMIX_STAGES} from './remix-roster.mjs';

const fighters=['Mario','Fox','Donkey Kong','Samus','Luigi','Link','Yoshi','Captain Falcon','Kirby','Pikachu','Jigglypuff','Ness','Falco','Ganondorf','Young Link','Dr. Mario','Wario','Bowser','Wolf','Conker','Mewtwo','Marth','Sonic','Sheik','Marina','Dedede','Goemon','Banjo & Kazooie','Peach','Crash','Dark Samus','Lucas','Roy','Dr. Luigi'];
const stages=['Dream Land','Final Destination',"Fray’s Stage",'First Destination','Pokémon Stadium','Pokémon Stadium 2','Goomba Road','Battlefield'];
export const fighterName=id=>fighters[REMIX_FIGHTERS.indexOf(id)]||'Fighter';
export const stageName=id=>stages[REMIX_STAGES.indexOf(id)]||'Arena';

export function loadingMatch(params){
 const battle=params.get('SSB64_BOOT_BATTLE');
 if(!battle)return null;
 const [first,second,stage,,third=-1,fourth=-1]=battle.split(',').map(Number);
 const slots=[first,second,third,fourth].map((id,port)=>({id,port})).filter(({id})=>REMIX_FIGHTERS.includes(id));
 if(!slots.length)return null;
 return {fighters:slots.map(({id})=>fighterName(id)),ports:slots.map(({port})=>port),stage:stageName(stage),stocks:Number(params.get('SSB64_STOCKS'))||4};
}
