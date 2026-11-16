// 閃爍 (3.227.0, docs/FACTIONS.md 5.1 and 5.5; user 2026-11-16: "被附身者＋閃爍體，共用短距離閃爍"): the rift's short
// blink. A carrier marks the tile it will appear on, a turn ahead, and appears there on its next turn. Nothing between
// stops it (it does not walk), but the tile has to be free when it arrives; taken, the blink fizzles and the carrier
// stays. Two ways to use it, from the card's `blink.mode`:
// - 'strike' (閃爍體): from 2–range tiles, seeing you, it marks the tile beside you nearest to it. Next turn it appears
//   there and, if you are still on the tile you stood on when it marked, strikes at once. Step off and it lands empty.
// - 'evade' (被附身者): when you come within `evadeRange` tiles, it marks a tile at least `evadeGap` tiles from you that it
//   can see you from, and appears there next turn (that is its turn: it does not shoot).
// Numbers are Claude's (user: "你先定就做" for the rift), to be tuned after play.
import {t} from './i18n.js';
import {enemyDef} from './enemy-data.js';
import {pinned} from './suppression.js';
import {interruptEnemyIntent,enemyCallout,tickSpecials} from './enemy-intents.js';
import {enemyDisplayName} from './enemy-affixes.js';
import {DIRECTIONS,distance,key} from './world.js';
import {SIZE} from './data.js';
import {hazardTile} from './hazard-paths.js';
import {scaleEnemy,floorDamageBonus} from './endless.js';
import {registerSpecial,registerStep,validSpecials,INTERRUPT_REASONS,dropAttack} from './enemy-specials.js';

export const BLINK_TUNING=Object.freeze({strikeRange:4,strikeCooldown:3,evadeRange:2,evadeReach:4,evadeGap:4,evadeCooldown:4,maxReach:6});
let strike=null;
// The card's own attack lives in enemy-behavior.js, which hands it over so the two files never import each other.
export const useBlinkHooks=({attack})=>{strike=attack;};
export const blinkMode=e=>enemyDef(e)?.blink||null;
export const canBlink=e=>Boolean(blinkMode(e));
const cooldownOf=e=>blinkMode(e)==='evade'?BLINK_TUNING.evadeCooldown:BLINK_TUNING.strikeCooldown;
const free=(g,e,p)=>p.x>=0&&p.y>=0&&p.x<SIZE&&p.y<SIZE&&g.passable(p.x,p.y,e)&&key(p)!==key(g.player)&&!g.enemies.some(o=>o!==e&&o.hp>0&&key(o)===key(p))&&!g.activeAllies.some(a=>key(a)===key(p))&&!(g.hazards||[]).some(h=>key(h)===key(p));

// The tile beside you nearest the carrier (ties in DIRECTIONS order), from which it can reach you (no door or partition between).
function strikePlan(g,e){
 const p=g.player,d=distance(e,p);
 if(p.hp<=0||d<=1||d>BLINK_TUNING.strikeRange||!g.sight(e,p))return null;
 const cells=DIRECTIONS.map(([dx,dy])=>({x:p.x+dx,y:p.y+dy})).filter(q=>free(g,e,q)&&g.canCross(q,p));
 cells.sort((a,b)=>distance(e,a)-distance(e,b));
 return cells[0]?{origin:{x:e.x,y:e.y},target:{x:p.x,y:p.y},point:cells[0]}:null;
}
// A tile within reach, far enough from you, that sees you: the farthest from you, then the nearest to the carrier.
function evadePlan(g,e){
 const p=g.player;
 if(p.hp<=0||distance(e,p)>BLINK_TUNING.evadeRange||!g.sight(e,p))return null;
 const R=BLINK_TUNING.evadeReach;let best=null;
 for(let dy=-R;dy<=R;dy++)for(let dx=-R;dx<=R;dx++){
  const q={x:e.x+dx,y:e.y+dy},reach=Math.abs(dx)+Math.abs(dy);
  if(reach<1||reach>R||distance(q,p)<BLINK_TUNING.evadeGap||!free(g,e,q)||!g.sight({...e,x:q.x,y:q.y},p))continue;
  if(!best||distance(q,p)>distance(best,p)||distance(q,p)===distance(best,p)&&reach<distance(best,e))best=q;
 }
 return best?{origin:{x:e.x,y:e.y},target:{x:p.x,y:p.y},point:best}:null;
}
export const blinkPlan=(g,e)=>blinkMode(e)==='evade'?evadePlan(g,e):blinkMode(e)==='strike'?strikePlan(g,e):null;

// 3.231.0 (user 2026-11-17: 「站在裂隙派系的傳送標的上，傳送不會取消，而是對玩家造成傷害（依敵人級別而定）並改站在相鄰隨機格」):
// you stand on the tile a blink marked. The blink goes on: you take the arriving body's blow (its own damage, so it grows with
// the card, the floor, the difficulty and an elite's scale), sure and past cover, and are put on a random free tile beside
// the mark (no hazard; the game's dice, so a replay agrees). Nowhere free beside it: you take the blow, stay, and the blink
// fizzles. Anyone else on the tile still makes it fizzle.
const arrivalDamage=(g,e)=>{const base=scaleEnemy(enemyDef(e).damage+floorDamageBonus(g.floor,g.difficultySpec),g.floor,'damage',g.difficultySpec);return e.damageScale===undefined?base:Math.max(1,Math.round(base*e.damageScale));};
const standable=(g,q)=>q.x>=0&&q.y>=0&&q.x<SIZE&&q.y<SIZE&&g.passable(q.x,q.y,g.player)&&!g.enemies.some(o=>o.hp>0&&key(o)===key(q))&&!g.activeAllies.some(a=>key(a)===key(q))&&!hazardTile(g,q.x,q.y,g.player)&&!(g.hazards||[]).some(h=>key(h)===key(q));
export function shoveOff(g,e,point){
 const p=g.player,name=enemyDisplayName(e);
 const tiles=DIRECTIONS.map(([dx,dy])=>({x:point.x+dx,y:point.y+dy})).filter(q=>standable(g,q)&&g.canCross(point,q));
 g.log(t('rift-blink.shoved',{enemy:name}),true);
 g.damagePlayer(arrivalDamage(g,e),name,e,true);
 if(!tiles.length||p.hp<=0)return false;
 const q=tiles[Math.floor(g.rng()*tiles.length)];
 Object.assign(p,{x:q.x,y:q.y,moved:false,moveDelta:[0,0],cornerExposure:null,fireChain:null,guard:false,focus:false,evasive:false,vaultExposed:false});
 g.pickup();g.reveal();
 return true;
}
const appear=(g,e,to)=>{const from={x:e.x,y:e.y};g.effects.push({type:'portalSpawn',from:{...from},to:{...from},damage:0});Object.assign(e,{x:to.x,y:to.y});e.moved=true;e.moveDelta=[to.x-from.x,to.y-from.y];
 g.effects.push({type:'portalSpawn',from:{...to},to:{...to},damage:0});};
export function blinkAction(ctx){
 const {g,e}=ctx;
 if(!canBlink(e))return false;
 if(pinned(e)){if(e.blinkIntent)interruptEnemyIntent(e,'suppressed');return false;}
 const pending=e.blinkIntent;
 if(pending){
  delete e.blinkIntent;e.blinkCooldown=cooldownOf(e);dropAttack(e);
  if(g.player.hp>0&&key(g.player)===key(pending.point)&&!shoveOff(g,e,pending.point)){g.log(t('rift-blink.fizzled',{enemy:enemyDisplayName(e)}),true);return true;}
  if(!free(g,e,pending.point)){g.log(t('rift-blink.fizzled',{enemy:enemyDisplayName(e)}),true);return true;}
  appear(g,e,pending.point);
  if(blinkMode(e)==='strike'&&key(g.player)===key(pending.target)&&distance(e,g.player)===1&&g.canCross(e,g.player)){
   g.log(t('rift-blink.struck',{enemy:enemyDisplayName(e)}),true);
   strike?.({...ctx,p:g.player,d:1,los:true});dropAttack(e);e.attackCount=(e.attackCount||0)+1;
  }else g.log(t('rift-blink.landed',{enemy:enemyDisplayName(e)}),true);
  return true;
 }
 if((e.blinkCooldown||0)>0)return false;
 const plan=blinkPlan(g,e);if(!plan)return false;
 interruptEnemyIntent(e,'target_lost');e.blinkIntent=plan;
 g.effects.push({type:'enemyTelegraph',phase:'prepare',from:{...plan.origin},to:{...plan.point},damage:0});
 enemyCallout(g,e,'telegraph',{action:'aim'});
 g.log(t('rift-blink.marked',{enemy:enemyDisplayName(e)}),true);
 return true;
}
// The shared rules (src/enemy-specials.js): a marked blink keeps the unit from shooting a mine or stepping off a hazard;
// a pin (被附身者 can be pinned; an energy body cannot) drops it. The round start counts the cooldown down and drops the
// mark for a fall, a stun or a pin. Saves (docs/CHECKLIST.md 3): a mark its carrier could no longer finish (fallen,
// disabled, pinned, or moved off the tile it marked from) is dropped and the cooldown restarts; a cooldown past the
// tuning is cut to it; a malformed mark refuses the save.
const live=e=>e?.hp>0&&!e.control?.disabled;
const whole=q=>Boolean(q&&typeof q==='object'&&Number.isInteger(q.x)&&Number.isInteger(q.y));
const staleMark=e=>{const s=e.blinkIntent;return Boolean(s&&typeof s==='object'&&whole(s.origin)&&!(live(e)&&!pinned(e)&&s.origin.x===e.x&&s.origin.y===e.y));};
registerSpecial({id:'blink',intent:'blinkIntent',carries:canBlink,
 fields:{
  blinkIntent:{valid:(s,e,f)=>{const point=p=>p&&Number.isInteger(p.x)&&Number.isInteger(p.y)&&f.grid?.[p.y]?.[p.x]===1;return !(!s||e.hp<=0||!point(s.origin)||!point(s.target)||!point(s.point)||key(e)!==key(s.origin)||distance(s.origin,s.point)>BLINK_TUNING.maxReach+1||key(s.point)===key(s.target));}},
  blinkCooldown:{count:{max:()=>Math.max(BLINK_TUNING.strikeCooldown,BLINK_TUNING.evadeCooldown),clamp:'cut'}},
 },
 interrupt:{on:INTERRUPT_REASONS,cooldown:'blinkCooldown'},
 tick:{cooldown:'blinkCooldown',drop:e=>e.hp<=0?'death':e.control?.disabled?'disabled':pinned(e)?'suppressed':null},
 blocks:{mine:true,stepOff:true,pin:true},
 load:{stale:staleMark,restart:'blinkCooldown'},
 card:(g,e)=>[e.blinkIntent?t('target-card.blinking'):''],
});
registerStep('top','blink',blinkAction,canBlink);
export const tickBlinks=g=>tickSpecials(g,[['blink']]);
export const validBlink=g=>validSpecials(g,['blink']);
