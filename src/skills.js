import {t} from './i18n.js';
import {GRAPPLE_RANGE,GRAPPLE_COOLDOWN,CAMO_DURATION,CAMO_COOLDOWN,MELEE_TUNING} from './melee-classes.js';
import {grantTrait,removeTraitSource} from './traits.js';
import {TETHER,CARRY_DISTANCE,SUMMON_LIMIT,SUMMON_INTERVAL,SUMMON_TETHER,RALLY_TURNS,PET_TETHER,DRONE_HP,SENTRY_ARMOR,WORKSHOP_TUNING,MUNITION_TUNING,ENEMY_UNIT_TUNING,REPAIR_TUNING,allyWeapon,summonInterval,summonLimit} from './allies.js';
import {classPerkRank,CLASS_PERK_TUNING,markValues} from './class-perks.js';
// Ally skill texts read the tuning constants, so a balance change cannot leave them stale (3.44).
const FOLLOW=allyWeapon({kind:'drone',sourceId:'drone_follow'}),SENTRY=allyWeapon({kind:'drone',sourceId:'drone_sentry'});
// Texts whose numbers class perks change are templates: the pack and the skill button show the player's actual values (3.151).
const SKILL_TEXTS={
 early_warning:v=>t('skills.earlyWarning',{radius:v.radius,markTurns:v.mark.duration,accuracy:v.mark.accuracy,damage:Math.round(v.mark.damage*100),evasion:v.mark.evasion?t('skills.warningEvasion',{n:v.mark.evasion}):'',cooldown:v.cooldown}),
 signal_break:v=>t('skills.signalBreak',{turns:v.duration,cooldown:v.cooldown}),
 camouflage:v=>t('skills.camouflage',{turns:v.duration,evasion:MELEE_TUNING.camoEvasion,cooldown:v.cooldown}),
 raise_dead:v=>`被動：每 ${v.interval} 回合自動從本層倒下過的非頭目、非機械敵人中抽一隻起身（倒下越多的種類越常出現，屍體不消耗），最多 ${v.limit} 隻，出現在你身邊、下回合才行動；生命同該物種（32～150），傷害取物種基礎值（不含深層加成），沒有裝甲；主動追擊離你 ${SUMMON_TETHER} 格內看得到的敵人。按技能免費集結：${RALLY_TURNS} 回合內召喚物停止追擊、回到你身邊，換層前使用。未同行者換層消失。`,
},SKILL_CARDS={raise_dead:v=>`每 ${v.interval} 回合自動起身 · 集結免費`};
// Active skills are separate from passive traits and item quantities.
export const SKILLS={
 suppressive_fire:{name:'壓制射擊',short:'壓制',icon:'◇',action:'suppressiveFire',cost:1,duration:0,cooldown:0,target:'area',text:'消耗 3 發，命中 −20；目標格與相鄰四格敵人獲得 1 層壓制，命中可再加 1 層。'},
 anchor:{name:'下錨',short:'下錨',icon:'◇',action:'skill',toggle:true,cost:1,duration:1,cooldown:0,text:'啟動／解除各 1 回合。下錨時不能移動或換層，套用笨拙；自己的武器射擊與近戰於普通與緩速各執行一次，分別消耗彈藥；投擲物與友軍不受影響。'},
 workshop:{name:'工坊',short:'工坊',icon:'▣',action:'skill',cost:0,duration:0,cooldown:0,card:'打開生產序列 · 生產與部署各 1 回合',text:t('skills.workshop',{repairCost:REPAIR_TUNING.cost,droneHp:DRONE_HP,droneMag:FOLLOW.mag,droneRange:FOLLOW.range,sentryArmor:SENTRY_ARMOR,sentryMag:SENTRY.mag,carry:CARRY_DISTANCE,tether:TETHER,munitionHp:MUNITION_TUNING.hp,droneUnitHp:ENEMY_UNIT_TUNING.drone.hp,droneUnitRange:ENEMY_UNIT_TUNING.drone.range,bomberHp:ENEMY_UNIT_TUNING.bomber.hp,wardenHp:ENEMY_UNIT_TUNING.warden.hp,bossHp:ENEMY_UNIT_TUNING.boss.hp,lines:WORKSHOP_TUNING.lines,deploy:WORKSHOP_TUNING.deploy})},
 pet_command:{name:'伴生指揮',short:'指揮',icon:'♧',action:'skill',cost:0,duration:0,cooldown:0,card:'指令免費 · 相鄰餵食 1 回合',text:`指揮已探索 ${TETHER} 格內位置，或召回。獵獸追擊 ${PET_TETHER} 格內敵人；相鄰餵食累積成長與燃料，死亡後自動重生，換層必定同行。`},
 // The cooldown field is the rising timer, so it must be able to hold SUMMON_INTERVAL; saves are validated against it.
 raise_dead:{name:'亡者集結',short:'集結',icon:'♧',action:'skill',cost:0,duration:0,cooldown:SUMMON_INTERVAL,card:SKILL_CARDS.raise_dead({interval:SUMMON_INTERVAL}),text:SKILL_TEXTS.raise_dead({interval:SUMMON_INTERVAL,limit:SUMMON_LIMIT})},
 early_warning:{name:'預警',short:'預警',icon:'⌖',action:'skill',cost:0,duration:1,cooldown:5,radius:8,text:SKILL_TEXTS.early_warning({radius:8,cooldown:5,mark:markValues(null)})},signal_break:{name:'訊號斷層',short:'斷層',icon:'⌁',action:'skill',cost:0,duration:3,cooldown:6,text:SKILL_TEXTS.signal_break({duration:3,cooldown:6})},
 grapple:{name:'鉤鎖',short:'鉤鎖',icon:'◇',action:'skill',cost:1,duration:0,cooldown:GRAPPLE_COOLDOWN,text:t('skills.grapple',{range:GRAPPLE_RANGE,cooldown:GRAPPLE_COOLDOWN})},
 camouflage:{name:'光學迷彩',short:'迷彩',icon:'◇',action:'skill',cost:0,duration:CAMO_DURATION,cooldown:CAMO_COOLDOWN,cooldownAfterEffect:true,text:SKILL_TEXTS.camouflage({duration:CAMO_DURATION,cooldown:CAMO_COOLDOWN})},
};
export const initialSkillState=ids=>Object.fromEntries(ids.map(id=>[id,{remaining:0,cooldown:0}]));
export const skillActive=(player,id='signal_break')=>(player.skillState?.[id]?.remaining||0)>0;
export function skillValues(player,id){const d=SKILLS[id],rank=classPerkRank(player,id==='early_warning'?'soldier_overwatch':id==='signal_break'?'recon_blackout':id==='camouflage'?'ninja_overload':'');if(id==='early_warning')return {...d,radius:d.radius+rank*CLASS_PERK_TUNING.overwatchRadius,cooldown:Math.max(2,d.cooldown-rank*CLASS_PERK_TUNING.overwatchCooldown),mark:markValues(player)};if(id==='signal_break')return {...d,duration:d.duration+rank*CLASS_PERK_TUNING.blackoutDuration,cooldown:Math.max(3,d.cooldown-rank*CLASS_PERK_TUNING.blackoutCooldown)};if(id==='camouflage')return {...d,duration:d.duration+rank*CLASS_PERK_TUNING.overloadDuration,cooldown:Math.max(4,d.cooldown-rank*CLASS_PERK_TUNING.overloadCooldown)};return d;}
export function skillText(player,id){const d=SKILLS[id];if(!d||!SKILL_TEXTS[id])return d?.text||'';if(id==='raise_dead')return SKILL_TEXTS.raise_dead({interval:summonInterval(player),limit:summonLimit(player)});return SKILL_TEXTS[id](skillValues(player,id));}
export const canUseSkill=(player,id)=>Object.hasOwn(SKILLS,id)&&player.skills.includes(id)&&player.prepared.skill===id&&(SKILLS[id].toggle||!player.skillState?.[id]?.remaining)&&!player.skillState?.[id]?.cooldown;
export function skillStatus(player,id){const state=player.skillState?.[id];if(SKILLS[id]?.toggle)return state?.remaining?'解除':'啟動';return state?.remaining?`生效 ${state.remaining}`:state?.cooldown?`冷卻 ${state.cooldown}`:'就緒';}
export function tickSkills(player){for(const [id,state] of Object.entries(player.skillState)){const def=skillValues(player,id);if(def?.toggle)continue;if(def?.cooldownAfterEffect&&state.remaining){state.remaining--;if(!state.remaining)state.cooldown=def.cooldown;continue;}state.remaining=Math.max(0,state.remaining-1);state.cooldown=Math.max(0,state.cooldown-1);}}
export function endSkillEffects(player){for(const [id,state] of Object.entries(player.skillState))if(!SKILLS[id]?.toggle&&!SKILLS[id]?.cooldownAfterEffect)state.remaining=0;}
export function validSkillState(player){
  const states=player.skillState;
  if(!states||typeof states!=='object'||Array.isArray(states)||Object.keys(states).length!==player.skills.length)return false;
  return player.skills.every(id=>{
    const state=states[id],def=skillValues(player,id);
    return def&&state&&typeof state==='object'&&!Array.isArray(state)&&Object.keys(state).length===2&&
      Number.isInteger(state.remaining)&&state.remaining>=0&&state.remaining<=def.duration&&Number.isInteger(state.cooldown)&&state.cooldown>=0&&(def.toggle?state.cooldown===0:def.cooldownAfterEffect?(state.remaining===0||state.cooldown===0):state.cooldown>=state.remaining-Math.max(0,def.duration-def.cooldown))&&state.cooldown<=def.cooldown;
  });
}

export const ANCHOR_SOURCE='skill:anchor';
export function toggleAnchor(player){
 if(!canUseSkill(player,'anchor')||player.control.disabled)return false;
 const active=skillActive(player,'anchor');
 if(active)removeTraitSource(player,ANCHOR_SOURCE);
 else if(!grantTrait(player,'clumsy',ANCHOR_SOURCE))return false;
 player.skillState.anchor.remaining=active?0:1;return true;
}
export function validAnchor(player){
 const traits=player.traits.filter(t=>t.source===ANCHOR_SOURCE);
 return skillActive(player,'anchor')?traits.length===1&&traits[0].id==='clumsy'&&traits[0].turns===undefined:traits.length===0;
}
