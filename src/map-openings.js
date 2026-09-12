import {roomContains} from './map-geometry.js';
import {edgeCells,barrierBetween,makeBarrier} from './barriers.js';
import {createLighting} from './lighting.js';
import {placePopulation} from './map-population.js';

// Geometry controls only. Content, enemy budgets and the combat stream stay put.
export const OPENING_RECIPES=Object.freeze([
  {id:'warehouse-v4',openings:{default:[2,2],large:[2,3]},doorRatio:.2},
  {id:'laboratory-v4',openings:{default:[1,2],large:[2,3]},doorRatio:.5},
].map(r=>Object.freeze({...r,openings:Object.freeze(r.openings)})));
export const OPENING_SEPARATION=3; // Two intact tile rows between the mouths.
const key=p=>`${p.x},${p.y}`,pairKey=ids=>[...ids].sort((a,b)=>a-b).join('-');
const hash=(seed,floor,salt)=>{let n=(seed^Math.imul(floor,2654435761)^Math.imul(salt+1,2246822519))>>>0;n=Math.imul(n^(n>>>16),2246822519);return (n^(n>>>13))>>>0;};
const directions=[[1,0],[0,1],[-1,0],[0,-1]];

export function roomInterface(first,second){
  let a=first,b=second,axis;
  if(a.x+a.w<=b.x||b.x+b.w<=a.x){axis='x';if(a.x>b.x)[a,b]=[b,a];}
  else if(a.y+a.h<=b.y||b.y+b.h<=a.y){axis='y';if(a.y>b.y)[a,b]=[b,a];}
  else return null;
  const tangent=axis==='x'?'y':'x',size=axis==='x'?'h':'w';
  const low=Math.max(a[tangent],b[tangent]),high=Math.min(a[tangent]+a[size],b[tangent]+b[size])-1;
  if(low>high)return null;
  return {a,b,axis,tangent,low,high,from:a[axis]+a[axis==='x'?'w':'h']-1,to:b[axis]};
}

function coreOpening(map,opening,face){
  const {a,b,axis,from,to}=face;
  const starts=opening.cells.filter(p=>p[axis]===from&&roomContains(a,p)),ends=opening.cells.filter(p=>p[axis]===to&&roomContains(b,p));
  if(!starts.length||!ends.length)return null;
  const allowed=new Set(opening.cells.filter(p=>p[axis]>=from&&p[axis]<=to).map(key));
  const queue=[...starts],parents=new Map(starts.map(p=>[key(p),null]));let finish;
  for(let i=0;i<queue.length;i++){
    if(ends.some(p=>key(p)===key(queue[i]))){finish=queue[i];break;}
    for(const [dx,dy]of directions){const p={x:queue[i].x+dx,y:queue[i].y+dy},k=key(p);if(allowed.has(k)&&!parents.has(k)){parents.set(k,queue[i]);queue.push(p);}}
  }
  if(!finish)return null;
  const cells=[];for(let p=finish;p;p=parents.get(key(p)))cells.unshift({...p});
  // Keep all bend/spur cells for clearance and lighting, plus an ordered path
  // for movement and door placement. The old descriptor was an unordered union.
  return {...opening,rooms:[a.id,b.id],mouths:[cells[0],cells.at(-1)],cells:opening.cells.filter(p=>p[axis]>=from&&p[axis]<=to),path:cells,barrierIds:[]};
}

export function openingRequest(map,link,recipe,seed,floor,index){
  const id=pairKey(link),large=link.some(i=>map.rooms[i].cellIds.length>1);
  const range=recipe.openings?.[id]||(large&&recipe.openings?.large)||recipe.openings?.default||[1,2];
  if(!Array.isArray(range)||range.length!==2||!range.every(n=>Number.isInteger(n)&&n>=1&&n<=3)||range[0]>range[1])throw new Error('Invalid opening range');
  const wantsDoor=recipe.doorRatio>0&&(recipe.doorLinks?.includes(id)||hash(seed,floor,index+71)/2**32<recipe.doorRatio);
  const drawn=range[0]+hash(seed,floor,index+19)%(range[1]-range[0]+1);
  return {count:Math.max(wantsDoor?2:1,drawn),wantsDoor};
}

export function openingCandidates(map,face,existing){
  const {a,b,axis,tangent,low,high,from,to}=face,result=[];
  const blocked=new Set([...map.props,...map.items,...map.hazards,map.start,map.end].map(key));
  for(let offset=low;offset<=high;offset++){
    // Protect both mouths and every bend in an existing inter-room corridor.
    if(existing.some(o=>o.cells.some(p=>Math.abs(p[tangent]-offset)<OPENING_SEPARATION)))continue;
    const cells=[];for(let value=from;value<=to;value++)cells.push(axis==='x'?{x:value,y:offset}:{x:offset,y:value});
    if(cells.some(p=>blocked.has(key(p))))continue;
    if(map.grid[cells[0].y][cells[0].x]!==1||map.grid[cells.at(-1).y][cells.at(-1).x]!==1)continue;
    if(cells.some(p=>map.barriers.some(b=>edgeCells(b).some(q=>key(q)===key(p)))))continue;
    // No widening of another corridor or accidental link to a third room.
    const tunnel=cells.slice(1,-1),own=new Set(cells.map(key));
    if(tunnel.some(p=>map.grid[p.y][p.x]===1||directions.some(([dx,dy])=>{const q={x:p.x+dx,y:p.y+dy};return map.grid[q.y]?.[q.x]===1&&!own.has(key(q))&&!roomContains(a,q)&&!roomContains(b,q);})))continue;
    result.push({rooms:[a.id,b.id],cells,path:cells,mouths:[cells[0],cells.at(-1)],barrierIds:[]});
  }
  return result;
}

const pathDoors=(map,o)=>o.path.slice(1).flatMap((p,i)=>{const b=barrierBetween(map.barriers,o.path[i],p);return b?.type==='door'?[b.id]:[];});
export function openingInvariants(map){
  for(const link of map.links){
    const group=map.openings.filter(o=>pairKey(o.rooms)===pairKey(link));if(group.length<1||group.length>3||!group.some(o=>pathDoors(map,o).length===0))return false;
    const face=roomInterface(...link.map(id=>map.rooms[id]));if(!face)return false;
    for(let i=0;i<group.length;i++)for(let j=0;j<i;j++)if(group[i].cells.some(p=>group[j].cells.some(q=>Math.abs(p[face.tangent]-q[face.tangent])<OPENING_SEPARATION)))return false;
  }
  return map.rooms.every(r=>map.openings.some(o=>o.rooms.includes(r.id)));
}

// Called only on a newly generated floor. Old saves retain their stored doors.
export function addOpenings(base,seed,floor,recipe,{reachable,generationSafe}){
  if(!Number.isFinite(recipe.doorRatio)||recipe.doorRatio<0||recipe.doorRatio>1)throw new Error('Invalid door ratio');
  const map=structuredClone(base);
  // Interior compartment doors are unrelated to the room-connection policy.
  map.barriers=map.barriers.filter(b=>!b.id.startsWith(`edge-${floor}-entrance-`));
  const groups=[];
  for(const [index,link]of map.links.entries()){
    const face=roomInterface(...link.map(id=>map.rooms[id]));if(!face)return null;
    const original=map.openings.filter(o=>pairKey(o.rooms)===pairKey(link));
    const group=original.map(o=>coreOpening(map,o,face));if(group.some(o=>!o))return null;
    const request=openingRequest(map,link,recipe,seed,floor,index);
    while(group.length<request.count){
      const candidates=openingCandidates(map,face,group).sort((a,b)=>hash(seed,floor,index*31+a.mouths[0][face.tangent])-hash(seed,floor,index*31+b.mouths[0][face.tangent]));
      if(!candidates.length)break;
      const opening={...candidates[0],id:`opening-${floor}-${index}-extra-${group.length}`};
      for(const p of opening.cells)map.grid[p.y][p.x]=1;group.push(opening);
    }
    groups.push(group);
  }
  map.openings=groups.flat();
  // Reserve one physically door-free path per link before assigning any doors.
  const candidates=[];
  for(const [index,group]of groups.entries()){
    const free=group.find(o=>pathDoors(map,o).length===0);if(!free)return null;
    for(const [n,o]of group.entries())if(o!==free&&!pathDoors(map,o).length){
      const pair=o.path.slice(1).map((p,i)=>[o.path[i],p]).find(([a,b])=>!barrierBetween(map.barriers,a,b));
      if(pair)candidates.push({o,pair,rank:hash(seed,floor,index*7+n+503)});
    }
  }
  // Actual ratio may be below the requested value due to free-path/space caps.
  const count=Math.min(candidates.length,Math.floor(map.openings.length*recipe.doorRatio));
  candidates.sort((a,b)=>a.rank-b.rank);
  for(const {o,pair}of candidates.slice(0,count))map.barriers.push(makeBarrier('door',...pair,`edge-${o.id}`));
  for(const o of map.openings)o.barrierIds=pathDoors(map,o);
  if(!openingInvariants(map)||!placePopulation(map,reachable(map,map.start),floor))return null;
  map.lighting=createLighting(map.grid,map.rooms,map.start,seed,floor,map.openings);
  map.generation={version:4,recipeId:recipe.id,skeleton:base.generation.recipeId};
  return generationSafe(map)?map:null;
}
