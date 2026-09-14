import {ENEMY_TYPES} from './data.js';
import {DEFAULT_FACTION,factionDef,expandRoster} from './faction-catalog.js';

export const ENEMY_TAGS=Object.freeze(['boss','armed','breaker','flying','noncombatant','infected']);
// These positions and duplicates are part of the seeded generation contract.
export const ENEMY_SPAWNS=Object.freeze({
 get legacyEarly(){return Object.freeze(expandRoster(factionDef(DEFAULT_FACTION).roster.early));},
 get legacyLate(){return Object.freeze(expandRoster(factionDef(DEFAULT_FACTION).roster.late));},
 get scout(){return factionDef(DEFAULT_FACTION).scout;},get retreatWave(){return Object.freeze([...factionDef(DEFAULT_FACTION).retreatWave]);},get runtimeFodder(){return factionDef(DEFAULT_FACTION).fodder;},get nestChild(){return factionDef(DEFAULT_FACTION).nestChild;},
});
export const ALLY_BASE_TYPES=Object.freeze({drone:'drone',pet:'crawler'});
export const enemyDef=value=>ENEMY_TYPES[typeof value==='string'?value:value?.type];
export const hasEnemyTag=(value,tag)=>Boolean(enemyDef(value)?.tags?.includes(tag));
export const isBossClass=value=>hasEnemyTag(value,'boss');
export function enemyStartingTraitIds(type,floor=1){const d=enemyDef(type);return [...(d?.traits||[]),...(d?.floorTraits||[]).filter(t=>floor>=t.minFloor).map(t=>t.id),d?.mechanical?'mechanical':'biological'];}

export const isNoncombatant=value=>hasEnemyTag(value,'noncombatant');
