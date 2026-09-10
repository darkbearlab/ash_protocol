// Active skills are separate from passive traits and item quantities.
export const SKILLS={
 drone_follow:{name:'追隨僚機',short:'僚機',icon:'◇',action:'skill',cost:1,duration:0,cooldown:0,text:'一台機體，部署／靠近回收各 1 回合；回收補手槍彈，45 HP／12 發／射程 5。繩索 6 格，不主動追擊，損毀後相鄰回收殘骸，收納後到技能頁花廢料維修。'},
 drone_sentry:{name:'放置哨兵',short:'哨兵',icon:'▣',action:'skill',cost:1,duration:0,cooldown:0,text:'與追隨僚機共用機體。45 HP／8 發步槍彈／射程 7，不移動；超出 6 格停止運作。3 格可通路內可回收或隨行；殘骸須相鄰回收，收納後可維修。'},
 pet_command:{name:'伴生指揮',short:'指揮',icon:'♧',action:'skill',cost:0,duration:0,cooldown:0,text:'點技能後選已探索 6 格內位置，或點自己召回；指令免費，下次寵物行動執行。倒地時靠近消耗醫療包 1、花 1 回合救援至半血。'},
 raise_dead:{name:'死者徵召',short:'徵召',icon:'♧',action:'skill',cost:1,duration:0,cooldown:4,text:'消耗本層非頭目屍體隨機補至兩隻召喚物。花 1 回合，冷卻 4（含施放輪）。召喚物不掉落、不能再作素材，未同行換層消失。'},
 early_warning:{name:'預警',short:'預警',icon:'⌖',action:'skill',cost:0,duration:1,cooldown:5,radius:8,text:'免費掃描 8 格內敵人，穿牆顯示當下位置光點，維持至下一次耗回合行動結束；不追蹤移動、不提供射線。被掃描敵人立刻得知你的位置。冷卻 5 次耗回合行動。'},signal_break:{name:'訊號斷層',short:'斷層',icon:'⌁',action:'skill',cost:0,duration:3,cooldown:6,text:'免費啟動，3 次耗回合行動內敵人無法更新你的位置；仍會搜索最後目擊處。冷卻從啟動起算 6 次耗回合行動。已鎖定的狙擊與轟炸仍會落下，下樓結束效果但不重置冷卻。'}};
export const initialSkillState=ids=>Object.fromEntries(ids.map(id=>[id,{remaining:0,cooldown:0}]));
export const skillActive=(player,id='signal_break')=>(player.skillState?.[id]?.remaining||0)>0;
export const canUseSkill=(player,id)=>Object.hasOwn(SKILLS,id)&&player.skills.includes(id)&&player.prepared.skill===id&&!player.skillState?.[id]?.remaining&&!player.skillState?.[id]?.cooldown;
export function skillStatus(player,id){const state=player.skillState?.[id];return state?.remaining?`生效 ${state.remaining}`:state?.cooldown?`冷卻 ${state.cooldown}`:'就緒';}
export function tickSkills(player){for(const state of Object.values(player.skillState)){state.remaining=Math.max(0,state.remaining-1);state.cooldown=Math.max(0,state.cooldown-1);}}
export function endSkillEffects(player){for(const state of Object.values(player.skillState))state.remaining=0;}
export function validSkillState(player){
  const states=player.skillState;
  if(!states||typeof states!=='object'||Array.isArray(states)||Object.keys(states).length!==player.skills.length)return false;
  return player.skills.every(id=>{
    const state=states[id],def=SKILLS[id];
    return def&&state&&typeof state==='object'&&!Array.isArray(state)&&Object.keys(state).length===2&&
      Number.isInteger(state.remaining)&&state.remaining>=0&&state.remaining<=def.duration&&Number.isInteger(state.cooldown)&&state.cooldown>=state.remaining&&state.cooldown<=def.cooldown;
  });
}
