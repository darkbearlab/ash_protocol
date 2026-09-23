import {t} from './i18n.js';
import {suppressionPenalty} from './suppression.js';
import {CHARACTERS,validCharacter} from './characters.js';

// Independent attack channels. Optional per-actor adjustments are a saved hook
// for future equipment/status effects, never inferred from species or body size.
export const COMBAT_STATS=['rangedAccuracy','rangedEvasion','meleeAccuracy','meleeEvasion'];
export const validCombatModifiers=value=>value===undefined||(value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>COMBAT_STATS.includes(key)&&Number.isInteger(value[key])&&value[key]>=-100&&value[key]<=100));
// 3.127.2 (user decision): conscripts keep their numbers but not their aim — dragged-in shooters are worse shots. Read
// live from the flag, so conscripts in saves from 3.127.x get it too.
export const CONSCRIPT_ACCURACY=-20;
export const actorStat=(actor,key)=>(validCharacter(actor?.character)?CHARACTERS[actor.character].combat?.[key]||0:0)+(actor?.combatModifiers?.[key]||0)+(actor?.conscript&&key==='rangedAccuracy'?CONSCRIPT_ACCURACY:0)-(['rangedAccuracy','meleeAccuracy'].includes(key)?suppressionPenalty(actor):0)+(key==='rangedAccuracy'&&actor?.traits?.some(t=>t.id==='exoskeleton')?EXO_ACCURACY:0);
export const clampHit=chance=>Math.max(10,Math.min(99,chance));
// 3.144.0: a worn exoskeleton (src/field-gear.js) steadies the aim.
export const EXO_ACCURACY=10;
export const meleeChance=(attacker,target,base=97)=>clampHit(base+actorStat(attacker,'meleeAccuracy')-actorStat(target,'meleeEvasion'));

const labels={rangedAccuracy:t('labels.rangedAccuracy'),rangedEvasion:t('labels.rangedEvasion'),meleeAccuracy:t('labels.meleeAccuracy'),meleeEvasion:t('labels.meleeEvasion')};
export const combatStatSummary=actor=>COMBAT_STATS.filter(key=>actorStat(actor,key)!==0).map(key=>labels[key]+' '+(actorStat(actor,key)>0?'+':'')+actorStat(actor,key)).join(' · ')||t('actor-stats.none');
