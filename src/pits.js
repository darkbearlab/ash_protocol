// Pits (3.164.0, user decisions 2026-09-23; docs/PITS.md). An open drop inside a room, like an atrium: no floor is drawn,
// nobody walks on it but flyers, and sight, shots and blasts cross it. A red-black warning band rims it on the floor
// (drawn by the renderer), and on some sides a railing — the low partition: half cover, see-through — stands on the edge.
// Dug once the combat population, supplies and runtime population stand, before the researchers, the swarm's burrow, the
// terminal kinds and the vault (which only ever use floor, so they step around it), from hashes of its own: only a floor
// that gets a pit changes. It is inserted like the living modules — inside one room, never on anything the floor was
// generated with — and the floor must stay fully connected, or the pit is not dug.
// This module imports nothing that imports world.js; world.js hands in its safety check.
import {VOID} from './data.js';
import {makeBarrier,barrierBetween,edgeCells} from './barriers.js';
import {roomTiles,roomContains} from './map-geometry.js';
import {moduleCells} from './modules.js';

// chance: a floor digs one pit (user: 2x2 to 5x5, by the room). margin: how much smaller than the room a pit's side is
// before the bounds, so a 6-wide room gets a 3-wide pit and a hall a 5-wide one. railSide: the chance each side is railed.
export const PIT_TUNING=Object.freeze({chance:.5,min:2,max:5,margin:3,railSide:.5});
const fnv=text=>{let h=2166136261;for(const s of text){h^=s.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
const key=p=>`${p.x},${p.y}`,DIRS=[[0,-1],[1,0],[0,1],[-1,0]];
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));

// Every tile something on the floor was generated with: units, items, props and module cells, slots, corridors and paths,
// both sides of every door or partition, the start and the exit. Read from the map as data, so a new kind of placed
// thing cannot be forgotten here. Rooms only describe the floor, so their corners are not taken.
const SKIP=new Set(['grid','lighting','rooms','generation']);
export function takenTiles(map){
 const taken=new Set(),add=p=>{if(p&&Number.isInteger(p.x)&&Number.isInteger(p.y))taken.add(key(p));};
 const walk=(v,depth)=>{if(!v||typeof v!=='object'||depth>8)return;if(Array.isArray(v)){for(const x of v)walk(x,depth+1);return;}add(v);for(const x of Object.values(v))walk(x,depth+1);};
 for(const [k,v] of Object.entries(map))if(!SKIP.has(k))walk(v,0);
 for(const m of (map.props||[]).filter(p=>p.type==='module'))for(const c of moduleCells(m))add(c);
 for(const b of map.barriers||[])for(const c of edgeCells(b))add(c);
 return taken;
}

// The pit a room would take, largest first: each side is the room's less the margin, within 2 and 5; if that will not fit,
// it shrinks a side at a time down to 2x2. A walkway of floor stays all round inside the room, and centred spots are tried first.
function candidates(tiles,seed,floor){
 const inRoom=new Set(tiles.map(key)),xs=tiles.map(p=>p.x),ys=tiles.map(p=>p.y);
 const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),cx=(minX+maxX)/2,cy=(minY+maxY)/2;
 const W=clamp(maxX-minX+1-PIT_TUNING.margin,PIT_TUNING.min,PIT_TUNING.max),H=clamp(maxY-minY+1-PIT_TUNING.margin,PIT_TUNING.min,PIT_TUNING.max);
 const sizes=[];for(let w=W;w>=PIT_TUNING.min;w--)for(let h=H;h>=PIT_TUNING.min;h--)sizes.push([w,h]);
 sizes.sort((a,b)=>b[0]*b[1]-a[0]*a[1]||b[0]-a[0]);
 const out=[];
 for(const [w,h] of sizes){
  const spots=[];for(let y=minY+1;y+h<=maxY;y++)for(let x=minX+1;x+w<=maxX;x++)spots.push({x,y});
  const off=s=>Math.abs(s.x+(w-1)/2-cx)+Math.abs(s.y+(h-1)/2-cy);
  spots.sort((a,b)=>off(a)-off(b)||fnv(`${seed}:${floor}:pit-spot:${key(a)}`)-fnv(`${seed}:${floor}:pit-spot:${key(b)}`));
  for(const s of spots){
   const cells=[];for(let y=s.y;y<s.y+h;y++)for(let x=s.x;x<s.x+w;x++)cells.push({x,y});
   const inside=new Set(cells.map(key)),ring=cells.flatMap(p=>DIRS.map(([dx,dy])=>({x:p.x+dx,y:p.y+dy}))).filter(q=>!inside.has(key(q)));
   out.push({x:s.x,y:s.y,w,h,cells,ring,inRoom});
  }
 }
 return out;
}

export function placePit(map,seed,floor,safe){
 if(!map?.generation||!Array.isArray(map.rooms)||!Array.isArray(map.barriers)||!Array.isArray(map.grid))return map;
 if(fnv(`${seed}:${floor}:pit-v1`)/4294967296>=PIT_TUNING.chance)return map;
 const taken=takenTiles(map);
 const rooms=map.rooms.map((r,i)=>({r,i})).filter(({r,i})=>i!==map.startRoom&&!roomContains(r,map.start)&&!roomContains(r,map.end))
  .sort((a,b)=>fnv(`${seed}:${floor}:pit-room:${a.i}`)-fnv(`${seed}:${floor}:pit-room:${b.i}`));
 for(const {r} of rooms){
  for(const pit of candidates(roomTiles(r),seed,floor)){
   if(pit.cells.some(p=>map.grid[p.y]?.[p.x]!==1||taken.has(key(p))))continue;
   if(pit.ring.some(q=>!pit.inRoom.has(key(q))||map.grid[q.y]?.[q.x]!==1))continue;
   const priorBarriers=map.barriers,rails=[];let n=0;
   for(const p of pit.cells)map.grid[p.y][p.x]=VOID;
   DIRS.forEach(([dx,dy],side)=>{
    if(fnv(`${seed}:${floor}:pit-rail:${side}`)/4294967296>=PIT_TUNING.railSide)return;
    for(const p of pit.cells){const q={x:p.x+dx,y:p.y+dy};if(map.grid[q.y]?.[q.x]!==1||barrierBetween(map.barriers,p,q))continue;rails.push(makeBarrier('low_partition',q,p,`edge-pit-${floor}-${n++}`));}
   });
   map.barriers=[...priorBarriers,...rails];
   if(safe(map))return map;
   for(const p of pit.cells)map.grid[p.y][p.x]=1;map.barriers=priorBarriers;
  }
 }
 return map;
}

// The pits of a floor, read back from its grid (the save keeps only the grid): each 4-connected group of pit cells.
export function pitsOf(grid){
 const seen=new Set(),out=[];
 for(let y=0;y<grid.length;y++)for(let x=0;x<grid[y].length;x++){
  if(grid[y][x]!==VOID||seen.has(`${x},${y}`))continue;
  const cells=[{x,y}];seen.add(`${x},${y}`);
  for(let i=0;i<cells.length;i++)for(const [dx,dy]of DIRS){const q={x:cells[i].x+dx,y:cells[i].y+dy};if(grid[q.y]?.[q.x]===VOID&&!seen.has(key(q))){seen.add(key(q));cells.push(q);}}
  const xs=cells.map(p=>p.x),ys=cells.map(p=>p.y);out.push({x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs)+1,h:Math.max(...ys)-Math.min(...ys)+1,cells});
 }
 return out;
}
