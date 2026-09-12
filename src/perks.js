import {classPerkRank,CLASS_PERK_TUNING} from './class-perks.js';
import {perkLimit} from './endless.js';
import {healActor} from './traits.js';
import {PERKS} from './data.js';
import {random} from './world.js';
export const REPEAT_CHANCE=.6,CLASS_CHANCE=.5,CLASS_MISS_LIMIT=2;
const isClass=o=>Boolean(o.characters?.length);
const count=(p,id)=>p.perks[id]||0;
// Future content may restrict characters or provide an eligibility predicate.
export const eligiblePerks=g=>PERKS.filter(o=>(o.cap===null||count(g.player,o.id)<o.cap)&&(!o.characters||o.characters.includes(g.player.character))&&(!o.eligible||o.eligible(g)));
// Armour-plate salvage (3.51.0): armoured enemies drop far more often, ordinary ones start dropping at all.
// The chance is derived from the stored perk count, so no new save field is needed. A zero chance must not
// roll at all, or an unmodified run would consume a different random stream than before.
export const PLATE_DROP={base:.2,perTier:.15,plainPerTier:.06,amount:10,plainAmount:5};
export const plateDrop=(player,armoured)=>{const tiers=count(player,'plating'),recovery=classPerkRank(player,'bulwark_recovery');
 return {chance:Math.min(1,(armoured?PLATE_DROP.base+PLATE_DROP.perTier*tiers:PLATE_DROP.plainPerTier*tiers)+recovery*CLASS_PERK_TUNING.recoveryChance),amount:(armoured?PLATE_DROP.amount:PLATE_DROP.plainAmount)+recovery*CLASS_PERK_TUNING.recoveryAmount};};
export function drawPerks(g){
 const rng=random((g.seed^Math.imul(g.perkPicks+1,0x9e3779b1)^0x5045524b)>>>0),pool=eligiblePerks(g),ids=[];
 const take=list=>{const o=list[Math.floor(rng()*list.length)];ids.push(o.id);pool.splice(pool.indexOf(o),1);};
 const repeat=pool.filter(o=>o.cap!==null&&count(g.player,o.id)>0);
 if(rng()<REPEAT_CHANCE&&repeat.length)take(repeat);
 const classPool=pool.filter(isClass);
 if(classPool.length){const prioritize=(g.classPerkMisses||0)>=CLASS_MISS_LIMIT||rng()<CLASS_CHANCE;
  if(prioritize&&!ids.some(id=>isClass(PERKS.find(o=>o.id===id))))take(classPool);
 }
 while(ids.length<3&&pool.length)take(pool);
 for(let i=ids.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]];}
 return {index:g.perkPicks,ids};
}
export function ensurePerks(g){
 if(!g.pendingPerks||g.perkPicks>=perkLimit(g.player.level)){g.perkDraft=null;return [];}
 if(!g.perkDraft)g.perkDraft=drawPerks(g);
 return g.perkDraft.ids.map(id=>PERKS.find(o=>o.id===id));
}
export function recordPerkOffer(g){
 const available=eligiblePerks(g).some(isClass),offered=g.perkDraft?.ids.some(id=>isClass(PERKS.find(o=>o.id===id)));
 g.classPerkMisses=!available||offered?0:Math.min(CLASS_MISS_LIMIT,(g.classPerkMisses||0)+1);
}
export function applyPerk(g,o){
 const p=g.player;
 switch(o.effect){
 case 'passive':if(o.id==='necro_haste'&&p.skillState?.raise_dead)p.skillState.raise_dead.cooldown=Math.max(0,p.skillState.raise_dead.cooldown-CLASS_PERK_TUNING.haste);break;
 case 'weapon':p.perkWeaponBonus+=o.amount;break;
 case 'health':p.maxHp+=o.amount;healActor(p,o.heal);break;
 case 'stat':p[o.stat]+=o.amount;break;
 case 'supply':p.meds+=2;g.supplyPack({grenade:2,rifle:24,pistol:24,shell:6});break;
 case 'scavenger':p.scavenger+=o.amount;p.scrap+=15;break;
 case 'medic':p.healBonus+=o.amount;p.meds++;break;
 case 'hazmat':p.hazmat+=o.amount;p.poison=0;break;
 case 'plating':p.plates=Math.min(g.plateCapacity,(p.plates||0)+o.amount);break;
 case 'combat':p.combatModifiers={...p.combatModifiers};for(const key of o.stats)p.combatModifiers[key]=Math.min(100,(p.combatModifiers[key]||0)+o.amount);break;
 default:throw new Error('Unknown perk effect');
 }
 p.perks[o.id]=count(p,o.id)+1;
}
export function migratePerks(g){
 const p=g.player;p.perks={};p.perkWeaponBonus=0;
 // Historical starting HP/armor (not today's balance table). Preserve all actual stats.
 const budget=Math.max(0,p.level-1-g.pendingPerks);
 const exact=(id,value,step)=>{if(Number.isSafeInteger(value)&&value>0&&value%step===0&&value/step<=budget)p.perks[id]=value/step;};
 exact('damage',p.bonus,6);exact('health',p.maxHp-(p.character==='bulwark'?200:100),25);
 exact('armor',p.armor-(p.character==='bulwark'?6:0),3);exact('blast',p.blastBonus,18);
 exact('scavenger',p.scavenger,1);exact('medic',p.healBonus,20);exact('hazmat',p.hazmat,5);
 if(Object.values(p.perks).reduce((a,b)=>a+b,0)>budget)p.perks={}; // Ambiguous modified stats: never invent a history.
 g.perkPicks=budget;g.perkDraft=null;ensurePerks(g);
}
export function validPerks(g){
 const integer=n=>Number.isSafeInteger(n)&&n>=0&&n<=10000000,p=g.player,d=g.perkDraft;
 if(!Number.isInteger(g.classPerkMisses)||g.classPerkMisses<0||g.classPerkMisses>CLASS_MISS_LIMIT)return false;
 if(!integer(g.pendingPerks)||!integer(g.perkPicks)||!integer(p.perkWeaponBonus)||!p.perks||typeof p.perks!=='object'||Array.isArray(p.perks))return false;
 if(!integer(p.level)||p.level<1||!integer(p.xp)||!integer(g.legacyPerkPicks))return false;
 if(g.legacyPerkPicks?(g.perkPicks!==g.legacyPerkPicks||g.pendingPerks!==0||g.legacyPerkPicks>p.level-1):g.perkPicks+g.pendingPerks>perkLimit(p.level))return false;
 if(Object.entries(p.perks).some(([id,n])=>!PERKS.some(o=>o.id===id)||!integer(n)))return false;
 if(d===null)return true;
 return g.pendingPerks>0&&d&&d.index===g.perkPicks&&Array.isArray(d.ids)&&d.ids.length>0&&d.ids.length<=3&&new Set(d.ids).size===d.ids.length&&d.ids.every(id=>eligiblePerks(g).some(o=>o.id===id));
}
export const perkRank=(p,o)=>o.cap===null?`已取得 ${count(p,o.id)} 次 · 可重複`:`${count(p,o.id)}/${o.cap} → ${count(p,o.id)+1}/${o.cap}`;
