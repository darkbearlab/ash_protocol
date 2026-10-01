// 封鎖 Lockdown (3.213.0; user 2026-09-30, docs/ENEMY_VARIETY.md section 2): 「應該更像現在狙擊手的行為，只是間隔更短，
// 且是在玩家躲在轉角且可視時發動，是打在相鄰格，而非狙擊手的打在玩家所在那格。」
// - Who: a gunman with reach 5 or more and no behaviour card of its own (not the sniper, the squad leader or the enforcer),
//   never infected; a special affix from the curve's varietyStart (src/enemy-affixes.js).
// - When: it sees you, you are in its reach, and it has no shot at you — you stand at a corner and only lean (src/corner.js).
// - What: it aims at a tile beside you that you could step onto and would stand in its line there, the one nearest its
//   line to you, then in reading order; it warns one round (the sniper warns two) and fires at that tile the next,
//   whoever stands on it — you or one of your units, as the sniper's fixed tile (enemy rounds never hit enemies:
//   3.185.0 overpenetration, the sniper). An empty tile takes the rounds for nothing. Smoke does not matter: it fires at
//   the tile, not at you; the hit chance and the damage are its usual ones.
// - Then one round off (`lockCooldown`), and it fights as any gunman does until you hide at a corner again.
// - Dropped when it falls, is stunned, pinned or moved (src/enemy-specials.js); a save drops one it could no longer fire.
// 3.213.0 review: the aim starts as an affix branch (lockdownBranch, registered in src/enemy-behavior.js after the
// deployer's), after the unit's orders, its hazard step and its survival walk — a cowering rebel hides, a gunman on acid
// steps off first — and only when you are the turn's target (a drone of yours in the open is shot instead); the burst
// alone goes off at the top of the turn (ORDER.top), from where it aimed, as the grenade's throw does. The burst checks
// the same line as the aim (a body on the tile, at its centre): a door shut between them stops it.
import {t} from './i18n.js';
import {ENEMY_TYPES,SIZE} from './data.js';
import {pinned} from './suppression.js';
import {interruptEnemyIntent,enemyCallout,tickSpecials} from './enemy-intents.js';
import {AFFIX_TUNING,locksDown,revealEnemyAffix,enemyDisplayName} from './enemy-affixes.js';
import {distance,key} from './world.js';
import {cornerRay} from './corner.js';
import {firstBarrierOnRay} from './barriers.js';
import {scaleEnemy,floorDamageBonus} from './endless.js';
import {registerSpecial,registerStep,validSpecials,dropAttack} from './enemy-specials.js';

let shoot=null;
// The gunman's own attack lives in enemy-behavior.js, which hands it over so the two files never import each other.
export const useLockdownHooks=({attack})=>{shoot=attack;};
const SIDES=[[0,-1],[1,0],[0,1],[-1,0]];
const live=e=>e?.hp>0&&!e.control?.disabled;
// Would someone standing on `q` — not leaning, not having fired — be in its line? (a body is shot at its centre only)
const inLine=(g,e,q)=>cornerRay(g,e,q,{centre:true}).clear;
export function lockdownPlan(g,e){
 const p=g.player,reach=ENEMY_TYPES[e.type]?.range||0;
 if(p.hp<=0||!locksDown(e)||!g.sight(e,p)||distance(e,p)>reach||g.shotClear(e,p))return null;
 const off=q=>Math.abs((q.x-e.x)*(p.y-e.y)-(q.y-e.y)*(p.x-e.x));   // twice the area: the distance from its line, scaled
 const tiles=SIDES.map(([dx,dy])=>({x:p.x+dx,y:p.y+dy})).filter(q=>g.passable(q.x,q.y,p)&&g.canCross(p,q)&&distance(e,q)<=reach&&!g.enemies.some(o=>o.hp>0&&key(o)===key(q))&&inLine(g,e,q));
 tiles.sort((a,b)=>off(a)-off(b)||a.y-b.y||a.x-b.x);
 return tiles[0]?{origin:{x:e.x,y:e.y},tile:tiles[0]}:null;
}
function fire(ctx){
 const {g,e}=ctx,{tile}=e.lockIntent;
 delete e.lockIntent;e.lockCooldown=AFFIX_TUNING.lockdownCooldown;
 const unit=[g.player,...g.activeAllies].find(a=>a.hp>0&&key(a)===key(tile));
 if(!inLine(g,e,tile)){
  // A door shut or a wall put up in between: the burst stops there and hits it, as the sniper's.
  const edge=firstBarrierOnRay(g.barriers,e,tile),def=ENEMY_TYPES[e.type];
  g.log(t('lockdown.blocked',{enemy:enemyDisplayName(e)}));g.effects.push({type:'enemyShot',attackerType:e.type,from:{x:e.x,y:e.y},to:edge?{x:edge.x,y:edge.y}:{...tile},damage:0});
  if(edge)g.damageProp(edge,scaleEnemy(def.damage+floorDamageBonus(g.floor,g.difficultySpec),g.floor,'damage',g.difficultySpec));
 }else if(unit)shoot?.({...ctx,p:unit,los:true,d:distance(e,unit)});
 else{g.recordExposure(e,tile);g.log(t('lockdown.empty',{enemy:enemyDisplayName(e)}));g.effects.push({type:'enemyShot',attackerType:e.type,from:{x:e.x,y:e.y},to:{...tile},damage:0,miss:true});}
 dropAttack(e);e.attackCount=(e.attackCount||0)+1;
}
// The top step: an aim warned last round goes off from where it was warned; pinned or moved off, it is dropped.
export function lockdownAction(ctx){
 const {e}=ctx;
 if(!locksDown(e)||!e.lockIntent)return false;
 if(pinned(e)){interruptEnemyIntent(e,'suppressed');return false;}
 if(key(e.lockIntent.origin)!==key(e)){interruptEnemyIntent(e,'displaced');return false;}
 fire(ctx);return true;
}
// The affix branch: no dice (`pending`) — it aims whenever it can, you are the turn's target and it is not resting.
export const lockdownBranch=Object.freeze({id:'lockdown',reveal:'effect',applies:({e})=>locksDown(e),
 trigger:({g,e,p})=>p===g.player&&!e.lockIntent&&!(e.lockCooldown>0)&&!pinned(e)&&Boolean(lockdownPlan(g,e)),
 pending:()=>true,run:startAim});
function startAim(ctx){
 const {g,e}=ctx,plan=lockdownPlan(g,e);if(!plan)return false;
 dropAttack(e);e.lockIntent=plan;revealEnemyAffix(g,e,'lockdown');
 g.effects.push({type:'enemyTelegraph',phase:'prepare',from:{...plan.origin},to:{...plan.tile},damage:0});
 enemyCallout(g,e,'telegraph',{action:'aim'});
 g.log(t('lockdown.aim',{enemy:enemyDisplayName(e)}),true);
 return true;
}
// The shared rules (src/enemy-specials.js): aiming, it turns on no decoy, shoots no mine, steps off no hazard, and a pin drops it; the round
// start counts the cooldown down and drops the aim for a fall, a stun or a pin. Saves (CHECKLIST 3): an aim its gunman
// could no longer fire (fallen, stunned, pinned, moved off its tile) is dropped and the cooldown restarts; a cooldown past
// the tuning is cut; a malformed aim is refused.
const whole=q=>Boolean(q&&typeof q==='object'&&Number.isInteger(q.x)&&Number.isInteger(q.y));
// The reach is the card's (tuning-bound): a tile on the map past it is dropped as stale, never a reason to refuse the run;
// a tile off the map is broken data, left for the check to refuse.
const onMap=q=>whole(q)&&q.x>=0&&q.y>=0&&q.x<SIZE&&q.y<SIZE;
const staleAim=e=>{const s=e.lockIntent;return Boolean(s&&typeof s==='object'&&whole(s.origin)&&onMap(s.tile)&&!(live(e)&&!pinned(e)&&key(s.origin)===key(e)&&distance(s.origin,s.tile)<=(ENEMY_TYPES[e.type]?.range||0)));};
registerSpecial({id:'lockdown',intent:'lockIntent',carries:locksDown,
 fields:{
  lockIntent:{valid:(s,e,f)=>{const floor=q=>whole(q)&&f.grid?.[q.y]?.[q.x]===1;return Boolean(s&&locksDown(e)&&floor(s.origin)&&floor(s.tile)&&key(e)===key(s.origin));}},
  lockCooldown:{count:{max:()=>AFFIX_TUNING.lockdownCooldown,carrier:true,clamp:'cut'}},
 },
 interrupt:{on:['death','disabled','displaced','suppressed'],cooldown:'lockCooldown'},
 tick:{cooldown:'lockCooldown',drop:e=>e.hp<=0?'death':e.control?.disabled?'disabled':pinned(e)?'suppressed':null},
 blocks:{decoy:true,mine:true,stepOff:true,pin:true},   // 3.213.0 review: a decoy waits for the warned burst, as for the other warnings
 load:{stale:staleAim,restart:'lockCooldown'},
 card:(g,e)=>[e.lockIntent?t('target-card.lockdown'):''],
});
registerStep('top','lockdown',lockdownAction,locksDown);
export const tickLockdowns=g=>tickSpecials(g,[['lockdown']]);
export const validLockdown=g=>validSpecials(g,['lockdown']);
