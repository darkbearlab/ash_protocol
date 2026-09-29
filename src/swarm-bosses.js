// Swarm bosses (3.205.0, user design 2026-09-29; docs/BOSSES.md section 4): the warning stays, being caught costs a lot.
// Both bosses keep the tongue (src/swarm.js: it now takes the first body on its line and bites it at once). Besides:
// 衝鋒, the hive beast's (floor 3), and the matriarch's too below half her health (src/swarm-tuning.js SWARM_BOSS_TUNING):
// - Seeing its target in a straight row or column two to eight tiles off, with nothing solid between, it lowers its head:
//   a round of warning drawing the lane (`chargeIntent`), from it to the first wall, pit, closed door, partition or solid
//   object, at most eight tiles.
// - Its next turn, first of all, it charges down that lane, whoever stands where. Every body on the lane, any side, is
//   knocked one tile aside (square to the lane) onto free floor for 15 damage, or, with neither side free (a wall, a pit,
//   a body, an edge that stops a walker), stays and takes 30; either way it is down for a round, as a stun leaves it
//   (the first push in the game, boss only; nothing is ever knocked into a pit). With both sides free a fixed hash of the
//   seed, floor, round, boss and body picks one — never the combat dice.
// - It stops at the lane's end. A lane that ended against a wall (anything that stopped it short of eight tiles) leaves it
//   stunned for a round with +20 to hit it (`crashed`, with the vault penalty's `vaultExposed`): bait it into walls.
// - Three rounds before it can lower its head again. Stunned, pinned, moved or killed while it warns, it drops it.
// 產蟲巢, the matriarch's: seeing you, she lays an egg sac on a floor tile three or four tiles from you that you can see
// (`nestIntent`; the tile nearest her, ties by a fixed hash). The round after, as her turn begins, it hatches into a nest
// under the nest rules (src/runtime-enemies.js) that gives three larvae in all; at most two of hers stand at once; six
// rounds after a hatch before the next sac. A sac whose tile is taken when it hatches is lost; stunned or killed, she
// loses it. The hatch is not her action: she goes on with her turn.
import {t} from './i18n.js';
import {SWARM_BOSS_TUNING} from './swarm-tuning.js';
import {enemyDef} from './enemy-data.js';
import {distance,key,DIRECTIONS,reachable} from './world.js';
import {barrierBetween,edgeBlocks} from './barriers.js';
import {occupied,allyName} from './allies.js';
import {pinned} from './suppression.js';
import {interruptEnemyIntent,enemyCallout,tickSpecials} from './enemy-intents.js';
import {enemyDisplayName as enemyName,enemyArmor} from './enemy-affixes.js';
import {scaleEnemy} from './endless.js';
import {reduceDirectDamage} from './traits.js';
import {tongueAction} from './swarm.js';
import {RUNTIME_TUNING} from './runtime-enemies.js';
import {isSimulation} from './killhouse-policy.js';
import {registerSpecial,registerStep,dropStaleSpecials,validSpecials} from './enemy-specials.js';

const C=SWARM_BOSS_TUNING.charge,N=SWARM_BOSS_TUNING.nest;
const specials=e=>enemyDef(e)?.specials||[];
export const chargesLane=e=>specials(e).includes('charge');
export const laysNests=e=>specials(e).includes('nest');
// The matriarch charges only below half her health (the card's `chargeBelow`); the beast always can.
export const chargeReady=e=>chargesLane(e)&&(!enemyDef(e)?.chargeBelow||e.hp<e.maxHp*C.below);
const live=e=>e?.hp>0&&!e.control?.disabled;
const hash=text=>{let h=2166136261;for(const c of text){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};

// ---- the charge ----------------------------------------------------------------------------------------------------
// The lane from `from` toward `dir` ({x,y}, one of the four steps): the floor tiles it covers, at most `lane` of them;
// bodies never stop it. `crash`: it stopped short of that against a wall, a pit, an edge that stops a walker (a closed
// door, a partition, a low partition) or a solid object.
export function chargeLane(g,from,dir){
 const cells=[];let at={x:from.x,y:from.y},crash=false;
 for(let n=0;n<C.lane;n++){
  const q={x:at.x+dir.x,y:at.y+dir.y};
  if(g.grid[q.y]?.[q.x]!==1||g.solid(q.x,q.y)||edgeBlocks(barrierBetween(g.barriers,at,q),'move')){crash=true;break;}
  cells.push(q);at=q;
 }
 return {cells,crash};
}
const bodies=(g,e)=>[g.player,...g.activeAllies,...g.enemies].filter(u=>u!==e&&u.hp>0);
const bodyName=(g,u)=>g.enemies.includes(u)?enemyName(u):allyName(u);
// A side tile a body can be knocked onto: floor (a pit counts as a wall), nothing solid or alive on it, no edge between.
const sideFree=(g,from,q)=>g.grid[q.y]?.[q.x]===1&&!g.solid(q.x,q.y)&&!occupied(g,q)&&!edgeBlocks(barrierBetween(g.barriers,from,q),'move');
// Both sides free: a fixed hash picks, so a replay and a reload knock it the same way and no combat roll is spent.
export const chargeSide=(g,e,u)=>hash(`${g.seed}:${g.floor}:${g.turn}:${e.id}:${u.id||'player'}:charge-side-v1`)&1;
// Down for a round, as a stun grenade leaves a unit, whatever it is made of (a blow, not a grenade's keyword); an
// earlier stun's immunity does not keep it off, and the usual immunity follows (src/throwables.js skipDisabled).
function knockDown(g,u,rounds=C.disabled){
 if(u.hp<=0||!u.control)return;
 u.control.disabled=Math.max(u.control.disabled||0,rounds);u.control.immune=0;
 interruptEnemyIntent(u,'disabled');delete u.primed;
 u.guard=false;u.focus=false;u.evasive=false;u.moved=false;u.moveDelta=[0,0];
}
function ram(g,e,u,amount){
 const damage=scaleEnemy(amount,g.floor,'damage',g.difficultySpec);
 if(u===g.player)g.damagePlayer(damage,t('swarmBosses.chargeSource',{enemy:enemyName(e)}),null,true);
 else if(g.activeAllies.includes(u))g.damageAlly(u,damage,null,true);
 else g.hurt(u,Math.max(1,reduceDirectDamage(u,damage-enemyArmor(u))),e);
}
function startCharge({g,e,p,los}){
 if(!chargeReady(e)||e.chargeIntent||(e.chargeCooldown||0)>0||pinned(e)||!los||!p||p.hp<=0)return false;
 const d=distance(e,p);if(d<2||d>C.lane||(p.x!==e.x&&p.y!==e.y))return false;
 const dir={x:Math.sign(p.x-e.x),y:Math.sign(p.y-e.y)},{cells,crash}=chargeLane(g,e,dir);
 if(!cells.some(q=>key(q)===key(p)))return false;
 interruptEnemyIntent(e,'target_lost');   // a blow wound up at someone who stepped away is dropped for the charge
 e.chargeIntent={origin:{x:e.x,y:e.y},dir};
 const end=cells[cells.length-1];
 g.effects.push({type:'bossTelegraph',kind:'charge',from:{x:e.x,y:e.y},to:{...end},...(crash?{crash:true}:{}),damage:0});
 enemyCallout(g,e,'telegraph',{action:'attack'});g.log(t('swarmBosses.chargeReady',{enemy:enemyName(e)}),true);
 return true;
}
// The charge itself: the boss's whole turn.
function rush({g,e}){
 const s=e.chargeIntent;delete e.chargeIntent;e.chargeCooldown=C.cooldown;
 e.charge=false;e.aim=null;e.windup=1;   // the charge is this round's attack: no blow is left wound up behind it
 if(e.x!==s.origin.x||e.y!==s.origin.y)return true;
 const {cells,crash}=chargeLane(g,s.origin,s.dir),from={x:e.x,y:e.y};
 g.log(t('swarmBosses.charge',{enemy:enemyName(e)}),true);
 for(const q of cells){
  if(e.hp<=0)break;   // review: killed on the way (a crushed bomber's blast), it stops there and rams no one else
  const u=bodies(g,e).find(u=>u.x===q.x&&u.y===q.y);if(!u)continue;
  const sides=[{x:q.x+s.dir.y,y:q.y+s.dir.x},{x:q.x-s.dir.y,y:q.y-s.dir.x}].filter(n=>sideFree(g,q,n));
  const to=sides.length>1?sides[chargeSide(g,e,u)]:sides[0]||null,you=u===g.player,name=you?null:bodyName(g,u);
  if(to){
   Object.assign(u,{x:to.x,y:to.y});if(you||g.enemies.includes(u)){u.cornerExposure=null;u.fireChain=null;}
   g.effects.push({type:'bossTelegraph',kind:'shove',from:{...q},to:{...to},damage:0});
  }
  ram(g,e,u,to?C.damage:C.crush);knockDown(g,u);
  g.log(you?t(to?'swarmBosses.shovedYou':'swarmBosses.crushedYou',{n:C.disabled}):t(to?'swarmBosses.shoved':'swarmBosses.crushed',{name,n:C.disabled}),you);
 }
 if(e.hp<=0){g.reveal();return true;}   // its body stays where it fell; no run, no crash
 // It stops at the lane's end, or short of a body that could not be knocked aside there.
 const all=bodies(g,e),stop=[...cells].reverse().find(q=>!all.some(u=>u.x===q.x&&u.y===q.y));
 if(stop){e.x=stop.x;e.y=stop.y;e.moved=true;e.cornerExposure=null;}
 g.effects.push({type:'bossTelegraph',kind:'rush',from,to:{x:e.x,y:e.y},dir:{...s.dir},...(crash?{crash:true}:{}),damage:0});
 if(crash&&e.hp>0){
  e.control.disabled=Math.max(e.control.disabled||0,1);e.control.immune=0;e.vaultExposed=true;e.crashed=true;e.moved=false;   // dazed where it stands: no moving target's evasion
  g.log(t('swarmBosses.crash',{enemy:enemyName(e),n:C.crashBonus}),true);
 }
 g.reveal();
 return true;
}
// A wall-stunned boss: +20 to a blow at it (a shot already gets the vault penalty's +20 from `vaultExposed`).
export const crashBonus=target=>target?.crashed&&target.vaultExposed?C.crashBonus:0;
// The lanes to draw: every warning boss's, as the floor stands now.
export const chargeLanes=g=>g.enemies.filter(e=>e.hp>0&&e.chargeIntent).map(e=>({sourceId:e.id,origin:{...e.chargeIntent.origin},dir:{...e.chargeIntent.dir},...chargeLane(g,e.chargeIntent.origin,e.chargeIntent.dir)}));

// ---- the nests -----------------------------------------------------------------------------------------------------
// Her nests are ordinary nest props with ids of her own (`<her id>-nest-<n>`), never reused: a spent one stays as ruins.
const nestPrefix=e=>`${e.id}-nest-`;
export const laidNests=(g,e)=>(g.props||[]).filter(o=>o.type==='nest'&&o.id.startsWith(nestPrefix(e)));
const standing=(g,e)=>laidNests(g,e).filter(o=>o.hp>0).length+(e.nestIntent?1:0);
const eggFree=(g,q)=>g.grid[q.y]?.[q.x]===1&&!g.solid(q.x,q.y)&&!occupied(g,q)&&!g.props.some(o=>o.x===q.x&&o.y===q.y)&&!g.items.some(o=>o.x===q.x&&o.y===q.y)&&!g.hazards.some(o=>o.x===q.x&&o.y===q.y)&&!(g.fires||[]).some(o=>o.x===q.x&&o.y===q.y)&&!(g.mines||[]).some(o=>o.x===q.x&&o.y===q.y)&&!(g.decoy&&key(g.decoy)===key(q))&&key(q)!==key(g.start)&&key(q)!==key(g.end);
// A nest there must not cut off any floor you can reach now (like the generated nests' check). Review: counted with
// locked doors open (`keys`, as the generator counts them), so a sac never takes the one tile in front of a vault door.
function keepsRoutes(g,q,before){
 const after=reachable({grid:g.grid,barriers:g.barriers,props:[...g.props,{type:'nest',x:q.x,y:q.y,hp:1}]},g.player,{keys:true});
 return after.size===before.size-(before.has(key(q))?1:0);
}
export function eggSpot(g,e){
 const p=g.player,spots=[];
 for(let y=p.y-N.far;y<=p.y+N.far;y++)for(let x=p.x-N.far;x<=p.x+N.far;x++){const q={x,y},d=distance(p,q);if(d>=N.near&&d<=N.far&&eggFree(g,q)&&g.visible(q))spots.push(q);}
 spots.sort((a,b)=>distance(e,a)-distance(e,b)||hash(`${g.seed}:${g.floor}:${g.turn}:${a.x},${a.y}:egg-v1`)-hash(`${g.seed}:${g.floor}:${g.turn}:${b.x},${b.y}:egg-v1`));
 if(!spots.length)return null;
 const before=reachable(g,g.player,{keys:true});return spots.find(q=>keepsRoutes(g,q,before))||null;
}
function layEgg({g,e}){
 const p=g.player;
 if(!laysNests(e)||e.nestIntent||(e.nestCooldown||0)>0||isSimulation(g)||p.hp<=0||!g.sight(e,p)||standing(g,e)>=N.live)return false;
 const q=eggSpot(g,e);if(!q)return false;
 interruptEnemyIntent(e,'target_lost');   // laying is this round's action: no blow is left wound up
 e.nestIntent={x:q.x,y:q.y};
 g.effects.push({type:'bossTelegraph',kind:'egg',from:{x:e.x,y:e.y},to:{...q},damage:0});
 enemyCallout(g,e,'telegraph',{action:'aim'});g.log(t('swarmBosses.eggLaid',{enemy:enemyName(e)}),true);
 return true;
}
// As her turn begins (Game.enemyAct, before a decoy or a mine can take the turn): the sac hatches. Not her action.
export function hatchEgg(g,e){
 const q=e.nestIntent;if(!q)return false;
 delete e.nestIntent;e.nestCooldown=N.cooldown;
 if(!live(e))return false;
 if(!eggFree(g,q)){g.effects.push({type:'bossTelegraph',kind:'eggLost',from:{...q},to:{...q},damage:0});g.log(t('swarmBosses.eggLost'),true);return false;}
 const n=laidNests(g,e).length;
 g.props.push({id:`${nestPrefix(e)}${n}`,type:'nest',x:q.x,y:q.y,hp:RUNTIME_TUNING.nestHp,maxHp:RUNTIME_TUNING.nestHp,nest:{active:false,total:N.brood,interval:RUNTIME_TUNING.interval,remaining:N.brood,cooldown:0,serial:0}});
 g.effects.push({type:'bossTelegraph',kind:'hatch',from:{...q},to:{...q},damage:0});g.log(t('swarmBosses.nestHatched'),true);g.reveal();
 return true;
}
export const eggSacs=g=>g.enemies.filter(e=>e.hp>0&&e.nestIntent).map(e=>({sourceId:e.id,x:e.nestIntent.x,y:e.nestIntent.y}));

// ---- the turn (src/enemy-behavior.js, at the very top of the tree, before orders or anything else can move it) ---------
// A warning given last round goes off first; otherwise the card's `specials`, in order, may start one.
export function swarmBossAction(ctx){
 const {e}=ctx;
 if(e.chargeIntent)return pinned(e)?(interruptEnemyIntent(e,'suppressed'),false):rush(ctx);
 if(!enemyDef(e)?.specials)return tongueAction(ctx);
 if(e.tongueIntent)return tongueAction(ctx);
 for(const kind of specials(e))if(kind==='charge'?startCharge(ctx):kind==='nest'?layEgg(ctx):kind==='tongue'&&tongueAction(ctx))return true;
 return false;
}
registerStep('top','swarm',swarmBossAction,e=>Boolean(enemyDef(e)?.tongue)||chargesLane(e)||laysNests(e));
registerStep('start','nest',hatchEgg);
// Round start (Game.action, after the tongue's): both cooldowns count down, then a warning whose boss has fallen, been
// stunned or pinned is dropped (one pass for the two: src/enemy-specials.js ORDER.tick).
export const tickSwarmBosses=g=>tickSpecials(g,[['charge','nest']]);

// ---- the shared rules and saves (src/enemy-specials.js) ------------------------------------------------------------
const exactly=(o,keys)=>Boolean(o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).sort().join()===keys);
const tile=(q,grid)=>exactly(q,'x,y')&&Number.isInteger(q.x)&&Number.isInteger(q.y)&&grid?.[q.y]?.[q.x]===1;
const at=(e,q)=>q&&typeof q==='object'&&q.x===e.x&&q.y===e.y;
// The charge: stunned, pinned, moved or killed while it warns, it drops it and the cooldown restarts (losing sight of
// you does not matter: it charges the lane whoever stands there). Warning, it cannot turn on a decoy, shoot a mine or
// step off a hazard. `crashed` (dazed against a wall) is its too.
// A warning left on a boss that has since fallen, been stunned, pinned or moved is dropped when a save loads, as the
// boss would drop it (never a reason to refuse the run; the 3.203.0 lesson). Review: a cooldown longer than today's
// tuning (a save from before the user retuned it) is cut to it, not refused.
registerSpecial({id:'charge',intent:'chargeIntent',carries:chargesLane,
 fields:{
  chargeIntent:{valid:(s,e,f)=>chargesLane(e)&&live(e)&&exactly(s,'dir,origin')&&tile(s.origin,f.grid)&&at(e,s.origin)&&exactly(s.dir,'x,y')&&DIRECTIONS.some(([x,y])=>s.dir.x===x&&s.dir.y===y)},
  chargeCooldown:{count:{max:()=>C.cooldown,carrier:true,clamp:'cut'}},
  crashed:{valid:(v,e)=>e.crashed===true&&e.vaultExposed===true&&chargesLane(e)},
 },
 interrupt:{on:['death','disabled','displaced','suppressed'],cooldown:'chargeCooldown'},
 tick:{cooldown:'chargeCooldown',drop:e=>e.hp<=0?'death':e.control?.disabled?'disabled':pinned(e)?'suppressed':null},
 blocks:{decoy:true,mine:true,stepOff:true,pin:true},
 load:{stale:e=>Boolean(e.chargeIntent&&typeof e.chargeIntent==='object'&&!(live(e)&&!pinned(e)&&at(e,e.chargeIntent.origin))),restart:'chargeCooldown'},
 card:(g,e)=>[e.chargeIntent?t('target-card.charging'):''],
});
// The egg sac: only her fall or a stun loses it (the cooldown restarts); it blocks nothing — it is not her action.
// (Review: how many of her nests stand is not checked; a save from before the user lowered the cap still loads, and
// she lays no more until she is under it.)
registerSpecial({id:'nest',intent:'nestIntent',carries:laysNests,
 fields:{
  nestIntent:{valid:(v,e,f)=>laysNests(e)&&live(e)&&tile(v,f.grid)},
  nestCooldown:{count:{max:()=>N.cooldown,carrier:true,clamp:'cut'}},
 },
 interrupt:{on:['death','disabled'],cooldown:'nestCooldown'},
 tick:{cooldown:'nestCooldown',drop:e=>e.hp<=0?'death':e.control?.disabled?'disabled':null},
 load:{stale:e=>Boolean(e.nestIntent&&typeof e.nestIntent==='object'&&!live(e)),restart:'nestCooldown'},
 card:(g,e)=>[e.nestIntent?t('target-card.laying'):''],
});
// The tongue's warning is trimmed here too (its declaration is src/swarm.js's).
export const dropStaleSwarmIntents=g=>dropStaleSpecials(g,['tongue','charge','nest']);
export const validSwarmBosses=g=>validSpecials(g,['charge','nest']);
