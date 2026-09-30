// Delisted operatives: the draw and the serial (3.207.0, user design 2026-09-29; docs/BOSSES.md section 5). Kept apart
// from src/delisted-operatives.js so the map generator (src/world.js) can ask without pulling the rules in.
// - At floor 6 of a loyalist or rebel facility, 30% of runs meet a delisted operative in place of the faction's own
//   floor-6 boss; in endless every boss floor after that (9, 12, 15...) draws again (user). The legacy mix and the swarm
//   never do. Which floors, whether and which class: hashes of the run's seed and the floor, never the map or combat dice,
//   so nothing else on a floor moves and a replay or a reload meets the same operative.
// - Its serial has the player clone's format (src/purge-review.js cloneDesignation: a letter and four digits), fixed by
//   the seed, the floor and its id.
import {cloneDesignation} from './purge-review.js';
import {factionDef} from './faction-catalog.js';

// The heavy (bulwark) class is left out for now (user: not yet clear how to make fighting it fun).
export const OPERATIVE_CLASSES=Object.freeze(['soldier','recon','engineer','berserker','ninja']);
export const operativeType=cls=>`delisted_${cls}`;
// chance: the share of drawing floors that meet one; `first` and `every`: floor 6, then every third floor after it.
// Which factions meet them is the catalog's `delisted` (src/faction-catalog.js: the loyalists and the rebels).
export const OPERATIVE_DRAW=Object.freeze({chance:.3,first:6,every:3});
const hash=text=>{let h=2166136261;for(const c of text){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
export const drawFloor=floor=>Number.isInteger(floor)&&floor>=OPERATIVE_DRAW.first&&(floor-OPERATIVE_DRAW.first)%OPERATIVE_DRAW.every===0;
// A QA hook (qa/save-fuzz.mjs --operative, the tests): a function (seed, floor) -> class or null that replaces the draw on
// the floors that draw; null restores it. Never set by the game.
let override=null;
export const setOperativeDraw=fn=>{override=typeof fn==='function'?fn:null;};
// The class met on this floor, or null for the faction's own boss.
export function drawnOperative(seed,floor,faction){
 if(!factionDef(faction)?.delisted||!drawFloor(floor))return null;
 if(override){const cls=override(seed,floor);return OPERATIVE_CLASSES.includes(cls)?cls:null;}
 if(hash(`${seed}:${floor}:delisted-v1`)/4294967296>=OPERATIVE_DRAW.chance)return null;
 return OPERATIVE_CLASSES[hash(`${seed}:${floor}:delisted-class-v1`)%OPERATIVE_CLASSES.length];
}
export const operativeCode=(seed,floor,id)=>cloneDesignation(`${seed}:${floor}:${id}:delisted-v1`);
export const validOperativeCode=code=>typeof code==='string'&&/^[A-HJ-NPR-Z]-\d{4}$/.test(code);
// The serial the game reads out: the unit's own, or (one made outside a generated floor: tests, tools) one from its id.
export const unitCode=e=>validOperativeCode(e?.code)?e.code:operativeCode('unit',0,e?.id??'');
