// Straight-line movement (3.132.0, user request 2026-09-18): the geometry behind the berserker's grapple, the hive
// beast's tongue and the workshop drone's pull, made general so the swarm and the rifts can build on it.
// A straight move sweeps every cell between the two tiles: walls, solid props and other units stop it, and a diagonal
// corner may only be cut where one side is open. The mover itself never blocks its own line.
import {lineOfSight} from './world.js';

// The cells a straight move by `mover` may pass through, as a grid of 1 (open) and 0 (blocked).
export function sweptGrid(g,mover){
 const grid=g.grid.map(row=>row.slice());
 for(let y=0;y<grid.length;y++)for(let x=0;x<grid[y].length;x++)if(g.solid(x,y))grid[y][x]=0;
 for(const a of [g.player,...g.enemies.filter(a=>a.hp>0),...g.activeAllies])if(a!==mover)grid[a.y][a.x]=0;
 return grid;
}
// Can `mover` go from where it stands to `to` in one straight sweep? Pass a grid to reuse it across candidates.
export function sweptClear(g,mover,to,grid=sweptGrid(g,mover)){
 return grid[to.y]?.[to.x]===1&&lineOfSight(grid,mover,to,g.barriers,'move');
}
