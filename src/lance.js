// 貫穿 (lance; 3.141.0, user decisions 2026-09-19; docs/WEAPONS.md): a drop-only plasma affix whose beam goes on through
// its target. Up to the target it is the shot the player aimed, so cover there only protects, as for any shot. Past the
// target it runs straight on to the end of the weapon's range and stops at the first wall, closed door or partition, or
// object standing on a tile (tall furniture, crate, barrel, nest), which takes the hit. Every visible unit on the way,
// friend or foe, rolls its own hit. Same stepping as a shot (rayCells), so "on the line" means what it means for sight.
import {distance,lineOfSight} from './world.js';
import {rayCells} from './shotgun.js';
import {firstBarrierOnRay} from './barriers.js';
import {fullProp} from './scenery.js';

const STOPPING=new Set(['cover','barrel','nest']);
const stopsBeam=o=>o.hp>0&&(STOPPING.has(o.type)||fullProp(o));

// {units, stop, end}: the units in order from the shooter, the object that stopped the beam (a prop or a barrier; null
// for a wall or the end of the range), and the last tile the beam reached.
export function lancePath(g,from,target,range){
  const step=distance(from,target),m=Math.max(1,Math.ceil((range+1)/Math.max(1,step)));
  const far={x:from.x+(target.x-from.x)*m,y:from.y+(target.y-from.y)*m};
  const line=[...rayCells(from,far),far].filter(c=>distance(from,c)<=range);
  const units=[];let prev=from,beyond=false,stop=null,end=from;
  for(const c of line){
    if(beyond){
      if(g.grid[c.y]?.[c.x]!==1)break;
      if(!lineOfSight(g.grid,prev,c,g.barriers,'shot')){stop=firstBarrierOnRay(g.barriers,prev,c)||null;break;}
      const object=g.props.find(o=>o.x===c.x&&o.y===c.y&&stopsBeam(o));
      if(object){stop=object;end=c;break;}
    }
    units.push(...g.enemies.filter(e=>e.hp>0&&e.x===c.x&&e.y===c.y&&g.visible(e)),...g.activeAllies.filter(a=>a.hp>0&&a.x===c.x&&a.y===c.y));
    end=c;if(c.x===target.x&&c.y===target.y)beyond=true;prev=c;
  }
  return {units,stop,end};
}
