import {ACTIVE_PROFILE,validFighter} from './game-profile.mjs';

// Presentation consumes the settled platform outcome and the previous game's
// fixed seats. Platform set scores are wins, never remaining native stocks.
export function nativeResultArgs(event,view,terminal,profile=ACTIVE_PROFILE){
 if(!profile.remix||!view||!Array.isArray(view.fighters)||view.fighters.length!==2||!view.fighters.every(f=>validFighter(f,profile))||![0,1].includes(view.seat))return null;
 const winner=event.void?-2:event.draw?-1:typeof event.won==='boolean'?(event.won?view.seat:1-view.seat):null;
 if(winner===null)return null;
 const stocks=terminal?.stocks;
 return [...view.fighters,winner,...[0,1].map(i=>Number.isInteger(stocks?.[i])&&stocks[i]>=0?stocks[i]:0)];
}
