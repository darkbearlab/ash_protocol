// Straight-line movement (3.132.0, user request 2026-09-18): the geometry behind the berserker's grapple, the hive
// beast's tongue and the workshop drone's pull, made general so the swarm and the rifts can build on it.
// A straight move sweeps every cell between the two tiles: walls, solid props and other units stop it, and a diagonal
// corner may only be cut where one side is open. The mover itself never blocks its own line.
import {lineOfSight} from './world.js';
import {activeTrait} from './traits.js';

// The cells a straight move by `mover` may pass through, as a grid of 1 (open) and 0 (blocked).
export function sweptGrid(g,mover){
 const grid=g.grid.map(row=>row.slice());
 for(let y=0;y<grid.length;y++)for(let x=0;x<grid[y].length;x++)if(g.solid(x,y))grid[y][x]=0;
 // 3.133.0 (user decision): a unit that is 矮小 (the swarm's brood) does not stop a straight move; it still owns its tile.
 for(const a of [g.player,...g.enemies.filter(a=>a.hp>0),...g.activeAllies])if(a!==mover&&!activeTrait(a,'underfoot'))grid[a.y][a.x]=0;
 return grid;
}
const unitAt=(g,mover,q)=>[g.player,...g.enemies.filter(a=>a.hp>0),...g.activeAllies].some(a=>a!==mover&&a.x===q.x&&a.y===q.y);
// Can `mover` go from where it stands to `to` in one straight sweep? Pass a grid to reuse it across candidates.
export function sweptClear(g,mover,to,grid=sweptGrid(g,mover)){
 return grid[to.y]?.[to.x]===1&&!unitAt(g,mover,to)&&lineOfSight(grid,mover,to,g.barriers,'move');
}
// 3.205.0 (the swarm bosses' tongue, src/swarm.js): the cells a straight line from `from` through `toward` passes, in order,
// out to `reach` steps (the game's step distance), stopping before the first cell `open(q)` refuses or the first edge
// `blocks(a,b)` stops. The same traversal as lineOfSight, so a diagonal corner needs one open side; the line runs on
// past `toward`.
export function rayCells(from,toward,reach,open,blocks){
 const dx=toward.x-from.x,dy=toward.y-from.y,sx=Math.sign(dx),sy=Math.sign(dy),out=[];if(!dx&&!dy)return out;
 const stepX=dx?1/Math.abs(dx):Infinity,stepY=dy?1/Math.abs(dy):Infinity;
 let x=from.x,y=from.y,tx=dx?.5/Math.abs(dx):Infinity,ty=dy?.5/Math.abs(dy):Infinity;
 for(let i=0;i<reach*2+2;i++){
  let next;
  if(Math.abs(tx-ty)<1e-9){
   const here={x,y},h={x:x+sx,y},v={x,y:y+sy};next={x:x+sx,y:y+sy};
   if(!(open(h)&&!blocks(here,h)&&!blocks(h,next))&&!(open(v)&&!blocks(here,v)&&!blocks(v,next)))break;
   tx+=stepX;ty+=stepY;
  }else if(tx<ty){next={x:x+sx,y};if(blocks({x,y},next))break;tx+=stepX;}
  else{next={x,y:y+sy};if(blocks({x,y},next))break;ty+=stepY;}
  if(Math.abs(next.x-from.x)+Math.abs(next.y-from.y)>reach||!open(next))break;
  out.push(next);x=next.x;y=next.y;
 }
 return out;
}
