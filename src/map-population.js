import {roomTiles,roomContains} from './map-geometry.js';
// Shared by mission definitions and generation: reserve before distributing.
export const REQUIRED_TARGET_ROOMS=3;
export const eligibleMissionEnemy=e=>!e.expendable&&!['boss','warden'].includes(e.type);
// Phase one preserves the sampled roster/cost. Distinct balance weights come later.
export const threatCost=()=>1;
const key=p=>`${p.x},${p.y}`;
const distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);

// Reservations protect later wall/furniture edits. v2 takes the full contour;
// v1 keeps its historical first seven positions for seed compatibility.
export function reservationPosts(room,{legacy=false,deep=false}={}){
  const tiles=roomTiles(room),inside=new Set(tiles.map(key));
  const inset=tiles.filter(p=>[[0,-1],[1,0],[0,1],[-1,0]].every(([dx,dy])=>inside.has(`${p.x+dx},${p.y+dy}`)));
  if(!legacy)return inset.length?inset:tiles;
  const first=[[room.x+1,room.y+1],[room.x+room.w-2,room.y+1],[room.x+room.w-2,room.y+room.h-2],[room.x+1,room.y+room.h-2]];
  if(deep)first.push([room.x+2,room.y+1],[room.x+1,room.y+3],[room.x+room.w-2,room.y+3]);
  return [...new Map([...first.map(([x,y])=>({x,y})),...inset,...tiles].filter(p=>inside.has(key(p))).map(p=>[key(p),p])).values()];
}

export function contourPosts(map,room,accessible){
  const footprint=new Set(roomTiles(room).map(key));
  const forbidden=new Set([...map.props,...map.items,...map.hazards,map.start,map.end].map(key));
  const entrances=(map.openings||[]).filter(o=>o.rooms.includes(room.id)).flatMap(o=>o.cells.filter(p=>roomContains(room,p)));
  const covers=map.props.filter(p=>p.hp>0&&p.type==='cover');
  const candidates=roomTiles(room).filter(p=>map.grid[p.y]?.[p.x]===1&&accessible.has(key(p))&&!forbidden.has(key(p)));
  return candidates.map(p=>{
    const nearCover=covers.some(c=>distance(c,p)===1);
    const boundary=[[0,-1],[1,0],[0,1],[-1,0]].some(([dx,dy])=>!footprint.has(`${p.x+dx},${p.y+dy}`));
    const facing=nearCover&&entrances.some(e=>covers.some(c=>distance(c,p)===1&&(c.x-p.x)*(e.x-p.x)+(c.y-p.y)*(e.y-p.y)>0));
    return {...p,tier:facing?'primary':'secondary',nestAnchor:!boundary&&!nearCover,rank:facing?0:nearCover?1:boundary?3:2};
  }).sort((a,b)=>a.rank-b.rank||a.y-b.y||a.x-b.x);
}

export function allocateThreat(rooms,roster,{startRoom,endRoom,capacities,requiredTargetRooms=REQUIRED_TARGET_ROOMS}){
  const eligible=rooms.filter(r=>r.id!==startRoom&&capacities[r.id]>0);
  const budget=roster.reduce((n,e)=>n+threatCost(e),0),bosses=roster.filter(e=>!eligibleMissionEnemy(e)&&!e.expendable);
  const regular=roster.filter(eligibleMissionEnemy),other=roster.filter(e=>e.expendable);
  const assigned=Object.fromEntries(eligible.map(r=>[r.id,[]]));
  if(eligible.length<requiredTargetRooms||regular.length<requiredTargetRooms||!assigned[endRoom])return null;
  for(const e of bosses){if(assigned[endRoom].length>=capacities[endRoom])return null;assigned[endRoom].push(e);}
  const targetRooms=eligible.filter(r=>assigned[r.id].length<capacities[r.id]).slice(0,requiredTargetRooms);
  if(targetRooms.length!==requiredTargetRooms)return null;
  targetRooms.forEach((r,i)=>assigned[r.id].push(regular[i]));
  // Smallest occupied budget / area wins. Ties are stable room IDs, no RNG.
  for(const e of [...regular.slice(requiredTargetRooms),...other]){
    const room=eligible.filter(r=>assigned[r.id].length<capacities[r.id]).sort((a,b)=>assigned[a.id].length/roomTiles(a).length-assigned[b.id].length/roomTiles(b).length||a.id-b.id)[0];
    if(!room)return null;assigned[room.id].push(e);
  }
  return {budget,assigned,targetRooms:targetRooms.map(r=>r.id)};
}

export function placePopulation(map,accessible,floor){
  const posts=Object.fromEntries(map.rooms.map(r=>[r.id,contourPosts(map,r,accessible)]));
  const plan=allocateThreat(map.rooms,map.enemies,{startRoom:map.startRoom,endRoom:map.endRoom,capacities:Object.fromEntries(map.rooms.map(r=>[r.id,posts[r.id].length]))});
  if(!plan)return false;
  const enemies=[];
  for(const r of map.rooms){
    const available=[...posts[r.id]],chosen=[];
    for(const [i,e]of (plan.assigned[r.id]||[]).entries()){
      // Prefer separated firing positions within each quality tier.
      available.sort((a,b)=>a.rank-b.rank||(chosen.length?Math.min(...chosen.map(p=>distance(p,b)))-Math.min(...chosen.map(p=>distance(p,a))):0)||a.y-b.y||a.x-b.x);
      const p=available.shift();if(!p)return false;chosen.push(p);
      enemies.push({...e,id:`${floor}-${r.id}-${i}`,x:p.x,y:p.y});
    }
  }
  map.enemies=enemies;return true;
}
