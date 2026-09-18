// 迂迴 (3.129.0, user design 2026-09-18): a unit carrying the 迂迴 trait approaches by the route you cannot see. Who has
// it is decided by the trait alone — for now the squad's advancers and searchers, and rebels running for cover.
// Rules the user decided:
// - What counts as "seen" is judged from where the unit last knew you to be, never from where you really are.
// - Smoke hides a tile (sight already stops at smoke); darkness does not.
// - A detour may be long enough to go round the outside of a small room (6×6: about 8 extra steps). Longer than
//   that, it takes the plain shortest route instead, so a flanker never looks like it is wandering.
import {distance,key} from './world.js';
import {SIZE} from './data.js';

export const DETOUR_TRAIT='detour';
export const DETOUR_TUNING=Object.freeze({exposedCost:4,extraSteps:8,sightRadius:10});

// The tiles seen from one point, once per turn and per point: a squad sharing your last known tile shares the work.
const seenFrom=new WeakMap();
export function exposedFrom(g,point){
 const stamp=`${g.turn}|${key(point)}|${(g.smoke||[]).length}`;let cache=seenFrom.get(g);
 if(!cache||cache.turn!==g.turn){cache={turn:g.turn,fields:new Map()};seenFrom.set(g,cache);}
 if(cache.fields.has(stamp))return cache.fields.get(stamp);
 const seen=new Set(),r=DETOUR_TUNING.sightRadius,eye={x:point.x,y:point.y};
 for(let y=Math.max(0,point.y-r);y<=Math.min(SIZE-1,point.y+r);y++)for(let x=Math.max(0,point.x-r);x<=Math.min(SIZE-1,point.x+r);x++){
  const q={x,y};if(distance(eye,q)<=r&&g.grid[y]?.[x]===1&&g.sight(eye,q))seen.add(key(q));
 }
 cache.fields.set(stamp,seen);return seen;
}
// Where a detouring unit thinks you are looking from, or null when it has no idea (then it walks the plain route).
export const watchPoint=e=>e.lastKnown&&Number.isInteger(e.lastKnown.x)&&Number.isInteger(e.lastKnown.y)?e.lastKnown:null;
