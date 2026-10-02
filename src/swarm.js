import {t} from './i18n.js';
import {addPoison,validPoison} from './poison.js';
import {enemyDef,hasEnemyTag} from './enemy-data.js';
import {factionDef,enemyFaction} from './factions.js';
import {birthRandom,revealEnemyAffix} from './enemy-affixes.js';
import {activeTrait} from './traits.js';
import {distance,DIRECTIONS,key} from './world.js';
import {pinned,meleeSuppression} from './suppression.js';
import {interruptEnemyIntent,tickSpecials} from './enemy-intents.js';
import {registerSpecial,validSpecials,INTERRUPT_REASONS} from './enemy-specials.js';
import {TONGUE_VISUAL} from './enemy-visuals.js';
import {enemyRoom,expendableRoom} from './runtime-enemies.js';
import {occupied,allyName} from './allies.js';
import {rayCells} from './line-move.js';
import {seeThrough} from './data.js';
import {blockedBetween} from './barriers.js';
import {scaleEnemy,floorDamageBonus} from './endless.js';
import {enemyArmor,enemyDisplayName} from './enemy-affixes.js';
import {reduceDirectDamage} from './traits.js';

import {SWARM_TUNING} from './swarm-tuning.js';
export {SWARM_TUNING} from './swarm-tuning.js';
const affix=(e,id)=>e.affixes?.some(a=>a.id===id);
// First pass uses the player's established toxin status. Allies intercept venom harmlessly.
export function poisonHit(g,e,target){
 if(target!==g.player||target.hp<=0||activeTrait(target,'mechanical'))return false;
 if(!enemyDef(e)?.venom&&!affix(e,'venomous'))return false;
 if(affix(e,'venomous'))revealEnemyAffix(g,e,'venomous');
 if(!addPoison(target)){g.log(t('swarm.venomImmune'));return true;}
 g.log(t('swarm.venomPoisoned'),true);return true;
}
// 3.205.0 (user 2026-09-29, docs/BOSSES.md section 4): the tongue flies along the line it announced — from the boss
// through the tile it aimed at, on to its full reach — and takes the first body on it, whoever it is: you, your units,
// a civilian or the swarm's own (路徑上都應該要可以被鉤到；敵我不分). Walls, closed doors, partitions and solid objects stop
// it; it crosses pits (docs/PITS.md), and what it catches always lands on floor. The catch is dragged beside the boss
// and bitten in the same action (the berserker's grapple and strike), for the card's own blow. Nothing on the line: a
// miss. It still aims at whoever the boss is fighting and still needs sight and a clear shot to announce.
// 鉤舌 Hooktongue (3.220.0; docs/ENEMY_VARIETY.md 10.6): the boss tongue made small for a hunter or giant bug — reach
// HOOK_TUNING.range, it only pulls you beside it (no bite), its own cooldown. The warning, the lane, the catch, the rope and
// the interruptions are the tongue's. The affix shows with the first warning.
export const HOOK_TUNING=Object.freeze({range:4,cooldown:4});
export const hooks=e=>Boolean(e?.affixes?.some(a=>a.id==='hook'));
export const tongues=e=>Boolean(enemyDef(e)?.tongue)||hooks(e);
const reachOf=e=>enemyDef(e)?.tongue?SWARM_TUNING.tongueRange:HOOK_TUNING.range;
export const tongueLane=(g,origin,target,reach=SWARM_TUNING.tongueRange)=>rayCells(origin,target,reach,q=>seeThrough(g.grid[q.y]?.[q.x])&&!g.solid(q.x,q.y),(a,b)=>blockedBetween(g.barriers,a,b,'shot'));
const bodies=(g,e)=>[g.player,...g.activeAllies,...g.enemies].filter(u=>u!==e&&u.hp>0&&!u.concealed);   // 3.217.0: never a hidden unit
export function tongueCatch(g,e,lane){const all=bodies(g,e);for(const q of lane){const u=all.find(u=>u.x===q.x&&u.y===q.y);if(u)return u;}return null;}
// Where a caught body lands: free floor beside the boss, with no wall edge between — the tile it announced while that
// still is, else the one nearest the body.
export function hookLanding(g,e,body,announced=null){
 const free=q=>g.grid[q.y]?.[q.x]===1&&!g.solid(q.x,q.y)&&!occupied(g,q,body)&&g.canCross(q,e);
 if(announced&&distance(announced,e)===1&&free(announced))return {x:announced.x,y:announced.y};
 return DIRECTIONS.map(([dx,dy])=>({x:e.x+dx,y:e.y+dy})).filter(free).sort((a,b)=>distance(a,body)-distance(b,body))[0]||null;
}
export function tonguePlan(g,e,target=g.player){
 if(!target||target.hp<=0||distance(e,target)<=1||distance(e,target)>reachOf(e)||!g.sight(e,target)||!g.shotClear(e,target))return null;
 if(!tongueLane(g,e,target,reachOf(e)).some(q=>key(q)===key(target)))return null;
 const point=hookLanding(g,e,target);return point?{point,origin:{x:e.x,y:e.y},target:{x:target.x,y:target.y}}:null;
}
let bite=null;
// 3.207.0: a delisted berserker (src/delisted-operatives.js) throws the same line as a grapple (its card's `grapple`): the
// same rules, its own words and colours.
const grapple=e=>Boolean(enemyDef(e)?.grapple),hooked=g=>g?{grapple:true}:{};
// The card's own attack lives in enemy-behavior.js, which hands it over (as for the pounce) so neither imports the other.
export const useTongueHooks=({attack})=>{bite=attack;};
const bodyName=(g,u)=>g.enemies.includes(u)?enemyDisplayName(u):allyName(u);
function biteBody(ctx,body){
 const {g,e,def}=ctx;
 if(body===g.player||g.activeAllies.includes(body)){bite?.({...ctx,p:body,d:1,los:true});return;}
 // One of its own, or a civilian: the same blow, rolled the same way.
 const damage=scaleEnemy(def.damage+floorDamageBonus(g.floor,g.difficultySpec),g.floor,'damage',g.difficultySpec),hit=g.rng()*100<g.meleeAccuracy(e,body);
 g.effects.push({type:'enemyShot',attackerType:e.type,style:def.attackStyle||'claw',from:{x:e.x,y:e.y},to:{x:body.x,y:body.y},damage:0,...(hit?{}:{miss:true})});
 if(!hit)return;
 const before=body.hp;g.hurt(body,Math.max(1,reduceDirectDamage(body,damage-enemyArmor(body))),e);
 meleeSuppression(g,e,body,before);   // 3.208.0 近戰壓制: its own kind and civilians too (on you or your units: attack)
}
function lashTongue(ctx,s){
 const {g,e}=ctx,boss=Boolean(enemyDef(e)?.tongue);delete e.tongueIntent;e.tongueCooldown=boss?SWARM_TUNING.tongueCooldown:HOOK_TUNING.cooldown;
 e.charge=false;e.aim=null;e.windup=1;   // the lash is this round's attack: no blow is left wound up behind it
 // Review: a body already beside the boss but across an edge a blow cannot cross (a low partition) is dragged like one
 // further off: over it to free floor beside the boss, or the tongue slips.
 const lane=key(s.origin)===key(e)?tongueLane(g,s.origin,s.target,reachOf(e)):[],body=tongueCatch(g,e,lane),drag=Boolean(body)&&(distance(body,e)>1||!g.canCross(body,e)),point=drag?hookLanding(g,e,body,s.point):null;
 // Nothing on the line, or nowhere beside it to drag the catch to: it lashes out to its reach and back, empty.
 if(!body||drag&&!point){const end=lane[lane.length-1]||s.target;g.effects.push({type:'tonguePull',sourceId:e.id,from:{...end},to:{...s.origin},origin:{...s.origin},damage:0,miss:true,...hooked(grapple(e))});g.log(t(grapple(e)?'operatives.grappleMissed':'swarm.tongueMissed'));return true;}
 if(point){
  const from={x:body.x,y:body.y};Object.assign(body,point);
  if(body===g.player){Object.assign(body,{moved:true,moveDelta:[point.x-from.x,point.y-from.y],cornerExposure:null,fireChain:null,guard:false,focus:false,evasive:false});}
  else if(g.enemies.includes(body)){interruptEnemyIntent(body,'displaced');Object.assign(body,{moved:true,moveDelta:[point.x-from.x,point.y-from.y],cornerExposure:null});}
  g.effects.push({type:'tonguePull',sourceId:e.id,from,to:{...point},origin:{x:e.x,y:e.y},damage:0,...hooked(grapple(e))});
 }
 // Review: dragged, or bitten where it stands (already beside the boss).
 if(grapple(e)){if(point)g.log(body===g.player?t('operatives.grapplePulled'):t('operatives.grappleCaught',{name:bodyName(g,body)}),true);else g.log(body===g.player?t('operatives.grappleCuts'):t('operatives.grappleCutsOther',{name:bodyName(g,body)}),true);}
 else if(point)g.log(body===g.player?t('swarm.tonguePulled'):t('swarm.tongueCaught',{name:bodyName(g,body)}),true);
 else if(boss)g.log(body===g.player?t('swarm.tongueBites'):t('swarm.tongueBitesOther',{name:bodyName(g,body)}),true);
 g.reveal();
 if(boss){biteBody(ctx,body);e.attackCount=(e.attackCount||0)+1;}   // 鉤舌 only pulls
 return true;
}
export function tongueAction(ctx){
 const {g,e}=ctx;
 if(!tongues(e))return false;
 if(pinned(e)){if(e.tongueIntent)interruptEnemyIntent(e,'suppressed');return false;}
 const pending=e.tongueIntent;
 if(pending)return lashTongue(ctx,pending);
 if((e.tongueCooldown||0)>0)return false;
 const plan=tonguePlan(g,e,ctx.p||g.player);
 if(!plan)return false;
 interruptEnemyIntent(e,'target_lost');e.tongueIntent=plan;if(!enemyDef(e)?.tongue)revealEnemyAffix(g,e,'hook');
 g.effects.push({type:'tongueTelegraph',sourceId:e.id,from:{...plan.origin},to:{...plan.target},landing:{...plan.point},damage:0,...hooked(grapple(e))});g.log(t(grapple(e)?'operatives.grappleTaut':'swarm.tongueTaut'),true);return true;
}
// 3.205.0: with the lane it will fly along, as the game stands now (the renderer shades the tiles you can see).
export const tongueTelegraphs=g=>g.enemies.filter(e=>e.hp>0&&e.tongueIntent).map(e=>({kind:'tongue',sourceId:e.id,origin:{...e.tongueIntent.origin},target:{...e.tongueIntent.target},landing:{...e.tongueIntent.point},lane:tongueLane(g,e.tongueIntent.origin,e.tongueIntent.target,reachOf(e)),interruptible:true,...hooked(grapple(e))}));
// 3.206.1 (src/enemy-specials.js): the tongue as the shared rules see it. Taut, it cannot turn on a decoy, shoot a mine
// or step off a hazard, and a pin drops it; the round start counts the cooldown down and drops the warning for a fall, a
// stun or a pin. It goes off in the swarm bosses' step (src/swarm-bosses.js swarmBossAction). Saves: a warning its boss
// could no longer give (fallen, stunned, pinned, moved) is dropped and the cooldown restarts; a cooldown past the tuning
// is cut to it.
const live=e=>e?.hp>0&&!e.control?.disabled;
const at=(e,q)=>q&&typeof q==='object'&&q.x===e.x&&q.y===e.y;
registerSpecial({id:'tongue',intent:'tongueIntent',carries:tongues,
 fields:{
  // 3.205.0 review: the aimed tile may be over a pit (a flying unit there can be aimed at); the boss and the landing are floor.
  tongueIntent:{valid:(s,e,f)=>{if(!s)return false;const point=p=>p&&Number.isInteger(p.x)&&Number.isInteger(p.y)&&f.grid[p.y]?.[p.x]===1,aimed=p=>p&&Number.isInteger(p.x)&&Number.isInteger(p.y)&&seeThrough(f.grid[p.y]?.[p.x]);
   return !(!tongues(e)||e.hp<=0||e.control?.disabled||pinned(e)||!point(s.origin)||!aimed(s.target)||!point(s.point)||key(e)!==key(s.origin)||distance(s.origin,s.target)>reachOf(e)||distance(s.origin,s.point)!==1);}},
  tongueCooldown:{count:{max:()=>SWARM_TUNING.tongueCooldown,carrier:true,clamp:'cut'}},
 },
 interrupt:{on:INTERRUPT_REASONS,cooldown:'tongueCooldown'},
 tick:{cooldown:'tongueCooldown',drop:e=>e.hp<=0?'death':e.control?.disabled?'disabled':pinned(e)?'suppressed':null},
 blocks:{decoy:true,mine:true,stepOff:true,pin:true},
 load:{stale:e=>Boolean(e.tongueIntent&&typeof e.tongueIntent==='object'&&!(live(e)&&!pinned(e)&&at(e,e.tongueIntent.origin))),restart:'tongueCooldown'},
 card:(g,e)=>[e.tongueIntent?(grapple(e)?t('target-card.grappling'):TONGUE_VISUAL.label):''],
});
export const tickTongues=g=>tickSpecials(g,[['tongue']]);
export function infectedDeath(g,e){
 if(!affix(e,'brood_host')||e.broodReleased)return;
 e.broodReleased=true;revealEnemyAffix(g,e,'brood_host');
 const rng=birthRandom(g.seed,g.floor,e.id,'infection-burst-v1'),wanted=SWARM_TUNING.burstMin+Math.floor(rng()*(SWARM_TUNING.burstMax-SWARM_TUNING.burstMin+1));let count=0;
 for(const [dx,dy] of DIRECTIONS){
  if(count>=wanted||!enemyRoom(g)||!expendableRoom(g))break;
  const q={x:e.x+dx,y:e.y+dy};if(!g.passable(q.x,q.y)||!g.canCross(e,q)||occupied(g,q)||g.props.some(p=>key(p)===key(q))||g.items.some(p=>key(p)===key(q))||g.hazards.some(p=>key(p)===key(q)))continue;
  const child=g.spawnEnemy(factionDef(enemyFaction(e)).nestChild,q.x,q.y,`${e.id}-burst-${count++}`);child.broodParent=e.id;child.alert=true;child.lastKnown={x:g.player.x,y:g.player.y};g.enemies.push(child);
  g.effects.push({type:'nestSpawn',nestStyle:'burrow',from:{x:e.x,y:e.y},to:q,damage:0});
 }
 if(count)g.log(t('swarm.hostBurst'),true);
}
// Saves: the poison on you and the brood a host released (validSwarmState; the loader checks the tongue with the other
// specials, src/enemy-specials.js); validSwarm is both.
export function validSwarmState(g){
 const frames=[g,...Object.values(g.floorStates||{})];
 if(!validPoison(g.player))return false;
 for(const f of frames)for(const e of f.enemies||[]){
  if(e.broodReleased!==undefined&&(!affix(e,'brood_host')||e.broodReleased!==true||e.hp>0))return false;
  if(e.broodParent!==undefined){const parent=f.enemies.find(p=>p.id===e.broodParent);if(!parent?.broodReleased||!hasEnemyTag(parent,'infected')||enemyFaction(parent)!==enemyFaction(e)||!e.expendable||!e.reinforcement||!Array.from({length:SWARM_TUNING.burstMax},(_,n)=>String(n)).some(n=>e.id===`${parent.id}-burst-${n}`)||e.type!==factionDef(enemyFaction(parent)).nestChild)return false;}
 }
 return true;
}
export const validSwarm=g=>validSwarmState(g)&&validSpecials(g,['tongue']);
