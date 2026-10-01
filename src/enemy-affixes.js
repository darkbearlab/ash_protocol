import {t} from './i18n.js';
import {enemyFaction,factionDef,enemyBaseName} from './factions.js';
import {hasEnemyTag,isNoncombatant} from './enemy-data.js';
import {ENEMY_TYPES} from './data.js';
import {grantTrait,activeTrait} from './traits.js';
import {effectiveDepth,curveOf} from './endless.js';
// stunShare (3.188.0, user): the share of a grenadier's throws that are stun grenades (docs/ENEMY_AFFIXES.md).
export const AFFIX_TUNING={chanceCap:.5,additionalFactor:.5,grenadeChance:.2,grenadeRange:5,grenadeRadius:1,grenadeDamage:32,stunShare:1/3,
 // 投放 (3.103.0, user request) rolls on its own stream so the existing affix draws, and every map already
 // generated, stay bit-identical; only enemies that win this extra roll differ.
 // 3.212.0 rework (docs/ENEMY_VARIETY.md section 1): from the curve's varietyStart (hard floor 3, standard 5); each
 // deployer puts out one kind (DEPLOY_KINDS), deployerCharges in all, at most deployerLive of its own up at a time
 // (Claude's numbers; the user: 「只是不能無限生」). The per-depth chance and cap stay 3.103.0's (measured in
 // qa/results/2026-10-01-claude-3.212.0-deployer.md).
 deployerPerDepth:.03,deployerCap:.24,deployerRange:7,deployerFire:.35,deployerCharges:2,deployerLive:1,
 // 火焰兵 (3.203.0, docs/HAZARDS.md section 4). How often one is born and its armour are Claude's numbers (the user fixed
 // only "有裝甲"): from the curve's affixStart (standard floor 3) 2% a depth, at most 12% — about one a floor by floors
 // 5-6 of a standard run, where some fifteen soldiers qualify; armour 2, the top of the light band (rifle rounds and
 // energy full, pistol rounds and buckshot ×0.8; blades, blasts and fire −2). flamerBlast: the user's 30% that a defeated
 // flamer's tank goes up (else it drops its flamethrower), rolled on a hash of its own.
 flamerPerDepth:.02,flamerCap:.12,flamerArmor:2,flamerBlast:.3};
export const REVEAL_TYPES=Object.freeze({effect:'effect',scan:'scan',failed:'condition_failed'});
const armed=e=>hasEnemyTag(e,'armed');
const combatant=e=>!isNoncombatant(e)&&!ENEMY_TYPES[e.type]?.expendable;
// 3.204.0 review: a card may bar an affix (the loyalist bosses bar 快速 and 紅外線). The pick still spends its draw, as any
// affix that does not apply does, so every other roll on every floor stays as it was.
const barred=(e,id)=>Boolean(ENEMY_TYPES[e.type]?.barredAffixes?.includes(id));
const infected=e=>hasEnemyTag(e,'infected')&&Boolean(factionDef(enemyFaction(e))?.infectedAffixes);
// 投放 (3.212.0, docs/ENEMY_VARIETY.md section 1): the one kind a deployer puts out, the cards of the things your engineer
// makes — a drone, a loitering munition, a fixed turret, a bomb bot. Fixed at birth on a stream of its own
// ('deployer-kind-v1', so no other draw moves) and saved on the unit (`deployKind`, a card id; only ever appended to),
// with its charges left (`deployCharges`). The name shows the kind once the affix is revealed (its first deployment).
export const DEPLOY_KINDS=Object.freeze(['drone','munition','turret','bomber_bot']);
const DEPLOY_FRAGMENTS=Object.freeze({drone:'enemyAffixes.deployer.drone',munition:'enemyAffixes.deployer.munition',turret:'enemyAffixes.deployer.turret',bomber_bot:'enemyAffixes.deployer.bomber_bot'});
export const deploys=e=>Boolean(e?.affixes?.some(a=>a.id==='deployer'));
export const deployKindOf=(seed,floor,id)=>DEPLOY_KINDS[Math.floor(birthRandom(seed,floor,id,'deployer-kind-v1')()*DEPLOY_KINDS.length)];
export function armDeployer(e,kind){if(!deploys(e)||!DEPLOY_KINDS.includes(kind))return false;e.deployKind=kind;e.deployCharges=AFFIX_TUNING.deployerCharges;return true;}
export const ENEMY_AFFIXES=[
 {id:'fast',fragment:t('enemyAffixes.fast.fragment'),order:0,applies:e=>combatant(e)&&!barred(e,'fast')&&!e.traits.some(t=>['fast','slow'].includes(t.id)),trait:'fast',reveal:REVEAL_TYPES.effect},
 {id:'infrared',fragment:t('enemyAffixes.infrared.fragment'),order:1,applies:e=>combatant(e)&&!barred(e,'infrared')&&!activeTrait(e,'infrared'),trait:'infrared',reveal:REVEAL_TYPES.effect},
 {id:'night_vision',fragment:t('enemyAffixes.night_vision.fragment'),order:2,applies:e=>combatant(e)&&!activeTrait(e,'night_vision'),trait:'night_vision',reveal:REVEAL_TYPES.effect},
 // 3.203.0: a flamer has no gun left to fire faster or a hand free to throw, so an elite flamer's top-up skips these two.
 {id:'suppressor',fragment:t('enemyAffixes.suppressor.fragment'),order:3,applies:e=>armed(e)&&!isFlamer(e),trait:'rapid_fire',reveal:REVEAL_TYPES.effect},
 {id:'grenadier',fragment:t('enemyAffixes.grenadier.fragment'),order:4,applies:e=>armed(e)&&!isFlamer(e),behavior:'grenade',reveal:REVEAL_TYPES.effect},
 {id:'venomous',fragment:t('enemyAffixes.venomous.fragment'),order:5,applies:infected,infection:true,reveal:REVEAL_TYPES.effect},
 {id:'brood_host',fragment:t('enemyAffixes.brood_host.fragment'),order:6,applies:infected,infection:true,reveal:REVEAL_TYPES.effect},
 // Puts out units of its one kind (DEPLOY_KINDS). The range bar keeps it off the raider: a rusher that launches and then
 // closes would put the player in two jaws at once. 3.212.0 (Claude's call, as for 火焰兵): never an infected soldier —
 // the infected do not work machines.
 {id:'deployer',fragment:t('enemyAffixes.deployer.fragment'),fragmentOf:e=>DEPLOY_FRAGMENTS[e?.deployKind]?t(DEPLOY_FRAGMENTS[e.deployKind]):null,order:7,applies:e=>armed(e)&&!hasEnemyTag(e,'infected')&&(ENEMY_TYPES[e.type]?.range??0)>=6,special:true,spawns:DEPLOY_KINDS,reveal:REVEAL_TYPES.effect},
 // 火焰兵 (3.203.0, user design 2026-09-29, docs/HAZARDS.md section 4): the gun is swapped for a flamethrower outright; it
 // only sprays fire (src/enemy-behavior.js flamerAct) and wears armour (enemyArmor). Special, rolled last on its own
 // stream, so every other affix on every floor stays as it was. Claude's call on who: an armed soldier with no behaviour
 // of its own (not the sniper, the squad leader or the enforcer), not an infected one, and not one already carrying a gun
 // affix (壓制者, 擲彈兵, 投放).
 {id:'flamer',fragment:t('enemyAffixes.flamer.fragment'),order:8,applies:e=>armed(e)&&!ENEMY_TYPES[e.type]?.behavior&&!hasEnemyTag(e,'infected')&&!e.affixes?.some(a=>['suppressor','grenadier','deployer'].includes(a.id)),special:true,reveal:REVEAL_TYPES.effect},
];
export const isFlamer=e=>Boolean(e?.affixes?.some(a=>a.id==='flamer'));
// An enemy's armour: its card's, or a flamer's own when that is more (3.203.0).
// 3.206.0: an overheated arsonist (src/rebel-bosses.js, `overheat` while it vents) has none at all.
export const enemyArmor=e=>e?.overheat>0?0:Math.max(ENEMY_TYPES[e?.type]?.armor||0,isFlamer(e)?AFFIX_TUNING.flamerArmor:0);
// 3.137.0: where affixes and deployers begin, and how fast they climb, belong to the difficulty curve (src/endless.js).
// 3.212.0: deployers from the curve's varietyStart, the start shared by the enemy-variety affixes.
export const deployerChance=(floor,d)=>Math.min(AFFIX_TUNING.deployerCap,Math.max(0,effectiveDepth(floor,d)-curveOf(d).varietyStart+1)*AFFIX_TUNING.deployerPerDepth);
export const flamerChance=(floor,d)=>Math.min(AFFIX_TUNING.flamerCap,Math.max(0,effectiveDepth(floor,d)-curveOf(d).affixStart+1)*AFFIX_TUNING.flamerPerDepth);
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
 if(deployer.applies(e)&&birthRandom(seed,floor,e.id,'deployer-v1')()<deployerChance(floor,offset)&&giveEnemyAffix(e,'deployer'))armDeployer(e,deployKindOf(seed,floor,e.id));   // the kind: 3.212.0
 if(ENEMY_AFFIXES.find(d=>d.id==='flamer').applies(e)&&birthRandom(seed,floor,e.id,'flamer-v1')()<flamerChance(floor,offset))giveEnemyAffix(e,'flamer');   // 3.203.0
 return e;}
// 3.212.0: an affix may name itself per unit (`fragmentOf`: a deployer's kind).
export const revealedAffixes=e=>ENEMY_AFFIXES.filter(d=>e?.affixes?.some(a=>a.id===d.id&&a.revealed)).map(({id,fragment,fragmentOf,order,reveal})=>({id,fragment:fragmentOf?.(e)??fragment,order,reveal}));
// 3.166.0: the name is composed from parts (base, revealed fragments, an unknown mark), so the target card can shorten
// it without taking the string apart and another language can order the parts its own way.
export const enemyNameParts=e=>({base:enemyBaseName(e),fragments:revealedAffixes(e).map(d=>d.fragment),unknown:Boolean(e.affixes?.some(a=>!a.revealed))});
export const composeEnemyName=({base,fragments,unknown},cut=false)=>t('enemy-affixes.name',{base,affixes:fragments.map(fragment=>t('enemy-affixes.fragment',{fragment})).join(''),cut:cut?t('enemy-affixes.cut'):'',unknown:unknown?t('enemy-affixes.unknown'):''});
export const enemyDisplayName=e=>composeEnemyName(enemyNameParts(e));
export function revealEnemyAffix(g,e,id){const a=e.affixes?.find(a=>a.id===id);if(!a||a.revealed)return false;a.revealed=true;g.enemyCallout?.(e,'affix_revealed',{affixId:id});return true;}
export function validEnemyAffixes(e){if(e.traits?.some(t=>t.source==='endless:elite'))return false;if(e.affixes===undefined)return !e.traits?.some(t=>t.source?.startsWith('affix:'));if(!Array.isArray(e.affixes)||e.affixes.length>ENEMY_AFFIXES.length||new Set(e.affixes.map(a=>a.id)).size!==e.affixes.length)return false;if(isFlamer(e)&&e.affixes.some(a=>['suppressor','grenadier','deployer'].includes(a.id)))return false;return e.affixes.every(a=>{const d=ENEMY_AFFIXES.find(d=>d.id===a.id);return d&&(!d.infection||infected(e))&&typeof a.revealed==='boolean'&&(!['suppressor','grenadier','flamer'].includes(a.id)||armed(e))&&(!d.trait||e.traits.some(t=>t.id===d.trait&&t.source===`affix:${a.id}`));})&&e.traits.filter(t=>t.source.startsWith('affix:')).every(t=>e.affixes.some(a=>t.source===`affix:${a.id}`&&ENEMY_AFFIXES.find(d=>d.id===a.id)?.trait===t.id));}
export function migrateEnemyAffixes(g){g.difficultyOffset=0;for(const e of [...g.enemies,...(g.allies||[]),...Object.values(g.floorStates||{}).flatMap(f=>f.enemies||[])]){const old=(e.traits||[]).filter(t=>t.source==='endless:elite');e.traits=(e.traits||[]).filter(t=>t.source!=='endless:elite');if(old.length)e.affixes=[];for(const t of old)giveEnemyAffix(e,t.id,true);}}
