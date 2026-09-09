// Separate prepared slots. Stable catalog IDs are saved; quantities retain existing keys.
export const PREPARED_CATEGORIES={grenade:'手榴彈',item:'道具',skill:'技能'};
export const PREPARED_CATALOG={
  grenade:{frag:{name:'破片手榴彈',short:'破片彈',icon:'◉',resource:'grenades',action:'grenade',text:'射程 5 格、爆炸半徑 2 格。會自傷及引爆油桶，確認落點後消耗 1 回合。'}},
  item:{medkit:{name:'醫療包',short:'醫療包',icon:'✚',resource:'meds',action:'heal',text:'回復生命並清除中毒。使用消耗 1 回合，滿血且未中毒時不消耗。'}},
  skill:{},
};
export const defaultPrepared=()=>({grenade:'frag',item:'medkit',skill:null});
export function preparedOptions(player,category){
  return Object.entries(PREPARED_CATALOG[category]||{}).filter(([id])=>category!=='skill'||player.skills.includes(id));
}
export function canPrepare(player,category,id){
  return Object.hasOwn(PREPARED_CATEGORIES,category)&&(id===null||preparedOptions(player,category).some(([key])=>key===id));
}
export function preparedEntry(player,category){
  const id=player.prepared?.[category];return id&&Object.hasOwn(PREPARED_CATALOG[category]||{},id)?PREPARED_CATALOG[category][id]:null;
}
export function validPrepared(player){
  return Array.isArray(player.skills)&&new Set(player.skills).size===player.skills.length&&player.skills.every(id=>typeof id==='string'&&Object.hasOwn(PREPARED_CATALOG.skill,id))&&
    player.prepared&&typeof player.prepared==='object'&&!Array.isArray(player.prepared)&&Object.keys(player.prepared).length===3&&
    Object.keys(PREPARED_CATEGORIES).every(category=>Object.hasOwn(player.prepared,category)&&canPrepare(player,category,player.prepared[category]));
}
// Switching TO a handgun can be free. Ammo type never determines equip cost (SMG stays 1).
// No handgun is available yet; future definitions opt in with weaponClass:'pistol'.
export function weaponSwitchTurns(weapon,current){return weapon?.integrated||current?.integrated||weapon?.weaponClass==='pistol'?0:1;}
