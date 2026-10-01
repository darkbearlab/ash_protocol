// Import-free catalog: data/endless compatibility views can depend on this without cycles.
import {t} from './i18n.js';
export const DEFAULT_FACTION='legacy';
// First human split (3.80.0, Claude; docs/FACTIONS.md 10.8). Loyalists hold the two bosses and field few robots; rebels
// fill numbers with drones and suicide robots and add always-elite hero cards. Neither has fodder or nests, which wait
// for the swarm and rift factions. Rebels spawned the same bosses as a placeholder until 3.206.0. Roster numbers are first-pass.
// 3.81.0 (user): rebels get more elites, from floor 1, with eliteAffixes 4; some loyalist riflemen and raiders wear armour 1.
// Faction names (3.104.0, user request): the two human factions field the same cards, so they get their own names.
// Loyalists are the garrison and say what the unit does; the rebels are the same unit that turned, so 叛變 goes in front.
// The armoured loyalist variants deliberately share their plain card's name. legacy keeps the ENEMY_TYPES names.
const LOYALIST_NAMES={squad_leader:{name:t('loyalistNames.squad_leader.name')},rifleman:{name:t('loyalistNames.rifleman.name')},rifleman_armored:{name:t('loyalistNames.rifleman_armored.name')},raider:{name:t('loyalistNames.raider.name')},raider_armored:{name:t('loyalistNames.raider_armored.name')},
 gunner:{name:t('loyalistNames.gunner.name')},sniper:{name:t('loyalistNames.sniper.name')},crawler:{name:t('loyalistNames.crawler.name')},heavy_flamer:{name:t('loyalistNames.heavy_flamer.name')}};
const REBEL_NAMES={drone:{name:t('rebelNames.drone.name')},brute:{name:t('rebelNames.brute.name')},rifleman:{name:t('rebelNames.rifleman.name')},raider:{name:t('rebelNames.raider.name')},raider_elite:{name:t('rebelNames.raider_elite.name')},
 gunner:{name:t('rebelNames.gunner.name')},gunner_elite:{name:t('rebelNames.gunner_elite.name')},sniper:{name:t('rebelNames.sniper.name')},crawler:{name:t('rebelNames.crawler.name')},heavy_flamer:{name:t('rebelNames.heavy_flamer.name')}};
// 3.208.0 (user decisions 2026-09-30, docs/SWARM.md section 14): an override may also add traits, each with a rank when
// it has one. A unit gets them when it is made (src/traits.js startingTraits with its faction; source `faction:<id>`),
// and every load re-syncs them to this table (src/traits.js syncFactionTraits: a trait added here is added, one removed
// is removed, an unchanged table changes nothing); a rank is read from this table through that source
// (factionTraitRank), never saved. So a retune — a rank, or which units carry what — reaches the units a save holds. The swarm's own units only: the fodder, brood and crawler cards are shared with the legacy mix
// (and the crawler with the loyalist and rebel dogs), which keep theirs. Agile larvae, and 近戰壓制 N on every biter
// (src/suppression.js meleeSuppression); the bombers and spitters do not bite.
const melee=n=>({id:'melee_suppression',rank:n});
const SWARM_OVERRIDES={fodder:{name:t('factions.swarm.overrides.fodder.name'),traits:[melee(1)]},brood:{name:t('factions.swarm.overrides.brood.name'),traits:[{id:'agile'},melee(1)]},crawler:{name:t('factions.swarm.overrides.crawler.name'),traits:[melee(2)]},
 giant_bug:{traits:[melee(3)]},hive_beast:{traits:[melee(5)]},hive_matriarch:{traits:[melee(5)]}};
export const FACTIONS={
 legacy:{name:t('factions.legacy.name'),tag:false,roster:{
  early:[['rifleman',2],['raider',1],['gunner',1],['drone',1],['crawler',1]],
  late:[['rifleman',2],['raider',2],['gunner',1],['drone',1],['brute',1],['sniper',1],['bomber',1]],
  deepExtra:[['brute',1],['sniper',1],['bomber',1]],
 },bosses:{3:'warden',6:'boss'},scout:'rifleman',preview:'sniper',retreatWave:['rifleman','raider'],fodder:'fodder',nestChild:'brood'},
 loyalist:{noncombatants:{roster:[['civilian',1]],perFloor:{min:3,max:5}},name:t('factions.loyalist.name'),tag:true,pickable:true,voice:'loyalist',roster:{
  early:[['rifleman',1],['rifleman_armored',1],['raider',1],['gunner',1],['drone',1],['crawler',1]],
  late:[['rifleman',1],['rifleman_armored',1],['raider',1],['raider_armored',1],['gunner',1],['drone',1],['brute',1],['sniper',1],['crawler',1]],
  deepExtra:[['brute',1],['sniper',1]],
 },
  // 3.128.0 (user design): squads are placed, not drawn — a leader and three guns in each of the two largest rooms,
  // outside the threat budget (docs/SQUAD.md「小隊據點」). Early/late follows the roster's floor split.
  squads:{perFloor:2,early:['rifleman','rifleman','gunner'],late:['rifleman_armored','gunner','sniper']},
  // 3.133.0 personality table (user decision, docs/ORDERS.md §8.1); a card not listed takes no orders on its own.
  personality:{rifleman:'disciplined',rifleman_armored:'disciplined',raider:'disciplined',raider_armored:'disciplined',gunner:'disciplined',sniper:'cunning',squad_leader:'commander',drone:'mindless',civilian:'fleeing'},
  // 3.204.0 (user design 2026-09-29, docs/BOSSES.md section 2): the loyalists' own bosses, 標定官 and 火線官. A floor already
  // generated keeps the boss it has; the legacy mix keeps the warden and the core guard (the rebels had them until 3.206.0).
  bosses:{3:'designator',6:'gunline'},delisted:true,scout:'rifleman',preview:'sniper',heavy:'heavy_flamer',retreatWave:['rifleman','raider'],fodder:null,nestChild:null,overrides:LOYALIST_NAMES},
 rebel:{name:t('factions.rebel.name'),tag:true,pickable:true,voice:'rebel',eliteAffixes:4,roster:{
  early:[['rifleman',1],['raider',2],['gunner',1],['drone',2],['bomber_bot',1],['crawler',1],['raider_elite',1],['enforcer',1]],
  late:[['rifleman',1],['raider',2],['gunner',1],['drone',2],['bomber_bot',2],['brute',1],['sniper',1],['crawler',1],['raider_elite',1],['gunner_elite',1],['enforcer',1]],
  deepExtra:[['bomber_bot',1],['gunner_elite',1]],
 },
 personality:{rifleman:'cowardly',raider:'cowardly',gunner:'cowardly',sniper:'cunning',raider_elite:'cunning',gunner_elite:'cunning',enforcer:'commander',drone:'mindless',bomber_bot:'mindless'},
 // 3.206.0 (user design 2026-09-29, docs/BOSSES.md section 3): the rebels' own bosses, 縱火者 and 焚線官 (src/rebel-bosses.js).
 // A floor already generated keeps the warden or core guard it has. The table holds the faction's own bosses only: the
 // delisted operative (3.207.0, docs/BOSSES.md section 5) replaces the floor-6 one by a draw where the floor asks for its
 // boss (factionBoss's caller, src/world.js), so this entry stays what an undrawn floor gets. `delisted` (3.207.0): this
 // faction's floor-6 boss (and every boss floor after it in endless) may be one (src/operative-draw.js).
 bosses:{3:'arsonist',6:'burnline'},delisted:true,scout:'rifleman',preview:'sniper',heavy:'heavy_flamer',retreatWave:['rifleman','raider'],fodder:null,nestChild:null,overrides:REBEL_NAMES},
 // Swarm (3.83.0, user): creature cards and infected soldiers, a giant bug, oversized bug bosses and burrow nests only.
 // The venom shot, the tongue pull and the infected affixes come with the Codex rules (docs/SWARM.md).
 swarm:{hordeType:'brood',infectedAffixes:['venomous','brood_host'],name:t('factions.swarm.name'),tag:true,pickable:true,voice:'creature',nestStyle:'burrow',roster:{
  early:[['rifleman_infected',2],['raider_infected',1],['crawler',1]],
  late:[['crawler',2],['rifleman_infected',2],['raider_infected',2],['bomber',1],['giant_bug',1],['spitter',1]],
  deepExtra:[['giant_bug',1],['bomber',1],['spitter',1]],
 },
 personality:{crawler:'feral',rifleman_infected:'mindless',raider_infected:'mindless',bomber:'mindless'},
 // preview (3.137.0, docs/DIFFICULTY.md): the special enemy floor 2 shows on the standard curve.
 bosses:{3:'hive_beast',6:'hive_matriarch'},scout:'rifleman_infected',preview:'spitter',retreatWave:['crawler','crawler'],fodder:'fodder',nestChild:'brood',overrides:SWARM_OVERRIDES},
};
export const factionDef=id=>typeof id==='string'&&Object.hasOwn(FACTIONS,id)?FACTIONS[id]:undefined;
// The traits a faction's override adds to one of its cards (3.208.0), as they go on the unit.
export const factionTraits=(faction,type)=>(factionDef(faction)?.overrides?.[type]?.traits||[]).map(({id})=>({id,source:`faction:${faction}`}));
// A unit's rank in a trait its faction gave it (3.208.0), read from the table through the trait's source: 0 when none does.
export const factionTraitRank=(actor,id)=>Math.max(0,...(actor?.traits||[]).filter(t=>t.id===id&&typeof t.source==='string'&&t.source.startsWith('faction:')).map(t=>factionDef(t.source.slice(8))?.overrides?.[actor.type]?.traits?.find(x=>x.id===id)?.rank||0));
export const expandRoster=entries=>entries.flatMap(([id,count])=>Array(count).fill(id));
// The rules default stays the legacy mix, so saves, tests and baselines built without a choice are unchanged.
export const pickFacilityFaction=(seed,mission)=>DEFAULT_FACTION;
// A new deployment asks for a facility by seed: a stable hash over the pickable factions, never map or combat RNG.
export function rollFacilityFaction(seed){
 const ids=Object.keys(FACTIONS).filter(id=>FACTIONS[id].pickable);if(!ids.length)return DEFAULT_FACTION;
 let h=2166136261;for(const c of `${seed}:facility-v1`){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}
 return ids[(h>>>0)%ids.length];
}
export function factionPool(id,floor){const d=factionDef(id);if(!d)throw new Error('Unknown facility faction');return [...expandRoster(floor<=2?d.roster.early:d.roster.late),...(floor>6?expandRoster(d.roster.deepExtra):[])];}
export const factionBoss=(id,cycleFloor)=>factionDef(id)?.bosses[cycleFloor];
