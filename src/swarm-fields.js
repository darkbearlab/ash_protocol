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
import {interruptEnemyIntent,enemyCallout} from './enemy-intents.js';
import {enemyDisplayName} from './enemy-affixes.js';
import {activeTrait} from './traits.js';
import {enemyDef} from './enemy-data.js';
import {distance,key,swarmPayload} from './world.js';

export const FIELD_TUNING=Object.freeze({radius:1,lobRange:6,lobCooldown:10,screenFrom:3});
export const PAYLOADS=Object.freeze(['toxic','acid','spore']);   // same list as world.js (import cycle)
export const payloadTrait=kind=>`payload_${kind}`;
// Swarm is the faction, whatever the card: infected soldiers and the spitter included.
export const isSwarm=a=>Boolean(a)&&a.faction==='swarm'&&typeof a.type==='string'&&!a.kind;
const cellsOf=(g,kind)=>new Set((g.smoke||[]).filter(s=>s.kind===kind).flatMap(s=>s.cells.map(key)));
export const inToxic=(g,pos)=>cellsOf(g,'toxic').has(key(pos));
// Every tile the straight line from a to b touches, both ends included.
function lineCells(a,b){
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
 g.log(kind==='toxic'?'孢子囊破裂，毒霧散開。':kind==='acid'?'孢子囊破裂，地上濺滿酸液。':'孢子囊破裂，孢子煙遮住了你的視線。',true);
}

// Contact: the player is poisoned for each turn it ends in mist; the player's units lose 1 hp in a turn they start in
// it or walk into it (user decision). The swarm never.
export function toxicPlayerTurn(g,addPoison){
 const p=g.player;if(p.hp<=0||!inToxic(g,p))return;
 if(addPoison(p,SWARM_TUNING.poisonHitStacks))g.log('你吸進了毒霧，中毒了。',true);else g.log('毒霧對你無效。');
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
  spawnField(g,'toxic',point);g.log(t('swarm-fields.lobbed',{enemy:enemyDisplayName(e)}),true);
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
export function tickFields(g){
 for(const e of g.enemies){
  if(e.lobCooldown>0)e.lobCooldown--;
  if(e.lobIntent&&(e.hp<=0||e.control?.disabled||pinned(e)))interruptEnemyIntent(e,e.hp<=0?'death':e.control?.disabled?'disabled':'suppressed');
 }
}
export function validFields(g){
 const frames=[g,...Object.values(g.floorStates||{})];
 for(const f of frames){
  if((f.smoke||[]).some(s=>s.kind!==undefined&&!['toxic','spore'].includes(s.kind)))return false;
  for(const e of f.enemies||[]){
   if(e.lobCooldown!==undefined&&(!Number.isSafeInteger(e.lobCooldown)||e.lobCooldown<0||e.lobCooldown>FIELD_TUNING.lobCooldown))return false;
   if(e.lobIntent!==undefined){const s=e.lobIntent,pt=q=>q&&Number.isInteger(q.x)&&Number.isInteger(q.y)&&f.grid?.[q.y]?.[q.x]===1;
    if(!s||!enemyDef(e)?.lobs||e.hp<=0||!pt(s.origin)||!pt(s.point)||key(s.origin)!==key(e)||distance(s.origin,s.point)>FIELD_TUNING.lobRange)return false;}
  }
 }
 return true;
}
