// Stable resource IDs. `reserve` / item `ammo` remain rifle rounds for old tools.
// tint: one colour per ammunition type (3.50.1). The pack's reserve chips and each weapon card read it, so a
// weapon's colour tells you which reserve it drains. MELEE_TINT covers the weapons that never reload.
import {t} from './i18n.js';
export const MELEE_TINT='#8ea88c';
// 3.115.0 (user decision; qa/results/2026-09-17-claude-shotgun-supply.md): every shell source doubled and every battery
// source raised by half, the least that let a shotgun or plasma bot that cannot die stop running dry. Start loadouts
// and carry capacity are unchanged.
// 3.185.0 (user, plan C): rifle rounds x3 and pistol rounds x2 everywhere they come from, since the rifle now fires 3 a
// trigger and the SMG 4 instead of 2 — the number of triggers you can pull stays what it was.
export const AMMUNITION={
  pistol:{name:t('ammunition.pistol.name'),short:t('ammunition.pistol.short'),tint:'#7fa9dd',key:'pistol',item:'pistol',base:240,step:60,pickup:48},
  rifle:{name:t('ammunition.rifle.name'),short:t('ammunition.rifle.short'),tint:'#d9b46a',key:'reserve',item:'ammo',base:216,step:54,pickup:48},
  shell:{name:t('ammunition.shell.name'),short:t('ammunition.shell.short'),tint:'#e08a63',key:'shell',item:'shell',base:24,step:6,pickup:12},
  energy:{name:t('ammunition.energy.name'),short:t('ammunition.energy.short'),tint:'#62c6c9',key:'energy',item:'energy',base:36,step:9,pickup:18},
  ordnance:{name:t('ammunition.ordnance.name'),short:t('ammunition.ordnance.short'),tint:'#b58ad8',key:'ordnance',item:'ordnance',base:8,step:2,pickup:4},
  grenade:{name:t('ammunition.grenade.name'),short:t('ammunition.grenade.short'),tint:'#c3cf7c',key:'grenades',item:'grenade',base:4,step:1,pickup:1}
};
export const AMMO_IDS=['pistol','rifle','shell','energy','ordnance'];
// 3.185.0 (user, plan C; docs/WEAPONS.md): armor works on each kind of ammunition differently, for both sides. A round's
// damage is multiplied by its kind's factor for the target's armor (0, 1-2, 3-5, 6 and up) instead of losing a flat
// amount; a weapon's pierce pulls an armored factor back toward 1. Rifle rounds tear through an unarmored body and do
// most to light armor; pistol rounds and buckshot hurt flesh most and fall off fast against armor; energy ignores it.
// Explosions, melee and your plates keep their own rules.
export const AMMO_PROFILE=Object.freeze({rifle:[.8,1,.85,.6],pistol:[1.25,.8,.4,.15],shell:[1.15,.8,.4,.15],energy:[1,1,1,1]});
export const armorTier=a=>a<=0?0:a<=2?1:a<=5?2:3;
export function ammoMultiplier(ammo,armor,pierce=0){const c=AMMO_PROFILE[ammo];if(!c)return null;const m=c[armorTier(armor)];return armor>0?m+(1-m)*Math.min(1,pierce):m;}
// What an enemy's gun fires, by its card's projectile.
export const PROJECTILE_AMMO=Object.freeze({rifle:'rifle',sniper:'rifle',smg:'pistol',shotgun:'shell',plasma:'energy'});
// Rifle rounds through an armorless target fly on to the next unit on the line, at this share of the damage.
export const OVERPENETRATION=.5;
export const CARRY_COSTS=[20,40,70];
export const carryLevel=value=>Number.isInteger(value)?Math.max(0,Math.min(CARRY_COSTS.length,value)):0;
export const carryLevels=value=>Object.fromEntries(Object.keys(AMMUNITION).map(id=>[id,carryLevel(typeof value==='number'?value:value?.[id])]));
export const validCarryLevels=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===Object.keys(AMMUNITION).length&&Object.keys(AMMUNITION).every(id=>Object.hasOwn(value,id)&&Number.isInteger(value[id])&&value[id]>=0&&value[id]<=CARRY_COSTS.length);
export const carryingSpent=level=>CARRY_COSTS.slice(0,carryLevel(level)).reduce((sum,n)=>sum+n,0);
export const capacity=(type,levels=0)=>AMMUNITION[type].base+AMMUNITION[type].step*carryLevel(typeof levels==='number'?levels:levels?.[type]);
export const itemAmmo=type=>Object.keys(AMMUNITION).find(id=>AMMUNITION[id].item===type);
export const TERMINAL_AMMO={pistol:{amount:72,cost:10},rifle:{amount:72,cost:10},shell:{amount:16,cost:10},energy:{amount:18,cost:12},ordnance:{amount:3,cost:12}};
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
