// Display helpers for unified suppression and learning data (3.74.1, Claude). Rules stay in suppression.js and
// learning.js; these only restate their state, and text reads SUPPRESSION_TUNING so numbers cannot drift.
import {suppressionTurns} from './status-timers.js';
import {suppressionState,SUPPRESSION_TUNING as T} from './suppression.js';
import {SKILLS} from './skills.js';
import {TRAITS} from './traits.js';
import {LEARNING_SCRAP} from './learning-data.js';

export function suppressionTag(actor){
 const s=suppressionState(actor);
 return s.immune||!s.stacks?'':`壓制 ${s.stacks}/${s.max} · 命中 −${s.accuracyPenalty}${s.immobile?' · 釘住':''}`;
}
export function suppressionStatus(actor){
 const s=suppressionState(actor);
 return s.immune||!s.stacks?'':`壓制 ${s.stacks} · 命中 −${s.accuracyPenalty}${s.immobile?' · 無法移動':''} · ${suppressionTurns(actor)} 回合`;
}

// Active skills first, then passives; reasons come straight from learningInventory.
export function learningEntries(inventory){
 return [...inventory].sort((a,b)=>Number(Boolean(a.trait))-Number(Boolean(b.trait))||a.name.localeCompare(b.name,'zh-Hant')).map(item=>{
  const passive=Boolean(item.trait);
  const detail=passive?(TRAITS[item.trait]?.text||''):item.skills.map(id=>`${SKILLS[id]?.name||id}：${SKILLS[id]?.text||''}`).join(' ');
  const rank=item.maxRank?` · 目前 ${item.rank}/${item.maxRank} 階`:'';
  return {id:item.id,title:item.name,count:item.count,kind:passive?'被動':'主動技能',icon:passive?'◆':'✦',
   detail:`${passive?'被動 · 學會後直接生效':'主動技能 · 學會後到技能分頁預備'}${rank}。${detail}`,
   useReason:item.useReason,dismantleReason:item.dismantleReason,scrap:item.scrap,rank:item.rank,maxRank:item.maxRank};
 });
}

// The skill tab lists each passive once: stacked resistance sources read as a rank, and a timer shows only when
// every source is timed (3.75.1).
export function traitRuleLines(actor){
 const timers=new Map();for(const t of actor?.traits||[]){const prev=timers.get(t.id);timers.set(t.id,prev===0||!t.turns?0:Math.max(prev??0,t.turns));}
 return [...timers].map(([id,turns])=>`${TRAITS[id].name}${id==='suppression_resistance'?`（${suppressionState(actor).resistance}/3 階）`:''}${turns?`（剩 ${turns} 回合）`:''}：${TRAITS[id].text}`);
}

export function suppressionHelp(){
 return `壓制最多 ${T.max} 層，每層射擊與近戰命中 −${T.accuracy}；${T.pinned} 層以上不能移動（仍可攻擊、裝填、使用道具），每個單位自己行動完後層數減半、無條件進位，1 層則歸零（敵我相同；5 層依序是 5、3、2、1）。一次攻擊打出至少 ${T.weaponRounds} 發並命中，目標得 1 層；壓制射擊消耗 ${T.skillRounds} 發、每發命中 −${T.skillAccuracy}，範圍內敵人保底 1 層，命中者再加 1 層。頭目少 1 層，機械不受壓制。壓制抗性每階使單次壓制合計 −1 層，最高 3 階，可用學習資料提升；部分職業、重裝兵與頭目天生 1 階。未識別貨櫃可能掉出武器或學習資料：在背包道具分頁使用或拆解（+${LEARNING_SCRAP} 廢料），都不耗回合；學會的主動技能與職業技能共用一格預備欄。`;
}
