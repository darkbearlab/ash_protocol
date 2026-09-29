import {roomTiles,roomContains} from './map-geometry.js';
import {takenTiles} from './pits.js';

// Smoke vents on the floor plan (3.202.0, user design 2026-09-29, docs/HAZARDS.md section 3). Kept apart from the vents'
// runtime (src/vents.js) because map generation imports it. Placed last in generate(), after the lamps, from the vents'
// own hashes, so nothing else on a floor moves and a floor without vents comes out exactly as before.
// - 0-2 a floor, one to a room, never the start room or the rooms of the start and the exit; a free floor tile whose
//   plus-shaped spray (the tile and its four neighbours) keeps at least four floor tiles and touches neither the start,
//   the exit nor any unit the floor was generated with (review: idle units standing in steam were scalded to death).
// - A vent is one kind for good: dense smoke, light smoke or steam; on a swarm floor toxic gas.
// - `phase` staggers the cycle (src/vents.js ventStage) so two vents on a floor do not go off together.
export const VENT_TUNING=Object.freeze({oneAt:.3,twoAt:.75,period:7,damage:5});
export const VENT_KINDS=Object.freeze(['smoke','haze','steam','toxic']);
const fnv=text=>{let h=2166136261;for(const s of text){h^=s.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
const key=p=>`${p.x},${p.y}`;
const PLUS=[[0,0],[0,-1],[1,0],[0,1],[-1,0]];
// The tiles a vent sprays: itself and its four neighbours, floor only.
export const ventCells=(grid,v)=>PLUS.map(([dx,dy])=>({x:v.x+dx,y:v.y+dy})).filter(q=>grid[q.y]?.[q.x]===1);

export function placeVents(map,seed,floor,faction){
 if(!map?.generation||!Array.isArray(map.rooms)||!Array.isArray(map.grid))return map;
 const roll=fnv(`${seed}:${floor}:vents-v1`)/4294967296,count=roll<VENT_TUNING.oneAt?0:roll<VENT_TUNING.twoAt?1:2;
 if(!count)return map;
 const taken=takenTiles(map),vents=[],clear=new Set([map.start,map.end,...(map.enemies||[])].filter(Boolean).map(key));   // the spray stays off these
 const rooms=map.rooms.map((r,i)=>({r,i})).filter(({r,i})=>i!==map.startRoom&&!roomContains(r,map.start)&&!roomContains(r,map.end))
  .sort((a,b)=>fnv(`${seed}:${floor}:vent-room:${a.i}`)-fnv(`${seed}:${floor}:vent-room:${b.i}`));
 for(const {r} of rooms){
  if(vents.length>=count)break;
  const spot=roomTiles(r).filter(p=>map.grid[p.y]?.[p.x]===1&&!taken.has(key(p))&&ventCells(map.grid,p).length>=4&&!ventCells(map.grid,p).some(q=>clear.has(key(q))))
   .sort((a,b)=>fnv(`${seed}:${floor}:vent-tile:${key(a)}`)-fnv(`${seed}:${floor}:vent-tile:${key(b)}`))[0];
  if(!spot)continue;
  const n=vents.length,kind=faction==='swarm'?'toxic':VENT_KINDS[fnv(`${seed}:${floor}:vent-kind:${n}`)%3];
  vents.push({id:`vent-${floor}-${n}`,x:spot.x,y:spot.y,kind,phase:fnv(`${seed}:${floor}:vent-phase:${n}`)%VENT_TUNING.period});
  taken.add(key(spot));
 }
 if(vents.length)map.vents=vents;
 return map;
}
