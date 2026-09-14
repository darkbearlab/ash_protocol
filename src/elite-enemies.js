import {ENEMY_AFFIXES,birthRandom,giveEnemyAffix} from './enemy-affixes.js';
import {enemyDef,isBossClass} from './enemy-data.js';
import {effectiveDepth} from './endless.js';
import {factionActors,factionDef,enemyFaction} from './factions.js';

export const ELITE_TUNING={startDepth:9,chancePerDepth:.02,chanceCap:.15,minAffixes:3,xpMultiplier:2};
export const eliteChance=(floor,offset=0)=>Math.min(ELITE_TUNING.chanceCap,Math.max(0,effectiveDepth(floor,offset)-ELITE_TUNING.startDepth+1)*ELITE_TUNING.chancePerDepth);
export const eliteEligible=e=>!e.expendable&&!enemyDef(e)?.expendable&&!isBossClass(e);
// Run AFTER ordinary affixes. This salt never consumes map, combat or ordinary affix randomness.
export function rollEnemyElite(e,seed,floor,offset=0){
 if(!eliteEligible(e))return e;
 const rng=birthRandom(seed,floor,e.id,'elite-v1');
 // Cards marked elite (rebel heroes, 3.80.0) are always elite; the draw is still taken so the stream stays aligned.
 const roll=rng();if(!enemyDef(e)?.elite&&roll>=eliteChance(floor,offset))return e;
 e.elite=true;
 // A faction may ask for more affixes on its elites (rebels, 3.81.0); otherwise ELITE_TUNING.minAffixes.
 const wanted=factionDef(enemyFaction(e))?.eliteAffixes??ELITE_TUNING.minAffixes;
 while((e.affixes?.length||0)<wanted){
  const pool=ENEMY_AFFIXES.filter(d=>!e.affixes?.some(a=>a.id===d.id)&&d.applies(e));
  if(!pool.length)break;
  giveEnemyAffix(e,pool[Math.floor(rng()*pool.length)].id);
 }
 return e;
}
export const enemyKillXp=e=>e.expendable?0:Math.round((enemyDef(e)?.xp??1)*(e.elite?ELITE_TUNING.xpMultiplier:1));
export function migrateElites(g){for(const e of factionActors(g))delete e.elite;}
export const validElites=g=>factionActors(g).every(e=>!Object.hasOwn(e,'elite')||e.elite===true);
