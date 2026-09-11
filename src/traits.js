import {ENEMY_TYPES} from './data.js';
// Independent passive rules. Sources persist even when opposite effects cancel.
export const TRAITS={
 difficult_healing:{name:'難以治療',text:'生命恢復在計入升級加成後減半，向下取整；不影響生命上限與護甲板。'},
  night_vision:{name:'夜視',text:'忽略目標暗區的射擊命中懲罰；會受震撼彈失能，不穿煙。'},
  infrared:{name:'紅外線',text:'看穿煙霧，仍受牆與門阻擋；會受震撼彈失能，不抵銷暗區懲罰。'},
  biological:{name:'生物',text:'會受到震撼彈的失能效果；可與機械同時存在。'},
  mechanical:{name:'機械',text:'會受到 EMP 的失能效果，電漿直擊增傷 20%；可與生物同時存在。'},
  heavy_armor:{name:'重裝防護',text:'直接傷害在固定裝甲後再減少 25%，向上取整；不抵擋環境或中毒。'},
  braced:{name:'架槍',text:'自己相對射擊目標受到掩體保護時，命中 +12。'},
  correction:{name:'著彈修正',short:'修正',text:'連續回合射擊同一敵人，後續命中每次 +8，最高 +24；未命中仍累積。'},
  sidestep:{name:'側身',text:'相對攻擊者主要橫向移動時，被射擊命中額外 −20；暴露時移動與側身合計至少 −42。'},
  quick_reload:{name:'快速裝填',short:'快填',text:'使用手槍彈的武器裝填不耗回合，仍消耗備彈。'},
  large:{name:'大型',opposite:'small',text:'被射擊命中率 +15 個百分點。'},
  small:{name:'小型',opposite:'large',text:'被射擊命中率 −15 個百分點。'},
  agile:{name:'敏捷',opposite:'clumsy',text:'移動時，對手射擊命中率 −35（原為 −22）。'},
  clumsy:{name:'笨拙',opposite:'agile',text:'移動時，對手射擊命中率 −9（原為 −22）。'},
  no_cover:{name:'無法利用掩體',short:'無掩體',text:'無法取得牆角／箱體的命中保護與減傷，牆壁仍阻擋視線。'},
  fast:{name:'快速',opposite:'slow',text:'快速階段行動，每回合仍只有一次行動。'},
  slow:{name:'緩速',opposite:'fast',text:'緩速階段行動；與快速同時存在時按普通速度結算。'},
 bloodlust:{name:'嗜血',text:'近戰造成的實際生命傷害，20% 回復為你的生命（不含溢出）。'},
 battle_spirit:{name:'戰意',text:'近戰擊殺 +1 層、最多 5 層，每層受到的直接傷害 −5%；5 回合沒有近戰擊殺後，每 2 回合掉一層。'},
 blade_stash:{name:'刃藏',text:'背包每有一把近戰武器（含斧頭），所有攻擊傷害 +10%、受到的直接傷害 −10%。'},
 ambush:{name:'伏擊',text:'目標失能、目標或你站在煙霧中、目標還沒發現你，或你站在暗處時，近戰傷害 ×1.5；每次觸發讓光學迷彩冷卻 −1（迷彩生效中不減）。'},
 duelist:{name:'單挑',text:'只有一名已發現你的敵人看得到你時，射擊與近戰迴避 +15。'},
};
export function hasTrait(actor,id){return (actor?.traits||[]).some(t=>t.id===id);}
export function activeTrait(actor,id){return hasTrait(actor,id)&&!hasTrait(actor,TRAITS[id]?.opposite);}
export const initiative=actor=>activeTrait(actor,'fast')?-1:activeTrait(actor,'slow')?1:0;
export const sizeModifier=actor=>activeTrait(actor,'large')?15:activeTrait(actor,'small')?-15:0;
export const movementModifier=actor=>activeTrait(actor,'agile')?13:activeTrait(actor,'clumsy')?-13:0;
export function traitLabels(actor){return [...new Set((actor?.traits||[]).map(t=>t.id))].map(id=>`${TRAITS[id].short||TRAITS[id].name}${activeTrait(actor,id)?'':'（抵銷）'}`);}
export function tickTraits(actor){actor.traits=(actor.traits||[]).flatMap(t=>t.turns===undefined?[t]:t.turns>1?[{...t,turns:t.turns-1}]:[]);}
export function validTraits(traits){return Array.isArray(traits)&&traits.length<=68&&traits.every(t=>t&&typeof t==='object'&&!Array.isArray(t)&&typeof t.id==='string'&&Object.hasOwn(TRAITS,t.id)&&typeof t.source==='string'&&/^[a-zA-Z0-9:_-]{1,100}$/.test(t.source)&&(t.turns===undefined||(Number.isInteger(t.turns)&&t.turns>0&&t.turns<=999)));}
export const bodyKeyword=type=>ENEMY_TYPES[type]?.mechanical?'mechanical':'biological';
export function startingTraits(type,floor=1){
  const ids=type==='drone'?['no_cover']:type==='brute'?['large']:type==='crawler'&&floor>=4?['fast']:[];
  if(type==='sniper')ids.push('night_vision');
  if(type==='warden')ids.push('infrared');
  ids.push(bodyKeyword(type));
  return ids.map(id=>({id,source:`enemy:${type}`}));
}
export function initiativeQueue(player,enemies,allies=[]){return [player,...allies.filter(a=>a.hp>0),...enemies.filter(e=>e.hp>0)].map((actor,index)=>({actor,index,speed:initiative(actor)})).sort((a,b)=>a.speed-b.speed||a.index-b.index);}

export function grantTrait(actor,id,source,turns){
  const trait={id,source,...(turns===undefined?{}:{turns})};if(!validTraits([trait]))return false;
  const traits=(actor.traits||[]).filter(t=>t.id!==id||t.source!==source);if(traits.length>=68)return false;
  actor.traits=[...traits,trait];return true;
}
export function removeTraitSource(actor,source){actor.traits=(actor.traits||[]).filter(t=>t.source!==source);}

export function correctionBonus(actor,targetId,turn){
  const c=actor.fireChain;
  return activeTrait(actor,'correction')&&c&&c.targetId===targetId&&(c.turn===turn||c.turn===turn-1)?c.count*8:0;
}
export function recordShot(actor,targetId,turn){
  if(!activeTrait(actor,'correction')){actor.fireChain=null;return;}
  const c=actor.fireChain;
  actor.fireChain={targetId,turn,count:c?.targetId===targetId&&c.turn===turn-1?Math.min(3,c.count+1):1};
}
export function sidestepPenalty(attacker,target){
  if(!target.moved||!activeTrait(target,'sidestep')||!target.moveDelta)return 0;
  const [mx,my]=target.moveDelta,dx=attacker.x-target.x,dy=attacker.y-target.y;
  return Math.abs(mx*dy-my*dx)>Math.abs(mx*dx+my*dy)?20:0;
}
export function validCombatMemory(actor,turn){
  const d=actor.moveDelta,c=actor.fireChain;
  return Array.isArray(d)&&d.length===2&&d.every(Number.isInteger)&&Math.abs(d[0])+Math.abs(d[1])<=1&&
    (c===null||(c&&typeof c==='object'&&!Array.isArray(c)&&typeof c.targetId==='string'&&c.targetId.length>0&&c.targetId.length<=100&&Number.isInteger(c.turn)&&c.turn>=1&&c.turn<=turn&&Number.isInteger(c.count)&&c.count>=1&&c.count<=3));
}

export const reduceDirectDamage=(actor,damage)=>activeTrait(actor,'heavy_armor')?Math.max(1,Math.ceil(damage*.75)):damage;

export const healingAmount=(actor,amount)=>activeTrait(actor,'difficult_healing')?Math.floor(amount/2):amount;
export function healActor(actor,amount){const before=actor.hp;actor.hp=Math.min(actor.maxHp,actor.hp+healingAmount(actor,amount));return actor.hp-before;}
