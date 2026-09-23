// Display helpers for unified suppression and learning data (3.74.1, Claude). Rules stay in suppression.js and
// learning.js; these only restate their state, and text reads SUPPRESSION_TUNING so numbers cannot drift.
import {t} from './i18n.js';
import {suppressionTurns} from './status-timers.js';
import {suppressionState,SUPPRESSION_TUNING as T} from './suppression.js';
import {SKILLS} from './skills.js';
import {TRAITS} from './traits.js';
import {LEARNING_SCRAP} from './learning-data.js';

export function suppressionTag(actor){
 const s=suppressionState(actor);
 return s.immune||!s.stacks?'':t(s.immobile?'suppression-ui.tagPinned':'suppression-ui.tag',{stacks:s.stacks,max:s.max,penalty:s.accuracyPenalty});
}
export function suppressionStatus(actor){
 const s=suppressionState(actor);
 return s.immune||!s.stacks?'':t(s.immobile?'suppression-ui.statusPinned':'suppression-ui.status',{stacks:s.stacks,penalty:s.accuracyPenalty,turns:suppressionTurns(actor)});
}

// Active skills first, then passives; reasons come straight from learningInventory.
export function learningEntries(inventory){
 return [...inventory].sort((a,b)=>Number(Boolean(a.trait))-Number(Boolean(b.trait))||a.name.localeCompare(b.name,'zh-Hant')).map(item=>{
  const passive=Boolean(item.trait);
  const detail=passive?(TRAITS[item.trait]?.text||''):item.skills.map(id=>t('suppression-ui.skillLine',{name:SKILLS[id]?.name||id,text:SKILLS[id]?.text||''})).join(' ');
  const rank=item.maxRank?t('suppression-ui.rank',{rank:item.rank,max:item.maxRank}):'';
  return {id:item.id,title:item.name,count:item.count,kind:passive?t('suppression-ui.passive'):t('suppression-ui.activeSkill'),icon:passive?'◆':'✦',
   detail:t(passive?'suppression-ui.detailPassive':'suppression-ui.detailSkill',{rank,detail}),
   useReason:item.useReason,dismantleReason:item.dismantleReason,scrap:item.scrap,rank:item.rank,maxRank:item.maxRank};
 });
}

// The skill tab lists each passive once: stacked resistance sources read as a rank, and a timer shows only when
// every source is timed (3.75.1).
export function traitRuleLines(actor){
 const timers=new Map();for(const t of actor?.traits||[]){const prev=timers.get(t.id);timers.set(t.id,prev===0||!t.turns?0:Math.max(prev??0,t.turns));}
 return [...timers].map(([id,turns])=>t('suppression-ui.traitLine',{name:TRAITS[id].name,rank:id==='suppression_resistance'?t('suppression-ui.traitRank',{n:suppressionState(actor).resistance}):'',turns:turns?t('suppression-ui.traitTurns',{n:turns}):'',text:TRAITS[id].text}));
}

export function suppressionHelp(){
 return t('suppression-ui.help',{max:T.max,accuracy:T.accuracy,pinned:T.pinned,weaponRounds:T.weaponRounds,skillRounds:T.skillRounds,skillAccuracy:T.skillAccuracy,scrap:LEARNING_SCRAP});
}
