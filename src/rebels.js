// Rebels (3.127.0, user design 2026-09-18, docs/REBELS.md): a rabble held together by fear.
// Loyalists fight by discipline (src/squad.js), the swarm by numbers; rebels by who is watching whom.
// - 躲藏: an ordinary rebel who drops below half health, or who sees a comrade gunned down within four tiles, runs for the
//   nearest cover and stays there, shooting back only when it can. Elites never break; machines never do.
// - 嘲笑: at the end of every turn each rebel who can see a cowering comrade draws one boost for the coming turn —
//   fast, one more round, or heavy armour. Drawn before the player gets control, so the target card already shows it.
// - 督戰官 (enforcer): slow, with a long, hopeless gun. It marks a cowering rebel, and the next turn executes it: every
//   coward within seven tiles returns to the fight, every rebel already aiming fires at once, a primed grenade goes out,
//   and everyone in range draws a boost even with no coward left in sight. No experience for the player.
// - 強徵兵 (conscript): on a fresh rebel floor every ordinary gun-carrying rebel has a conscript beside it, outside the
//   threat budget: the same card, but no experience, no scrap, no drop, and first to break.
import {t} from './i18n.js';
import {enemyDef,isNoncombatant,isBossClass} from './enemy-data.js';
import {enemyDisplayName} from './enemy-affixes.js';
import {ENEMY_TYPES} from './data.js';
import {grantTrait,removeTraitSource,activeTrait} from './traits.js';
import {pinned} from './suppression.js';
import {unitTree} from './behavior-tree.js';
import {distance,key,DIRECTIONS,makeEnemy} from './world.js';
import {DETOUR_TRAIT} from './detour.js';
import {registerOrder,giveOrder,endOrder} from './orders.js';
import {accepts} from './personality.js';
import {SIZE} from './data.js';

// 3.153.0 (faction review): enforcerRange matches the enforcer's own gun range (10); at 7 the cowering rebels it was
// meant to rally were routinely out of reach, so 91% of them died behind cover instead.
export const REBEL_TUNING=Object.freeze({witnessRadius:4,coverSearch:6,enforcerRange:10,alarmRadius:8,alarmCooldown:5});
export const TAUNT_TRAITS=Object.freeze(['fast','rapid_fire','heavy_armor']);
export const CONSCRIPT_TYPES=Object.freeze(['rifleman','raider','gunner']);
export const COWER_TRAIT='cowering',COWER_SOURCE='rebel:cower',TAUNT_SOURCE='rebel:taunt';

export const isRebel=e=>e?.faction==='rebel';
export const isEnforcer=e=>enemyDef(e)?.behavior==='enforcer';
export const isCowering=e=>activeTrait(e,COWER_TRAIT);
const biological=e=>!activeTrait(e,'mechanical');
const elite=e=>Boolean(e?.elite||enemyDef(e)?.elite);
// Who can break: ordinary armed rebels. Elites never run, machines have no fear, the enforcer is the fear.
export const canCower=e=>isRebel(e)&&accepts(e,'retreat')&&e.hp>0&&!elite(e)&&biological(e)&&!isBossClass(e)&&!isNoncombatant(e)&&!isEnforcer(e)&&(enemyDef(e)?.range||1)>1;

// Cover to run to: the nearest tile that shields it from the player, never a one-tile corridor (it would seal its own
// side in), never occupied. None found: it cowers where it stands.
const straightCorridor=(g,q)=>{const open=([dx,dy])=>g.passable(q.x+dx,q.y+dy);return (open([1,0])&&open([-1,0])&&!open([0,1])&&!open([0,-1]))||(open([0,1])&&open([0,-1])&&!open([1,0])&&!open([-1,0]));};
export function coverSpot(g,e){
 const r=REBEL_TUNING.coverSearch,p=g.player;let best=null;
 for(let y=e.y-r;y<=e.y+r;y++)for(let x=e.x-r;x<=e.x+r;x++){
  const q={x,y};if(x<0||y<0||x>=SIZE||y>=SIZE||distance(e,q)>r)continue;
  if(!g.passable(x,y,e)||straightCorridor(g,q)||g.hazards.some(h=>distance(h,q)===0))continue;
  if([p,...g.enemies.filter(o=>o.hp>0&&o!==e),...g.activeAllies].some(a=>distance(a,q)===0))continue;
  if(!g.protectingCover(q,p))continue;
  const score=distance(e,q);
  if(!best||score<best.score||score===best.score&&key(q)<key(best.q))best={q,score};
 }
 return best?.q||null;
}
export function cower(g,e){
 if(!canCower(e)||isCowering(e))return false;
 grantTrait(e,COWER_TRAIT,COWER_SOURCE);
 // 3.129.0 迂迴: the run for cover takes the way you cannot see; a rally removes both with the source.
 grantTrait(e,DETOUR_TRAIT,COWER_SOURCE);
 // 3.131.0: hiding is a retreat order the rebel gives itself — no time limit, nothing but a rally ends it.
 const spot=coverSpot(g,e);
 giveOrder(g,e,{kind:'retreat',by:'self',at:spot?{x:spot.x,y:spot.y}:{x:e.x,y:e.y},patience:null,breakOn:[]});
 g.enemyCallout?.(e,'state',{state:'flee'});
 return true;
}
export function rally(g,e){removeTraitSource(e,COWER_SOURCE);if(e.order?.kind==='retreat')endOrder(g,e,'rallied');}

// A comrade shot down in plain sight within four tiles breaks the ones who saw it. Only deaths the player's side
// caused: an execution or a suicide bot going off is not the enemy's doing, and must never undo a rally.
export function witnessDeath(g,dead){
 const broke=[];
 for(const e of g.enemies)if(e!==dead&&canCower(e)&&!isCowering(e)&&distance(e,dead)<=REBEL_TUNING.witnessRadius&&g.sight(e,dead)&&cower(g,e))broke.push(e);
 return broke;
}

// A cowering rebel's own turn: shoot back when it can, otherwise make for its cover and stay there. Pinned, it cannot
// run — suppression is how the player finishes one.
// Personality: a wounded ordinary rebel breaks by itself (witnessing a death breaks it from witnessDeath).
export function selfRetreat(ctx){
 const {g,e}=ctx;
 if(isRebel(e)&&!isCowering(e)&&canCower(e)&&e.hp<e.maxHp/2)cower(g,e);
}
// The retreat order (docs/ORDERS.md): walk to the cover spot and stay; shoot back only when it can reach you.
registerOrder('retreat',{act(ctx,order){
 const {g,e,p}=ctx;
 if(p&&g.sight(e,p)&&g.shotClear(e,p)&&distance(e,p)<=(enemyDef(e)?.range||1))return false;
 const goal=order.at;
 if(distance(e,goal)>0&&!pinned(e)){
  const step=g.nextStep(e,goal);
  if(step&&distance(step,g.player)!==0&&!g.enemies.some(o=>o.hp>0&&o!==e&&distance(o,step)===0)){e.x=step.x;e.y=step.y;e.moved=true;return true;}
 }
 return true;
}});

// The attack and the grenade throw belong to enemy-behavior.js; it hands them over so the two files never import each
// other, the same arrangement as src/squad.js.
let hooks={attack:null,grenade:null};
export const useRebelHooks=next=>{hooks={...hooks,...next};};
const rallies=new WeakMap();
// "蓄勢推進一回合": only for those already aiming (and a grenade already primed). The shot uses the card's own attack.
export function advanceCharge(g,e){
 if(e.grenadeIntent&&hooks.grenade){hooks.grenade({g,e,p:g.enemyTarget(e),def:ENEMY_TYPES[e.type],los:g.sight(e,g.enemyTarget(e)),d:distance(e,g.enemyTarget(e))});return 'grenade';}
 if(!e.charge||!hooks.attack)return null;
 const tree=unitTree(e),def=ENEMY_TYPES[e.type],p=g.enemyTarget(e);
 e.windup=(e.windup||1)-1;if(e.windup>0)return 'aim';
 const los=g.sight(e,p);
 if(!((los&&g.shotClear(e,p)&&distance(e,p)<=def.range)||(tree.fixedTile&&e.aim))){e.windup=1;return null;}
 const ctx={g,e,p,def,los,d:distance(e,p)};
 if(tree.attack)tree.attack(ctx);else hooks.attack(ctx);
 e.charge=Boolean(def.rapid);e.windup=1;e.aim=null;e.attackCount=(e.attackCount||0)+1;
 return 'fire';
}
export function execute(g,enforcer,target){
 const range=REBEL_TUNING.enforcerRange;
 g.effects.push({type:'enemyShot',attackerType:enforcer.type,from:{x:enforcer.x,y:enforcer.y},to:{x:target.x,y:target.y},damage:0});
 g.log(t('rebels.executed',{enemy:enemyDisplayName(enforcer),victim:enemyDisplayName(target)}),true);
 g.hurt(target,target.hp,enforcer);
 const inRange=g.enemies.filter(o=>o.hp>0&&isRebel(o)&&o!==enforcer&&distance(enforcer,o)<=range);
 g.enemyCallout?.(enforcer,'telegraph',{action:'execute'});
 const rallied=inRange.filter(o=>isCowering(o));for(const o of rallied)rally(g,o);
 const fired=inRange.map(o=>advanceCharge(g,o)).filter(r=>r==='fire'||r==='grenade').length;
 // 3.127.1 (user request): a rally is announced by the soldier it happens to, so the turnaround can be seen. It is
 // shouted after the charge, so it stays over any shot the same soldier just fired instead of being replaced by it.
 for(const o of rallied)g.enemyCallout?.(o,'state',{state:'rally'});
 const set=rallies.get(g)||new Set();for(const o of inRange)set.add(o.id);rallies.set(g,set);
 g.log(fired?t('rebels.rallyFire',{n:fired}):'叛軍歸隊。',true);
}
// 3.127.1 (user request): seeing you, the enforcer does what a researcher does — raises the alarm for everyone within
// eight tiles (a free action, every five turns) — and then looks for cover. It never walks at you on its own: the
// mechanism needs it alive and behind something.
export function tickAlarms(g){for(const e of g.enemies)if(e.alarmCooldown>0)e.alarmCooldown--;}
export function soundAlarm(g,e,target=g.player){
 if((e.alarmCooldown||0)>0)return false;
 e.alarmCooldown=REBEL_TUNING.alarmCooldown;
 // 3.144.0: an enemy drawn off by the decoy is not told where you are (src/field-gear.js).
 for(const o of g.enemies)if(o!==e&&o.hp>0&&!isNoncombatant(o)&&!(target===g.player&&g.isFooled?.(o))&&distance(e,o)<=REBEL_TUNING.alarmRadius){o.alert=true;o.lastKnown={x:target.x,y:target.y};}
 g.log(t('rebels.alarm',{enemy:enemyDisplayName(e)}),true);
 g.enemyCallout?.(e,'telegraph',{action:'alarm'});
 return true;
}
// The enforcer's own turn. It is slow, so the execution always lands last in the turn it was announced for.
export function enforcerAct(ctx){
 const {g,e,p}=ctx,range=REBEL_TUNING.enforcerRange,intent=e.executeIntent,sees=p===g.player&&g.sight(e,p);
 if(intent){
  delete e.executeIntent;
  const target=g.enemies.find(o=>o.id===intent.id&&o.hp>0);
  if(target&&isCowering(target)&&distance(e,target)<=range&&g.sight(e,target)){execute(g,e,target);return true;}
 }
 const victim=g.enemies.filter(o=>o.hp>0&&o!==e&&isCowering(o)&&distance(e,o)<=range&&g.sight(e,o))
  .sort((a,b)=>distance(e,a)-distance(e,b)||a.id.localeCompare(b.id))[0];
 if(victim){
  e.executeIntent={id:victim.id};
  g.effects.push({type:'enemyTelegraph',phase:'prepare',from:{x:e.x,y:e.y},to:{x:victim.x,y:victim.y},damage:0});
  g.log(t('rebels.spotted',{enemy:enemyDisplayName(e),victim:enemyDisplayName(victim)}),true);
  return true;
 }
 // Cover first: exposed to you, it walks to the nearest spot that shields it and stays there.
 if(p===g.player&&(sees||e.lastKnown)&&!g.protectingCover(e,p)&&!pinned(e)){
  const spot=coverSpot(g,e);
  if(spot&&distance(e,spot)>0){
   const step=g.nextStep(e,spot);
   if(step&&distance(step,g.player)!==0&&!g.enemies.some(o=>o.hp>0&&o!==e&&distance(o,step)===0)){e.x=step.x;e.y=step.y;e.moved=true;return true;}
  }
 }
 // Nobody to execute: its long, hopeless gun, from where it stands. It never closes on you by itself.
 if(sees&&g.shotClear(e,p)&&distance(e,p)<=(enemyDef(e)?.range||1))return false;
 return true;
}

// End of the turn, before the player gets control: taunts, and the boosts an execution promised.
export function rebelMorale(g){
 const rallied=rallies.get(g)||new Set();rallies.delete(g);
 const cowards=g.enemies.filter(e=>e.hp>0&&isCowering(e));
 let drawn=0;
 for(const e of g.enemies){
  if(e.hp<=0||!isRebel(e)||!biological(e)||isCowering(e)||isEnforcer(e)||isNoncombatant(e))continue;
  removeTraitSource(e,TAUNT_SOURCE);
  const sees=cowards.some(c=>c!==e&&g.sight(e,c));
  if(!sees&&!rallied.has(e.id))continue;
  grantTrait(e,TAUNT_TRAITS[Math.floor(g.rng()*TAUNT_TRAITS.length)],TAUNT_SOURCE,1);drawn++;
 }
 if(drawn)g.log(t('rebels.morale',{n:drawn}),true);
 return drawn;
}

// A fresh rebel floor: every ordinary gun-carrying rebel brings a conscript. Placed after the mission picks its
// targets, so a conscript is never one, and outside the threat budget by design (user: more bodies to break).
export function recruitConscripts(g){
 if(g.simulation)return 0;
 const recruits=[],taken=new Set([key(g.player),...g.enemies.map(key)]);
 for(const e of g.enemies){
  if(e.hp<=0||!isRebel(e)||e.conscript||elite(e)||!CONSCRIPT_TYPES.includes(e.type))continue;
  const spot=DIRECTIONS.map(([dx,dy])=>({x:e.x+dx,y:e.y+dy})).find(q=>g.passable(q.x,q.y)&&!taken.has(key(q))&&!g.props.some(o=>distance(o,q)===0)&&!g.hazards.some(h=>distance(h,q)===0)&&g.canCross(e,q));
  if(!spot)continue;taken.add(key(spot));
  const c=makeEnemy(e.type,spot.x,spot.y,`${e.id}-c`,g.floor,g.difficultySpec,e.faction);
  c.conscript=true;c.faction=e.faction;recruits.push(c);
 }
 g.enemies.push(...recruits);
 return recruits.length;
}

const point=q=>q&&Number.isInteger(q.x)&&Number.isInteger(q.y)&&q.x>=0&&q.y>=0&&q.x<SIZE&&q.y<SIZE;
export function validRebels(g){
 const actors=[...(g.enemies||[]),...Object.values(g.floorStates||{}).flatMap(f=>f.enemies||[])];
 // 3.131.0: the cover spot lives in the retreat order now; a stray cowerAt only arrives through a pre-60 save and is migrated.
 return actors.every(e=>(e.conscript===undefined||e.conscript===true)&&e.cowerAt===undefined&&(!isCowering(e)||e.order?.kind==='retreat')&&
  (e.alarmCooldown===undefined||Number.isSafeInteger(e.alarmCooldown)&&e.alarmCooldown>=0&&e.alarmCooldown<=REBEL_TUNING.alarmCooldown)&&
  (e.executeIntent===undefined||e.executeIntent&&typeof e.executeIntent.id==='string'&&e.executeIntent.id.length>0&&e.executeIntent.id.length<=100));
}
