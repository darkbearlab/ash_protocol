// 射線 (3.231.0, docs/FACTIONS.md 5.1 and 5.9): the rift's ranged pressure, the 射線體's beam. Seeing you 2 to `range`
// tiles off, with nothing standing between, it marks a straight line from itself through where you stand, on to its
// reach or the first wall, closed door, partition or object on a tile (cover, a crate, a barrel); it holds still that turn. On its next turn the beam goes along that line as the floor
// stands then (a door shut or cover put up in between stops it there) and hits every body of yours on it — you, your
// allies, your pets; enemy fire never hits enemies — for its damage, sure to hit (it is warned), armor and plates as for
// a blast. Step off the line and it hits nothing. Then `cooldown` turns before the next mark; in between it fights hand to
// hand like the other bodies.
// Numbers are Claude's (user: "你先定就做" for the rift), to be tuned after play.
import {t} from './i18n.js';
import {enemyDef} from './enemy-data.js';
import {seeThrough,SIZE} from './data.js';
import {interruptEnemyIntent,enemyCallout,tickSpecials} from './enemy-intents.js';
import {enemyDisplayName} from './enemy-affixes.js';
import {distance,key} from './world.js';
import {rayCells} from './line-move.js';
import {blockedBetween} from './barriers.js';
import {scaleEnemy,floorDamageBonus} from './endless.js';
import {registerSpecial,registerStep,validSpecials,dropAttack} from './enemy-specials.js';

export const BEAM_TUNING=Object.freeze({range:7,minRange:2,cooldown:2});
export const beams=e=>Boolean(enemyDef(e)?.beam);
// The tiles the beam crosses, in order: through `target` on to the reach, stopping before a wall, a tall object or a
// shut edge (the tongue's lane rules, src/swarm.js).
export const beamLane=(g,origin,target)=>rayCells(origin,target,BEAM_TUNING.range,q=>seeThrough(g.grid[q.y]?.[q.x])&&!g.solid(q.x,q.y),(a,b)=>blockedBetween(g.barriers,a,b,'shot'));
export function beamPlan(g,e){
 const p=g.player,d=distance(e,p);
 if(p.hp<=0||d<BEAM_TUNING.minRange||d>BEAM_TUNING.range||!g.sight(e,p))return null;
 if(!beamLane(g,e,p).some(q=>key(q)===key(p)))return null;
 return {origin:{x:e.x,y:e.y},target:{x:p.x,y:p.y}};
}
const beamDamage=(g,e)=>{const def=enemyDef(e),base=scaleEnemy(def.damage+floorDamageBonus(g.floor,g.difficultySpec),g.floor,'damage',g.difficultySpec);return e.damageScale===undefined?base:Math.max(1,Math.round(base*e.damageScale));};
function fire(g,e,s){
 delete e.beamIntent;e.beamCooldown=BEAM_TUNING.cooldown;dropAttack(e);
 const lane=beamLane(g,s.origin,s.target),end=lane[lane.length-1]||s.target,damage=beamDamage(g,e),name=enemyDisplayName(e);
 g.effects.push({type:'enemyShot',attackerType:e.type,style:'plasma',from:{...s.origin},to:{...end},damage:0,beam:true});
 const hit=[];
 for(const q of lane){
  if(g.player.hp>0&&key(g.player)===key(q))hit.push(g.player);
  for(const a of g.activeAllies)if(a.hp>0&&key(a)===key(q))hit.push(a);
 }
 if(!hit.length){g.log(t('rift-beam.missed',{enemy:name}),true);return true;}
 g.log(t('rift-beam.fired',{enemy:name}),true);
 for(const u of hit)if(u===g.player)g.damagePlayer(damage,name,e,true);else g.damageAlly(u,damage,e,true);
 e.attackCount=(e.attackCount||0)+1;
 return true;
}
export function beamAction(ctx){
 const {g,e}=ctx;
 if(!beams(e))return false;
 const pending=e.beamIntent;
 if(pending){
  if(key(pending.origin)!==key(e)){interruptEnemyIntent(e,'displaced');return false;}
  return fire(g,e,pending);
 }
 if((e.beamCooldown||0)>0)return false;
 const plan=beamPlan(g,e);if(!plan)return false;
 interruptEnemyIntent(e,'target_lost');dropAttack(e);e.beamIntent=plan;
 g.effects.push({type:'enemyTelegraph',phase:'prepare',from:{...plan.origin},to:{...plan.target},damage:0});
 enemyCallout(g,e,'telegraph',{action:'aim'});
 g.log(t('rift-beam.marked',{enemy:enemyDisplayName(e)}),true);
 return true;
}
// For the renderer and the text play: each warned beam's line as the floor stands now.
export const beamTelegraphs=g=>g.enemies.filter(e=>e.hp>0&&e.beamIntent).map(e=>({sourceId:e.id,origin:{...e.beamIntent.origin},lane:beamLane(g,e.beamIntent.origin,e.beamIntent.target)}));
// The shared rules (src/enemy-specials.js): warned, it turns on no decoy, shoots no mine, steps off no hazard (an energy
// body cannot be pinned). The round start counts the cooldown down and drops the mark for a fall or a stun (an EMP).
// Saves (docs/CHECKLIST.md 3): a mark its body could no longer fire (fallen, disabled, moved off its tile, or its target
// now past the reach) is dropped and the cooldown restarts; a cooldown past the tuning is cut; a malformed mark refuses.
const live=e=>e?.hp>0&&!e.control?.disabled;
const whole=q=>Boolean(q&&typeof q==='object'&&Number.isInteger(q.x)&&Number.isInteger(q.y));
const onMap=q=>whole(q)&&q.x>=0&&q.y>=0&&q.x<SIZE&&q.y<SIZE;
const staleBeam=e=>{const s=e.beamIntent;return Boolean(s&&typeof s==='object'&&whole(s.origin)&&onMap(s.target)&&!(live(e)&&key(s.origin)===key(e)&&distance(s.origin,s.target)<=BEAM_TUNING.range));};
registerSpecial({id:'beam',intent:'beamIntent',carries:beams,
 fields:{
  beamIntent:{valid:(s,e,f)=>{const floor=q=>whole(q)&&f.grid?.[q.y]?.[q.x]===1;return Boolean(s&&beams(e)&&e.hp>0&&floor(s.origin)&&floor(s.target)&&key(e)===key(s.origin)&&key(s.origin)!==key(s.target));}},
  beamCooldown:{count:{max:()=>BEAM_TUNING.cooldown,clamp:'cut'}},
 },
 interrupt:{on:['death','disabled','displaced'],cooldown:'beamCooldown'},
 tick:{cooldown:'beamCooldown',drop:e=>e.hp<=0?'death':e.control?.disabled?'disabled':null},
 blocks:{decoy:true,mine:true,stepOff:true,pin:true},
 load:{stale:staleBeam,restart:'beamCooldown'},
 card:(g,e)=>[e.beamIntent?t('target-card.beaming'):''],
});
registerStep('top','beam',beamAction,beams);
export const tickBeams=g=>tickSpecials(g,[['beam']]);
export const validBeam=g=>validSpecials(g,['beam']);
