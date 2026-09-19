import {isNoncombatant} from './enemy-data.js';
import {factionDef,factionActors,expandRoster,enemyBaseName} from './factions.js';
import {birthRandom} from './enemy-affixes.js';
import {makeEnemy,DIRECTIONS,distance,key,reachable} from './world.js';
import {roomTiles,roomContains} from './map-geometry.js';
import {occupied} from './allies.js';
import {barrierBetween,edgeBlocks,vaultable} from './barriers.js';
import {pinned} from './suppression.js';
import {registerOrder,giveOrder,runOrder} from './orders.js';

export const CIVILIAN_TUNING={screamCooldown:5,screamRadius:8,fleeCalloutEvery:3};
// A separate, post-combat population. No combat roster, reservation or RNG is changed.
export function addNoncombatants(map,seed,floor,faction){
 const config=factionDef(faction)?.noncombatants;if(!config)return map;
 const roster=expandRoster(config.roster).filter(isNoncombatant);if(!roster.length)return map;
 const rng=birthRandom(seed,floor,'population','noncombatants-v1'),{min,max}=config.perFloor;
 const wanted=min+Math.floor(rng()*(max-min+1)),seen=reachable(map,map.start);
 const occupiedTiles=new Set([...map.enemies,...map.props,...map.items,...map.hazards,...(map.slots||[])].map(key));
 const openings=(map.openings||[]).flatMap(o=>o.cells);
 const points=map.rooms.flatMap((r,i)=>i===map.startRoom?[]:roomTiles(r).filter(p=>
  seen.has(key(p))&&!occupiedTiles.has(key(p))&&distance(p,map.end)>2&&distance(p,map.start)>2&&
  !openings.some(o=>distance(o,p)<=1)&&DIRECTIONS.every(([dx,dy])=>{const q={x:p.x+dx,y:p.y+dy};return map.grid[q.y]?.[q.x]===1&&roomContains(r,q)&&!occupiedTiles.has(key(q))&&!edgeBlocks(barrierBetween(map.barriers,p,q));})
 ).map(p=>({...p,order:rng()}))).sort((a,b)=>a.order-b.order);
 let n=0;for(const p of points){if(n>=wanted)break;if(occupiedTiles.has(key(p)))continue;
  const e=makeEnemy(roster[Math.floor(rng()*roster.length)],p.x,p.y,`noncombatant-${floor}-${n++}`,floor,0,faction);
  map.enemies.push(e);occupiedTiles.add(key(p));
 }
 if(n&&map.generation)map.generation={version:12,recipeId:'noncombatants-v12',base:map.generation};
 return map;
}
export function scream(g,e){
 if(e.hp<=0||e.control?.disabled||e.screamCooldown>0||!g.sight(e,g.player))return false;
 e.screamCooldown=CIVILIAN_TUNING.screamCooldown;
 // 3.144.0: a guard drawn off by the decoy only snaps out when you attack (src/field-gear.js).
 for(const guard of g.enemies)if(guard.hp>0&&!isNoncombatant(guard)&&!g.isFooled?.(guard)&&distance(e,guard)<=CIVILIAN_TUNING.screamRadius){guard.alert=true;guard.lastKnown={x:g.player.x,y:g.player.y};}
 g.log(`${enemyBaseName(e)}尖叫，附近的守衛警戒了。`,true);g.enemyCallout(e,'telegraph',{action:'scream'});return true;
}
// 3.131.0: a civilian's flight is a flee order it gives itself on its first turn — no time limit, nothing ends it.
// The order runs from the card's `before`, where the flight always ran, so nothing about when it acts has changed.
export function civilianAction(ctx){
 const {g,e}=ctx;
 if(!e.order)giveOrder(g,e,{kind:'flee',by:'self',patience:null,breakOn:[]});
 return runOrder(ctx)!==false;
}
registerOrder('flee',{act({g,e}){
 const visible=g.sight(e,g.player);if(visible)e.lastKnown={x:g.player.x,y:g.player.y};
 scream(g,e);
 if(g.turn%CIVILIAN_TUNING.fleeCalloutEvery===0)g.enemyCallout(e,'state',{state:'flee'});
 const from=visible?g.player:e.lastKnown;if(!from||pinned(e))return true;
 const choices=DIRECTIONS.map(([dx,dy])=>({x:e.x+dx,y:e.y+dy})).filter(p=>{
  const edge=barrierBetween(g.barriers,e,p);
  if(e.simulation&&g.simulation?.phase==='tutorial'&&((e.simulationBounds&&!roomContains(e.simulationBounds,p))||(e.simulationNoDoors&&edgeBlocks(edge)&&edge.type==='door')))return false;
  return g.passable(p.x,p.y,e)&&!occupied(g,p,e)&&distance(p,from)>distance(e,from)&&(!edgeBlocks(edge)||edge.type==='door'&&!edge.locked||vaultable(edge));
 }).sort((a,b)=>distance(b,from)-distance(a,from));
 const p=choices[0];if(!p)return true;const edge=barrierBetween(g.barriers,e,p);
 if(edgeBlocks(edge)&&!vaultable(edge)){g.setDoor(edge,true);return true;}
 e.x=p.x;e.y=p.y;e.moved=true;if(vaultable(edge))e.vaultExposed=true;return true;
}});
export function tickCivilianCooldowns(g){for(const e of g.enemies)if(isNoncombatant(e)&&e.hp>0)e.screamCooldown=Math.max(0,e.screamCooldown-1);}
export function migrateCivilians(g){for(const e of factionActors(g))if(isNoncombatant(e))e.screamCooldown??=0;}
export const validCivilians=g=>factionActors(g).every(e=>isNoncombatant(e)?Number.isSafeInteger(e.screamCooldown)&&e.screamCooldown>=0&&!e.elite&&!e.affixes?.length: e.screamCooldown===undefined);
