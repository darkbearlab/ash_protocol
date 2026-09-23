import {t} from './i18n.js';
import {enemyFaction,factionDef,enemyBaseName} from './factions.js';
import {hasEnemyTag,isNoncombatant} from './enemy-data.js';
import {ENEMY_TYPES} from './data.js';
import {grantTrait,activeTrait} from './traits.js';
import {effectiveDepth,curveOf} from './endless.js';
export const AFFIX_TUNING={chanceCap:.5,additionalFactor:.5,grenadeChance:.2,grenadeRange:5,grenadeRadius:1,grenadeDamage:32,
 // 投放 (3.103.0, user request) rolls on its own stream so the existing affix draws, and every map already
 // generated, stay bit-identical; only enemies that win this extra roll differ.
 deployerPerDepth:.03,deployerCap:.24,deployerRange:7,deployerFire:.35};
export const REVEAL_TYPES=Object.freeze({effect:'effect',scan:'scan',failed:'condition_failed'});
const armed=e=>hasEnemyTag(e,'armed');
const combatant=e=>!isNoncombatant(e)&&!ENEMY_TYPES[e.type]?.expendable;
const infected=e=>hasEnemyTag(e,'infected')&&Boolean(factionDef(enemyFaction(e))?.infectedAffixes);
export const ENEMY_AFFIXES=[
 {id:'fast',fragment:'快速',order:0,applies:e=>combatant(e)&&!e.traits.some(t=>['fast','slow'].includes(t.id)),trait:'fast',reveal:REVEAL_TYPES.effect},
 {id:'infrared',fragment:'紅外線',order:1,applies:e=>combatant(e)&&!activeTrait(e,'infrared'),trait:'infrared',reveal:REVEAL_TYPES.effect},
 {id:'night_vision',fragment:'夜視',order:2,applies:e=>combatant(e)&&!activeTrait(e,'night_vision'),trait:'night_vision',reveal:REVEAL_TYPES.effect},
 {id:'suppressor',fragment:'壓制者',order:3,applies:armed,trait:'rapid_fire',reveal:REVEAL_TYPES.effect},
 {id:'grenadier',fragment:'擲彈兵',order:4,applies:armed,behavior:'grenade',reveal:REVEAL_TYPES.effect},
 {id:'venomous',fragment:'帶毒',order:5,applies:infected,infection:true,reveal:REVEAL_TYPES.effect},
 {id:'brood_host',fragment:'育蟲',order:6,applies:infected,infection:true,reveal:REVEAL_TYPES.effect},
 // Carries one loitering munition. The range bar keeps it off the raider: a rusher that launches and then closes
 // would put the player in two jaws at once.
 {id:'deployer',fragment:'投放',order:7,applies:e=>armed(e)&&(ENEMY_TYPES[e.type]?.range??0)>=6,special:true,spawns:'munition',reveal:REVEAL_TYPES.effect},
];
// 3.137.0: where affixes and deployers begin, and how fast they climb, belong to the difficulty curve (src/endless.js).
export const deployerChance=(floor,d)=>Math.min(AFFIX_TUNING.deployerCap,Math.max(0,effectiveDepth(floor,d)-curveOf(d).deployerStart+1)*AFFIX_TUNING.deployerPerDepth);
export const affixChance=(floor,d)=>Math.min(AFFIX_TUNING.chanceCap,Math.max(0,effectiveDepth(floor,d)-curveOf(d).affixStart+1)*curveOf(d).affixPerDepth);
export function birthRandom(seed,floor,id,salt='enemy-v10'){let h=2166136261;for(const c of `${seed}:${floor}:${id}:${salt}`){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return ()=>{h=(h+0x6D2B79F5)>>>0;let t=Math.imul(h^h>>>15,h|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
export function giveEnemyAffix(e,id,revealed=false){const d=ENEMY_AFFIXES.find(a=>a.id===id);if(!d||(e.affixes||[]).some(a=>a.id===id))return false;e.affixes=[...(e.affixes||[]),{id,revealed}];if(d.trait)grantTrait(e,d.trait,`affix:${id}`);return true;}
export function affixPickIndex(pool,draw,weights){
 if(!weights)return Math.floor(draw*pool.length);
 const total=pool.reduce((n,d)=>n+(weights[d.id]??1),0);let left=draw*total;
 for(let i=0;i<pool.length;i++){left-=weights[pool[i].id]??1;if(left<0)return i;}return pool.length-1;
}
export function rollEnemyAffixes(e,seed,floor,offset){e.affixes=[];if(isNoncombatant(e))return e;const rng=birthRandom(seed,floor,e.id),pool=ENEMY_AFFIXES.filter(d=>!d.infection&&!d.special),weights=factionDef(enemyFaction(e))?.affixWeights;let p=affixChance(floor,offset);while(pool.length&&rng()<p){const [d]=pool.splice(affixPickIndex(pool,rng(),weights),1);if(d.applies(e))giveEnemyAffix(e,d.id);p*=AFFIX_TUNING.additionalFactor;}if(infected(e))for(const id of factionDef(enemyFaction(e)).infectedAffixes)giveEnemyAffix(e,id);
 const deployer=ENEMY_AFFIXES.find(d=>d.id==='deployer');
 if(deployer.applies(e)&&birthRandom(seed,floor,e.id,'deployer-v1')()<deployerChance(floor,offset))giveEnemyAffix(e,'deployer');
 return e;}
export const revealedAffixes=e=>ENEMY_AFFIXES.filter(d=>e?.affixes?.some(a=>a.id===d.id&&a.revealed)).map(({id,fragment,order,reveal})=>({id,fragment,order,reveal}));
// 3.166.0: the name is composed from parts (base, revealed fragments, an unknown mark), so the target card can shorten
// it without taking the string apart and another language can order the parts its own way.
export const enemyNameParts=e=>({base:enemyBaseName(e),fragments:revealedAffixes(e).map(d=>d.fragment),unknown:Boolean(e.affixes?.some(a=>!a.revealed))});
export const composeEnemyName=({base,fragments,unknown},cut=false)=>t('enemy-affixes.name',{base,affixes:fragments.map(fragment=>t('enemy-affixes.fragment',{fragment})).join(''),cut:cut?t('enemy-affixes.cut'):'',unknown:unknown?t('enemy-affixes.unknown'):''});
export const enemyDisplayName=e=>composeEnemyName(enemyNameParts(e));
export function revealEnemyAffix(g,e,id){const a=e.affixes?.find(a=>a.id===id);if(!a||a.revealed)return false;a.revealed=true;g.enemyCallout?.(e,'affix_revealed',{affixId:id});return true;}
export function validEnemyAffixes(e){if(e.traits?.some(t=>t.source==='endless:elite'))return false;if(e.affixes===undefined)return !e.traits?.some(t=>t.source?.startsWith('affix:'));if(!Array.isArray(e.affixes)||e.affixes.length>ENEMY_AFFIXES.length||new Set(e.affixes.map(a=>a.id)).size!==e.affixes.length)return false;return e.affixes.every(a=>{const d=ENEMY_AFFIXES.find(d=>d.id===a.id);return d&&(!d.infection||infected(e))&&typeof a.revealed==='boolean'&&(!['suppressor','grenadier'].includes(a.id)||armed(e))&&(!d.trait||e.traits.some(t=>t.id===d.trait&&t.source===`affix:${a.id}`));})&&e.traits.filter(t=>t.source.startsWith('affix:')).every(t=>e.affixes.some(a=>t.source===`affix:${a.id}`&&ENEMY_AFFIXES.find(d=>d.id===a.id)?.trait===t.id));}
export function migrateEnemyAffixes(g){g.difficultyOffset=0;for(const e of [...g.enemies,...(g.allies||[]),...Object.values(g.floorStates||{}).flatMap(f=>f.enemies||[])]){const old=(e.traits||[]).filter(t=>t.source==='endless:elite');e.traits=(e.traits||[]).filter(t=>t.source!=='endless:elite');if(old.length)e.affixes=[];for(const t of old)giveEnemyAffix(e,t.id,true);}}
