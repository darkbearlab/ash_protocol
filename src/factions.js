import {t} from './i18n.js';
import {ENEMY_TYPES} from './data.js';
import {DEFAULT_FACTION,factionDef} from './faction-catalog.js';
export * from './faction-catalog.js';
export const enemyFaction=e=>e?.faction??DEFAULT_FACTION;
export const factionOverride=e=>factionDef(enemyFaction(e))?.overrides?.[e?.type]||{};
// 3.127.0: a conscript carries its card's body but not its name.
export const enemyBaseName=e=>e?.conscript?t('factions.conscript'):factionOverride(e).name??ENEMY_TYPES[e?.type]?.name??t('factions.unknownUnit');
export const factionActors=g=>[...(g.enemies||[]),...(g.allies||[]),...Object.values(g.floorStates||{}).flatMap(f=>f.enemies||[])];
export function migrateFactions(g){g.facilityFaction??=DEFAULT_FACTION;for(const e of factionActors(g))e.faction??=DEFAULT_FACTION;}
export function validFactions(g){return Boolean(factionDef(g.facilityFaction))&&factionActors(g).every(e=>Boolean(factionDef(e.faction)));}
