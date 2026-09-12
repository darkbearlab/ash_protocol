import {GRAPPLE_RANGE,GRAPPLE_COOLDOWN,CAMO_DURATION,CAMO_COOLDOWN,MELEE_TUNING} from './melee-classes.js';
import {grantTrait,removeTraitSource} from './traits.js';
import {TETHER,CARRY_DISTANCE,SUMMON_LIMIT,SUMMON_INTERVAL,SUMMON_TETHER,RALLY_TURNS,PET_TETHER,PET_REGEN,PET_MEDKIT_FRACTION,DRONE_HP,DRONE_BUILD_COST,SENTRY_ARMOR,allyWeapon} from './allies.js';
import {classPerkRank,CLASS_PERK_TUNING} from './class-perks.js';
// Ally skill texts read the tuning constants, so a balance change cannot leave them stale (3.44).
const FOLLOW=allyWeapon({kind:'drone',sourceId:'drone_follow'}),SENTRY=allyWeapon({kind:'drone',sourceId:'drone_sentry'});
// Active skills are separate from passive traits and item quantities.
export const SKILLS={
 anchor:{name:'下錨',short:'下錨',icon:'◇',action:'skill',toggle:true,cost:1,duration:1,cooldown:0,text:'啟動／解除各 1 回合。下錨時不能移動或換層，套用笨拙；自己的武器射擊與近戰於普通與緩速各執行一次，分別消耗彈藥；投擲物與友軍不受影響。'},
 drone_follow:{name:'追隨僚機',short:'僚機',icon:'◇',action:'skill',cost:1,duration:0,cooldown:0,text:`一台機體，部署／靠近回收各 1 回合；部署或生產時點選你身邊 2 步內的位置。${DRONE_HP} HP，步槍彈 ${FOLLOW.mag} 發、射程 ${FOLLOW.range}。閒置時貼在你身邊，可隨時換位；離你 ${CARRY_DISTANCE} 步內會自己用你的步槍備彈換彈。繩索 ${TETHER} 格，不主動追擊；受傷時回收後到技能頁花廢料維修，損毀後按技能花 ${DRONE_BUILD_COST} 廢料生產新機。`},
 drone_sentry:{name:'放置哨兵',short:'哨兵',icon:'▣',action:'skill',cost:1,duration:0,cooldown:0,text:`與追隨僚機共用機體。部署或生產時點選你身邊 2 步內的位置。${DRONE_HP} HP、裝甲 ${SENTRY_ARMOR}、可利用掩體；${SENTRY.mag} 發步槍彈、射程 ${SENTRY.range}，不移動；超出 ${TETHER} 格停止運作。${CARRY_DISTANCE} 格可通路內可回收、隨行並自己換彈；損毀後按技能花 ${DRONE_BUILD_COST} 廢料生產新機。`},
 pet_command:{name:'伴生指揮',short:'指揮',icon:'♧',action:'skill',cost:0,duration:0,cooldown:0,card:'指令免費 · 回收／醫療包 1 回合',text:`點技能後選已探索 ${TETHER} 格內位置，或點自己召回；指令免費，下次寵物行動執行。寵物追擊 ${PET_TETHER} 格內敵人。倒地後同格或相鄰按技能花 1 回合回收，不耗醫療包；收納中每回合回 ${PET_REGEN} 生命，回滿且本技能預備中自行歸隊。收納時按技能可花醫療包 1、1 回合立即回 ${PET_MEDKIT_FRACTION*100}% 生命。`},
 // The cooldown field is the rising timer, so it must be able to hold SUMMON_INTERVAL; saves are validated against it.
 raise_dead:{name:'亡者集結',short:'集結',icon:'♧',action:'skill',cost:0,duration:0,cooldown:SUMMON_INTERVAL,card:`每 ${SUMMON_INTERVAL} 回合自動起身 · 集結免費`,text:`被動：每 ${SUMMON_INTERVAL} 回合自動從本層倒下過的非頭目、非機械敵人中抽一隻起身（倒下越多的種類越常出現，屍體不消耗），最多 ${SUMMON_LIMIT} 隻，出現在你身邊、下回合才行動；生命同該物種（32～150），傷害取物種基礎值（不含深層加成），沒有裝甲；主動追擊離你 ${SUMMON_TETHER} 格內看得到的敵人。按技能免費集結：${RALLY_TURNS} 回合內召喚物停止追擊、回到你身邊，換層前使用。未同行者換層消失。`},
 early_warning:{name:'預警',short:'預警',icon:'⌖',action:'skill',cost:0,duration:1,cooldown:5,radius:8,text:'免費掃描 8 格內敵人，穿牆顯示當下位置光點，維持至下一次耗回合行動結束；不追蹤移動、不提供射線。被掃描敵人立刻得知你的位置。冷卻 5 次耗回合行動。'},signal_break:{name:'訊號斷層',short:'斷層',icon:'⌁',action:'skill',cost:0,duration:3,cooldown:6,text:'免費啟動，3 次耗回合行動內敵人無法更新你的位置；仍會搜索最後目擊處。冷卻從啟動起算 6 次耗回合行動。已鎖定的狙擊與轟炸仍會落下，下樓結束效果但不重置冷卻。'},
 grapple:{name:'鉤鎖',short:'鉤鎖',icon:'◇',action:'skill',cost:1,duration:0,cooldown:GRAPPLE_COOLDOWN,text:`鉤住目前鎖定、${GRAPPLE_RANGE} 格內看得到的敵人（可斜向）：一般敵人拉到你身邊，大型與頭目改由你衝過去，到位後用斧頭砍一刀。花 1 回合，冷卻 ${GRAPPLE_COOLDOWN}（含施放回合）。沒有落點時不能使用、不花回合。`},
 camouflage:{name:'光學迷彩',short:'迷彩',icon:'◇',action:'skill',cost:0,duration:CAMO_DURATION,cooldown:CAMO_COOLDOWN,cooldownAfterEffect:true,text:`免費啟動。接下來 ${CAMO_DURATION} 次付費行動內，敵人對你的射擊與近戰命中 −${MELEE_TUNING.camoEvasion}，攻擊不會解除。效果結束後才開始冷卻 ${CAMO_COOLDOWN} 回合，伏擊可縮短。迷彩不會讓敵人看不到你。`},
};
export const initialSkillState=ids=>Object.fromEntries(ids.map(id=>[id,{remaining:0,cooldown:0}]));
export const skillActive=(player,id='signal_break')=>(player.skillState?.[id]?.remaining||0)>0;
export function skillValues(player,id){const d=SKILLS[id],rank=classPerkRank(player,id==='early_warning'?'soldier_overwatch':id==='signal_break'?'recon_blackout':id==='camouflage'?'ninja_overload':'');if(id==='early_warning')return {...d,radius:d.radius+rank*CLASS_PERK_TUNING.overwatchRadius,cooldown:Math.max(2,d.cooldown-rank*CLASS_PERK_TUNING.overwatchCooldown)};if(id==='signal_break')return {...d,duration:d.duration+rank*CLASS_PERK_TUNING.blackoutDuration,cooldown:Math.max(3,d.cooldown-rank*CLASS_PERK_TUNING.blackoutCooldown)};if(id==='camouflage')return {...d,duration:d.duration+rank*CLASS_PERK_TUNING.overloadDuration,cooldown:Math.max(4,d.cooldown-rank*CLASS_PERK_TUNING.overloadCooldown)};return d;}
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
