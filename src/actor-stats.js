import {CHARACTERS,validCharacter} from './characters.js';

// Independent attack channels. Optional per-actor adjustments are a saved hook
// for future equipment/status effects, never inferred from species or body size.
export const COMBAT_STATS=['rangedAccuracy','rangedEvasion','meleeAccuracy','meleeEvasion'];
export const validCombatModifiers=value=>value===undefined||(value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>COMBAT_STATS.includes(key)&&Number.isInteger(value[key])&&value[key]>=-100&&value[key]<=100));
export const actorStat=(actor,key)=>(validCharacter(actor?.character)?CHARACTERS[actor.character].combat?.[key]||0:0)+(actor?.combatModifiers?.[key]||0);
export const clampHit=chance=>Math.max(10,Math.min(99,chance));
export const meleeChance=(attacker,target,base=97)=>clampHit(base+actorStat(attacker,'meleeAccuracy')-actorStat(target,'meleeEvasion'));

const labels={rangedAccuracy:'射擊命中',rangedEvasion:'射擊迴避',meleeAccuracy:'近戰命中',meleeEvasion:'近戰迴避'};
export const combatStatSummary=actor=>COMBAT_STATS.filter(key=>actorStat(actor,key)!==0).map(key=>labels[key]+' '+(actorStat(actor,key)>0?'+':'')+actorStat(actor,key)).join(' · ')||'無額外命中／迴避修正';
