import {ANNEX_TYPES,ANNEX_SIDES,annexBounds,annexBorder,roomTiles,roomContains} from './map-geometry.js';
import {makeBarrier,edgeCells} from './barriers.js';
import {moduleCells} from './modules.js';

export const ANNEX_RECIPES=Object.freeze([Object.freeze({id:'edge-annexes-v5'})]);
const key=p=>`${p.x},${p.y}`,dirs=[[1,0],[0,1],[-1,0],[0,-1]];
const hash=(seed,floor,salt)=>{let n=(seed^Math.imul(floor,2654435761)^Math.imul(salt+1,2246822519))>>>0;n=Math.imul(n^(n>>>16),2246822519);return (n^(n>>>13))>>>0;};

export function annexCandidates(map,seed,floor){
  const candidates=[];
  for(const r of map.rooms)for(const [i,side]of ANNEX_SIDES.entries()){
    const bounds=annexBounds(map,r.id,side);if(!bounds)continue;
    // Keep the initial/exit encounter footprint intact. Plenty of edge rooms
    // remain, including merged rooms; one annex per parent in this first pool.
    if(r.id===map.startRoom||r.id===map.endRoom||map.annexes.some(a=>a.roomId===r.id))continue;
    const footprint=roomTiles(bounds),cells=new Set(footprint.map(key)),border=annexBorder(map,r.id,side);
    if(footprint.some(p=>map.grid[p.y]?.[p.x]!==0||dirs.some(([dx,dy])=>{const q={x:p.x+dx,y:p.y+dy};return map.grid[q.y]?.[q.x]===1&&!cells.has(key(q))&&!roomContains(r,q);})))continue;
    // A restroom against an exterior tile wall relies on that wall to seal it.
    // Never replace that supporting wall with a transparent/vaultable railing.
    const moduleTiles=map.props.filter(p=>p.type==='module').flatMap(moduleCells);
    if(border.some(b=>moduleTiles.some(p=>key(p)===key(b.inside))||map.grid[b.inside.y][b.inside.x]!==1))continue;
    const free=border.filter(b=>![...map.props,...map.items,...map.hazards,map.start,map.end].some(p=>key(p)===key(b.inside))&&!map.barriers.some(e=>edgeCells(e).some(p=>key(p)===key(b.inside))));
    const pairs=free.flatMap((a,j)=>free.slice(j+1).filter(b=>Math.abs(a.inside.x-b.inside.x)+Math.abs(a.inside.y-b.inside.y)>=3).map(b=>[a,b]));
    if(!pairs.length)continue;
    pairs.sort((a,b)=>Math.abs(b[0].inside.x-b[1].inside.x)+Math.abs(b[0].inside.y-b[1].inside.y)-Math.abs(a[0].inside.x-a[1].inside.x)-Math.abs(a[0].inside.y-a[1].inside.y));
    const rank=hash(seed,floor,r.id*4+i);
    candidates.push({roomId:r.id,side,footprint,openings:pairs[0],type:ANNEX_TYPES[rank%ANNEX_TYPES.length],rank});
  }
  return candidates.sort((a,b)=>a.rank-b.rank);
}

function placeAnnex(base,candidate,floor,index){
  const map=structuredClone(base),{rank,...shape}=candidate;
  const annex={id:`annex-${floor}-${index}`,...shape,barrierIds:[]};
  for(const p of annex.footprint)map.grid[p.y][p.x]=1;
  for(const [i,b]of annexBorder(map,annex.roomId,annex.side).entries())if(!annex.openings.some(g=>key(g.inside)===key(b.inside))){
    const rail=makeBarrier('low_partition',b.inside,b.outside,`edge-${annex.id}-${i}`);map.barriers.push(rail);annex.barrierIds.push(rail.id);
  }
  const r=map.rooms[annex.roomId],light=map.lighting[r.cy][r.cx];
  for(const p of annex.footprint)map.lighting[p.y][p.x]=light;
  map.annexes.push(annex);return map;
}

export function annexesSafe(map,base,{reachable,generationSafe}){
  if(!generationSafe(map))return false;
  // Annexes never become an alternative owner for room IDs/mainRoute. Closing
  // every new tile must restore the original main-line connectivity.
  const without=structuredClone(map),annexCells=new Set(map.annexes.flatMap(a=>a.footprint.map(key))),railIds=new Set(map.annexes.flatMap(a=>a.barrierIds));
  for(const a of map.annexes)for(const p of a.footprint)without.grid[p.y][p.x]=0;
  without.barriers=without.barriers.filter(b=>!railIds.has(b.id));
  const original=reachable(base,base.start),remaining=reachable(without,without.start);
  if([...original].some(k=>!remaining.has(k)))return false;
  const accessible=reachable(map,map.start);
  return map.annexes.every(a=>a.footprint.every(p=>accessible.has(key(p)))&&a.openings.every(g=>accessible.has(key(g.inside))&&accessible.has(key(g.outside))))&&
    ![...map.enemies,...map.items,...map.props,...map.hazards,map.start,map.end].some(p=>annexCells.has(key(p)));
}

export function addAnnexes(base,seed,floor,checks){
  let map=structuredClone(base);const wanted=1+hash(seed,floor,997)%2;
  for(let i=0;i<wanted;i++){
    let added=false;
    for(const candidate of annexCandidates(map,seed,floor)){
      const next=placeAnnex(map,candidate,floor,i);
      if(annexesSafe(next,base,checks)){map=next;added=true;break;}
    }
    if(!added)break;
  }
  if(!map.annexes.length)return null;
  map.generation={version:5,recipeId:'edge-annexes-v5',base:structuredClone(base.generation)};
  return map;
}
