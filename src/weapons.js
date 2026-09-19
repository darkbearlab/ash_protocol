import {rapidFireModifiers} from './suppression.js';
import {AMMUNITION} from './ammunition.js';
import {WEAPONS} from './data.js';
import {activeTrait} from './traits.js';

// Stable IDs are stored in saves. Affixes affect the base gun; +1 tuning stays +5 damage.
export const AFFIXES={
  stable:{name:'穩定',text:'命中 +10；基礎傷害 −10%',accuracy:10,damage:.9},
  piercing:{name:'穿甲',text:'穿透 +25%；彈匣 −25%（向下取整，至少 1 發）',pierce:.25,mag:.75},
  extended:{name:'擴容',text:'彈匣 +50%（向下取整）；命中 −8',mag:1.5,accuracy:-8},
  powerful:{name:'強擊',text:'基礎傷害 +15%；彈匣 −25%（向下取整，至少 1 發）',damage:1.15,mag:.75},
  longbarrel:{name:'長管',text:'射程 +2；基礎傷害 −10%',range:2,damage:.9},
  tracking:{name:'追獵',text:'目標移動的命中懲罰減為 10；基礎傷害 −10%',tracking:12,damage:.9},
  // 3.141.0 (user decisions 2026-09-19, docs/WEAPONS.md): drop-only affixes, plasma rifles for now. Never sold, never
  // installed: they come only with a plasma rifle found on a floor, in a case or on a body (rollAffix below).
  lance:{name:'貫穿',text:'光束穿過目標繼續前進，打中直線上每個看得見的單位（各自判定命中），在射程盡頭或碰到牆、門、掩體、油桶才停；每次射擊耗 2 發；基礎傷害 −15%',damage:.85,shotCost:2,lance:true,dropOnly:['plasma']},
  burst:{name:'爆裂',text:'命中後在目標處爆炸，相鄰一格受到命中傷害的一半（會波及自己與友軍、引爆油桶）；每次射擊耗 2 發；基礎傷害 −15%',damage:.85,shotCost:2,blast:.5,dropOnly:['plasma']},
};
// How often a dropped weapon that can carry a drop-only affix gets each one. Its own hash, so every other roll is as before.
export const DROP_ONLY_CHANCE=.15;
export const dropOnlyAffixes=base=>Object.keys(AFFIXES).filter(id=>AFFIXES[id].dropOnly?.includes(WEAPONS[base]?.id));
export const affixAllowed=(base,affix)=>affix===null||Object.hasOwn(AFFIXES,affix)&&(!AFFIXES[affix].dropOnly||AFFIXES[affix].dropOnly.includes(WEAPONS[base]?.id));
export function weaponStats(base,affix=null,actor=null){
  const w=WEAPONS[base];if(w.melee)return {...w,affix:null,affixText:w.desc,accuracyBonus:0,tracking:0};
  const a=AFFIXES[affix]||{};
  const burstRange=w.range+(a.range||0),extended=w.weaponClass==='smg'&&activeTrait(actor,'extended_burst');
  return {...w,name:a.name?`${a.name}・${w.name}`:w.name,affix,affixText:(a.text||'標準型，沒有詞條')+(w.lootOnly?` · ${w.desc}`:'')+(extended?` · 延伸點射：${burstRange} 格內兩發，${burstRange+1}–${burstRange+2} 格單發`:''),
    min:Math.round(w.min*(a.damage||1)),max:Math.round(w.max*(a.damage||1)),
    ...(w.closeRange?{closeMin:Math.round(w.closeMin*(a.damage||1)),closeMax:Math.round(w.closeMax*(a.damage||1))}:{}),
    ...(w.farFrom?{farMin:Math.round(w.farMin*(a.damage||1)),farMax:Math.round(w.farMax*(a.damage||1))}:{}),
    ...(w.pellets?{pelletMin:Math.round(w.pelletMin*(a.damage||1)),pelletMax:Math.round(w.pelletMax*(a.damage||1))}:{}),
    shotCost:a.shotCost||1,affixAccuracy:a.accuracy||0,...(a.lance?{lance:true}:{}),...(a.blast?{blast:a.blast}:{}),
    mag:Math.max(1,Math.floor(w.mag*(a.mag||1))),range:burstRange+(extended?2:0),...(extended?{burstRange}:{}),
    pierce:Math.min(1,(w.pierce||0)+(a.pierce||0)),extraRounds:rapidFireModifiers(actor).extraRounds,accuracyBonus:(a.accuracy||0)+rapidFireModifiers(actor).accuracyBonus,tracking:a.tracking||0};
}
// Do not change weapon.burst: it also divides per-volley perk damage bonuses.
export const singleShotAt=(weapon,range)=>weapon.burstRange!==undefined&&range>weapon.burstRange;
export const volleyAt=(weapon,range)=>(singleShotAt(weapon,range)?1:(weapon.burst||1))+(weapon.extraRounds||0);
// Separate from combat RNG: inspecting, collecting or restoring loot never rerolls it.
const fnv=seed=>{let hash=2166136261;for(const c of String(seed)){hash^=c.charCodeAt(0);hash=Math.imul(hash,16777619);}return hash>>>0;};
export function rollAffix(base,seed){
  if(WEAPONS[base]?.melee)return null;
  const special=dropOnlyAffixes(base),pick=Math.floor(fnv(`${seed}:drop-only`)/4294967296/DROP_ONLY_CHANCE);
  if(pick<special.length)return special[pick];
  const hash=fnv(seed);if(hash%100>=65)return null;
  const ids=Object.keys(AFFIXES).filter(id=>!AFFIXES[id].dropOnly&&(id!=='piercing'||!WEAPONS[base].explosive));
  return ids[Math.floor(hash/100)%ids.length];
}

export const ammoName=w=>w.melee?'無限使用':AMMUNITION[w.ammoType].name;
export const magazineLabel=(w,rounds)=>w.melee?'∞':`${rounds}/${w.mag}`;

// Shared dismantling/feeding/trade-in value; magazine ammunition is handled separately. The engineer's own passive
// (3.120.0, user decision) raises it by half: the workshop spends scrap all the time, and terminals now take it too.
export const SALVAGE_TUNING=Object.freeze({base:20,perLevel:10,engineer:1.5});
export const salvageValue=(p,slot)=>{const value=SALVAGE_TUNING.base+(p.upgrades[slot]||0)*SALVAGE_TUNING.perLevel;return p.character==='engineer'?Math.round(value*SALVAGE_TUNING.engineer):value;};
export const canSalvageOwned=(g,slot)=>Number.isInteger(slot)&&g.player.owned.includes(slot)&&g.player.owned.length>1&&!g.weaponAt(slot).locked;
