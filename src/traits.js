// Independent passive rules. Sources persist even when opposite effects cancel.
export const TRAITS={
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
};
export function hasTrait(actor,id){return (actor?.traits||[]).some(t=>t.id===id);}
export function activeTrait(actor,id){return hasTrait(actor,id)&&!hasTrait(actor,TRAITS[id]?.opposite);}
export const initiative=actor=>activeTrait(actor,'fast')?-1:activeTrait(actor,'slow')?1:0;
export const sizeModifier=actor=>activeTrait(actor,'large')?15:activeTrait(actor,'small')?-15:0;
export const movementModifier=actor=>activeTrait(actor,'agile')?13:activeTrait(actor,'clumsy')?-13:0;
export function traitLabels(actor){return [...new Set((actor?.traits||[]).map(t=>t.id))].map(id=>`${TRAITS[id].short||TRAITS[id].name}${activeTrait(actor,id)?'':'（抵銷）'}`);}
export function tickTraits(actor){actor.traits=(actor.traits||[]).flatMap(t=>t.turns===undefined?[t]:t.turns>1?[{...t,turns:t.turns-1}]:[]);}
export function validTraits(traits){return Array.isArray(traits)&&traits.length<=64&&traits.every(t=>t&&typeof t==='object'&&!Array.isArray(t)&&typeof t.id==='string'&&Object.hasOwn(TRAITS,t.id)&&typeof t.source==='string'&&/^[a-zA-Z0-9:_-]{1,100}$/.test(t.source)&&(t.turns===undefined||(Number.isInteger(t.turns)&&t.turns>0&&t.turns<=999)));}
export function startingTraits(type,floor=1){
  const ids=type==='drone'?['no_cover']:type==='brute'?['large']:type==='crawler'&&floor>=4?['fast']:[];
  return ids.map(id=>({id,source:`enemy:${type}`}));
}
export function initiativeQueue(player,enemies){return [player,...enemies.filter(e=>e.hp>0)].map((actor,index)=>({actor,index,speed:initiative(actor)})).sort((a,b)=>a.speed-b.speed||a.index-b.index);}

export function grantTrait(actor,id,source,turns){
  const trait={id,source,...(turns===undefined?{}:{turns})};if(!validTraits([trait]))return false;
  const traits=(actor.traits||[]).filter(t=>t.id!==id||t.source!==source);if(traits.length>=64)return false;
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
