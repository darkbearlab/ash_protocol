import {ENEMY_TYPES} from './data.js';

export const ENEMY_TAGS=Object.freeze(['boss','armed','breaker','flying']);
// These positions and duplicates are part of the seeded generation contract.
export const ENEMY_SPAWNS=Object.freeze({
 legacyEarly:Object.freeze(['rifleman','rifleman','raider','gunner','drone','crawler']),
 legacyLate:Object.freeze(['rifleman','rifleman','raider','raider','gunner','drone','brute','sniper','bomber']),
 scout:'rifleman',retreatWave:Object.freeze(['rifleman','raider']),runtimeFodder:'fodder',nestChild:'brood',
});
export const ALLY_BASE_TYPES=Object.freeze({drone:'drone',pet:'crawler'});
export const enemyDef=value=>ENEMY_TYPES[typeof value==='string'?value:value?.type];
export const hasEnemyTag=(value,tag)=>Boolean(enemyDef(value)?.tags?.includes(tag));
export const isBossClass=value=>hasEnemyTag(value,'boss');
export function enemyStartingTraitIds(type,floor=1){const d=enemyDef(type);return [...(d?.traits||[]),...(d?.floorTraits||[]).filter(t=>floor>=t.minFloor).map(t=>t.id),d?.mechanical?'mechanical':'biological'];}
