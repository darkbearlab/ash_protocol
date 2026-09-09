// Independent passive rules. Sources persist even when opposite effects cancel.
export const TRAITS={
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
