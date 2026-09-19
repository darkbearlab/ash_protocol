import {SKILLS} from './skills.js';
import {TRAITS,grantTrait,removeTraitSource,activeTrait} from './traits.js';
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
   // 3.123.0 (user decisions, docs/ITEMS.md 照明彈): an item, but aimed like a throwable (`aim:'throw'`).
   flare:{name:'照明彈',short:'照明彈',icon:'✺',resource:'flares',action:'flare',aim:'throw',text:'射程 5 格、半徑 3 格，持續 8 輪。落點看得到、而且沒有對照明彈取得完整掩體的暗格會被照亮：站在上面的敵我都失去暗區的命中懲罰。'},
   // 3.135.0 (user decision, docs/ITEMS.md): grapple lines, dropped only. One line, one use; the escape line is free,
   // the redeploy line costs a turn. Aimed like a flare: pick the landing tile, confirm.
   escape_line:{name:'逃命繩索',short:'逃命繩',icon:'↟',resource:'escapeLines',action:'rope',aim:'throw',text:'不消耗回合。朝 6 格內看得見的地板射出繩索，沿直線把你拉過去；牆、實心物件和其他單位會擋住，幼蟲不會。一條只能用一次。'},
   redeploy_line:{name:'重部署鉤索',short:'鉤索',icon:'⇢',resource:'redeployLines',action:'rope',aim:'throw',text:'消耗 1 回合。朝 6 格內看得見的地板射出鉤索，沿直線把你拉過去；牆、實心物件和其他單位會擋住，幼蟲不會。一條只能用一次。'},
   // 3.148.0 (user decision 2026-09-19): infrared goggles, the night-vision goggles' counterpart; squad leaders drop them.
   irg:{name:'紅外線護目鏡',short:'紅外',icon:'◍',wear:true,traits:['infrared'],text:'佩戴期間看得穿煙霧（牆與關著的門照樣擋），不抵銷暗區懲罰；會受震撼彈失能。戴上與脫下各消耗 1 回合，佩戴期間道具鍵停用。'},
   nvg:{name:'夜視鏡',short:'夜視',icon:'◉',wear:true,traits:['night_vision'],text:'佩戴期間忽略目標暗區的射擊命中懲罰（不穿煙）。戴上與脫下各消耗 1 回合，佩戴期間道具鍵停用。'},
   // 3.144.0 (user decisions 2026-09-19, src/field-gear.js, docs/ITEMS.md): a decoy thrown like a flare, a mine laid
   // within three tiles, and the exoskeleton, a wearable with plates of its own.
   decoy:{name:'誘餌',short:'誘餌',icon:'◎',resource:'decoys',action:'decoy',aim:'throw',text:'射程 5 格。落點 6 格內的敵人（頭目、自爆單位除外）會把誘餌當成你：看不到你、改去攻擊誘餌，但照樣打你的友軍。你攻擊的敵人、以及看得到牠被攻擊的敵人會回過神來；走到你旁邊的也會看穿。誘餌 30 耐久，維持 4 回合。消耗 1 回合。'},
   mine:{name:'地雷',short:'地雷',icon:'✱',resource:'mines',action:'mine',aim:'throw',text:'埋在 3 格內看得見的空地上，同一層最多 3 顆。走路的敵人踩到就爆炸：中心 60、相鄰 50（加上爆破專家）；你和友軍踩到不會爆，但會被炸到。其他爆炸也會引爆它。敵人看不到地雷；看著你埋的會繞開，有槍的會在爆炸範圍外開槍引爆它。換層後就沒了。消耗 1 回合。'},
   exo:{name:'外骨骼',short:'外骨骼',icon:'⛨',wear:true,traits:['exoskeleton'],text:'射擊命中 +10、近戰傷害 +20%，自帶 50 點護甲板，受傷時先替你吸收（和護甲板一樣吸收一半）。護甲板打光時外骨骼損毀、消失，你直接被壓制 5 層。無法修復；重裝兵穿不下。戴上與脫下各消耗 1 回合。'}},
  skill:SKILLS,
};
// 3.136.0 (user decision): every carried item stops at five. The carry learning data (攜行擴充) widens every pouch:
// ammunition by half again, the shared throwable pouch by two, each item by two. Grapple lines are rare enough to go
// uncapped, and goggles are worn, not stocked.
export const CARRY_TUNING=Object.freeze({items:5,itemBonus:2,ammoBonus:1.5,throwBonus:2});
export const CAPPED_ITEMS=Object.freeze(['medkit','spray','adrenaline','barricade','flare','decoy','mine']);
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
export function weaponSwitchTurns(weapon,current){return weapon?.integrated||current?.integrated||weapon?.weaponClass==='pistol'?0:1;}
