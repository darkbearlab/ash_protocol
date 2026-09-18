import {isBossClass} from './enemy-data.js';
import {interruptEnemyIntent} from './enemy-intents.js';
import {pinned} from './suppression.js';
import {classPerkRank,CLASS_PERK_TUNING} from './class-perks.js';
import {activeTrait,healActor} from './traits.js';
import {DIRECTIONS,distance,lineOfSight} from './world.js';
import {sweptGrid,sweptClear} from './line-move.js';
import {WEAPONS,ENEMY_TYPES} from './data.js';
import {isDark} from './lighting.js';
import {presentStep} from './presentation.js';
export const MELEE_TUNING={bloodlust:.2,spiritMax:5,spiritReduction:.05,spiritDelay:5,spiritInterval:2,bladeDamage:.1,bladeReduction:.1,ambush:1.5,ambushCooldown:1,duelist:15,camoEvasion:30};
export const GRAPPLE_RANGE=5,GRAPPLE_COOLDOWN=4,CAMO_DURATION=5,CAMO_COOLDOWN=10;
export const spiritLimit=p=>MELEE_TUNING.spiritMax+classPerkRank(p,'berserker_fury')*CLASS_PERK_TUNING.fury;
export const freshSpirit=()=>({stacks:0,lastKill:null});
export const bladeCount=p=>activeTrait(p,'blade_stash')?p.owned.filter(slot=>WEAPONS[p.weaponBases[slot]]?.melee).length:0;
export const bladeMultiplier=p=>1+bladeCount(p)*MELEE_TUNING.bladeDamage;
export function meleeDefense(p,damage){const spirit=activeTrait(p,'battle_spirit')?(p.battleSpirit?.stacks||0):0;return Math.max(1,Math.ceil(damage*Math.max(0,1-bladeCount(p)*MELEE_TUNING.bladeReduction)*(1-spirit*MELEE_TUNING.spiritReduction)));}
export function tickSpirit(g){const p=g.player,s=p.battleSpirit;if(!s?.stacks||s.lastKill===null)return;const rank=classPerkRank(p,'berserker_endure'),delay=MELEE_TUNING.spiritDelay+rank*CLASS_PERK_TUNING.endureDelay,interval=MELEE_TUNING.spiritInterval+rank*CLASS_PERK_TUNING.endureInterval,elapsed=g.turn-s.lastKill;if(elapsed>=delay&&(elapsed-delay)%interval===0)s.stacks--;}
// Ambush (3.48.2, user call): target disabled, target or ninja standing in smoke, target not yet alert, or the ninja in the dark.
// Smoke is checked by position: adjacent units always see each other, so the old "target cannot see you" test never fired in melee reach.
export const inSmoke=(g,pos)=>Boolean(g.smoke?.some(s=>s.kind!=='toxic'&&s.cells.some(q=>q.x===pos.x&&q.y===pos.y)));   // mist is not smoke (3.134.0)
export function ambushReady(g,target){const p=g.player;return Boolean(target&&g.enemies.includes(target)&&activeTrait(p,'ambush')&&(target.control?.disabled>0||inSmoke(g,target)||inSmoke(g,p)||!target.alert||isDark(g,p)));}
export const ambushMultiplier=p=>MELEE_TUNING.ambush+classPerkRank(p,'ninja_ambush')*CLASS_PERK_TUNING.ambush;
export function shortenCamo(p){const s=p.skillState?.camouflage;if(s&&!s.remaining)s.cooldown=Math.max(0,s.cooldown-MELEE_TUNING.ambushCooldown);}
export function meleeReward(g,target,before){const p=g.player,actual=Math.max(0,before-Math.max(0,target.hp));if(actual<=0)return;
 if(p.hp>0&&activeTrait(p,'bloodlust'))healActor(p,Math.floor(actual*(MELEE_TUNING.bloodlust+classPerkRank(p,'berserker_thirst')*CLASS_PERK_TUNING.thirst)));
 if(target.hp<=0&&activeTrait(p,'battle_spirit'))p.battleSpirit={stacks:Math.min(spiritLimit(p),p.battleSpirit.stacks+1),lastKill:g.turn};
}
// Duel: exactly one alert enemy within its sensing range can see the ninja right now. Shared with the status line.
export const duelActive=g=>{const p=g.player;return activeTrait(p,'duelist')&&g.enemies.filter(e=>e.hp>0&&e.alert&&distance(e,p)<=Math.max(10,ENEMY_TYPES[e.type].range)&&g.sight(e,p)).length===1;};
export function defensiveEvasion(g,attacker,target){
 if(target!==g.player||!g.enemies.includes(attacker))return 0;
 const p=g.player;let bonus=p.skillState?.camouflage?.remaining>0?MELEE_TUNING.camoEvasion:0;
 if(duelActive(g))bonus+=MELEE_TUNING.duelist;
 return bonus;
}
export function grapplePlan(g,id=g.target){
 const p=g.player,e=g.enemies.find(e=>e.id===id&&e.hp>0),slot=g.bumpMeleeSlot();

 if(!e||distance(p,e)>GRAPPLE_RANGE||(!g.visible(e)||!g.shotClear(p,e)))return {reason:`鉤鎖需要先鎖定 ${GRAPPLE_RANGE} 格內、看得到的敵人。`};
 const dash=activeTrait(e,'large')||isBossClass(e),mover=dash?p:e,anchor=dash?e:p;
 if(dash&&(pinned(p)||p.skillState?.anchor?.remaining))return {reason:'固定中無法衝向目標。'};
 const point=pullLanding(g,mover,anchor);
 if(!point)return {reason:'沒有可到達的近戰落點：身邊或目標旁都被擋住。'};
 return {enemy:e,mover,point,dash,slot};
}
export function useGrapple(g,id){
 const plan=grapplePlan(g,id);if(plan.reason)return g.fail(plan.reason);
 const {enemy,mover,point,dash,slot}=plan,p=g.player;
 const state=p.skillState.grapple;if(!state||state.cooldown)return false;
 state.remaining=0;state.cooldown=GRAPPLE_COOLDOWN;
 presentStep(g,()=>{const from={x:mover.x,y:mover.y};Object.assign(mover,point);mover.moved=distance(from,point)>0;mover.moveDelta=[0,0];
  if(!dash&&mover.moved){interruptEnemyIntent(mover,'displaced');mover.charge=false;mover.windup=0;mover.aim=null;mover.focusTarget=null;mover.fireChain=null;}
  g.effects.push({type:'pulse',from,to:{...point},radius:.5,color:'#d9bd7b',damage:0});g.reveal();
 });
 g.target=enemy.id;return g.strike({id:enemy.id,x:enemy.x,y:enemy.y},slot);
}
export function validMeleeState(p,turn){const s=p.battleSpirit;return s&&typeof s==='object'&&!Array.isArray(s)&&Object.keys(s).length===2&&Number.isInteger(s.stacks)&&s.stacks>=0&&s.stacks<=spiritLimit(p)&&(s.lastKill===null?s.stacks===0:Number.isSafeInteger(s.lastKill)&&s.lastKill>=1&&s.lastKill<=turn);}

// Shared swept pull geometry; preserves grapple candidate and tie order.
export function pullLanding(g,mover,anchor){
 // Straight swept path (src/line-move.js, 3.132.0): occupied/solid cells excluded; a diagonal corner needs an open side.
 const grid=sweptGrid(g,mover);
 const choices=DIRECTIONS.map(([dx,dy])=>({x:anchor.x+dx,y:anchor.y+dy})).filter(q=>g.passable(q.x,q.y)&&sweptClear(g,mover,q,grid)&&g.canCross(q,anchor)).sort((a,b)=>distance(a,mover)-distance(b,mover));
 return choices[0]||null;
}
