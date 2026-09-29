import {DIRECTIONS,key} from './world.js';
import {hasEnemyTag,fireproof} from './enemy-data.js';
import {barrierBetween,edgeBlocks,vaultable} from './barriers.js';
import {roomContains} from './map-geometry.js';
import {blocked} from './enemy-specials.js';

// 3.201.0 (user, 2026-09-29): anyone who walks the floor routes around hazard tiles. A hazard stays passable (you can
// walk in and get hurt), but every route search charges `stepCost` extra for entering one, so a walker only crosses a
// hazard when going around is longer than that; with no way around it still crosses. Flyers ignore the floor, as they do
// for the damage (Game.environmentTurn). Before, only the in-sight combat step charged +4 and every other walker (pursuit,
// flanking, squads, allies, fleeing civilians) went straight across, so enemies burned or dissolved on acid and fire.
export const HAZARD_TUNING=Object.freeze({stepCost:40});
// 3.202.0: a vent's steam is a hazard for every walker while it hangs there (it scalds), and toxic mist or gas is one for
// the player's own units (it costs them hp; enemies take no harm from it). The cloud tiles are read once per cloud list.
const cloudHazards=new WeakMap();
function clouds(g){
 let c=cloudHazards.get(g);
 if(!c||c.smoke!==g.smoke){c={smoke:g.smoke,steam:new Set(),toxic:new Set()};for(const s of g.smoke||[])if(s.kind==='steam'||s.kind==='toxic')for(const q of s.cells)c[s.kind].add(`${q.x},${q.y}`);cloudHazards.set(g,c);}
 return c;
}
const playerSide=actor=>typeof actor?.kind==='string';
// 3.203.0: a burning tile (src/fire.js) is a hazard for every walker, read once per fire list like the clouds.
const fireHazards=new WeakMap();
function burning(g){
 let c=fireHazards.get(g);
 if(!c||c.fires!==g.fires||c.size!==g.fires.length){c={fires:g.fires,size:g.fires.length,cells:new Set(g.fires.map(f=>`${f.x},${f.y}`))};fireHazards.set(g,c);}
 return c.cells;
}
// 3.206.0: fire (a burning tile, the fixed fire of floors 5-6) is no hazard to a fireproof card (the rebel bosses), which
// walks through it and stands in its own smoke.
export const hazardTile=(g,x,y,actor=null)=>{
 const proof=Boolean(actor)&&fireproof(actor);
 if(g.hazards?.some(h=>h.x===x&&h.y===y&&!(proof&&h.type==='fire')))return true;
 if(g.fires?.length&&!proof&&burning(g).has(`${x},${y}`))return true;
 if(!g.smoke?.length)return false;
 const c=clouds(g),k=`${x},${y}`;return c.steam.has(k)||playerSide(actor)&&c.toxic.has(k);
};
export const avoidsHazards=actor=>Boolean(actor)&&!hasEnemyTag(actor,'flying');
export const hazardCost=(g,actor,x,y)=>avoidsHazards(actor)&&hazardTile(g,x,y,actor)?HAZARD_TUNING.stepCost:0;
// The route searches' door rule: a closed door can be opened on the way, a low barrier vaulted; walls and locks stop it.
const crossable=(g,a,b)=>{const edge=barrierBetween(g.barriers,a,b);return !edgeBlocks(edge)||edge.type==='door'||vaultable(edge);};

// What it costs to walk from each tile to `goal` under the route searches' rules (units ignored): entering a tile costs 1,
// plus stepCost when it is a hazard. One search outward from the goal; the cost of a tile counts the tiles after it.
export function costToGoal(g,actor,goal,limit=Infinity){
 const costs=new Map([[key(goal),0]]),buckets=[[{x:goal.x,y:goal.y}]];
 for(let cost=0;cost<buckets.length&&cost<=limit;cost++)for(const q of buckets[cost]||[]){
  if(costs.get(key(q))<cost)continue;
  const through=cost+1+hazardCost(g,actor,q.x,q.y);   // stepping from a neighbour into q
  for(const [dx,dy] of DIRECTIONS){
   const n={x:q.x+dx,y:q.y+dy},k=key(n);
   if(costs.has(k)&&costs.get(k)<=through||!g.passable(n.x,n.y,actor)||!crossable(g,n,q))continue;
   costs.set(k,through);(buckets[through]||=[]).push(n);
  }
 }
 return costs;
}

// A walker standing on a hazard steps off it (src/enemy-behavior.js, after the turn's resets), to a free tile beside it
// that is not a hazard and is no further from where it is going (`goal`: its order's spot, else you if it sees you, else
// where it last knew you), so it never steps back off its own route and shuttles; walking on along the route takes it off
// just the same. Not while pinned, resting (fodder), or committed to a telegraphed move: a wound-up shot, or a special
// whose declaration says so (src/enemy-specials.js `blocks.stepOff`: a grenade, a tongue, a pounce, a lob, a marked cone,
// a charge, a wall or ring). Noncombatants are left to their own flight. Returns true when it moved.
export function stepOffHazard(g,e,goal,{pinned=()=>false,occupied=()=>false}={}){
 if(!avoidsHazards(e)||!hazardTile(g,e.x,e.y,e)||pinned(e)||e.actionDelay>0||e.charge||blocked(e,'stepOff'))return false;
 const costs=goal?costToGoal(g,e,goal):null,here=costs?.get(key(e))??Infinity,cost=q=>costs?.get(key(q))??Infinity;
 const spots=DIRECTIONS.map(([dx,dy])=>({x:e.x+dx,y:e.y+dy})).filter(n=>{
  const edge=barrierBetween(g.barriers,e,n);
  if(e.simulationBounds&&!roomContains(e.simulationBounds,n)||e.simulationNoDoors&&edgeBlocks(edge)&&edge.type==='door')return false;
  return g.passable(n.x,n.y,e)&&!(edgeBlocks(edge)&&!vaultable(edge))&&!hazardTile(g,n.x,n.y,e)&&!(n.x===g.player.x&&n.y===g.player.y)&&!occupied(g,n,e)&&cost(n)<=here;
 }).sort((a,b)=>cost(a)-cost(b)||key(a).localeCompare(key(b)));
 const spot=spots[0];if(!spot)return false;
 const edge=barrierBetween(g.barriers,e,spot);
 e.x=spot.x;e.y=spot.y;e.moved=true;if(vaultable(edge))e.vaultExposed=true;
 return true;
}
