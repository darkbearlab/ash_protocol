// Melee weapons anyone may carry (3.136.0, user decisions 2026-09-19, docs/MELEE_WEAPONS.md). The user wants dilution,
// not removal: the crate axe and katana are no longer the only melee weapons a gun class can find, and each new one has
// a habit of its own rather than a bigger number.
// - You pick the weapon a bump attack uses in the pack (`p.meleeSlot`); with no pick, the first melee weapon in the pack
//   is used, which is what the old "free to switch both ways" rule picked, since every melee weapon before 3.136.0 was
//   integrated.
// - 手爪 strikes in the fast phase and hits harder on an unarmoured target; 鏈鋸 strikes in the slow phase, saws ten
//   times through any armour and costs you your next action when it bites; 軍刀 splashes onto the target's
//   neighbours; 長矛 held in hand thrusts along a straight line out to two tiles.
import {distance} from './world.js';
import {rayCells} from './shotgun.js';

export const MELEE_WEAPON_TUNING=Object.freeze({splash:.45,bareBonus:.5,thrustRange:2});
// The initiative an attack with this weapon resolves at, or null for the attacker's own.
export const attackSpeed=w=>w?.phase==='fast'?-1:w?.phase==='slow'?1:null;
// The spear's line: through the aim out to two tiles. A target next to you is run through to the tile behind it.
export function thrustCells(from,aim){
 const reach=distance(from,aim)===1?{x:aim.x*2-from.x,y:aim.y*2-from.y}:aim;
 return [...rayCells(from,reach),reach].filter(c=>distance(from,c)>=1&&distance(from,c)<=MELEE_WEAPON_TUNING.thrustRange);
}
// Every living unit on the line you can see and reach, nearest first. Like the shotgun, friends are not spared.
export function thrustTargets(g,from,aim){
 const cells=thrustCells(from,aim);
 return [...g.enemies.filter(e=>e.hp>0),...g.activeAllies.filter(a=>a.hp>0)]
  .filter(o=>cells.some(c=>c.x===o.x&&c.y===o.y)&&g.visible(o)&&g.shotClear(from,o))
  .sort((a,b)=>distance(from,a)-distance(from,b));
}
