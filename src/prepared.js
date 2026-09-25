import {t} from './i18n.js';
import {SKILLS} from './skills.js';
import {TRAITS,grantTrait,removeTraitSource,activeTrait} from './traits.js';
import {GRENADES} from './throwables.js';
// Separate prepared slots. Stable catalog IDs are saved; quantities retain existing keys.
export const PREPARED_CATEGORIES={grenade:t('preparedCategories.grenade'),item:t('preparedCategories.item'),skill:t('preparedCategories.skill')};
export const PREPARED_CATALOG={
  grenade:GRENADES,
  // 3.106.0 (docs/ITEMS.md, user): the repair spray is the medkit's armour twin; adrenaline is the ninja's shadow step
  // with a price, so it is free to use and buys movement only.
  item:{medkit:{name:t('preparedCatalog.item.medkit.name'),short:t('preparedCatalog.item.medkit.short'),icon:'✚',resource:'meds',action:'heal',text:t('preparedCatalog.item.medkit.text')},
   spray:{name:t('preparedCatalog.item.spray.name'),short:t('preparedCatalog.item.spray.short'),icon:'▣',resource:'sprays',action:'plate',text:t('preparedCatalog.item.spray.text')},
   adrenaline:{name:t('preparedCatalog.item.adrenaline.name'),short:t('preparedCatalog.item.adrenaline.short'),icon:'⚡',resource:'adrenaline',action:'surge',text:t('preparedCatalog.item.adrenaline.text')},
   // 3.109.0 (user request): cover you carry. It goes on an edge rather than a tile, so it can be vaulted and can
   // never seal a corridor, and `aim:'side'` tells the UI to ask for a direction before running the action.
   barricade:{name:t('preparedCatalog.item.barricade.name'),short:t('preparedCatalog.item.barricade.short'),icon:'▬',resource:'barricades',action:'deployCover',aim:'side',text:t('preparedCatalog.item.barricade.text')},
   // 3.108.0 (user, docs/ITEMS.md): the first wearable. It has no action — the prepared slot is its 生效欄, not a
   // quick-use slot — so wearing it is what does the work, and the item button greys while it is on.
   // 3.123.0 (user decisions, docs/ITEMS.md 照明彈): an item, but aimed like a throwable (`aim:'throw'`).
   flare:{name:t('preparedCatalog.item.flare.name'),short:t('preparedCatalog.item.flare.short'),icon:'✺',resource:'flares',action:'flare',aim:'throw',text:t('preparedCatalog.item.flare.text')},
   // 3.135.0 (user decision, docs/ITEMS.md): grapple lines, dropped only. One line, one use; the escape line is free,
   // the redeploy line costs a turn. Aimed like a flare: pick the landing tile, confirm.
   escape_line:{name:t('preparedCatalog.item.escape_line.name'),short:t('preparedCatalog.item.escape_line.short'),icon:'↟',resource:'escapeLines',action:'rope',aim:'throw',text:t('preparedCatalog.item.escape_line.text')},
   redeploy_line:{name:t('preparedCatalog.item.redeploy_line.name'),short:t('preparedCatalog.item.redeploy_line.short'),icon:'⇢',resource:'redeployLines',action:'rope',aim:'throw',text:t('preparedCatalog.item.redeploy_line.text')},
   // 3.148.0 (user decision 2026-09-19): infrared goggles, the night-vision goggles' counterpart; squad leaders drop them.
   irg:{name:t('preparedCatalog.item.irg.name'),short:t('preparedCatalog.item.irg.short'),icon:'◍',wear:true,traits:['infrared'],text:t('preparedCatalog.item.irg.text')},
   nvg:{name:t('preparedCatalog.item.nvg.name'),short:t('preparedCatalog.item.nvg.short'),icon:'◉',wear:true,traits:['night_vision'],text:t('preparedCatalog.item.nvg.text')},
   // 3.144.0 (user decisions 2026-09-19, src/field-gear.js, docs/ITEMS.md): a decoy thrown like a flare, a mine laid
   // within three tiles, and the exoskeleton, a wearable with plates of its own.
   decoy:{name:t('preparedCatalog.item.decoy.name'),short:t('preparedCatalog.item.decoy.short'),icon:'◎',resource:'decoys',action:'decoy',aim:'throw',text:t('preparedCatalog.item.decoy.text')},
   // 3.178.0 (docs/LIGHTING.md): the glowstick, thrown like the decoy; it keeps a small patch dim for good.
   glowstick:{name:t('preparedCatalog.item.glowstick.name'),short:t('preparedCatalog.item.glowstick.short'),icon:'⌇',resource:'glowsticks',action:'glowstick',aim:'throw',text:t('preparedCatalog.item.glowstick.text')},
   mine:{name:t('preparedCatalog.item.mine.name'),short:t('preparedCatalog.item.mine.short'),icon:'✱',resource:'mines',action:'mine',aim:'throw',text:t('preparedCatalog.item.mine.text')},
   exo:{name:t('preparedCatalog.item.exo.name'),short:t('preparedCatalog.item.exo.short'),icon:'⛨',wear:true,traits:['exoskeleton'],text:t('preparedCatalog.item.exo.text')}},
  skill:SKILLS,
};
// 3.136.0 (user decision): every carried item stops at five. The carry learning data (攜行擴充) widens every pouch:
// ammunition by half again, the shared throwable pouch by two, each item by two. Grapple lines are rare enough to go
// uncapped, and goggles are worn, not stocked.
export const CARRY_TUNING=Object.freeze({items:5,itemBonus:2,ammoBonus:1.5,throwBonus:2});
export const CAPPED_ITEMS=Object.freeze(['medkit','spray','adrenaline','barricade','flare','decoy','mine','glowstick']);
export const itemGroundType=id=>id==='medkit'?'med':id;
export const groundItemId=type=>type==='med'?'medkit':type;
export const itemCapacity=player=>CARRY_TUNING.items+(activeTrait(player,'extended_carry')?CARRY_TUNING.itemBonus:0);
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
// 3.155.0 短管: a stubby gun comes up like a sidearm, so switching to it is free — the same rule pistols already had.
export function weaponSwitchTurns(weapon,current){return weapon?.integrated||current?.integrated||weapon?.weaponClass==='pistol'||weapon?.quickSwap?0:1;}
