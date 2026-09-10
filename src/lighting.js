import {activeTrait} from './traits.js';

export const DARK_PENALTY=40;
export const fullLighting=grid=>grid.map(row=>row.map(()=>1));
// Separate deterministic stream: lighting never rerolls enemies, loot or combat RNG.
export function createLighting(grid,rooms,start,seed,floor,corridors=[]){
  const light=fullLighting(grid);
  const hash=i=>{let n=(seed^Math.imul(floor,2654435761)^Math.imul(i+1,2246822519))>>>0;n=Math.imul(n^(n>>>16),2246822519);return (n^(n>>>13))>>>0;};
  const dark=rooms.map((room,i)=>({room,i,rank:hash(i)})).filter(({room:r})=>!(start.x>=r.x&&start.x<r.x+r.w&&start.y>=r.y&&start.y<r.y+r.h)).sort((a,b)=>a.rank-b.rank||a.i-b.i).slice(0,3);
  for(const {room:r}of dark)for(let y=r.y;y<r.y+r.h;y++)for(let x=r.x;x<r.x+r.w;x++)if(grid[y]?.[x]===1)light[y][x]=0;
  const roomAt=p=>rooms.findIndex(r=>p.x>=r.x&&p.x<r.x+r.w&&p.y>=r.y&&p.y<r.y+r.h),assigned=new Set();
  for(const [i,path]of corridors.entries()){
    const endpoints=path.rooms.map(index=>rooms[index]),chosen=endpoints[hash(i+rooms.length)%2];
    const value=light[chosen.cy??chosen.y][chosen.cx??chosen.x];
    for(const p of path.cells){const k=p.x+','+p.y;if(grid[p.y]?.[p.x]===1&&roomAt(p)<0&&!assigned.has(k)){light[p.y][p.x]=value;assigned.add(k);}}
  }
  return light;
}
export const validLighting=(light,grid)=>Array.isArray(light)&&light.length===grid.length&&light.every((row,y)=>Array.isArray(row)&&row.length===grid[y].length&&row.every(n=>n===0||n===1));
// Missing lighting is lit for read-only previews and legacy callers; restore validates saves.
export const isDark=(game,point)=>game.lighting?.[point.y]?.[point.x]===0;
export function lightingEffects(game,attacker,target){
  const dark=isDark(game,target),nightVision=activeTrait(attacker,'night_vision');
  return {dark,nightVision,penalty:dark&&!nightVision?DARK_PENALTY:0};
}

// Three small pixel bands inside known tiles; never paint hidden terrain.
export function floorShading(game,x,y){
  if(!game.seen[y]?.[x])return [];
  const directions=[[0,-1],[1,0],[0,1],[-1,0]],bands=[];
  if(isDark(game,{x,y})){
    const edges=directions.map(([dx,dy])=>game.seen[y+dy]?.[x+dx]&&game.grid[y+dy]?.[x+dx]===1&&!isDark(game,{x:x+dx,y:y+dy}));
    if(!edges.some(Boolean))bands.push({x:0,y:0,w:1,h:1,color:'#060c22a6'});
    else for(let i=0;i<4;i++){const n=i*.06,l=edges[3]?n:0,r=edges[1]?n:0,u=edges[0]?n:0,d=edges[2]?n:0;bands.push({x:l,y:u,w:1-l-r,h:1-u-d,color:i?'#060c222e':'#060c225c'});}
  }
  if(game.visibleTiles?.has(x+','+y))for(const [dx,dy]of directions){
    if(game.visibleTiles.has((x+dx)+','+(y+dy)))continue;
    for(let i=0;i<3;i++){const width=(3-i)*.06;bands.push({x:dx>0?1-width:0,y:dy>0?1-width:0,w:dx?width:1,h:dy?width:1,color:'#07111920'});}
  }
  return bands;
}
