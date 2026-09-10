import {activeTrait} from './traits.js';

export const DARK_PENALTY=40;
export const fullLighting=grid=>grid.map(row=>row.map(()=>1));
// Separate deterministic stream: lighting never rerolls enemies, loot or combat RNG.
export function createLighting(grid,rooms,start,seed,floor){
  const light=fullLighting(grid);
  const hash=i=>{let n=(seed^Math.imul(floor,2654435761)^Math.imul(i+1,2246822519))>>>0;n=Math.imul(n^(n>>>16),2246822519);return (n^(n>>>13))>>>0;};
  const dark=rooms.map((room,i)=>({room,i,rank:hash(i)})).filter(({room:r})=>!(start.x>=r.x&&start.x<r.x+r.w&&start.y>=r.y&&start.y<r.y+r.h)).sort((a,b)=>a.rank-b.rank||a.i-b.i).slice(0,3);
  for(const {room:r}of dark)for(let y=r.y;y<r.y+r.h;y++)for(let x=r.x;x<r.x+r.w;x++)if(grid[y]?.[x]===1)light[y][x]=0;
  return light;
}
export const validLighting=(light,grid)=>Array.isArray(light)&&light.length===grid.length&&light.every((row,y)=>Array.isArray(row)&&row.length===grid[y].length&&row.every(n=>n===0||n===1));
// Missing lighting is lit for read-only previews and legacy callers; restore validates saves.
export const isDark=(game,point)=>game.lighting?.[point.y]?.[point.x]===0;
export function lightingEffects(game,attacker,target){
  const dark=isDark(game,target),nightVision=activeTrait(attacker,'night_vision');
  return {dark,nightVision,penalty:dark&&!nightVision?DARK_PENALTY:0};
}
