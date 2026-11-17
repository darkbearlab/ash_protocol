// 錯位 (3.231.0, docs/FACTIONS.md 5.1 and 5.9): the 錯位體 moves you. Seeing you 2 to `range` tiles off, it marks a
// tile 3–4 tiles from you (the one with the most other rift units around it, then the nearest to itself) and the tile you
// stand on; on its next turn, if you are still on that tile, you are put on the marked one. Step off and nothing happens
// — the same rule as the flicker's strike. It only ever marks open floor you could stand on, no fire, acid, steam, pit
// or mine, with at least two open tiles beside it (a way out by design, never a sealed box); taken or turned into a hazard
// by then, it fizzles. A skill that anchors you in place holds you there. Then `cooldown` turns; in between it fights
// hand to hand.
// Numbers are Claude's (user: "你先定就做" for the rift), to be tuned after play.
import {t} from './i18n.js';
import {enemyDef,isBossClass} from './enemy-data.js';
import {SIZE} from './data.js';
import {interruptEnemyIntent,enemyCallout,tickSpecials} from './enemy-intents.js';
import {enemyDisplayName} from './enemy-affixes.js';
import {DIRECTIONS,distance,key} from './world.js';
import {hazardTile} from './hazard-paths.js';
import {skillActive} from './skills.js';
import {registerSpecial,registerStep,validSpecials,dropAttack} from './enemy-specials.js';

export const WARP_TUNING=Object.freeze({range:5,minRange:2,near:3,far:4,cooldown:5,crowd:2,maxReach:9});
export const warps=e=>Boolean(enemyDef(e)?.warp);
const inside=q=>q.x>=0&&q.y>=0&&q.x<SIZE&&q.y<SIZE;
const taken=(g,q)=>g.enemies.some(o=>o.hp>0&&key(o)===key(q))||g.activeAllies.some(a=>key(a)===key(q));
// Somewhere you could stand: floor you may walk on, nobody there, no hazard.
const standable=(g,q)=>inside(q)&&g.passable(q.x,q.y,g.player)&&!taken(g,q)&&!hazardTile(g,q.x,q.y,g.player)&&!(g.hazards||[]).some(h=>key(h)===key(q));
const exits=(g,q)=>DIRECTIONS.filter(([dx,dy])=>{const n={x:q.x+dx,y:q.y+dy};return standable(g,n)&&g.canCross(q,n);}).length;
export const landing=(g,q)=>standable(g,q)&&key(q)!==key(g.player)&&exits(g,q)>=2;
export function warpPlan(g,e){
 const p=g.player,d=distance(e,p);
 if(p.hp<=0||d<WARP_TUNING.minRange||d>WARP_TUNING.range||!g.sight(e,p))return null;
 if(enemyDef(e)?.warp==='pull')return pullPlan(g,e);
 const crowd=q=>g.enemies.filter(o=>o!==e&&o.hp>0&&distance(o,q)<=WARP_TUNING.crowd).length;
 let best=null,bestCrowd=-1;
 for(let dy=-WARP_TUNING.far;dy<=WARP_TUNING.far;dy++)for(let dx=-WARP_TUNING.far;dx<=WARP_TUNING.far;dx++){
  const q={x:p.x+dx,y:p.y+dy},gap=Math.abs(dx)+Math.abs(dy);
  if(gap<WARP_TUNING.near||gap>WARP_TUNING.far||!landing(g,q))continue;
  const c=crowd(q);
  if(c>bestCrowd||c===bestCrowd&&distance(q,e)<distance(best,e)){best=q;bestCrowd=c;}
 }
 return best?{origin:{x:e.x,y:e.y},target:{x:p.x,y:p.y},point:best}:null;
}
// 3.232.0 (src/rift-bosses.js): a rift boss's pull — a tile beside it (or one further out), the nearest to it, then reading
// order; the same mark and the same rule (stay and you are put there).
function pullPlan(g,e){
 const p=g.player;let best=null;
 for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
  const q={x:e.x+dx,y:e.y+dy},r=Math.abs(dx)+Math.abs(dy);
  if(r<1||r>2||distance(q,p)<2||!landing(g,q))continue;
  if(!best||r<distance(best,e)||r===distance(best,e)&&(q.y<best.y||q.y===best.y&&q.x<best.x))best=q;
 }
 return best?{origin:{x:e.x,y:e.y},target:{x:p.x,y:p.y},point:best}:null;
}
function resolve(g,e,s){
 delete e.warpIntent;e.warpCooldown=WARP_TUNING.cooldown;dropAttack(e);
 const p=g.player,name=enemyDisplayName(e);
 if(p.hp<=0||key(p)!==key(s.target)){g.log(t('rift-warp.missed',{enemy:name}),true);return true;}
 if(skillActive(p,'anchor')){g.log(t('rift-warp.held',{enemy:name}),true);return true;}
 if(!landing(g,s.point)){g.log(t('rift-warp.fizzled',{enemy:name}),true);return true;}
 const from={x:p.x,y:p.y};
 g.effects.push({type:'portalSpawn',from:{...from},to:{...from},damage:0});
 Object.assign(p,{x:s.point.x,y:s.point.y,moved:false,moveDelta:[0,0],cornerExposure:null,fireChain:null,guard:false,focus:false,evasive:false,vaultExposed:false});
 g.effects.push({type:'portalSpawn',from:{...s.point},to:{...s.point},damage:0});
 g.log(t('rift-warp.moved',{enemy:name}),true);
 g.pickup();g.reveal();
 return true;
}
export function warpAction(ctx){
 const {g,e}=ctx;
 if(!warps(e))return false;
 const pending=e.warpIntent;
 if(pending){
  if(key(pending.origin)!==key(e)){interruptEnemyIntent(e,'displaced');return false;}
  return resolve(g,e,pending);
 }
 if((e.warpCooldown||0)>0)return false;
 const plan=warpPlan(g,e);if(!plan)return false;
 interruptEnemyIntent(e,'target_lost');dropAttack(e);e.warpIntent=plan;
 g.effects.push({type:'enemyTelegraph',phase:'prepare',from:{...plan.target},to:{...plan.point},damage:0});
 enemyCallout(g,e,'telegraph',{action:'aim'});
 g.log(t('rift-warp.marked',{enemy:enemyDisplayName(e)}),true);
 return true;
}
// The shared rules (src/enemy-specials.js): warned, it turns on no decoy, shoots no mine, steps off no hazard (an energy
// body cannot be pinned). The round start counts the cooldown down and drops the mark for a fall or a stun (an EMP).
// Saves (docs/CHECKLIST.md 3): a mark its body could no longer finish (fallen, disabled, moved off its tile) is dropped and
// the cooldown restarts; a cooldown past the tuning is cut; a malformed mark refuses.
const live=e=>e?.hp>0&&!e.control?.disabled;
const whole=q=>Boolean(q&&typeof q==='object'&&Number.isInteger(q.x)&&Number.isInteger(q.y));
const staleWarp=e=>{const s=e.warpIntent;return Boolean(s&&typeof s==='object'&&whole(s.origin)&&!(live(e)&&key(s.origin)===key(e)));};
registerSpecial({id:'warp',intent:'warpIntent',carries:warps,
 fields:{
  warpIntent:{valid:(s,e,f)=>{const floor=q=>whole(q)&&f.grid?.[q.y]?.[q.x]===1;return Boolean(s&&warps(e)&&e.hp>0&&floor(s.origin)&&floor(s.target)&&floor(s.point)&&key(e)===key(s.origin)&&key(s.point)!==key(s.target)&&distance(s.target,s.point)<=WARP_TUNING.maxReach+2);}},
  warpCooldown:{count:{max:()=>WARP_TUNING.cooldown,clamp:'cut'}},
 },
 interrupt:{on:['death','disabled','displaced'],cooldown:'warpCooldown'},
 tick:{cooldown:'warpCooldown',drop:e=>e.hp<=0?'death':e.control?.disabled?'disabled':null},
 blocks:{decoy:true,mine:true,stepOff:true,pin:true},
 load:{stale:staleWarp,restart:'warpCooldown'},
 card:(g,e)=>[e.warpIntent?t('target-card.warping'):''],
});
registerStep('top','warp',warpAction,e=>warps(e)&&!isBossClass(e));   // 3.232.0: a rift boss pulls from its own step
export const tickWarps=g=>tickSpecials(g,[['warp']]);
export const validWarp=g=>validSpecials(g,['warp']);
