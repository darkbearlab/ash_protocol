// Display-only helpers for druid feeding (3.72.1, Claude). Rules, prices and legality come from
// pet-growth.js quotes; nothing here recomputes them. Effect text reads PET_FEEDING_TUNING so it cannot drift.
import {AMMUNITION} from './ammunition.js';
import {GRENADES} from './throwables.js';
import {petNodes,PET_TETHER,PET_FEEDING_TUNING as T} from './pet-growth.js';

export const PET_LINE_NAMES={vitality:'體質',armor:'裝甲',turret:'砲台',extrusion:'排出'};
export const PET_LINE_TINTS={vitality:'#d98a7a',armor:'#92c4df',turret:'#d9b46a',extrusion:'#b8c694'};
const UNITS={vitality:'生命',armor:'板',turret:'價值',extrusion:'顆'};

export const rankDots=rank=>'◉'.repeat(rank)+'○'.repeat(Math.max(0,6-rank));
export const formatFuel=ticks=>String(Math.round(ticks/T.fuelScale*10)/10);
export const fuelLabel=state=>`燃料 ${formatFuel(state.fuel.stored)} / ${formatFuel(state.fuel.capacity)}`;
export const fuelPercent=state=>state.fuel.capacity?Math.round(state.fuel.stored/state.fuel.capacity*100):0;
export const lineProgress=(line,g)=>g.capped?'已滿六節點':`${g.progress} / ${g.nextThreshold} ${UNITS[line]}`;

export function lineEffects(line){
 return petNodes(null,line).map(n=>n.text);
}

export function petStatusLine(state){
 if(state.status==='reforming')return `消散中 · ${state.reviveRemaining} 個付費回合後在你身邊重生（${Math.round((state.reviveFraction??T.reviveFraction)*100)}% 生命），重生前不能餵`;
 if(state.status==='arriving')return '等候落點：身邊沒有空位，騰出相鄰格就會歸隊';
 return `活動中 · HP ${state.hp}/${state.maxHp}`;
}

// output.ready only means the timer reached zero; production still needs fuel, so never call it produced.
export function petOutputLine(state){
 if(!state.growth.extrusion.rank)return null;
 const name=GRENADES[state.output.kind]?.name||'投擲物',cost=formatFuel(state.output.fuelCost);
 if(state.status!=='active')return '排出暫停：獵獸歸隊後才會計時';
 if(state.output.ready)return state.fuel.stored>=state.output.fuelCost?`排出${name}：下一個付費回合結束時排出（耗燃料 ${cost}）`:`排出${name}：倒數已到，燃料不足（需要 ${cost}）`;
 return `排出${name}：${state.output.remaining} 個付費回合後（耗燃料 ${cost}）`;
}

const GROUPS=[
 ['fuel','燃料',id=>id.startsWith('ammo:')],
 ['growth','成長',id=>['life','plates','weapon'].includes(id)||id.startsWith('grenade:')],
 ['heal','治療',id=>id==='medkit'],
];
function optionView(option,gate,weaponName){
 const id=option.action.optionId,ok=option.allowed;let title=id,detail;
 if(id.startsWith('ammo:')){title=AMMUNITION[id.slice(5)].short;detail=ok?`${option.amount} 發 → 燃料 +${formatFuel(option.gain)}`:option.reason;}
 else if(id==='life'){title='生命';detail=ok?`−${option.cost} 生命 → 體質 +${option.gain}`:option.reason;}
 else if(id==='plates'){title='裝甲板';detail=ok?`−${option.cost} 板 → 裝甲 +${option.gain}`:option.reason;}
 else if(id==='weapon'){title=weaponName(option.action.weaponSlot);detail=ok?`整把 → 砲台 +${option.gain}`:option.reason;}
 else if(id.startsWith('grenade:')){title=GRENADES[id.slice(8)].short;detail=ok?`−1 → 排出 +${option.gain}`:option.reason;}
 else if(id==='medkit'){title='醫療包';detail=ok?`−1 → 獵獸 +${option.gain} 生命`:option.reason;}
 if(ok&&option.overflow)detail+=`（超出 ${option.overflow} 不計）`;
 return {id,title,detail:gate?'':detail||'',allowed:ok,weaponSlot:option.action.weaponSlot};
}
// When one shared gate (not adjacent, disabled, reforming) blocks everything, show it once instead of on every button.
export function feedGateReason(state){
 const reasons=state.options.map(o=>o.reason);
 return reasons.length&&!state.options.some(o=>o.allowed)&&reasons.every(r=>r===reasons[0])?reasons[0]:null;
}
export function feedingView(state,{weaponName=()=>'武器'}={}){
 const gate=feedGateReason(state);
 return {gate,groups:GROUPS.map(([id,label,match])=>({id,label,options:state.options.filter(o=>match(o.action.optionId)).map(o=>optionView(o,gate,weaponName))}))};
}

export function petHelpText(){
 return `餵養在背包技能頁：與獵獸上下左右相鄰、中間沒有門或隔板時，每次餵一份、花 1 回合。彈藥不限彈種，存進獨立的胃當燃料，寵物不會自己拿你的備彈；射擊與排出吃燃料，燃料不夠就只會咬。生命、裝甲板、武器、投擲物分別累積體質、裝甲、砲台、排出四條六節點成長（體質提高上限但不補當前生命）；醫療包只治療寵物。死亡時直接消散、胃清空、成長保留，${T.reviveTurns} 個付費回合後在你身邊以 ${Math.round(T.reviveFraction*100)}% 生命重生，重生前不能餵。`;
}

// Six-node tracks (3.73.1). Node names, texts and unlocks come from growth[line].nodes; nothing is recomputed.
export const nodeSymbol=n=>n.major?(n.unlocked?'◆':'◇'):(n.unlocked?'●':'○');
export const nextNode=g=>(g?.nodes||[]).find(n=>!n.unlocked)||null;
export const unlockedMajors=g=>(g?.nodes||[]).filter(n=>n.major&&n.unlocked).map(n=>n.name);

// Ability chips restate only what state.abilities reports.
export function abilityChips(state){
 const a=state?.abilities;if(!a)return [];
 const chips=[];
 if(a.steadfast)chips.push({id:'steadfast',text:'堅守中'});
 if(a.vision)chips.push({id:'vision',text:'共享夜視與紅外線'});
 else if((state.growth?.armor?.rank||0)>=6)chips.push({id:'vision-off',text:`共享視覺中斷：獵獸須活動且在 ${PET_TETHER} 格內`});
 if(a.sense?.unlocked)chips.push({id:'sense',text:a.sense.active?`感知 ${a.sense.radius} 格 · ${a.sense.remaining} 回合後掃描${a.sense.contacts.length?` · 標出 ${a.sense.contacts.length} 處`:''}`:'感知暫停：獵獸未活動'});
 for(const [key,name] of [['criticalSmoke','危急煙霧'],['guardianSmoke','守護煙霧']])if(a[key]?.unlocked)chips.push({id:key,text:`${name}：${a[key].used?'本層已用':'待命'}`});
 return chips;
}
