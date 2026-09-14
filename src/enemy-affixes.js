import {ENEMY_TYPES} from './data.js';
import {grantTrait,activeTrait} from './traits.js';
import {effectiveDepth} from './endless.js';
export const AFFIX_TUNING={startDepth:7,chancePerDepth:.04,chanceCap:.5,additionalFactor:.5,grenadeChance:.2,grenadeRange:5,grenadeRadius:1,grenadeDamage:32};
export const REVEAL_TYPES=Object.freeze({effect:'effect',scan:'scan',failed:'condition_failed'});
const armed=e=>['rifleman','raider','gunner','sniper'].includes(e.type);
const combatant=e=>!ENEMY_TYPES[e.type]?.expendable;
export const ENEMY_AFFIXES=[
 {id:'fast',fragment:'快速',order:0,applies:e=>combatant(e)&&!e.traits.some(t=>['fast','slow'].includes(t.id)),trait:'fast',reveal:REVEAL_TYPES.effect},
 {id:'infrared',fragment:'紅外線',order:1,applies:e=>combatant(e)&&!activeTrait(e,'infrared'),trait:'infrared',reveal:REVEAL_TYPES.effect},
 {id:'night_vision',fragment:'夜視',order:2,applies:e=>combatant(e)&&!activeTrait(e,'night_vision'),trait:'night_vision',reveal:REVEAL_TYPES.effect},
 {id:'suppressor',fragment:'壓制者',order:3,applies:armed,trait:'rapid_fire',reveal:REVEAL_TYPES.effect},
 {id:'grenadier',fragment:'擲彈兵',order:4,applies:armed,behavior:'grenade',reveal:REVEAL_TYPES.effect},
];
export const affixChance=(floor,offset=0)=>Math.min(AFFIX_TUNING.chanceCap,Math.max(0,effectiveDepth(floor,offset)-AFFIX_TUNING.startDepth+1)*AFFIX_TUNING.chancePerDepth);
export function birthRandom(seed,floor,id){let h=2166136261;for(const c of `${seed}:${floor}:${id}:enemy-v10`){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return ()=>{h=(h+0x6D2B79F5)>>>0;let t=Math.imul(h^h>>>15,h|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
export function giveEnemyAffix(e,id,revealed=false){const d=ENEMY_AFFIXES.find(a=>a.id===id);if(!d||(e.affixes||[]).some(a=>a.id===id))return false;e.affixes=[...(e.affixes||[]),{id,revealed}];if(d.trait)grantTrait(e,d.trait,`affix:${id}`);return true;}
export function rollEnemyAffixes(e,seed,floor,offset=0){e.affixes=[];const rng=birthRandom(seed,floor,e.id),pool=[...ENEMY_AFFIXES];let p=affixChance(floor,offset);while(pool.length&&rng()<p){const [d]=pool.splice(Math.floor(rng()*pool.length),1);if(d.applies(e))giveEnemyAffix(e,d.id);p*=AFFIX_TUNING.additionalFactor;}return e;}
export const revealedAffixes=e=>ENEMY_AFFIXES.filter(d=>e?.affixes?.some(a=>a.id===d.id&&a.revealed)).map(({id,fragment,order,reveal})=>({id,fragment,order,reveal}));
export const enemyDisplayName=e=>`${ENEMY_TYPES[e.type]?.name||'未知單位'}${revealedAffixes(e).map(d=>`・${d.fragment}`).join('')}${e.affixes?.some(a=>!a.revealed)?'？':''}`;
export function revealEnemyAffix(g,e,id){const a=e.affixes?.find(a=>a.id===id);if(!a||a.revealed)return false;a.revealed=true;g.enemyCallout?.(e,'affix_revealed',{affixId:id});return true;}
export function validEnemyAffixes(e){if(e.traits?.some(t=>t.source==='endless:elite'))return false;if(e.affixes===undefined)return !e.traits?.some(t=>t.source?.startsWith('affix:'));if(!Array.isArray(e.affixes)||e.affixes.length>ENEMY_AFFIXES.length||new Set(e.affixes.map(a=>a.id)).size!==e.affixes.length)return false;return e.affixes.every(a=>{const d=ENEMY_AFFIXES.find(d=>d.id===a.id);return d&&typeof a.revealed==='boolean'&&(!['suppressor','grenadier'].includes(a.id)||armed(e))&&(!d.trait||e.traits.some(t=>t.id===d.trait&&t.source===`affix:${a.id}`));})&&e.traits.filter(t=>t.source.startsWith('affix:')).every(t=>e.affixes.some(a=>t.source===`affix:${a.id}`&&ENEMY_AFFIXES.find(d=>d.id===a.id)?.trait===t.id));}
export function migrateEnemyAffixes(g){g.difficultyOffset=0;for(const e of [...g.enemies,...(g.allies||[]),...Object.values(g.floorStates||{}).flatMap(f=>f.enemies||[])]){const old=(e.traits||[]).filter(t=>t.source==='endless:elite');e.traits=(e.traits||[]).filter(t=>t.source!=='endless:elite');if(old.length)e.affixes=[];for(const t of old)giveEnemyAffix(e,t.id,true);}}
