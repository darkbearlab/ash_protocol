// Stable catalog IDs; unlockId is reserved and deliberately ignored this release.
export const LEARNING_SCRAP=15;
// 3.113.0 (user request): class skills were learnable only to prove a skill could be mounted on its own; that proof
// is done, so the eight class-native skills leave the pool. Suppressive fire belongs to no class and stays. The
// retired IDs are kept so older saves can turn what they still hold into scrap instead of failing to load.
export const RETIRED_LEARNING=['skill_drones','skill_pet_command','skill_raise_dead','skill_early_warning','skill_anchor','skill_signal_break','skill_grapple','skill_camouflage'];
const skills={suppressive_fire:['壓制射擊',['suppressive_fire']]};
const traits={braced:'架槍',correction:'著彈修正',sidestep:'側身',quick_reload:'快速裝填',night_vision:'夜視',infrared:'紅外線',extended_burst:'延伸點射',tactical_supply:'戰術配給',bloodlust:'嗜血',battle_spirit:'戰意',blade_stash:'刃藏',heavy_armor:'重裝防護',ambush:'伏擊',duelist:'單挑',rapid_fire:'連射',suppression_resistance:'壓制抗性'};
export const LEARNING_ITEMS=Object.fromEntries([
 ...Object.entries(skills).map(([id,[name,skills]])=>[`skill_${id}`,{name:`${name}學習資料`,skills,unlockId:null}]),
 ...Object.entries(traits).map(([trait,name])=>[`trait_${trait}`,{name:`${name}學習資料`,trait,unlockId:null}]),
]);
export const validLearningId=id=>typeof id==='string'&&Object.hasOwn(LEARNING_ITEMS,id);
export const UNKNOWN_LOOT=[...[6,11,12].map(weapon=>({type:'weapon',weapon,unlockId:null})),...Object.keys(LEARNING_ITEMS).map(learningId=>({type:'learning',learningId,unlockId:null}))];
export function fillUnknownContainers(map,seed,floor){
 if(!map.generation)return map;
 for(const c of map.props.filter(p=>p.type==='container'&&p.kind==='unknown'&&!p.opened)){
  let hash=2166136261;for(const s of `${seed}:${floor}:${c.id}:unknown-v9`){hash^=s.charCodeAt(0);hash=Math.imul(hash,16777619);}
  const {unlockId,...item}=UNKNOWN_LOOT[(hash>>>0)%UNKNOWN_LOOT.length];c.contents=[{...item}];
 }
 map.generation={version:9,recipeId:'contents-v9',base:map.generation};return map;
}
