import {SKILLS} from './skills.js';
import {TRAITS,grantTrait,removeTraitSource} from './traits.js';
import {GRENADES} from './throwables.js';
// Separate prepared slots. Stable catalog IDs are saved; quantities retain existing keys.
export const PREPARED_CATEGORIES={grenade:'手榴彈',item:'道具',skill:'技能'};
export const PREPARED_CATALOG={
  grenade:GRENADES,
  // 3.106.0 (docs/ITEMS.md, user): the repair spray is the medkit's armour twin; adrenaline is the ninja's shadow step
  // with a price, so it is free to use and buys movement only.
  item:{medkit:{name:'醫療包',short:'醫療包',icon:'✚',resource:'meds',action:'heal',text:'回復生命並清除中毒。使用消耗 1 回合，滿血且未中毒時不消耗。'},
   spray:{name:'修復噴劑',short:'噴劑',icon:'▣',resource:'sprays',action:'plate',text:'補上 20 點護甲板。使用消耗 1 回合，護甲板已滿時無法使用。'},
   adrenaline:{name:'腎上腺素',short:'腎上腺素',icon:'⚡',resource:'adrenaline',action:'surge',text:'不消耗回合。接下來可免費移動 2 格，做其他事就結束；代價是 15 生命。'},
   // 3.109.0 (user request): cover you carry. It goes on an edge rather than a tile, so it can be vaulted and can
   // never seal a corridor, and `aim:'side'` tells the UI to ask for a direction before running the action.
   barricade:{name:'摺疊掩體',short:'掩體',icon:'▬',resource:'barricades',action:'deployCover',aim:'side',text:'在身邊任一側的邊線架起矮隔板：擋住移動並提供掩體，但不擋視線與射線，任何人都能翻越（翻越者下次被射擊命中 +20）。使用消耗 1 回合。'},
   // 3.108.0 (user, docs/ITEMS.md): the first wearable. It has no action — the prepared slot is its 生效欄, not a
   // quick-use slot — so wearing it is what does the work, and the item button greys while it is on.
   nvg:{name:'夜視鏡',short:'夜視',icon:'◉',wear:true,traits:['night_vision'],text:'佩戴期間忽略目標暗區的射擊命中懲罰（不穿煙）。戴上與脫下各消耗 1 回合，佩戴期間道具鍵停用。'}},
  skill:SKILLS,
};
export const defaultPrepared=()=>({grenade:'frag',item:'medkit',skill:null});
// Wearables live in the prepared item slot and are owned rather than stocked, exactly like learned skills.
export const WEAR_SOURCE='item:wear';
export const WEARABLE_IDS=Object.entries(PREPARED_CATALOG.item).filter(([,entry])=>entry.wear).map(([id])=>id);
export const isWearable=id=>Boolean(PREPARED_CATALOG.item[id]?.wear);
export const wornEntry=player=>{const id=player?.prepared?.item;return isWearable(id)?PREPARED_CATALOG.item[id]:null;};
// Putting one on and taking it off each cost a turn, so swapping wearable→wearable is one turn, not two, and
// swapping consumable→consumable stays free (user, 2026-09-16).
export const prepareCost=(player,arg)=>arg?.category==='item'&&(isWearable(arg.id)||isWearable(player?.prepared?.item))?1:0;
// The worn item's passives are derived, never stored on their own: one source id, cleared and re-granted.
export function syncWearableTraits(player){
  if(!player||!Array.isArray(player.traits))return;
  const entry=wornEntry(player),wanted=entry?.traits||[];
  const current=player.traits.filter(t=>t.source===WEAR_SOURCE);
  if(current.length===wanted.length&&wanted.every(id=>current.some(t=>t.id===id)))return;
  removeTraitSource(player,WEAR_SOURCE);for(const id of wanted)grantTrait(player,id,WEAR_SOURCE);
}
export const validWearableCatalog=()=>WEARABLE_IDS.every(id=>(PREPARED_CATALOG.item[id].traits||[]).every(t=>Object.hasOwn(TRAITS,t)));
export const validWearables=player=>Array.isArray(player.wearables)&&new Set(player.wearables).size===player.wearables.length&&player.wearables.every(id=>WEARABLE_IDS.includes(id));
export function preparedOptions(player,category){
  return Object.entries(PREPARED_CATALOG[category]||{})
    .filter(([id,entry])=>entry.wear?player.wearables?.includes(id):category!=='skill'||player.skills.includes(id));
}
export function canPrepare(player,category,id){
  return Object.hasOwn(PREPARED_CATEGORIES,category)&&(id===null||preparedOptions(player,category).some(([key])=>key===id));
}
export function preparedEntry(player,category){
  const id=player.prepared?.[category];return id&&Object.hasOwn(PREPARED_CATALOG[category]||{},id)?PREPARED_CATALOG[category][id]:null;
}
export function validPrepared(player){
  return Array.isArray(player.skills)&&new Set(player.skills).size===player.skills.length&&player.skills.every(id=>typeof id==='string'&&Object.hasOwn(PREPARED_CATALOG.skill,id))&&validWearables(player)&&
    player.prepared&&typeof player.prepared==='object'&&!Array.isArray(player.prepared)&&Object.keys(player.prepared).length===3&&
    Object.keys(PREPARED_CATEGORIES).every(category=>Object.hasOwn(player.prepared,category)&&canPrepare(player,category,player.prepared[category]));
}
// Switching TO a handgun can be free. Ammo type never determines equip cost (SMG stays 1).
// No handgun is available yet; future definitions opt in with weaponClass:'pistol'.
export function weaponSwitchTurns(weapon,current){return weapon?.integrated||current?.integrated||weapon?.weaponClass==='pistol'?0:1;}
