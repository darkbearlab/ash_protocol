// Display helpers for unified suppression and learning data (3.74.1, Claude). Rules stay in suppression.js and
// learning.js; these only restate their state, and text reads SUPPRESSION_TUNING so numbers cannot drift.
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
 return s.immune||!s.stacks?'':`壓制 ${s.stacks} · 命中 −${s.accuracyPenalty}${s.immobile?' · 無法移動':''}`;
}

// Active skills first, then passives; reasons come straight from learningInventory.
export function learningEntries(inventory){
 return [...inventory].sort((a,b)=>Number(Boolean(a.trait))-Number(Boolean(b.trait))||a.name.localeCompare(b.name,'zh-Hant')).map(item=>{
  const passive=Boolean(item.trait);
  const detail=passive?(TRAITS[item.trait]?.text||''):item.skills.map(id=>`${SKILLS[id]?.name||id}：${SKILLS[id]?.text||''}`).join(' ');
  return {id:item.id,title:item.name,count:item.count,kind:passive?'被動':'主動技能',icon:passive?'◆':'✦',
   detail:`${passive?'被動 · 學會後直接生效':'主動技能 · 學會後到技能分頁預備'}。${detail}`,
   useReason:item.useReason,dismantleReason:item.dismantleReason,scrap:item.scrap};
 });
}

export function suppressionHelp(){
 return `壓制最多 ${T.max} 層，每層射擊與近戰命中 −${T.accuracy}；${T.pinned} 層以上不能移動（仍可攻擊、裝填、使用道具），每回合結束層數減半。一次攻擊打出至少 ${T.weaponRounds} 發並命中，目標得 1 層；壓制射擊消耗 ${T.skillRounds} 發、每發命中 −${T.skillAccuracy}，範圍內敵人保底 1 層，命中者再加 1 層。頭目少 1 層，機械不受壓制。未識別貨櫃可能掉出武器或學習資料：在背包道具分頁使用或拆解（+${LEARNING_SCRAP} 廢料），都不耗回合；學會的主動技能與職業技能共用一格預備欄。`;
}
