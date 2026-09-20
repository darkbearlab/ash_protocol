import {STORIES} from './story-data.js';
import {UNLOCK_SETTINGS,CHARACTER_IDS,STARTING_CHARACTERS,availableCharacters,validStoryId,shelvedCharacter} from './unlock-catalog.js';
import {rollFacilityFaction,FACTIONS} from './faction-catalog.js';
import {reachable,key,distance} from './world.js';
import {roomTiles} from './map-geometry.js';
const bindings=new WeakMap();
export function bindUnlocks(g,{profile,grant}){bindings.set(g,{profile,grant});return g;}
const profileFor=g=>bindings.get(g)?.profile()||{unlocks:{characters:g.unlockedCharacters||STARTING_CHARACTERS,stories:g.unlockedStories||[]}};
export function unlockRandom(seed,floor,salt){let n=(seed^Math.imul(floor,2654435761))>>>0;for(const c of salt)n=Math.imul(n^c.charCodeAt(0),16777619)>>>0;n^=n>>>16;return (Math.imul(n,2246822507)>>>0)/4294967296;}
export function endlessFaction(g){
 if(g.mission.id!=='endless'||g.simulation)return g.facilityFaction;
 if(UNLOCK_SETTINGS.fixedFactionOverride&&g.factionOverride)return g.factionOverride;
 let f=rollFacilityFaction(Math.floor(unlockRandom(g.seed,g.floor,'faction')*0xffffffff));
 if(!UNLOCK_SETTINGS.consecutiveFactions&&g.floor>1){const prior=endlessFaction({...g,floor:g.floor-1});if(f===prior){const pool=Object.keys(FACTIONS).filter(id=>FACTIONS[id].pickable&&id!==prior);if(pool.length)f=pool[0];}}
 return f;
}
export function initializeRunUnlocks(g,options={}){g.unlockedCharacters=availableCharacters(options.profile);g.unlockedStories=[...(options.profile?.unlocks?.stories||[])];g.pendingStories=[];g.encounteredCharacters=[];g.operatorCorpse=null;g.factionOverride=options.facilityFaction&&options.facilityFaction!=='random'?options.facilityFaction:null;}
// Corpses (3.151.0, user 2026-09-20): endless floor 5 onward, chance min(50%, 10% × (floor − 4)); after corpsePity floors
// in a row without one, the next floor has one. Every roll comes from the seed, so the pity needs no save field.
export const corpseChance=floor=>floor<UNLOCK_SETTINGS.corpseStart?0:Math.min(UNLOCK_SETTINGS.corpseMax,UNLOCK_SETTINGS.corpseStep*(floor-UNLOCK_SETTINGS.corpseStart+1));
export function corpseFloor(seed,floor){let dry=0,hit=false;for(let f=UNLOCK_SETTINGS.corpseStart;f<=floor;f++){hit=dry>=UNLOCK_SETTINGS.corpsePity||unlockRandom(seed,f,'corpse-chance')<corpseChance(f);dry=hit?0:dry+1;}return hit;}
export const CORPSE_NOTE='偵測到失聯幹員的生命訊號：遺體上方有光柱，靠近後按互動回收識別資料。';
export function floorCorpseNote(g){if(g.operatorCorpse&&!g.operatorCorpse.recovered)g.log(CORPSE_NOTE);}
export function populateRunUnlocks(g){
 g.operatorCorpse=null;if(g.simulation||g.mission.id!=='endless')return;
 g.items=g.items.filter(i=>i.type!=='lore');
 if(UNLOCK_SETTINGS.demo||!corpseFloor(g.seed,g.floor))return;
 const seen=reachable(g,g.start),occupied=new Set([...g.props,...g.items,...g.enemies,...g.hazards,g.end].map(key));
 const points=g.rooms.flatMap((r,i)=>i===g.startRoom?[]:roomTiles(r)).filter(p=>seen.has(key(p))&&!occupied.has(key(p))&&distance(p,g.end)>1);
 if(!points.length)return;const point=points[Math.floor(unlockRandom(g.seed,g.floor,'corpse-position')*points.length)];
 const owned=availableCharacters(profileFor(g)),pool=CHARACTER_IDS.filter(id=>!shelvedCharacter(id)&&!owned.includes(id)&&!g.encounteredCharacters.includes(id));if(!pool.length)return;
 const character=pool[Math.floor(unlockRandom(g.seed,g.floor,'corpse-character')*pool.length)];g.encounteredCharacters.push(character);g.operatorCorpse={...point,character,recovered:false};
}
export function recoverOperator(g){
 const c=g.operatorCorpse;if(g.simulation||UNLOCK_SETTINGS.demo||g.status!=='playing'||g.player.hp<=0||!c||c.recovered||!g.canTouch(c))return false;
 const handler=bindings.get(g);if(!handler)return g.fail('玩家檔案尚未連接，無法保存解鎖。');
 if(!availableCharacters(handler.profile()).includes(c.character)&&!handler.grant(c.character,'corpse'))return g.fail('無法儲存解鎖，請稍後再試。');
 c.recovered=true;g.log('已回收人員識別資料。');return true;
}
export function collectStory(g,item){
 if(g.simulation||g.mission.id==='endless')return null;
 const p=profileFor(g),pool=STORIES.filter(s=>(s.faction==='any'||s.faction===g.facilityFaction)&&g.floor>=s.floors[0]&&g.floor<=s.floors[1]&&!p.unlocks.stories.includes(s.id)&&!g.pendingStories.includes(s.id));
 if(!pool.length)return null;const s=pool[Math.floor(unlockRandom(g.seed,g.floor,`story:${item.x},${item.y}:${item.floor}`)*pool.length)];g.pendingStories.push(s.id);return s;
}
export function validRunUnlocks(g){
 const list=(v,valid)=>Array.isArray(v)&&new Set(v).size===v.length&&v.every(valid);
 const character=id=>CHARACTER_IDS.includes(id),c=g.operatorCorpse;
 return list(g.unlockedCharacters,character)&&list(g.unlockedStories,validStoryId)&&list(g.pendingStories,validStoryId)&&list(g.encounteredCharacters,character)&&(g.factionOverride===null||Object.hasOwn(FACTIONS,g.factionOverride))&&(c===null||g.mission?.id==='endless'&&g.floor>=UNLOCK_SETTINGS.corpseStart&&c&&character(c.character)&&g.encounteredCharacters.includes(c.character)&&Number.isInteger(c.x)&&Number.isInteger(c.y)&&g.grid[c.y]?.[c.x]===1&&typeof c.recovered==='boolean');
}
