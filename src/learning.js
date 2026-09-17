import {suppressionResistance} from './suppression.js';
import {LEARNING_ITEMS,LEARNING_SCRAP,validLearningId} from './learning-data.js';
import {grantTrait,hasTrait} from './traits.js';
import {initializeAllies} from './allies.js';
export function learningReason(g,id,dismantle=false){
 const p=g.player,d=LEARNING_ITEMS[id];
 if(!validLearningId(id)||!(p.learningItems?.[id]>0))return '沒有這份學習資料。';
 if(g.status!=='playing'||g.pendingPerks||p.control.disabled)return '目前無法使用學習資料。';
 // 3.120.0 (user decision): data is no longer dismantled in the pack; it is traded in at a supply terminal for the same value.
 if(dismantle)return '學習資料只能在補給終端抵價。';
 if(d.trait?(d.trait==='suppression_resistance'?suppressionResistance(p)>=3:hasTrait(p,d.trait)):d.skills.every(s=>p.skills.includes(s)))return '已經學會，這份資料可在補給終端抵價。';
 if(d.trait&&p.traits.length>=68)return '被動規則已滿。';
 const needed=d.skills?.filter(s=>s==='pet_command'&&!g.allies.some(a=>a.kind==='pet')).length||0;
 if(g.allies.length+needed>32)return '友軍名額已滿。';
 return '';
}
export function useLearning(g,id,dismantle=false){
 const reason=learningReason(g,id,dismantle);if(reason)return g.fail(reason);
 const p=g.player,d=LEARNING_ITEMS[id];
 if(dismantle)p.scrap+=LEARNING_SCRAP;
 else if(d.trait){if(!grantTrait(p,d.trait,`learned:${id}${d.trait==='suppression_resistance'?`:${suppressionResistance(p)+1}`:''}`))return false;}
 else {for(const skill of d.skills)if(!p.skills.includes(skill)){p.skills.push(skill);p.skillState[skill]={remaining:0,cooldown:0};}initializeAllies(g);}
 if(--p.learningItems[id]===0)delete p.learningItems[id];
 g.log(dismantle?`拆解${d.name}，廢料 +${LEARNING_SCRAP}。`:`已學會${d.name}。`);g.reveal();return true;
}
export const learningInventory=g=>Object.entries(g.player.learningItems).map(([id,count])=>({id,count,...LEARNING_ITEMS[id],...(LEARNING_ITEMS[id].trait==='suppression_resistance'?{rank:suppressionResistance(g.player),maxRank:3}:{}),scrap:LEARNING_SCRAP,useReason:learningReason(g,id),dismantleReason:learningReason(g,id,true)}));
export const validLearningInventory=p=>p.learningItems&&typeof p.learningItems==='object'&&!Array.isArray(p.learningItems)&&Object.entries(p.learningItems).every(([id,n])=>validLearningId(id)&&Number.isSafeInteger(n)&&n>0&&n<=10000000);
