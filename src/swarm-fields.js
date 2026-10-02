// The swarm's ground effects (3.134.0, user design 2026-09-18, docs/SWARM_FIELDS.md): more kinds of fight, not bigger
// numbers. A spore bomber leaves toxic mist, an acid pool or one-way spore smoke where it bursts, and the spitter can
// lob toxic mist on the ground — onto a player who hides from it, or between the player and its advancing kin.
// Mist and spore smoke live in g.smoke with a `kind`, so saves, floor changes and retreats carry them like smoke.
// - 毒霧 (toxic): never blocks sight; touching it poisons (the player) or costs 1 hp a turn (the player's units);
//   gunfire and beams through it do half damage at half the hit chance; none of it touches the swarm.
// - 孢子煙 (spore): smoke that blinds only the player's side — the swarm sees straight through it.
// - 酸液 (acid): the existing acid hazard, one tile.
import {t} from './i18n.js';
import {areaCells,SMOKE_DURATION} from './throwables.js';
import {SWARM_TUNING} from './swarm-tuning.js';
import {pinned} from './suppression.js';
import {interruptEnemyIntent,enemyCallout,tickSpecials} from './enemy-intents.js';
import {enemyDisplayName,revealEnemyAffix} from './enemy-affixes.js';
import {activeTrait} from './traits.js';
import {enemyDef} from './enemy-data.js';
import {distance,key,swarmPayload,DIRECTIONS} from './world.js';
import {registerSpecial,registerStep,validSpecials,frames,INTERRUPT_REASONS,dropAttack} from './enemy-specials.js';

export const FIELD_TUNING=Object.freeze({radius:1,lobRange:6,lobCooldown:10,screenFrom:3});
export const PAYLOADS=Object.freeze(['toxic','acid','spore']);   // same list as world.js (import cycle)
export const payloadTrait=kind=>`payload_${kind}`;
// Swarm is the faction, whatever the card: infected soldiers and the spitter included.
export const isSwarm=a=>Boolean(a)&&a.faction==='swarm'&&typeof a.type==='string'&&!a.kind;
const cellsOf=(g,kind)=>new Set((g.smoke||[]).filter(s=>s.kind===kind).flatMap(s=>s.cells.map(key)));
export const inToxic=(g,pos)=>cellsOf(g,'toxic').has(key(pos));
// Every tile the straight line from a to b touches, both ends included.
export function lineCells(a,b){
 const out=new Map(),steps=Math.max(1,Math.abs(b.x-a.x),Math.abs(b.y-a.y))*4;
 for(let i=0;i<=steps;i++){const t=i/steps,x=Math.round(a.x+(b.x-a.x)*t),y=Math.round(a.y+(b.y-a.y)*t);out.set(`${x},${y}`,{x,y});}
 return [...out.values()];
}
// Gunfire and beams only (user decision): no melee, and grenades and grenade launchers are not slowed by mist.
export const ballistic=w=>Boolean(w)&&!w.melee&&!w.explosive&&!w.pointTarget&&!w.splash&&!w.unarmed;
export function toxicShot(g,attacker,target,weapon){
 if(!attacker||!target||isSwarm(attacker)||!ballistic(weapon))return false;
 const mist=cellsOf(g,'toxic');if(!mist.size)return false;
 return lineCells(attacker,target).some(q=>mist.has(key(q)));
}

// 酸血 Acid blood (3.220.0; docs/ENEMY_VARIETY.md 10.7): where it dies, acid on its tile and the four beside it (floor
// with nothing standing in as a hazard already), for ACID_BLOOD.turns rounds (`expires`; the spitter's pools stay). The
// usual acid rules: hurt and poisoned at the round's end on it, hazmat as ever. The affix shows as it spills.
export const ACID_BLOOD=Object.freeze({turns:4});
export function acidBloodDeath(g,e){
 if(!e?.affixes?.some(a=>a.id==='acid_blood'))return;revealEnemyAffix(g,e,'acid_blood');
 for(const q of [{x:e.x,y:e.y},...DIRECTIONS.map(([dx,dy])=>({x:e.x+dx,y:e.y+dy}))])if(g.grid[q.y]?.[q.x]===1&&!g.solid(q.x,q.y)&&!g.hazards.some(h=>h.x===q.x&&h.y===q.y))g.hazards.push({x:q.x,y:q.y,type:'acid',expires:g.turn+ACID_BLOOD.turns});
 g.log(t('acid.spill',{enemy:enemyDisplayName(e)}),true);
}
export const dryAcid=g=>{g.hazards=g.hazards.filter(h=>!Number.isInteger(h.expires)||h.expires>g.turn);};
export function spawnField(g,kind,center){
 if(kind==='acid'){
  if(g.grid[center.y]?.[center.x]===1&&!g.hazards.some(h=>h.x===center.x&&h.y===center.y))g.hazards.push({x:center.x,y:center.y,type:'acid'});
  return;
 }
 const cells=areaCells(g.grid,center,FIELD_TUNING.radius,g.barriers,g).filter(q=>g.grid[q.y]?.[q.x]===1);if(!cells.length)return;   // 3.164.0: mist lies on the floor
 g.smoke=[...g.smoke,{kind,cells,expires:g.turn+SMOKE_DURATION-1}];
 g.effects.push({type:'pulse',from:{x:center.x,y:center.y},to:{x:center.x,y:center.y},radius:FIELD_TUNING.radius,color:kind==='toxic'?'#a9d24f':'#c7a66b'});
}
// A swarm bomber's payload is fixed at birth by its id — no dice, so nothing else on the floor shifts.
export const payloadFor=id=>swarmPayload(id);
export function releasePayload(g,e){
 const kind=PAYLOADS.find(k=>activeTrait(e,payloadTrait(k)));if(!kind)return;
 spawnField(g,kind,e);
 g.log(kind==='toxic'?t('swarm-fields.toxicBurst'):kind==='acid'?t('swarm-fields.acidBurst'):t('swarm-fields.sporeBurst'),true);
}

// Contact: the player is poisoned for each turn it ends in mist; the player's units lose 1 hp in a turn they start in
// it or walk into it (user decision). The swarm never.
export function toxicPlayerTurn(g,addPoison){
 const p=g.player;if(p.hp<=0||!inToxic(g,p))return;
 if(addPoison(p,SWARM_TUNING.poisonHitStacks))g.log(t('swarm-fields.mistPoisoned'),true);else g.log(t('swarm-fields.mistImmune'));
}
export function toxicAllyTurn(g,a,wasIn){if(a.hp>0&&a.status==='active'&&(wasIn||inToxic(g,a)))g.damageAlly(a,1,null,false,true);}

// The spitter's lob (user decision: both uses, ten turns' cooldown). Announced a turn ahead like a grenade.
function lobPoint(g,e,p){
 const reach=q=>q&&g.grid[q.y]?.[q.x]===1&&distance(e,q)<=FIELD_TUNING.lobRange&&g.sight(e,q);
 // Flush out: it can see you but your cover keeps its spit off you.
 if(g.sight(e,p)&&(!g.shotClear(e,p)||g.protectingCover(p,e))&&reach(p))return {x:p.x,y:p.y};
 // Screen: the ground between you and the nearest of its kin still closing in.
 const kin=g.enemies.filter(o=>o!==e&&o.hp>0&&isSwarm(o)&&distance(o,p)>=FIELD_TUNING.screenFrom&&distance(o,p)<=8)
  .sort((a,b)=>distance(a,p)-distance(b,p)||a.id.localeCompare(b.id))[0];
 if(!kin)return null;
 const mid={x:Math.round((p.x+kin.x)/2),y:Math.round((p.y+kin.y)/2)};
 return reach(mid)&&distance(mid,p)>0?mid:null;
}
export function lobAction(ctx){
 const {g,e,p}=ctx;
 if(!enemyDef(e)?.lobs||!isSwarm(e)||p!==g.player)return false;
 if(pinned(e)){if(e.lobIntent)interruptEnemyIntent(e,'suppressed');return false;}
 if(e.lobIntent){
  const point=e.lobIntent.point;delete e.lobIntent;e.lobCooldown=FIELD_TUNING.lobCooldown;
  g.effects.push({type:'shot',style:'grenade',color:'#a9d24f',from:{x:e.x,y:e.y},to:{...point},damage:0});
  spawnField(g,'toxic',point);dropAttack(e);g.log(t('swarm-fields.lobbed',{enemy:enemyDisplayName(e)}),true);   // dropAttack: 3.206.2
  return true;
 }
 if((e.lobCooldown||0)>0)return false;
 const point=lobPoint(g,e,p);if(!point)return false;
 interruptEnemyIntent(e,'target_lost');e.lobIntent={origin:{x:e.x,y:e.y},point};
 g.effects.push({type:'enemyTelegraph',phase:'prepare',from:{x:e.x,y:e.y},to:{...point},damage:0});
 enemyCallout(g,e,'telegraph',{action:'grenade'});
 g.log(t('swarm-fields.swelling',{enemy:enemyDisplayName(e)}),true);
 return true;
}
// 3.206.1 (src/enemy-specials.js): the lob as the shared rules see it. Swelling, it cannot shoot a mine or step off a
// hazard, and a pin drops it; the round start counts its cooldown down and drops it for a fall, a stun or a pin.
// Saves (3.206.2, docs/CHECKLIST.md 3): a swelling its spitter could no longer spit (fallen, stunned, pinned, or moved
// off the tile it swelled on) is dropped and the cooldown restarts, and a cooldown past the tuning is cut to it — they
// used to refuse the run. A malformed one is still refused. An interruption restarts the cooldown at
// FIELD_TUNING.lobCooldown (3.206.2: it was a literal 10, the same number).
const live=e=>e?.hp>0&&!e.control?.disabled;
const whole=q=>Boolean(q&&typeof q==='object'&&Number.isInteger(q.x)&&Number.isInteger(q.y));
const staleSwell=e=>{const s=e.lobIntent;return Boolean(s&&typeof s==='object'&&whole(s.origin)&&!(live(e)&&!pinned(e)&&s.origin.x===e.x&&s.origin.y===e.y));};
registerSpecial({id:'lob',intent:'lobIntent',carries:e=>Boolean(enemyDef(e)?.lobs)&&isSwarm(e),
 fields:{
  lobIntent:{valid:(s,e,f)=>{const pt=q=>q&&Number.isInteger(q.x)&&Number.isInteger(q.y)&&f.grid?.[q.y]?.[q.x]===1;return !(!s||!enemyDef(e)?.lobs||e.hp<=0||!pt(s.origin)||!pt(s.point)||key(s.origin)!==key(e)||distance(s.origin,s.point)>FIELD_TUNING.lobRange);}},
  lobCooldown:{count:{max:()=>FIELD_TUNING.lobCooldown,clamp:'cut'}},
 },
 interrupt:{on:INTERRUPT_REASONS,cooldown:'lobCooldown'},
 tick:{cooldown:'lobCooldown',drop:e=>e.hp<=0?'death':e.control?.disabled?'disabled':pinned(e)?'suppressed':null},
 blocks:{mine:true,stepOff:true,pin:true},
 load:{stale:staleSwell,restart:'lobCooldown'},
 card:(g,e)=>[e.lobIntent?t('target-card.swelling'):''],   // 3.206.2
});
registerStep('top','lob',lobAction,e=>Boolean(enemyDef(e)?.lobs)&&isSwarm(e));
export const tickFields=g=>tickSpecials(g,[['lob']]);
// Saves: the kinds of smoke (validFieldSmoke; the loader checks the lob with the other specials); validFields is both.
export const validFieldSmoke=g=>!frames(g).some(f=>(f.smoke||[]).some(s=>s.kind!==undefined&&!['toxic','spore','haze','steam'].includes(s.kind)));   // haze, steam: 3.202.0 vents
export const validFields=g=>validFieldSmoke(g)&&validSpecials(g,['lob']);
