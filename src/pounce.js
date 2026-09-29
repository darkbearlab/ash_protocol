// 撲擊 (3.133.0, user decision 2026-09-18): the swarm's hunter bug gets a grapple of its own. Built on the same
// straight sweep as the berserker's grapple and the hive beast's tongue (src/line-move.js), so it leaps over brood.
// Rules the user decided:
// - Only the hunter bug (the swarm's `crawler`, 兇猛 personality) pounces.
// - It is announced: within three tiles, seeing you, it crouches for a turn; next turn it leaps beside you and bites.
// - Moving off the announced tile makes it miss. A miss still carries it to the landing it announced (when that tile
//   is still clear), and it lands exposed for a turn — the vaulting penalty, +20 to hit it.
// - Three turns before it can crouch again.
import {t} from './i18n.js';
import {SWARM_TUNING} from './swarm-tuning.js';
import {personalityOf} from './personality.js';
import {pullLanding} from './melee-classes.js';
import {sweptClear} from './line-move.js';
import {pinned} from './suppression.js';
import {interruptEnemyIntent,enemyCallout,tickSpecials} from './enemy-intents.js';
import {enemyDisplayName} from './enemy-affixes.js';
import {distance,key} from './world.js';
import {registerSpecial,registerStep,validSpecials,INTERRUPT_REASONS,dropAttack} from './enemy-specials.js';

let bite=null;
// The card's own attack lives in enemy-behavior.js, which hands it over so the two files never import each other.
export const usePounceHooks=({attack})=>{bite=attack;};
export const canPounce=e=>Boolean(personalityOf(e)?.pounce);
export function pouncePlan(g,e){
 const p=g.player;
 if(p.hp<=0||distance(e,p)<=1||distance(e,p)>SWARM_TUNING.pounceRange||!g.sight(e,p))return null;
 const point=pullLanding(g,e,p);return point?{origin:{x:e.x,y:e.y},target:{x:p.x,y:p.y},point}:null;
}
const land=(g,e,to)=>{const from={x:e.x,y:e.y};Object.assign(e,{x:to.x,y:to.y});e.moved=true;e.moveDelta=[to.x-from.x,to.y-from.y];
 g.effects.push({type:'pulse',from,to:{...to},radius:.5,color:'#b8d45a',damage:0});};
export function pounceAction(ctx){
 const {g,e}=ctx;
 if(!canPounce(e))return false;
 if(pinned(e)){if(e.pounceIntent)interruptEnemyIntent(e,'suppressed');return false;}
 const pending=e.pounceIntent;
 if(!pending&&(e.pounceCooldown||0)>0)return false;
 const plan=pouncePlan(g,e);
 if(pending){
  delete e.pounceIntent;e.pounceCooldown=SWARM_TUNING.pounceCooldown;
  const hit=plan&&key(pending.origin)===key(e)&&key(pending.target)===key(g.player)&&key(pending.point)===key(plan.point);
  if(hit){
   land(g,e,plan.point);g.log(t('pounce.landed',{enemy:enemyDisplayName(e)}),true);
   bite?.({...ctx,d:1,los:true});e.charge=false;e.windup=1;e.aim=null;e.attackCount=(e.attackCount||0)+1;
   return true;
  }
  // A miss is still a leap: it goes where it said it would, if it can, and lands open.
  if(distance(pending.point,g.player)>0&&sweptClear(g,e,pending.point)&&g.passable(pending.point.x,pending.point.y,e))land(g,e,pending.point);
  e.vaultExposed=true;dropAttack(e);g.log(t('pounce.missed',{enemy:enemyDisplayName(e)}),true);   // dropAttack: 3.206.2, a miss is its attack too
  return true;
 }
 if(!plan)return false;
 interruptEnemyIntent(e,'target_lost');e.pounceIntent=plan;
 g.effects.push({type:'enemyTelegraph',phase:'prepare',from:{...plan.origin},to:{...plan.point},damage:0});
 enemyCallout(g,e,'telegraph',{action:'aim'});
 g.log(t('pounce.crouch',{enemy:enemyDisplayName(e)}),true);
 return true;
}
// 3.206.1 (src/enemy-specials.js): the pounce as the shared rules see it. Crouched, it cannot shoot a mine or step off
// a hazard, and a pin drops it; the round start counts the cooldown down and drops the crouch for a fall, a stun or a pin.
// Saves (3.206.2, docs/CHECKLIST.md 3): a crouch its bug could no longer finish (fallen, stunned, pinned, or moved off
// the tile it crouched on) is dropped and the cooldown restarts, and a cooldown past the tuning is cut to it — they used
// to refuse the run. A malformed one is still refused. Neither checks the card that carries it.
const live=e=>e?.hp>0&&!e.control?.disabled;
const whole=q=>Boolean(q&&typeof q==='object'&&Number.isInteger(q.x)&&Number.isInteger(q.y));
const staleCrouch=e=>{const s=e.pounceIntent;return Boolean(s&&typeof s==='object'&&whole(s.origin)&&!(live(e)&&!pinned(e)&&s.origin.x===e.x&&s.origin.y===e.y));};
registerSpecial({id:'pounce',intent:'pounceIntent',carries:canPounce,
 fields:{
  pounceIntent:{valid:(s,e,f)=>{const point=p=>p&&Number.isInteger(p.x)&&Number.isInteger(p.y)&&f.grid?.[p.y]?.[p.x]===1;return !(!s||e.hp<=0||!point(s.origin)||!point(s.target)||!point(s.point)||key(e)!==key(s.origin)||distance(s.origin,s.target)>SWARM_TUNING.pounceRange||distance(s.point,s.target)!==1);}},
  pounceCooldown:{count:{max:()=>SWARM_TUNING.pounceCooldown,clamp:'cut'}},
 },
 interrupt:{on:INTERRUPT_REASONS,cooldown:'pounceCooldown'},
 tick:{cooldown:'pounceCooldown',drop:e=>e.hp<=0?'death':e.control?.disabled?'disabled':pinned(e)?'suppressed':null},
 blocks:{mine:true,stepOff:true,pin:true},
 load:{stale:staleCrouch,restart:'pounceCooldown'},
 card:(g,e)=>[e.pounceIntent?t('target-card.pouncing'):''],   // 3.206.2
});
registerStep('top','pounce',pounceAction,canPounce);
export const tickPounces=g=>tickSpecials(g,[['pounce']]);
export const validPounce=g=>validSpecials(g,['pounce']);
