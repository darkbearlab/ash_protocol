// Stable catalog IDs; unlockId is reserved and deliberately ignored this release.
import {t} from './i18n.js';
export const LEARNING_SCRAP=15;
// 3.113.0 (user request): class skills were learnable only to prove a skill could be mounted on its own; that proof
// is done, so the eight class-native skills leave the pool. Suppressive fire belongs to no class and stays. The
// retired IDs are kept so older saves can turn what they still hold into scrap instead of failing to load.
export const RETIRED_LEARNING=['skill_drones','skill_pet_command','skill_raise_dead','skill_early_warning','skill_anchor','skill_signal_break','skill_grapple','skill_camouflage'];
// 3.166.2: an item's name is the name of what it teaches, read from the skill and trait tables (one word, one place).
const skills={suppressive_fire:['suppressive_fire']};
const traits=['braced','correction','sidestep','quick_reload','night_vision','infrared','extended_burst','tactical_supply','bloodlust','battle_spirit','blade_stash','heavy_armor','ambush','duelist','rapid_fire','suppression_resistance','extended_carry','disruption_resistant','agile'];
export const LEARNING_ITEMS=Object.fromEntries([
 ...Object.entries(skills).map(([id,skills])=>[`skill_${id}`,{name:t('learning-data.item',{name:t(`skills.${id}.name`)}),skills,unlockId:null}]),
 ...traits.map(trait=>[`trait_${trait}`,{name:t('learning-data.item',{name:t(`traits.${trait}.name`)}),trait,unlockId:null}]),
]);
export const validLearningId=id=>typeof id==='string'&&Object.hasOwn(LEARNING_ITEMS,id);
// 3.135.0 (user decision, docs/ITEMS.md): night vision and infrared, passives with no cost and nothing to do, are no
// longer found; night-vision goggles take their place in the pool. The items stay defined for saves that hold them.
export const UNFOUND_LEARNING=Object.freeze(['trait_night_vision','trait_infrared']);
// 3.136.0 (user decision): the five new melee weapons join the crate axe and katana (docs/MELEE_WEAPONS.md).
export const UNKNOWN_LOOT=[...[6,11,12,13,14,15,16,17].map(weapon=>({type:'weapon',weapon,unlockId:null})),...Object.keys(LEARNING_ITEMS).filter(id=>!UNFOUND_LEARNING.includes(id)).map(learningId=>({type:'learning',learningId,unlockId:null})),{type:'nvg',unlockId:null}];
export function fillUnknownContainers(map,seed,floor){
 if(!map.generation)return map;
 for(const c of map.props.filter(p=>p.type==='container'&&p.kind==='unknown'&&!p.opened)){
  let hash=2166136261;for(const s of `${seed}:${floor}:${c.id}:unknown-v9`){hash^=s.charCodeAt(0);hash=Math.imul(hash,16777619);}
  const {unlockId,...item}=UNKNOWN_LOOT[(hash>>>0)%UNKNOWN_LOOT.length];c.contents=[{...item}];
 }
 map.generation={version:9,recipeId:'contents-v9',base:map.generation};return map;
}
