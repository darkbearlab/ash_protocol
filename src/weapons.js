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
};
export function weaponStats(base,affix=null,actor=null){
  const w=WEAPONS[base];if(w.melee)return {...w,affix:null,affixText:w.desc,accuracyBonus:0,tracking:0};
  const a=AFFIXES[affix]||{};
  const burstRange=w.range+(a.range||0),extended=w.weaponClass==='smg'&&activeTrait(actor,'extended_burst');
  return {...w,name:a.name?`${a.name}・${w.name}`:w.name,affix,affixText:(a.text||'標準型，沒有詞條')+(w.lootOnly?` · ${w.desc}`:'')+(extended?` · 延伸點射：${burstRange} 格內兩發，${burstRange+1}–${burstRange+2} 格單發`:''),
    min:Math.round(w.min*(a.damage||1)),max:Math.round(w.max*(a.damage||1)),
    ...(w.closeRange?{closeMin:Math.round(w.closeMin*(a.damage||1)),closeMax:Math.round(w.closeMax*(a.damage||1))}:{}),
    mag:Math.max(1,Math.floor(w.mag*(a.mag||1))),range:burstRange+(extended?2:0),...(extended?{burstRange}:{}),
    pierce:Math.min(.95,(w.pierce||0)+(a.pierce||0)),accuracyBonus:a.accuracy||0,tracking:a.tracking||0};
}
// Do not change weapon.burst: it also divides per-volley perk damage bonuses.
export const singleShotAt=(weapon,range)=>weapon.burstRange!==undefined&&range>weapon.burstRange;
export const volleyAt=(weapon,range)=>singleShotAt(weapon,range)?1:(weapon.burst||1);
// Separate from combat RNG: inspecting, collecting or restoring loot never rerolls it.
export function rollAffix(base,seed){
  if(WEAPONS[base]?.locked)return null;
  let hash=2166136261;for(const c of String(seed)){hash^=c.charCodeAt(0);hash=Math.imul(hash,16777619);}
  hash>>>=0;if(hash%100>=65)return null;
  const ids=Object.keys(AFFIXES).filter(id=>id!=='piercing'||!WEAPONS[base].explosive);
  return ids[Math.floor(hash/100)%ids.length];
}

export const ammoName=w=>w.melee?'無限使用':AMMUNITION[w.ammoType].name;
export const magazineLabel=(w,rounds)=>w.melee?'∞':`${rounds}/${w.mag}`;
