// Import-free catalog: data/endless compatibility views can depend on this without cycles.
export const DEFAULT_FACTION='legacy';
// First human split (3.80.0, Claude; docs/FACTIONS.md 10.8). Loyalists hold the two bosses and field few robots; rebels
// fill numbers with drones and suicide robots and add always-elite hero cards. Neither has fodder or nests, which wait
// for the swarm and rift factions. Rebels still spawn the same bosses as a placeholder. Roster numbers are first-pass.
// 3.81.0 (user): rebels get more elites, from floor 1, with eliteAffixes 4; some loyalist riflemen and raiders wear armour 1.
const WATCH_DOG={name:'警犬'};
export const FACTIONS={
 legacy:{name:'現行混合',tag:false,roster:{
  early:[['rifleman',2],['raider',1],['gunner',1],['drone',1],['crawler',1]],
  late:[['rifleman',2],['raider',2],['gunner',1],['drone',1],['brute',1],['sniper',1],['bomber',1]],
  deepExtra:[['brute',1],['sniper',1],['bomber',1]],
 },bosses:{3:'warden',6:'boss'},scout:'rifleman',retreatWave:['rifleman','raider'],fodder:'fodder',nestChild:'brood'},
 loyalist:{noncombatants:{roster:[['civilian',1]],perFloor:{min:3,max:5}},name:'忠誠者',tag:true,pickable:true,voice:'loyalist',roster:{
  early:[['rifleman',1],['rifleman_armored',1],['raider',1],['gunner',1],['drone',1],['crawler',1]],
  late:[['rifleman',1],['rifleman_armored',1],['raider',1],['raider_armored',1],['gunner',1],['drone',1],['brute',1],['sniper',1],['crawler',1]],
  deepExtra:[['brute',1],['sniper',1]],
 },bosses:{3:'warden',6:'boss'},scout:'rifleman',retreatWave:['rifleman','raider'],fodder:null,nestChild:null,overrides:{crawler:WATCH_DOG}},
 rebel:{name:'叛軍',tag:true,pickable:true,voice:'rebel',eliteAffixes:4,roster:{
  early:[['rifleman',1],['raider',2],['gunner',1],['drone',2],['bomber_bot',1],['crawler',1],['raider_elite',1]],
  late:[['rifleman',1],['raider',2],['gunner',1],['drone',2],['bomber_bot',2],['brute',1],['sniper',1],['crawler',1],['raider_elite',1],['gunner_elite',1]],
  deepExtra:[['bomber_bot',1],['gunner_elite',1]],
 },bosses:{3:'warden',6:'boss'},scout:'rifleman',retreatWave:['rifleman','raider'],fodder:null,nestChild:null,overrides:{crawler:WATCH_DOG}},
 // Swarm (3.83.0, user): creature cards and infected soldiers, a giant bug, oversized bug bosses and burrow nests only.
 // The venom shot, the tongue pull and the infected affixes come with the Codex rules (docs/SWARM.md).
 swarm:{name:'蟲族',tag:true,pickable:true,voice:'creature',nestStyle:'burrow',roster:{
  early:[['rifleman_infected',2],['raider_infected',1],['crawler',1]],
  late:[['crawler',2],['rifleman_infected',2],['raider_infected',2],['bomber',1],['giant_bug',1]],
  deepExtra:[['giant_bug',1],['bomber',1]],
 },bosses:{3:'hive_beast',6:'hive_matriarch'},scout:'rifleman_infected',retreatWave:['crawler','crawler'],fodder:'fodder',nestChild:'brood',overrides:{fodder:{name:'被感染者'},brood:{name:'蟲群幼體'},crawler:{name:'獵殺蟲'}}},
};
export const factionDef=id=>typeof id==='string'&&Object.hasOwn(FACTIONS,id)?FACTIONS[id]:undefined;
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
