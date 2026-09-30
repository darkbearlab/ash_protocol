import {t} from './i18n.js';
import {ENEMY_TYPES} from './data.js';
import {DEFAULT_FACTION,factionDef} from './faction-catalog.js';
import {unitCode} from './operative-draw.js';
export * from './faction-catalog.js';
export const enemyFaction=e=>e?.faction??DEFAULT_FACTION;
export const factionOverride=e=>factionDef(enemyFaction(e))?.overrides?.[e?.type]||{};
// 3.127.0: a conscript carries its card's body but not its name.
// courseName (3.198.0): the training course's drones go by their part (src/course.js).
// 3.207.0: a delisted operative goes by its class and serial (docs/BOSSES.md section 5), e.g. 士兵 R-0317.
const OPERATIVE_LABELS=Object.freeze({soldier:'characters.soldier.label',recon:'characters.recon.label',engineer:'characters.engineer.label',berserker:'characters.berserker.label',ninja:'characters.ninja.label'});
// Only a real unit (it has an id); a card on its own (the hostile database) keeps the card's name, 除名士兵 (3.207.0 review).
const operativeName=e=>{const label=e?.id!==undefined&&OPERATIVE_LABELS[ENEMY_TYPES[e?.type]?.operative];return label?t('operatives.unitName',{label:t(label),code:unitCode(e)}):null;};
export const enemyBaseName=e=>e?.courseName?t(e.courseName):e?.conscript?t('factions.conscript'):operativeName(e)??factionOverride(e).name??ENEMY_TYPES[e?.type]?.name??t('factions.unknownUnit');
export const factionActors=g=>[...(g.enemies||[]),...(g.allies||[]),...Object.values(g.floorStates||{}).flatMap(f=>f.enemies||[])];
export function migrateFactions(g){g.facilityFaction??=DEFAULT_FACTION;for(const e of factionActors(g))e.faction??=DEFAULT_FACTION;}
export function validFactions(g){return Boolean(factionDef(g.facilityFaction))&&factionActors(g).every(e=>Boolean(factionDef(e.faction)));}
