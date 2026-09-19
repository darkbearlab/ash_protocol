import {rapidFireModifiers} from './suppression.js';
import {AMMUNITION} from './ammunition.js';
import {WEAPONS,PERK_D} from './data.js';
import {activeTrait} from './traits.js';

// Stable IDs are stored in saves. Affixes affect the base gun; +1 tuning stays +5 damage.
export const AFFIXES={
  stable:{name:'穩定',text:'命中 +10；基礎傷害 −10%',accuracy:10,damage:.9},
  piercing:{name:'穿甲',text:'穿透 +25%；彈匣 −25%（向下取整，至少 1 發）',pierce:.25,mag:.75},
  extended:{name:'擴容',text:'彈匣 +50%（向下取整）；命中 −8',mag:1.5,accuracy:-8},
  powerful:{name:'強擊',text:'基礎傷害 +15%；彈匣 −25%（向下取整，至少 1 發）',damage:1.15,mag:.75},
  longbarrel:{name:'長管',text:'射程 +2；基礎傷害 −10%',range:2,damage:.9},
  // 3.141.1 (user, 2026-09-19): no longer rolled on the shotgun, whose pellets ignore movement anyway (rollAffix).
  tracking:{name:'追獵',text:'目標移動的命中懲罰減為 10；基礎傷害 −10%',tracking:12,damage:.9,notOn:['shotgun']},
  // 3.141.0 (user decisions 2026-09-19, docs/WEAPONS.md): drop-only affixes, plasma rifles for now. Never sold, never
  // installed: they come only with a plasma rifle found on a floor, in a case or on a body (rollAffix below).
  lance:{name:'貫穿',text:'光束穿過目標繼續前進，打中直線上每個看得見的單位（各自判定命中），在射程盡頭或碰到牆、門、掩體、油桶才停；每次射擊耗 2 發；基礎傷害 −15%',damage:.85,shotCost:2,lance:true,dropOnly:['plasma']},
  burst:{name:'爆裂',text:'命中後在目標處爆炸，相鄰一格受到命中傷害的一半（會波及自己與友軍、引爆油桶）；每次射擊耗 2 發；基礎傷害 −15%',damage:.85,shotCost:2,blast:.5,dropOnly:['plasma']},
  // 3.142.0 (user proposal 2026-09-19): one battery fires a three-round volley of ordinary rounds at half piercing; a volley
  // of three that lands suppresses (src/suppression.js), as the light machine gun's does.
  rapid:{name:'速射',text:'一次射擊只耗 1 發，連射 3 發，每發 18–22、穿透 50%；命中會造成壓制（機械免疫）',damage:.34,pierce:-.5,burst:3,volleyCost:1,dropOnly:['plasma']},
};
// How often a dropped weapon that can carry a drop-only affix gets each one. Its own hash, so every other roll is as before.
export const DROP_ONLY_CHANCE=.15;
export const dropOnlyAffixes=base=>Object.keys(AFFIXES).filter(id=>AFFIXES[id].dropOnly?.includes(WEAPONS[base]?.id));
export const affixAllowed=(base,affix)=>affix===null||Object.hasOwn(AFFIXES,affix)&&(!AFFIXES[affix].dropOnly||AFFIXES[affix].dropOnly.includes(WEAPONS[base]?.id));
// 3.148.0 改裝精通 (升級 D, docs/PERK_GROWTH.md): each rank adds a quarter of a regular affix's upside again; its downside
// stays, and the drop-only affixes are untouched. Accuracy, range and tracking round down.
export const masteryRank=actor=>actor?.perks?.mod_mastery||0;
export function masteredAffix(a,rank){
  if(!rank||a.dropOnly)return a;const k=1+PERK_D.mastery*rank,up={...a};
  if(a.accuracy>0)up.accuracy=Math.floor(a.accuracy*k);
  if(a.damage>1)up.damage=1+(a.damage-1)*k;
  if(a.mag>1)up.mag=1+(a.mag-1)*k;
  if(a.pierce>0)up.pierce=a.pierce*k;
  if(a.range>0)up.range=Math.floor(a.range*k);
  if(a.tracking>0)up.tracking=Math.floor(a.tracking*k);
  return up;
}
export function weaponStats(base,affix=null,actor=null){
  const w=WEAPONS[base];if(w.melee)return {...w,affix:null,affixText:w.desc,accuracyBonus:0,tracking:0};
  const rank=AFFIXES[affix]&&!AFFIXES[affix].dropOnly?masteryRank(actor):0,a=masteredAffix(AFFIXES[affix]||{},rank);
  const burstRange=w.range+(a.range||0),extended=w.weaponClass==='smg'&&activeTrait(actor,'extended_burst');
  return {...w,name:a.name?`${a.name}・${w.name}`:w.name,affix,affixText:(a.text||'標準型，沒有詞條')+(rank?` · 改裝精通：好處 +${Math.round(PERK_D.mastery*rank*100)}%`:'')+(w.lootOnly?` · ${w.desc}`:'')+(extended?` · 延伸點射：${burstRange} 格內兩發，${burstRange+1}–${burstRange+2} 格單發`:''),
    min:Math.round(w.min*(a.damage||1)),max:Math.round(w.max*(a.damage||1)),
    ...(w.closeRange?{closeMin:Math.round(w.closeMin*(a.damage||1)),closeMax:Math.round(w.closeMax*(a.damage||1))}:{}),
    ...(w.farFrom?{farMin:Math.round(w.farMin*(a.damage||1)),farMax:Math.round(w.farMax*(a.damage||1))}:{}),
    ...(w.pellets?{pelletMin:Math.round(w.pelletMin*(a.damage||1)),pelletMax:Math.round(w.pelletMax*(a.damage||1))}:{}),
    shotCost:a.shotCost||1,affixAccuracy:a.accuracy||0,...(a.burst?{burst:a.burst}:{}),...(a.volleyCost?{volleyCost:a.volleyCost}:{}),...(a.lance?{lance:true}:{}),...(a.blast?{blast:a.blast}:{}),
    mag:Math.max(1,Math.floor(w.mag*(a.mag||1))),range:burstRange+(extended?2:0),...(extended?{burstRange}:{}),
    pierce:Math.max(0,Math.min(1,(w.pierce||0)+(a.pierce||0))),extraRounds:rapidFireModifiers(actor).extraRounds,accuracyBonus:(a.accuracy||0)+rapidFireModifiers(actor).accuracyBonus,tracking:a.tracking||0};
}
// Do not change weapon.burst: it also divides per-volley perk damage bonuses.
export const singleShotAt=(weapon,range)=>weapon.burstRange!==undefined&&range>weapon.burstRange;
export const volleyAt=(weapon,range)=>(singleShotAt(weapon,range)?1:(weapon.burst||1))+(weapon.extraRounds||0);
// 3.142.0: rounds a volley fires with this much in the magazine, and what each round costs. A volleyCost weapon (速射)
// spends it once, on the first round; every other weapon spends shotCost a round (2 for 貫穿 and 爆裂).
export const volleyShots=(w,range,ammo)=>w.volleyCost?(ammo>=w.volleyCost?volleyAt(w,range):0):Math.min(volleyAt(w,range),Math.floor(ammo/(w.shotCost||1)));
export const roundCost=(w,round)=>w.volleyCost?(round===0?w.volleyCost:0):(w.shotCost||1);
// Separate from combat RNG: inspecting, collecting or restoring loot never rerolls it.
const fnv=seed=>{let hash=2166136261;for(const c of String(seed)){hash^=c.charCodeAt(0);hash=Math.imul(hash,16777619);}return hash>>>0;};
export function rollAffix(base,seed){
  if(WEAPONS[base]?.melee)return null;
  const special=dropOnlyAffixes(base),pick=Math.floor(fnv(`${seed}:drop-only`)/4294967296/DROP_ONLY_CHANCE);
  if(pick<special.length)return special[pick];
  const hash=fnv(seed);if(hash%100>=65)return null;
  const ids=Object.keys(AFFIXES).filter(id=>!AFFIXES[id].dropOnly&&(id!=='piercing'||!WEAPONS[base].explosive)),id=ids[Math.floor(hash/100)%ids.length];
  // An affix that means nothing on this weapon re-picks among the rest from its own hash, so every other roll, and how
  // often the weapon carries an affix at all, stay as they were.
  if(!AFFIXES[id].notOn?.includes(WEAPONS[base].id))return id;
  const rest=ids.filter(other=>!AFFIXES[other].notOn?.includes(WEAPONS[base].id));
  return rest[fnv(`${seed}:repick`)%rest.length];
}

export const ammoName=w=>w.melee?'無限使用':AMMUNITION[w.ammoType].name;
export const magazineLabel=(w,rounds)=>w.melee?'∞':`${rounds}/${w.mag}`;

// Shared dismantling/feeding/trade-in value; magazine ammunition is handled separately. The engineer's own passive
// (3.120.0, user decision) raises it by half: the workshop spends scrap all the time, and terminals now take it too.
export const SALVAGE_TUNING=Object.freeze({base:20,perLevel:10,engineer:1.5});
export const salvageValue=(p,slot)=>{const value=SALVAGE_TUNING.base+(p.upgrades[slot]||0)*SALVAGE_TUNING.perLevel;return p.character==='engineer'?Math.round(value*SALVAGE_TUNING.engineer):value;};
export const canSalvageOwned=(g,slot)=>Number.isInteger(slot)&&g.player.owned.includes(slot)&&g.player.owned.length>1&&!g.weaponAt(slot).locked;
