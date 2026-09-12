// Stable resource IDs. `reserve` / item `ammo` remain rifle rounds for old tools.
// tint: one colour per ammunition type (3.50.1). The pack's reserve chips and each weapon card read it, so a
// weapon's colour tells you which reserve it drains. MELEE_TINT covers the weapons that never reload.
export const MELEE_TINT='#8ea88c';
export const AMMUNITION={
  pistol:{name:'手槍彈',short:'手槍彈',tint:'#7fa9dd',key:'pistol',item:'pistol',base:120,step:30,pickup:24},
  rifle:{name:'步槍彈',short:'步槍彈',tint:'#d9b46a',key:'reserve',item:'ammo',base:72,step:18,pickup:16},
  shell:{name:'霰彈',short:'霰彈',tint:'#e08a63',key:'shell',item:'shell',base:24,step:6,pickup:6},
  energy:{name:'能量電池',short:'電池',tint:'#62c6c9',key:'energy',item:'energy',base:36,step:9,pickup:12},
  ordnance:{name:'發射器榴彈',short:'榴彈',tint:'#b58ad8',key:'ordnance',item:'ordnance',base:8,step:2,pickup:4},
  grenade:{name:'手榴彈',short:'手榴彈',tint:'#c3cf7c',key:'grenades',item:'grenade',base:4,step:1,pickup:1}
};
export const AMMO_IDS=['pistol','rifle','shell','energy','ordnance'];
export const CARRY_COSTS=[20,40,70];
export const carryLevel=value=>Number.isInteger(value)?Math.max(0,Math.min(CARRY_COSTS.length,value)):0;
export const carryLevels=value=>Object.fromEntries(Object.keys(AMMUNITION).map(id=>[id,carryLevel(typeof value==='number'?value:value?.[id])]));
export const validCarryLevels=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===Object.keys(AMMUNITION).length&&Object.keys(AMMUNITION).every(id=>Object.hasOwn(value,id)&&Number.isInteger(value[id])&&value[id]>=0&&value[id]<=CARRY_COSTS.length);
export const carryingSpent=level=>CARRY_COSTS.slice(0,carryLevel(level)).reduce((sum,n)=>sum+n,0);
export const capacity=(type,levels=0)=>AMMUNITION[type].base+AMMUNITION[type].step*carryLevel(typeof levels==='number'?levels:levels?.[type]);
export const itemAmmo=type=>Object.keys(AMMUNITION).find(id=>AMMUNITION[id].item===type);
export const TERMINAL_AMMO={pistol:{amount:36,cost:10},rifle:{amount:24,cost:10},shell:{amount:8,cost:10},energy:{amount:12,cost:12},ordnance:{amount:3,cost:12}};
// Preserve the exact old total, apportioned by owned ballistic magazine sizes.
export function splitLegacyRounds(total,weapons,currentType='rifle'){
  const weights={};for(const w of weapons)if(['pistol','rifle','shell'].includes(w.ammoType))weights[w.ammoType]=(weights[w.ammoType]||0)+w.mag;
  if(!Object.keys(weights).length)weights.rifle=1;
  const sum=Object.values(weights).reduce((a,b)=>a+b,0),result={pistol:0,rifle:0,shell:0};
  const ids=Object.keys(weights).sort((a,b)=>(b===currentType)-(a===currentType));
  for(const id of ids)result[id]=Math.floor(total*weights[id]/sum);
  let left=total-Object.values(result).reduce((a,b)=>a+b,0);
  for(let i=0;left>0;i++,left--)result[ids[i%ids.length]]++;
  return result;
}
