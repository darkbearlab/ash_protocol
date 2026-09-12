import {roomTiles,roomContains,collapseCellLinks} from './map-geometry.js';
import {placePopulation} from './map-population.js';
import {edgeCells,makeBarrier} from './barriers.js';
import {addLivingModules} from './modules.js';
import {createLighting} from './lighting.js';

export const MERGED_RECIPES=Object.freeze([{id:'long-halls-v3'},{id:'hangar-v3'}].map(Object.freeze));
const key=p=>`${p.x},${p.y}`;
const rank=(seed,floor,salt)=>{let n=(seed^Math.imul(floor,2654435761)^Math.imul(salt+1,2246822519))>>>0;n=Math.imul(n^(n>>>16),2246822519);return (n^(n>>>13))>>>0;};
export const selectMergeRecipe=(seed,floor,recipes)=>recipes[rank(seed,floor,91)%recipes.length];

// One group per recipe in this phase: an adjacent pair, or at most one 2×2 hall.
// All choices use their own hash; the original population and supply draws survive.
export function mergePlans(base,seed,floor,recipeId){
  const candidates=[];
  for(const c of base.cells){
    for(const [dr,dc]of [[0,1],[1,0]]){
      const b=base.cells.find(b=>b.row===c.row+dr&&b.col===c.col+dc);
      if(b)candidates.push([c.id,b.id]);
    }
    if(recipeId==='hangar-v3'&&c.row<2&&c.col<2)candidates.push(base.cells.filter(b=>b.row>=c.row&&b.row<=c.row+1&&b.col>=c.col&&b.col<=c.col+1).map(b=>b.id));
  }
  return candidates.filter(ids=>!ids.includes(base.startRoom)&&!ids.includes(base.endRoom)&&ids.filter(id=>base.rooms[id].supply).length<=1)
    .map(ids=>({ids,rank:rank(seed,floor,ids.reduce((n,id)=>n|(1<<id),0))}))
    .sort((a,b)=>b.ids.length-a.ids.length||a.rank-b.rank).map(({ids})=>ids);
}

function remapRooms(map,merged){
  const groups=map.cells.filter(c=>!merged.includes(c.id)||c.id===merged[0]).map(c=>merged.includes(c.id)?merged:[c.id]);
  const owner=new Map();groups.forEach((ids,id)=>ids.forEach(cell=>owner.set(cell,id)));
  const oldRooms=map.rooms;
  map.rooms=groups.map((ids,id)=>{
    const originals=ids.map(i=>oldRooms[i]),x=Math.min(...originals.map(r=>r.x)),y=Math.min(...originals.map(r=>r.y));
    const w=Math.max(...originals.map(r=>r.x+r.w))-x,h=Math.max(...originals.map(r=>r.y+r.h))-y;
    const r={...originals[0],id,x,y,w,h,cx:x+Math.floor(w/2),cy:y+Math.floor(h/2),cellIds:ids};
    delete r.supply;const supply=originals.find(r=>r.supply)?.supply;if(supply)r.supply=supply;
    r.footprint=roomTiles({x,y,w,h});
    if(ids.length>1){r.kind=ids.length===4?'停機大廳':'開放車間';for(const p of r.footprint)map.grid[p.y][p.x]=1;}
    return r;
  });
  map.cells=map.cells.map(c=>({...c,roomId:owner.get(c.id)}));
  map.links=collapseCellLinks(map.cells,map.links);
  map.openings=map.openings.map(o=>({...o,rooms:o.rooms.map(id=>owner.get(id))})).filter(o=>o.rooms[0]!==o.rooms[1]);
  // Multiple openings belong to phase three. Do not accidentally introduce them
  // by collapsing two external edges onto the same pair of rooms.
  if(map.openings.length!==map.links.length)return false;
  map.startRoom=owner.get(map.startRoom);map.endRoom=owner.get(map.endRoom);
  map.rewardRooms=map.rewardRooms.map(id=>owner.get(id));
  const parents=new Map([[map.startRoom,null]]),queue=[map.startRoom];
  for(let i=0;i<queue.length;i++)for(const edge of map.links.filter(e=>e.includes(queue[i]))){const b=edge.find(id=>id!==queue[i]);if(!parents.has(b)){parents.set(b,queue[i]);queue.push(b);}}
  if(queue.length!==map.rooms.length)return false;
  map.mainRoute=[];for(let id=map.endRoom;id!==null;id=parents.get(id))map.mainRoute.unshift(id);
  return map.mainRoute.length>=3&&map.rewardRooms.some(id=>!map.mainRoute.includes(id));
}

function centralCover(map,hall,corridors){
  const local=map.props.filter(p=>p.type==='cover'&&!p.moduleId&&roomContains(hall,p));
  // Some deep-floor reservations leave only one cover in a candidate pair.
  // Reuse ordinary props from another non-endpoint room rather than add HP or
  // increase the floor's cover count. Removing a cover cannot seal its old room.
  const spare=map.props.filter(p=>p.type==='cover'&&!p.moduleId&&!local.includes(p)&&!roomContains(map.rooms[map.startRoom],p)&&!roomContains(map.rooms[map.endRoom],p));
  const covers=[...local,...spare];
  if(covers.length<2)return false;
  const count=Math.min(hall.cellIds.length===4?4:2,covers.length),group=covers.slice(0,count);
  const obstacles=new Set([...map.props.filter(p=>!group.includes(p)),...map.items,...map.hazards,map.start,map.end].map(key));
  const shapes=count===4?[[[0,0],[1,0],[0,1],[1,1]]]:count===3?[[[0,0],[1,0],[0,1]]]:[[[0,0],[1,0]],[[0,0],[0,1]]];
  const positions=roomTiles(hall).filter(p=>p.x>hall.x&&p.y>hall.y&&p.x<hall.x+hall.w-2&&p.y<hall.y+hall.h-2)
    .sort((a,b)=>(Math.abs(a.x-hall.cx)+Math.abs(a.y-hall.cy))-(Math.abs(b.x-hall.cx)+Math.abs(b.y-hall.cy)));
  for(const p of positions)for(const shape of shapes){
    const tiles=shape.map(([dx,dy])=>({x:p.x+dx,y:p.y+dy}));
    if(tiles.some(q=>obstacles.has(key(q))||corridors.has(key(q))||map.barriers.some(b=>edgeCells(b).some(c=>key(c)===key(q)))))continue;
    group.forEach((cover,i)=>Object.assign(cover,tiles[i]));return true;
  }
  return false;
}

function relocateStations(map,floor,corridors){
  const stations=map.props.filter(p=>p.type==='terminal');if(stations.length!==2)return false;
  const targets=[map.mainRoute[Math.floor(map.mainRoute.length/2)],map.rewardRooms.find(id=>!map.mainRoute.includes(id))];
  map.props=map.props.filter(p=>p.type!=='terminal');
  for(const [i,id]of targets.entries()){
    const blocked=new Set([...map.props,...map.items,...map.hazards,map.start,map.end].map(key));
    const spot=roomTiles(map.rooms[id]).find(p=>map.grid[p.y][p.x]===1&&!blocked.has(key(p))&&!corridors.has(key(p))&&!map.barriers.some(b=>edgeCells(b).some(c=>key(c)===key(p))));
    if(!spot)return false;map.props.push({...stations[i],...spot,id:`${floor}-console-${id}`});
  }
  return true;
}

function relocateEdges(map,groups,corridors,reachable){
  const occupied=new Set([...map.props,...map.items,...map.hazards,map.start,map.end].map(key));
  for(const group of groups){
    const points=group.flatMap(edgeCells),left=Math.min(...points.map(p=>p.x)),top=Math.min(...points.map(p=>p.y));let placed=false;
    for(const room of map.rooms.filter(r=>r.cellIds.length===1&&r.id!==map.startRoom)){
      if(placed)break;
      for(const origin of roomTiles(room)){
        const dx=origin.x-left,dy=origin.y-top;let edges=group.map(b=>({...b,x:b.x+dx,y:b.y+dy}));
        if(group.length>1){
          // A former compartment may have relied on adjacent tile walls. Build
          // its entire 2×2 perimeter so translating it cannot leave a new gap.
          const interior=[[0,0],[1,0],[0,1],[1,1]].map(([x,y])=>({x:origin.x+x,y:origin.y+y})),pairs=[];
          for(const a of interior)for(const [x,y]of [[0,-1],[1,0],[0,1],[-1,0]]){const b={x:a.x+x,y:a.y+y};if(!interior.some(p=>key(p)===key(b)))pairs.push([a,b]);}
          edges=pairs.map(([a,b],i)=>makeBarrier(i===0?'door':'partition',a,b,`${group[0].id}-relocated-${i}`));
        }
        const cells=edges.flatMap(edgeCells);
        if(cells.some(p=>!roomContains(room,p)||map.grid[p.y][p.x]!==1||occupied.has(key(p))||corridors.has(key(p))||map.barriers.some(b=>edgeCells(b).some(q=>key(p)===key(q)))))continue;
        const before=map.barriers;map.barriers=[...before,...edges];
        const all=reachable({...map,props:[]},map.start),seen=reachable(map,map.start);
        if(all.size===map.grid.flat().filter(n=>n===1).length&&[map.end,...map.items,...map.props.filter(p=>['container','terminal'].includes(p.type))].every(p=>seen.has(key(p)))){placed=true;break;}
        map.barriers=before;
      }
    }
    if(!placed)return false;
  }
  return true;
}

// Transactional transform: reject the complete candidate, never a partial room.
// Reachability is injected so world.js remains the sole movement-geometry owner.
export function mergeMap(base,ids,seed,floor,recipeId,{reachable,generationSafe}){
  const legal=mergePlans(base,seed,floor,recipeId).some(plan=>plan.length===ids.length&&plan.every((id,i)=>id===ids[i]));
  if(!legal)return null;
  const map=structuredClone(base);if(!remapRooms(map,ids))return null;
  const hall=map.rooms.find(r=>r.cellIds.length>1);
  map.props=map.props.filter(p=>p.type!=='module'&&!p.moduleId);
  const displaced=map.barriers.filter(b=>!b.id.startsWith('edge-module-')&&edgeCells(b).every(p=>roomContains(hall,p)));
  map.barriers=map.barriers.filter(b=>!b.id.startsWith('edge-module-')&&!edgeCells(b).every(p=>roomContains(hall,p)));
  const corridors=new Set(map.openings.flatMap(o=>o.cells.map(key)));
  const compartment=displaced.filter(b=>b.id.startsWith(`edge-${floor}-cell-`));
  const groups=[...(compartment.length?[compartment]:[]),...displaced.filter(b=>b.type==='low_partition').map(b=>[b])];
  if(!relocateEdges(map,groups,corridors,reachable))return null;
  if(!centralCover(map,hall,corridors)||!relocateStations(map,floor,corridors)||!placePopulation(map,reachable(map,map.start),floor))return null;
  // Keep enclosed life modules in the remaining single rooms; halls stay open.
  if(!addLivingModules(map,seed,floor,{corridors,reachable,roomFilter:r=>r.cellIds.length===1}))return null;
  map.lighting=createLighting(map.grid,map.rooms,map.start,seed,floor,map.openings);
  map.generation={version:3,recipeId:ids.length===4?'hangar-v3':'long-halls-v3'};
  return generationSafe(map)?map:null;
}
