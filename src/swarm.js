import {enemyDef,hasEnemyTag} from './enemy-data.js';
import {factionDef,enemyFaction} from './factions.js';
import {birthRandom,revealEnemyAffix} from './enemy-affixes.js';
import {activeTrait} from './traits.js';
import {distance,DIRECTIONS,key} from './world.js';
import {pullLanding} from './melee-classes.js';
import {pinned} from './suppression.js';
import {interruptEnemyIntent} from './enemy-intents.js';
import {enemyRoom,expendableRoom} from './runtime-enemies.js';
import {occupied} from './allies.js';

import {SWARM_TUNING} from './swarm-tuning.js';
export {SWARM_TUNING} from './swarm-tuning.js';
const affix=(e,id)=>e.affixes?.some(a=>a.id===id);
// First pass uses the player's established toxin status. Allies intercept venom harmlessly.
export function poisonHit(g,e,target){
 if(target!==g.player||target.hp<=0||activeTrait(target,'mechanical'))return false;
 if(!enemyDef(e)?.venom&&!affix(e,'venomous'))return false;
 if(affix(e,'venomous'))revealEnemyAffix(g,e,'venomous');
 target.poison=Math.min(SWARM_TUNING.poisonCap,(target.poison||0)+SWARM_TUNING.poisonTurns);
 g.log('毒液侵入防護服，你中毒了。',true);return true;
}
export function tonguePlan(g,e){
 const p=g.player;
 if(p.hp<=0||distance(e,p)<=1||distance(e,p)>SWARM_TUNING.tongueRange||!g.sight(e,p)||!g.shotClear(e,p))return null;
 const point=pullLanding(g,p,e);return point?{point,origin:{x:e.x,y:e.y},target:{x:p.x,y:p.y}}:null;
}
export function tongueAction({g,e}){
 if(!enemyDef(e)?.tongue)return false;
 if(pinned(e)){if(e.tongueIntent)interruptEnemyIntent(e,'suppressed');return false;}
 const pending=e.tongueIntent;
 if(!pending&&(e.tongueCooldown||0)>0)return false;
 const plan=tonguePlan(g,e);
 if(pending){
  // Track the announced tile: moving away is a reliable way to evade the tongue.
  const valid=plan&&key(pending.origin)===key(e)&&key(pending.target)===key(g.player)&&key(pending.point)===key(plan.point);
  delete e.tongueIntent;e.tongueCooldown=SWARM_TUNING.tongueCooldown;
  if(!valid){g.log('鉤舌撲空，未能拉住目標。');return true;}
  const p=g.player,from={x:p.x,y:p.y};Object.assign(p,plan.point);p.moved=true;p.moveDelta=[p.x-from.x,p.y-from.y];p.cornerExposure=null;p.fireChain=null;p.guard=false;p.focus=false;p.evasive=false;
  g.effects.push({type:'tonguePull',sourceId:e.id,from,to:{...plan.point},origin:{...plan.origin},damage:0});g.log('鉤舌將你拖向巨蟲！',true);g.reveal();return true;
 }
 if(!plan)return false;
 interruptEnemyIntent(e,'target_lost');e.tongueIntent=plan;
 g.effects.push({type:'tongueTelegraph',sourceId:e.id,from:{...plan.origin},to:{...plan.target},landing:{...plan.point},damage:0});g.log('巨蟲繃緊鉤舌：離開拉扯路線！',true);return true;
}
export const tongueTelegraphs=g=>g.enemies.filter(e=>e.hp>0&&e.tongueIntent).map(e=>({kind:'tongue',sourceId:e.id,origin:{...e.tongueIntent.origin},target:{...e.tongueIntent.target},landing:{...e.tongueIntent.point},interruptible:true}));
export function tickTongues(g){for(const e of g.enemies){if(e.tongueCooldown>0)e.tongueCooldown--;if(e.tongueIntent&&(e.hp<=0||e.control?.disabled||pinned(e)))interruptEnemyIntent(e,e.hp<=0?'death':e.control?.disabled?'disabled':'suppressed');}}
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
 if(count)g.log('感染者的軀殼裂開，幼蟲竄了出來。',true);
}
export function validSwarm(g){
 const frames=[g,...Object.values(g.floorStates||{})];
 if(!Number.isSafeInteger(g.player.poison)||g.player.poison<0||g.player.poison>SWARM_TUNING.poisonCap)return false;
 for(const f of frames)for(const e of f.enemies||[]){
  if(e.tongueCooldown!==undefined&&(!enemyDef(e)?.tongue||!Number.isSafeInteger(e.tongueCooldown)||e.tongueCooldown<0||e.tongueCooldown>SWARM_TUNING.tongueCooldown))return false;
  if(e.tongueIntent!==undefined){if(!e.tongueIntent)return false;const s=e.tongueIntent,point=p=>p&&Number.isInteger(p.x)&&Number.isInteger(p.y)&&f.grid[p.y]?.[p.x]===1;
   if(!enemyDef(e)?.tongue||e.hp<=0||e.control?.disabled||pinned(e)||!point(s.origin)||!point(s.target)||!point(s.point)||key(e)!==key(s.origin)||distance(s.origin,s.target)>SWARM_TUNING.tongueRange||distance(s.origin,s.point)!==1)return false;
  }
  if(e.broodReleased!==undefined&&(!affix(e,'brood_host')||e.broodReleased!==true||e.hp>0))return false;
  if(e.broodParent!==undefined){const parent=f.enemies.find(p=>p.id===e.broodParent);if(!parent?.broodReleased||!hasEnemyTag(parent,'infected')||enemyFaction(parent)!==enemyFaction(e)||!e.expendable||!e.reinforcement||!Array.from({length:SWARM_TUNING.burstMax},(_,n)=>String(n)).some(n=>e.id===`${parent.id}-burst-${n}`)||e.type!==factionDef(enemyFaction(parent)).nestChild)return false;}
 }
 return true;
}
