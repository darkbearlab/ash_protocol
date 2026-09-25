import {enemyProjectile,enemyMeleeStyle} from './enemy-visuals.js';
import {NEST_EFFECT_MS} from './nest-art.js';
import {actorMoves} from './actor-visuals.js';
import {killingBlow,ENEMY_BLOWS} from './kia.js';
import {goreKind,goreSize,goreForce} from './gore.js';
import {enemyDef} from './enemy-data.js';
// Presentation observes one synchronous turn. Snapshots never roll back rules or RNG.
const observers=new WeakMap(),activeSteps=new WeakSet();
export function snapshot(game){
  const {rng,effects,onEnemyCallout,...data}=game;
  return Object.assign(Object.create(Object.getPrototypeOf(game)),structuredClone(data),{effects:[]});
}
export function presentStep(game,action,quietActor=null){
  const steps=observers.get(game);
  if(!steps)return action();
  const before=snapshot(game),start=game.effects.length;
  const state=quietActor?{x:quietActor.x,y:quietActor.y,charge:quietActor.charge,windup:quietActor.windup,visible:game.visible(quietActor)}:null;
  let result;const nested=activeSteps.has(game);activeSteps.add(game);
  try{result=action();}finally{if(!nested)activeSteps.delete(game);}
  const changed=state&&(state.visible||game.visible(quietActor))&&(state.x!==quietActor.x||state.y!==quietActor.y||state.charge!==quietActor.charge||state.windup!==quietActor.windup);
  if(game.effects.length>start||changed||actorMoves(before,game).length)steps.push({before,after:snapshot(game),effects:structuredClone(game.effects.slice(start))});
  return result;
}
// A semantic event outside an existing step still belongs to the captured action.
export const presentAnnouncement=(game,emit)=>activeSteps.has(game)?emit():presentStep(game,emit);
export function captureAction(game,action){
  const steps=[];observers.set(game,steps);
  try{return {success:action(),steps};}finally{observers.delete(game);}
}
// Cosmetic projectiles per resolved shot; these never affect ammunition or damage.
// flash (3.116.0): the muzzle flash family from src/muzzle-flash.js; thrown grenades, melee and venom have none.
export const WEAPON_VISUALS={
  // Semantic style only; the venom trail drawing is handed to Claude.
  venom:{count:1,flight:130,stagger:0,spread:0,style:'venom'},
  pet_turret:{count:1,stagger:0,spread:0,flight:85,style:'bullet',flash:'rifle'},
  thunder:{count:1,flight:100,stagger:0,spread:0,style:'grenade',flash:'launcher'},
  lmg:{count:2,flight:60,stagger:15,spread:.07,style:'bullet',flash:'smg'},
  powerfist:{count:1,flight:100,stagger:0,spread:0,style:'slash'},
  // 3.136.0: ten quick cuts, one step each, run together like a burst.
  chainsaw:{count:1,flight:45,stagger:0,spread:0,style:'slash'},
  rifle:{count:3,flight:85,stagger:20,spread:.04,style:'bullet',flash:'rifle'},
  shotgun:{count:6,flight:95,stagger:0,spread:.5,style:'pellet',flash:'shotgun'},
  smg:{count:3,flight:60,stagger:15,spread:.07,style:'bullet',flash:'smg'},
  sniper:{count:1,flight:110,stagger:0,spread:0,style:'tracer',flash:'sniper'},
  plasma:{count:1,flight:130,stagger:0,spread:0,style:'plasma',flash:'plasma'},
  launcher:{count:1,flight:170,stagger:0,spread:0,style:'grenade',flash:'launcher'},
  grenade:{count:1,flight:180,stagger:0,spread:0,style:'grenade'},
  melee:{count:1,flight:80,stagger:0,spread:0}
};
export const FLIGHT_MS=125,IMPACT_MS=130,DEATH_MS=220;
// Kill confirmation (3.115.0, user request): a kill far enough away that the camera had to zoom out for it keeps that
// tile framed through the fall and a short beat, and the turn waits for it. Closer kills never moved the camera, so they
// get no beat and a swarm fight does not slow down. KILL_HOLD_REACH is where cameraFrame starts zooming out.
export const KILL_HOLD_MS=400,KILL_HOLD_REACH=4;
export function projectileVisuals(effect,reduceMotion=false){
  // 3.136.0: a melee weapon with no visuals of its own swings like the power fist. Before, the axe and katana fell
  // through to the rifle and were drawn as three bullets with a muzzle flash.
  const id=effect.style==='grenade'?'grenade':effect.weaponId==='unarmed'?'melee':effect.style==='slash'&&!WEAPON_VISUALS[effect.weaponId]?'powerfist':effect.weaponId||enemyProjectile(effect.attackerType)||'rifle';
  const base=WEAPON_VISUALS[id]||WEAPON_VISUALS.rifle,spec=effect.singleShot?{...base,count:1,spread:0}:base;
  // A launched grenade flies like a thrown one but still leaves the launcher's flash. A spread shot (the shotgun's pellets)
  // flashes once; a staggered burst flashes with every round.
  const flash=(WEAPON_VISUALS[effect.weaponId]||base).flash||null;
  return Array.from({length:reduceMotion?1:spec.count},(_,i)=>({...effect,damage:0,miss:false,missPath:effect.miss,
    style:spec.style||effect.style||(id==='melee'?enemyMeleeStyle(effect.attackerType):'bullet'),travel:reduceMotion?70:spec.flight,delay:reduceMotion?0:i*spec.stagger,
    spread:reduceMotion?0:spec.spread*(i-(spec.count-1)/2)/Math.max(1,(spec.count-1)/2),quiet:reduceMotion,
    flash:flash&&!effect.suppressed&&(i===0||(!reduceMotion&&spec.stagger>0))?flash:null,   // no flash from the flash hider (3.179.0)
    // 3.117.0: the first cosmetic round stands for the shot, so the shot is heard once (src/sound-cues.js).
    primary:i===0}));
}
// Consecutive steps that only move units (and may speak) play at the same time (3.84.2, user; docs/SWARM.md 3.4): a swarm
// of walkers would otherwise take one move animation each. Anything else ends the group: a shot, an effect, a death, the
// player moving, or a unit that already moves in the group (its two steps must not blend into one diagonal slide).
const fallen=step=>[...step.after.enemies,...(step.after.allies||[])].some(a=>a.hp<=0&&[...step.before.enemies,...(step.before.allies||[])].some(b=>b.id===a.id&&b.hp>0));
export function mergeMoveSteps(steps){
  const merged=[];let group=null,movers=null;
  for(const step of steps){
    const ids=actorMoves(step.before,step.after).map(m=>m.actorId);
    const moveOnly=ids.length>0&&!ids.includes('player')&&step.effects.every(e=>e.type==='callout')&&step.before.player.hp===step.after.player.hp&&step.before.floor===step.after.floor&&!fallen(step);
    if(moveOnly&&group&&group.after.floor===step.before.floor&&ids.every(id=>!movers.has(id))){
      group={before:group.before,after:step.after,effects:[...group.effects,...step.effects]};for(const id of ids)movers.add(id);continue;
    }
    if(group)merged.push(group);
    if(moveOnly){group={before:step.before,after:step.after,effects:[...step.effects]};movers=new Set(ids);}
    else{group=null;movers=null;merged.push(step);}
  }
  if(group)merged.push(group);
  return merged;
}
// Who stands on `at` after the step and is still alive: the operative, or an enemy or ally (not a pet).
function livingBody(state,at){
  if(!at)return null;
  const p=state.player;if(p&&p.hp>0&&p.x===at.x&&p.y===at.y)return {player:true};
  const actor=[...(state.enemies||[]),...(state.allies||[])].find(e=>e.hp>0&&e.kind!=='pet'&&e.x===at.x&&e.y===at.y);
  return actor?{actor}:null;
}
function hitInfo(effects,at,body){
  const types=body.player?['enemyShot']:ENEMY_BLOWS,actor=body.actor;
  return {blow:killingBlow(effects,at,types),force:goreForce(effects,at,types),gore:body.player?'flesh':goreKind(actor),size:body.player?1:goreSize(actor.maxHp||enemyDef(actor)?.hp)};
}
export function planPresentation(steps,{reduceMotion=false}={}){
  const events=[];let time=0;
  if(!reduceMotion)steps=mergeMoveSteps(steps);
  for(const [index,step]of steps.entries()){
    const moves=reduceMotion?[]:actorMoves(step.before,step.after);
    const flights=step.effects.filter(e=>e.type==='shot'||e.type==='enemyShot');
    const visuals=flights.flatMap(e=>projectileVisuals(e,reduceMotion));
    const rewards=step.effects.filter(e=>e.type==='capSupply');
    // A pickup (3.118.0) only cues a sound when the step lands; like a callout it takes no time of its own.
    const announcements=step.effects.filter(e=>e.type==='callout'||e.type==='pickup');
    const impacts=step.effects.filter(e=>e.type!=='shot'&&e.type!=='enemyShot'&&e.type!=='capSupply'&&e.type!=='callout'&&e.type!=='pickup');
    const travel=Math.max(0,...visuals.map(e=>e.delay+e.travel),...moves.map(e=>e.travel));
    events.push({time,state:step.before,effects:[...moves,...visuals]});
    for(const e of flights)if(e.damage>0||e.miss)impacts.push({...e,type:e.miss?'miss':'impact',style:undefined,from:e.to});
    const deaths=[...step.after.enemies,...(step.after.allies||[])].filter(e=>e.kind!=='pet'&&e.hp<=0&&[...step.before.enemies,...(step.before.allies||[])].some(b=>b.id===e.id&&b.hp>0));
    if(step.before.player.hp>0&&step.after.player.hp<=0)deaths.push({...step.after.player,type:'player'});
    // A brief impact flash precedes the grey corpse's settling motion.
    // 3.174.0: the operative's fall carries the killing blow's direction for the killed-in-action scene (src/kia.js);
    // 3.175.0: every other fall carries it too, with what the body is made of, for kill gore (src/gore.js).
    for(const dead of deaths)impacts.push({type:'fall',actorType:dead.type,from:{x:dead.x,y:dead.y},to:{x:dead.x,y:dead.y},damage:0,...(dead.type==='player'?{blow:killingBlow(step.effects,dead)}:{blow:killingBlow(step.effects,dead,ENEMY_BLOWS),force:goreForce(step.effects,dead,ENEMY_BLOWS),gore:goreKind(dead),size:goreSize(dead.maxHp||enemyDef(dead)?.hp),elite:Boolean(dead.elite)})});
    // 3.176.0 hit gore: a harmful hit on a body that lives through it carries what the renderer needs for a small
    // spray (src/gore.js hitBurst). Hits on props and on bodies that fell this step (their fall bursts) carry nothing.
    for(let i=0;i<impacts.length;i++){const e=impacts[i],body=e.type==='impact'&&e.damage>0?livingBody(step.after,e.to):null;if(body)impacts[i]={...e,hit:hitInfo(step.effects,e.to,body)};}
    const player=step.before.player,settle=reduceMotion?120:DEATH_MS;
    const far=deaths.filter(dead=>dead.type!=='player'&&step.before.enemies.some(b=>b.id===dead.id&&step.before.visible?.(b))&&Math.max(Math.abs(dead.x-player.x),Math.abs(dead.y-player.y))>=KILL_HOLD_REACH);
    for(const dead of far)impacts.push({type:'cameraHold',from:{x:dead.x,y:dead.y},to:{x:dead.x,y:dead.y},duration:settle+KILL_HOLD_MS,damage:0});
    time+=travel;
    // The kill settles before cap resources/logs appear. Rules already committed them;
    // only this presentation copy hides the pending visual reward.
    const prior=rewards[0]?.beforeSupply;
    const impactState=prior?Object.assign(Object.create(Object.getPrototypeOf(step.after)),step.after,{player:{...step.after.player,...prior.resources},items:prior.items,logs:prior.logs}):step.after;
    events.push({time,state:impactState,effects:[...impacts.map(e=>({...e,quiet:reduceMotion})),...announcements]});
    const burstContinues=flights.some(e=>['smg','lmg','thunder','chainsaw'].includes(e.weaponId))&&steps[index+1]?.effects.some(e=>e.type==='shot'&&['smg','lmg','thunder','chainsaw'].includes(e.weaponId));
    time+=!flights.length&&!impacts.length&&!rewards.length?0:reduceMotion?120:impacts.some(e=>e.type==='nestCollapse'||e.type==='nestSpawn')?NEST_EFFECT_MS:deaths.length?DEATH_MS:burstContinues?40:IMPACT_MS;
    if(far.length)time+=KILL_HOLD_MS;
    if(rewards.length){events.push({time,state:step.after,effects:rewards.map(({beforeSupply,...e})=>e)});time+=reduceMotion?60:IMPACT_MS;}
  }
  return {events,duration:time};
}

// Driven by visible animation frames, not wall-clock timers. Hidden/landscape
// pauses cannot skip a death frame and immediately cover it with a modal.
export class Playback {
  constructor(plan,emit){this.plan=plan;this.emit=emit;this.elapsed=0;this.index=0;this.done=false;}
  advance(milliseconds){
    if(this.done)return;
    this.elapsed+=Math.max(0,Math.min(milliseconds,100));
    while(this.index<this.plan.events.length&&this.plan.events[this.index].time<=this.elapsed)this.emit(this.plan.events[this.index++]);
    this.done=this.elapsed>=this.plan.duration;
  }
  // Skipping (3.114.0, user request): every remaining event is emitted at once and flagged, so the caller can drop the
  // sounds and redraw once. Callouts and the final state still arrive; only the frames in between are lost.
  finish(){
    if(this.done)return;
    this.skipping=true;this.elapsed=this.plan.duration;
    while(this.index<this.plan.events.length)this.emit(this.plan.events[this.index++]);
    this.done=true;
  }
}
