// Import-free catalog: data/endless compatibility views can depend on this without cycles.
export const DEFAULT_FACTION='legacy';
export const FACTIONS={legacy:{name:'現行混合',tag:false,roster:{
 early:[['rifleman',2],['raider',1],['gunner',1],['drone',1],['crawler',1]],
 late:[['rifleman',2],['raider',2],['gunner',1],['drone',1],['brute',1],['sniper',1],['bomber',1]],
 deepExtra:[['brute',1],['sniper',1],['bomber',1]],
},bosses:{3:'warden',6:'boss'},scout:'rifleman',retreatWave:['rifleman','raider'],fodder:'fodder',nestChild:'brood'}};
export const factionDef=id=>typeof id==='string'&&Object.hasOwn(FACTIONS,id)?FACTIONS[id]:undefined;
export const expandRoster=entries=>entries.flatMap(([id,count])=>Array(count).fill(id));
export const pickFacilityFaction=(seed,mission)=>DEFAULT_FACTION;
export function factionPool(id,floor){const d=factionDef(id);if(!d)throw new Error('Unknown facility faction');return [...expandRoster(floor<=2?d.roster.early:d.roster.late),...(floor>6?expandRoster(d.roster.deepExtra):[])];}
export const factionBoss=(id,cycleFloor)=>factionDef(id)?.bosses[cycleFloor];
