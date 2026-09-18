// Squad leader (3.125.0, user design 2026-09-18). The first enemy that knows the others exist.
// The loop the user asked for:
//   識別＋部署 → 就位者壓制 → 全隊已就緒 → 齊射 → 小隊長再把狀態加回來
// Rules the user decided:
// - The leader identifies the player's equipped weapon and sends the squad to positions that answer that weapon, so
//   switching weapons mid-fight makes the leader start over.
// - Identification costs no separate turn, and nobody suppresses on that turn because nobody is in position yet.
// - Someone in position fires suppression at the player when the corner is already exposed, and at a tile beside the
//   player when it is not; suppression needs the leader alive, has a one-turn cooldown per member, has no cap per turn,
//   and at least one member suppresses every turn.
// - 已就緒 is the player's wait, given to the whole squad: half damage, −15 to be hit, +15 on the next shot. It lasts one
//   round, so the leader spends its own action re-applying it — which is why killing the leader is the answer.
import {SUPPRESSION_TUNING,finishSuppression} from './suppression.js';
import {areaCells} from './throwables.js';
import {enemyDef,isNoncombatant} from './enemy-data.js';
import {enemyDisplayName} from './enemy-affixes.js';
import {enemyCallout} from './enemy-intents.js';
import {grantTrait,activeTrait} from './traits.js';
import {distance,key,DIRECTIONS} from './world.js';
import {spentCase} from './traces.js';
import {SIZE} from './data.js';

export const SQUAD_TUNING=Object.freeze({
 radius:7,          // how far from the leader a soldier still takes orders
 members:4,         // how many it directs, the leader aside
 suppressCooldown:1,
 readyTurns:2,      // granted during this turn, spent on the next one: one full round of readiness
 search:8,          // how far from the player a firing position may be looked for
 keepAway:3,        // melee, cone and blast all want distance
 closeIn:5,         // a long gun is answered by closing, not by trading
 spacing:2,         // cone and blast want the squad spread out
 deployMin:2,       // the window is never skipped: identification, then at least one turn of suppression
 deployTurns:3,     // orders do not wait for a straggler: the squad sets itself after this many turns
 regroup:4,         // move this far and their positions no longer answer you, so the leader starts over
});
export const READY_TRAIT='ready',SQUAD_SOURCE='squad';
export const isSquadLeader=e=>enemyDef(e)?.behavior==='squad_leader';
export const squadReady=e=>activeTrait(e,READY_TRAIT);

// What the player is holding decides what "a good position" means. Only weapon shape, never its owner's identity.
export function weaponAnswer(game){
 const w=game.weapon;
 if(!w)return {kind:'standard'};
 if(w.melee)return {kind:'melee',keepAway:SQUAD_TUNING.keepAway};
 if(w.cone)return {kind:'cone',keepAway:SQUAD_TUNING.keepAway,spacing:SQUAD_TUNING.spacing+1};
 if(w.pointTarget||w.explosive||w.splash)return {kind:'blast',keepAway:SQUAD_TUNING.keepAway,spacing:SQUAD_TUNING.spacing};
 if((w.range||0)>=8)return {kind:'long',closeIn:SQUAD_TUNING.closeIn};
 return {kind:'standard'};
}
export const squadMembers=(g,leader)=>g.enemies.filter(e=>e!==leader&&e.hp>0&&e.alert&&!isNoncombatant(e)&&!isSquadLeader(e)&&(enemyDef(e)?.range||1)>1&&distance(e,leader)<=SQUAD_TUNING.radius).slice(0,SQUAD_TUNING.members);

// A firing position for one member: it can shoot from there, it keeps the distance the player's weapon demands, and
// cover beats no cover. Taken tiles are reserved so a squad never stacks up on one doorway.
export function firingSpot(g,member,player,answer,taken){
 const range=enemyDef(member)?.range||1,reach=Math.min(SQUAD_TUNING.search,Math.max(range,2));
 let best=null;
 for(let y=player.y-reach;y<=player.y+reach;y++)for(let x=player.x-reach;x<=player.x+reach;x++){
  if(x<0||y<0||x>=SIZE||y>=SIZE)continue;
  const spot={x,y},d=distance(spot,player);
  if(d>range||!g.passable(x,y,member)||g.hazards.some(h=>distance(h,spot)===0))continue;
  if(taken.has(key(spot))||[g.player,...g.enemies.filter(e=>e.hp>0&&e!==member),...g.activeAllies].some(a=>distance(a,spot)===0))continue;
  const from={...member,x,y};
  if(!g.sight(from,player)||!g.shotClear(from,player))continue;
  if(answer.keepAway&&d<answer.keepAway)continue;
  if(answer.closeIn&&d>answer.closeIn)continue;
  if(answer.spacing&&[...taken].some(k=>{const [tx,ty]=k.split(',').map(Number);return distance({x:tx,y:ty},spot)<answer.spacing;}))continue;
  const cover=g.protectingCover(spot,player)?0:6;
  const score=cover+distance(member,spot)+(answer.closeIn?d:0);
  if(!best||score<best.score)best={spot,score};
 }
 return best?.spot||null;
}
// The identification turn: orders go out, nobody shoots.
export function deploySquad(g,leader,members,weaponId){
 const answer=weaponAnswer(g),taken=new Set(),p=g.player;
 for(const member of members){
  const spot=firingSpot(g,member,p,answer,taken);
  if(spot)taken.add(key(spot));
  member.squad={leader:leader.id,goal:spot||{x:member.x,y:member.y},set:!spot||distance(member,spot)===0,suppressed:0};
 }
 leader.squad={weapon:weaponId,state:'deploy',suppressTurn:0,answer:answer.kind,set:true,since:g.turn,at:{x:p.x,y:p.y}};
 return members.length>0;
}
export function squadSet(g,leader){
 const members=g.enemies.filter(e=>e.hp>0&&e.squad?.leader===leader.id);
 if(!members.length)return false;
 const since=leader.squad?.since??g.turn,waited=g.turn-since;
 // Deployment is always a real phase: even a squad that already stands well spends a turn suppressing before the order
 // to go ready, so the player always gets the window. A straggler cannot hold the squad past the deadline.
 if(waited<SQUAD_TUNING.deployMin)return false;
 return members.every(m=>m.squad.set)||waited>=SQUAD_TUNING.deployTurns;
}
export const squadStale=(g,leader,weaponId)=>!leader.squad||leader.squad.weapon!==weaponId||
 (leader.squad.at&&distance(leader.squad.at,g.player)>SQUAD_TUNING.regroup);
// 已就緒: the player's wait, handed to the squad. Setting the aim as well is what makes it a volley instead of another
// turn of telegraphing — they are already set, so the shot comes on their next action.
export function makeReady(g,leader,members){
 for(const actor of [leader,...members]){
  grantTrait(actor,READY_TRAIT,SQUAD_SOURCE,SQUAD_TUNING.readyTurns);
  if(actor!==leader&&(enemyDef(actor)?.range||1)>1){actor.charge=true;actor.windup=1;actor.aim={x:g.player.x,y:g.player.y};}
 }
 leader.squad.state='ready';
}
// The turn the orders go out is quiet even for a soldier who happens to be standing in a good spot already: the user's
// rule is that identification costs the squad its fire, which is what makes it the player's window.
export const canSuppress=(g,member,leader)=>Boolean(leader)&&Boolean(member.squad?.set)&&leader.squad?.since!==g.turn&&
 (g.turn-(member.squad.suppressed||0)>SQUAD_TUNING.suppressCooldown||leader.squad?.suppressTurn!==g.turn);
// Suppression at the player, or at the tile beside them when the corner still hides them. The area is the same radius
// the player's own suppressive fire uses, so a tile beside the player always reaches the player.
export function suppressionPoint(g,member,player){
 if(g.shotClear(member,player))return {x:player.x,y:player.y};
 const from=member;
 return DIRECTIONS.map(([dx,dy])=>({x:player.x+dx,y:player.y+dy}))
  .filter(spot=>g.grid[spot.y]?.[spot.x]===1&&g.sight(from,spot)&&g.shotClear({...from},spot))
  .sort((a,b)=>distance(from,a)-distance(from,b)||key(a).localeCompare(key(b)))[0]||null;
}
export function suppressFrom(g,member,player,leader){
 const point=suppressionPoint(g,member,player);if(!point)return false;
 const cells=new Set(areaCells(g.grid,point,1,g.barriers,g).map(key));
 const targets=[player,...g.activeAllies].filter(a=>a.hp>0&&cells.has(key(a)));
 member.squad.suppressed=g.turn;if(leader.squad)leader.squad.suppressTurn=g.turn;
 g.recordExposure(member,point);spentCase(g,member,enemyDef(member)?.casing);
 g.effects.push({type:'enemyShot',attackerType:member.type,from:{x:member.x,y:member.y},to:{x:point.x,y:point.y},damage:0,miss:true});
 finishSuppression(targets,new Set(),0,SUPPRESSION_TUNING.skillStacks,g);
 enemyCallout(g,member,'state',{state:'hold'});
 g.log(`${enemyDisplayName(member)}朝${distance(point,player)===0?'你':'你身邊'}壓制射擊。`,distance(point,player)===0);
 return true;
}
// The member's own turn while the squad works: walk to the assigned tile, then keep the player's head down.
export function squadMemberAct(ctx){
 const {g,e,p}=ctx,state=e.squad;
 if(!state)return false;
 const leader=g.enemies.find(o=>o.id===state.leader&&o.hp>0&&isSquadLeader(o));
 if(!leader){delete e.squad;return false;}
 if(p!==g.player)return false;
 if(!state.set){
  if(distance(e,state.goal)===0)state.set=true;
  else{
   const step=g.nextStep(e,state.goal);
   if(step&&!g.enemies.some(o=>o.hp>0&&o!==e&&distance(o,step)===0)&&distance(step,g.player)!==0){e.x=step.x;e.y=step.y;e.moved=true;enemyCallout(g,e,'state',{state:'move'});return true;}
   state.set=true;   // blocked: fight from here rather than shuffle for ever
  }
 }
 if(squadReady(e))return false;                       // ready: fall through to the volley
 if(leader.squad?.state==='ready')return false;
 if(canSuppress(g,e,leader)&&suppressFrom(g,e,p,leader))return true;
 enemyCallout(g,e,'state',{state:'hold'});
 return true;
}
// The leader's own turn: identify and deploy, or hold the squad ready. It never fires while it has a squad.
export function squadLeaderAct(ctx){
 const {g,e,p,los}=ctx;
 if(p!==g.player||!e.alert)return false;
 const weaponId=g.weapon?.id??'unarmed';
 const members=squadMembers(g,e);
 const mine=g.enemies.filter(o=>o.hp>0&&o.squad?.leader===e.id);
 if(!los&&!mine.length)return false;
 if(squadStale(g,e,weaponId)||!mine.length){
  if(!los||!members.length)return false;
  deploySquad(g,e,members,weaponId);
  enemyCallout(g,e,'telegraph',{action:'flank'});
  g.log(`${enemyDisplayName(e)}識別了你的${g.weapon?.name||'武器'}，小隊開始展開。`,true);
  return true;                                        // the identification turn: orders only, no suppression
 }
 if(squadSet(g,e)){
  makeReady(g,e,mine);
  g.log(`${enemyDisplayName(e)}下令：小隊已就緒。`,true);
  return true;
 }
 if(canSuppress(g,e,e)&&suppressFrom(g,e,p,e))return true;
 return true;
}
const point=q=>q&&Number.isInteger(q.x)&&Number.isInteger(q.y)&&q.x>=0&&q.y>=0&&q.x<SIZE&&q.y<SIZE;
export function validSquad(g){
 const actors=[...(g.enemies||[]),...Object.values(g.floorStates||{}).flatMap(f=>f.enemies||[])];
 return actors.every(e=>{
  const s=e.squad;if(s===undefined)return true;
  if(!s||typeof s!=='object'||Array.isArray(s))return false;
  if(isSquadLeader(e))return typeof s.weapon==='string'&&['deploy','ready'].includes(s.state)&&Number.isSafeInteger(s.suppressTurn)&&s.suppressTurn>=0&&(s.answer===undefined||typeof s.answer==='string')&&(s.set===undefined||typeof s.set==='boolean')&&(s.since===undefined||Number.isSafeInteger(s.since))&&(s.at===undefined||point(s.at));
  return typeof s.leader==='string'&&s.leader.length>0&&s.leader.length<=100&&point(s.goal)&&typeof s.set==='boolean'&&Number.isSafeInteger(s.suppressed)&&s.suppressed>=0;
 });
}
