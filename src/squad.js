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
// 3.126.0, bounding overwatch (user design, docs/SQUAD.md). Deployment is a shape that keeps changing, not a phase:
// - Whoever can shoot you covers; whoever cannot advances, members without a line of sight first, at most half at once.
//   An advancer is fast on the move and on the turn it arrives, and keeps its aim, so a soldier you let into a doorway
//   shoots before you do. Moving away no longer reopens the window — only a new weapon does.
// - The leader sees through smoke (infrared) and in the dark (night vision) and calls out your tile: soldiers who cannot
//   see you fire at it at −40, which replaces the darkness penalty. Smoke plus a stun on the leader, or a shut door,
//   blinds the whole squad.
// - Blind, they hold 已就緒 for six turns of patience, then half of them bound to where you were last seen; nobody
//   there means the squad disbands and the next contact is a fresh identification.
// - A squad standing on your only way to the lift never advances and never loses patience.
import {SUPPRESSION_TUNING,finishSuppression} from './suppression.js';
import {areaCells} from './throwables.js';
import {enemyDef,isNoncombatant} from './enemy-data.js';
import {enemyDisplayName} from './enemy-affixes.js';
import {enemyCallout} from './enemy-intents.js';
import {grantTrait,activeTrait,removeTraitSource} from './traits.js';
import {DETOUR_TRAIT} from './detour.js';
import {registerOrder,giveOrder,endOrder} from './orders.js';
import {orderAmbush} from './ambush.js';
import {distance,key,DIRECTIONS,makeEnemy} from './world.js';
import {roomTiles} from './map-geometry.js';
import {factionDef} from './faction-catalog.js';
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
 patience:6,        // turns a blinded squad holds before it goes looking: a smoke grenade lasts five
 blindPenalty:40,   // a shot at the tile the leader called out; it replaces the darkness penalty, never adds to it
 fastTurns:2,       // an advancer is fast while it moves and on the turn it arrives
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
export const squadMembers=(g,leader)=>g.enemies.filter(e=>e!==leader&&e.hp>0&&e.alert&&(!e.order||onDutyFor(e,leader))&&!isNoncombatant(e)&&!isSquadLeader(e)&&(enemyDef(e)?.range||1)>1&&distance(e,leader)<=SQUAD_TUNING.radius).slice(0,SQUAD_TUNING.members);

// A firing position for one member: it can shoot from there, it keeps the distance the player's weapon demands, and
// cover beats no cover. Taken tiles are reserved so a squad never stacks up on one doorway.
// 3.127.2 (user decision): every member must end up with the player inside its own range. The weapon answer is tried
// first; if the room leaves no such spot, the answer's spacing rules are dropped; if there is still no clear line, the
// member at least closes to its own range, and the bounding advance finds it a line from there.
export function firingSpot(g,member,player,answer,taken){
 for(const pass of ['answer','clear','range']){const spot=pickSpot(g,member,player,answer,taken,pass);if(spot)return spot;}
 return null;
}
function pickSpot(g,member,player,answer,taken,pass){
 const range=enemyDef(member)?.range||1,reach=Math.min(SQUAD_TUNING.search,Math.max(range,2));
 const found=[];
 for(let y=player.y-reach;y<=player.y+reach;y++)for(let x=player.x-reach;x<=player.x+reach;x++){
  if(x<0||y<0||x>=SIZE||y>=SIZE)continue;
  const spot={x,y},d=distance(spot,player);
  if(d>range||!g.passable(x,y,member)||g.hazards.some(h=>distance(h,spot)===0))continue;
  if(taken.has(key(spot))||[g.player,...g.enemies.filter(e=>e.hp>0&&e!==member),...g.activeAllies].some(a=>distance(a,spot)===0))continue;
  const from={...member,x,y},clear=g.sight(from,player)&&g.shotClear(from,player);
  if(pass!=='range'&&!clear)continue;
  if(pass==='answer'){
   if(answer.keepAway&&d<answer.keepAway)continue;
   if(answer.closeIn&&d>answer.closeIn)continue;
   if(answer.spacing&&[...taken].some(k=>{const [tx,ty]=k.split(',').map(Number);return distance({x:tx,y:ty},spot)<answer.spacing;}))continue;
  }
  const cover=g.protectingCover(spot,player)?0:6;
  const score=cover+distance(member,spot)+(pass==='answer'&&answer.closeIn?d:0);
  found.push({spot,score});
 }
 // Same order as before (first lowest score wins); only the fallback pays for a path check, and only until one works.
 found.sort((a,b)=>a.score-b.score);
 if(pass!=='range')return found[0]?.spot||null;
 return found.find(f=>distance(member,f.spot)===0||g.nextStep(member,f.spot))?.spot||null;
}
// 3.128.0 (user design 2026-09-18): a squad is placed, not drawn. After the mission picks its targets, each faction
// with a squad plan gets a leader and three guns in each of its largest rooms (not the start room; the lift's room is
// fine), outside the threat budget, with no random roll. The leader stands at the back — the tile farthest from where
// you arrive — and the members two to five tiles in front of it, next to cover where there is some, spaced apart.
// A room too cramped for all four is skipped for the next largest.
export function postSquads(g){
 const plan=factionDef(g.facilityFaction)?.squads;if(g.simulation||!plan)return 0;
 const types=g.floor<=2?plan.early:plan.late,exit=g.exitPoint,openings=(g.openings||[]).flatMap(o=>o.cells||[]);
 const taken=new Set([key(g.player),...[g.enemies,g.props,g.items,g.hazards,g.slots||[]].flat().map(key)]);
 const free=q=>g.grid[q.y]?.[q.x]===1&&g.passable(q.x,q.y)&&!taken.has(key(q))&&!openings.some(o=>distance(o,q)<=1)&&
  distance(q,g.start)>2&&!(exit&&distance(q,exit)===0);
 const byKey=(a,b)=>a.y-b.y||a.x-b.x,cover=q=>g.props.some(o=>o.type==='cover'&&distance(o,q)===1);
 const rooms=(g.rooms||[]).map((r,i)=>({i,tiles:roomTiles(r).filter(free)})).filter(r=>r.i!==g.startRoom)
  .sort((a,b)=>b.tiles.length-a.tiles.length||a.i-b.i);
 let placed=0;
 for(const room of rooms){
  if(placed>=plan.perFloor)break;
  const open=room.tiles.filter(free);if(open.length<types.length+1)continue;
  const leaderAt=[...open].sort((a,b)=>distance(b,g.start)-distance(a,g.start)||byKey(a,b))[0];
  const front=open.filter(q=>distance(q,leaderAt)>=2&&distance(q,leaderAt)<=5)
   .sort((a,b)=>Number(cover(b))-Number(cover(a))||distance(a,g.start)-distance(b,g.start)||byKey(a,b));
  let spots=[];
  for(const spacing of [2,1]){spots=[];for(const q of front)if(spots.length<types.length&&spots.every(s=>distance(s,q)>=spacing))spots.push(q);if(spots.length===types.length)break;}
  if(spots.length<types.length)continue;
  const id=`squad-${g.floor}-${placed}`,f=g.facilityFaction;
  const units=[makeEnemy('squad_leader',leaderAt.x,leaderAt.y,`${id}-L`,g.floor,g.difficultyOffset,f),...types.map((t,j)=>makeEnemy(t,spots[j].x,spots[j].y,`${id}-${j}`,g.floor,g.difficultyOffset,f))];
  for(const u of units)taken.add(key(u));
  g.enemies.push(...units);placed++;
 }
 return placed;
}
// The identification turn: orders go out, nobody shoots.
export function deploySquad(g,leader,members,weaponId){
 const answer=weaponAnswer(g),taken=new Set(),p=g.player;
 for(const member of members){
  const spot=firingSpot(g,member,p,answer,taken);
  if(spot)taken.add(key(spot));
  member.squad={leader:leader.id,suppressed:0};
  givePost(g,leader,member,spot||{x:member.x,y:member.y},!spot||distance(member,spot)===0);
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
 return members.every(m=>dutyOf(m)?.set??true)||waited>=SQUAD_TUNING.deployTurns;
}
// Only a new weapon reopens the identification window; moving away is answered by the formation moving with you.
export const squadStale=(g,leader,weaponId)=>!leader.squad||leader.squad.weapon!==weaponId;
// 已就緒: the player's wait, handed to the squad. Setting the aim as well is what makes it a volley instead of another
// turn of telegraphing — they are already set, so the shot comes on their next action.
// 3.128.1 (user decision): a member still walking to its spot is not ready yet — it keeps walking, and the leader's next
// re-application reaches it once it has arrived. So the deadline readies whoever is in place, not the stragglers.
// Bounding advancers are not stragglers: their callers decide (patience keeps them ready, contact leaves them out).
export function makeReady(g,leader,members){
 for(const actor of [leader,...members.filter(m=>dutyOf(m)?.set!==false||m.order?.kind==='bound')]){
  grantTrait(actor,READY_TRAIT,SQUAD_SOURCE,SQUAD_TUNING.readyTurns);
  if(actor!==leader&&(enemyDef(actor)?.range||1)>1){actor.charge=true;actor.windup=1;actor.aim={x:g.player.x,y:g.player.y};}
 }
}
// Sensing is sight as each unit has it: the leader's infrared sees through smoke, nothing sees through a wall or a door.
export const senses=(g,actor,player)=>actor.hp>0&&!actor.control?.disabled&&g.sight(actor,player);
export const canShoot=(g,member,player)=>g.sight(member,player)&&g.shotClear(member,player)&&distance(member,player)<=(enemyDef(member)?.range||1);
// Holding the route: with the squad's bodies and firing spots treated as walls, can the player still reach the lift?
// Asked with and without the squad, so a lift that is out of reach for other reasons never counts as their doing.
export function holdsTheRoute(g,leader,members){
 const exit=g.exitPoint,p=g.player;if(!exit)return false;
 const walls=new Set([leader,...members].flatMap(m=>[key(m),...(dutyOf(m)?[key(dutyOf(m).at)]:[])]));
 const reach=blocked=>{
  const queue=[{x:p.x,y:p.y}],seen=new Set([key(p)]);
  for(let i=0;i<queue.length;i++){
   const q=queue[i];if(distance(q,exit)<=1)return true;
   for(const [dx,dy] of DIRECTIONS){
    const n={x:q.x+dx,y:q.y+dy},k=key(n);
    if(seen.has(k)||blocked.has(k)||g.grid[n.y]?.[n.x]!==1||g.solid(n.x,n.y)||!g.canRoute(q,n))continue;
    seen.add(k);queue.push(n);
   }
  }
  return false;
 };
 return reach(new Set())&&!reach(walls);
}
// Who advances: never more than half the squad at once, so someone always covers. In contact the ones who cannot see
// you go first; while searching, whoever moved least recently goes, so the two halves take turns.
export function assignMovers(g,leader,mine,target,search){
 for(const m of mine)if(m.order?.kind==='bound'&&distance(m,m.order.at)===0)givePost(g,leader,m,m.order.at,m.order.set);
 const moving=mine.filter(m=>m.order?.kind==='bound');
 // 3.128.1 (user decision): in contact half rounds up, so three members bound in a pair instead of one at a time; the
 // search stays at half rounded down, as the user decided for 3.126.0.
 const slots=Math.max(1,search?Math.floor(mine.length/2):Math.ceil(mine.length/2))-moving.length;if(slots<=0)return;
 const answer=weaponAnswer(g),taken=new Set(mine.map(m=>key(m.order?.kind==='bound'?m.order.at:m)));
 const candidates=mine.filter(m=>m.order?.kind!=='bound'&&(search||!canShoot(g,m,g.player)))
  .sort((a,b)=>(search?0:Number(g.sight(a,g.player))-Number(g.sight(b,g.player)))||(a.squad.lastMove||0)-(b.squad.lastMove||0)||distance(a,target)-distance(b,target)||a.id.localeCompare(b.id));
 for(const m of candidates.slice(0,slots)){
  taken.delete(key(m));
  const goal=search?searchSpot(g,m,target,taken):firingSpot(g,m,g.player,answer,taken);
  if(!goal){taken.add(key(m));continue;}
  taken.add(key(goal));
  m.squad.lastMove=g.turn;giveOrder(g,m,{kind:'bound',by:leader.id,at:goal,set:false,patience:null,breakOn:[]});
  grantTrait(m,'fast','squad:advance',SQUAD_TUNING.fastTurns);
  m.charge=true;m.windup=1;
 }
}
function searchSpot(g,member,target,taken){
 const spots=[target,...DIRECTIONS.map(([dx,dy])=>({x:target.x+dx,y:target.y+dy}))];
 return spots.filter(q=>g.passable(q.x,q.y,member)&&!taken.has(key(q))&&!g.enemies.some(e=>e.hp>0&&e!==member&&distance(e,q)===0))
  .sort((a,b)=>distance(member,a)-distance(member,b)||key(a).localeCompare(key(b)))[0]||null;
}
// 3.132.0 (docs/ORDERS.md phase three): what a member does is an order its leader gives it — 'post' (go to the
// firing spot, suppress while the squad deploys, then cover) or 'bound' (the cross-covering advance, and the search).
// e.squad keeps only who leads it and its own suppression and move stamps. 'set' is whether it has reached its spot,
// or given up walking because the way was blocked. A bounding member carries 迂迴 (3.129.0) for as long as it bounds.
const DUTY=new Set(['post','bound']);
const SQUAD_DETOUR='squad:detour';
export const dutyOf=m=>DUTY.has(m?.order?.kind)?m.order:null;
function onDutyFor(e,leader){return DUTY.has(e.order?.kind)&&e.order.by===leader.id;}
function givePost(g,leader,m,at,set){giveOrder(g,m,{kind:'post',by:leader.id,at:{x:at.x,y:at.y},set,patience:null,breakOn:[]});}
// A disbanded squad's members are back to normal; a member away on an ambush keeps it (it is its own commitment now).
export function disbandSquad(g,leader,mine){for(const m of mine){delete m.squad;if(dutyOf(m))endOrder(g,m,'disbanded');}delete leader.squad;}
// The leader's callout turns a blinded soldier's shot into a shot at a tile: −40, and the darkness penalty is replaced.
// The attack itself is the card's own, handed in by enemy-behavior.js so the two files do not import each other.
let cardAttack=null;
export const useSquadAttack=fn=>{cardAttack=fn;};
function blindFire(ctx){
 const {g,e,p}=ctx;if(!cardAttack||!g.shotClear(e,p)||distance(e,p)>(enemyDef(e)?.range||1))return false;
 e.blindShot=SQUAD_TUNING.blindPenalty;
 try{cardAttack(ctx);}finally{delete e.blindShot;}
 e.charge=false;e.windup=1;e.aim=null;e.attackCount=(e.attackCount||0)+1;
 g.log(`${enemyDisplayName(e)}依小隊長回報的位置朝你開火。`,true);
 return true;
}
// The turn the orders go out is quiet even for a soldier who happens to be standing in a good spot already: the user's
// rule is that identification costs the squad its fire, which is what makes it the player's window.
export const canSuppress=(g,member,leader)=>Boolean(leader)&&(member===leader?Boolean(leader.squad?.set):Boolean(dutyOf(member)?.set))&&leader.squad?.since!==g.turn&&
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
// The member's own turn while the squad works: walk to the assigned tile, then keep the player's head down. Both
// duty orders share it; a bounding member is fast until it arrives, then turns to cover (a post where it stands).
function dutyAct(ctx,order){
 const {g,e,p}=ctx,state=e.squad;
 const leader=state&&g.enemies.find(o=>o.id===state.leader&&o.hp>0&&isSquadLeader(o));
 if(!leader){delete e.squad;endOrder(g,e,'leaderless');return false;}
 if(p!==g.player)return false;
 if(!order.set){
  if(distance(e,order.at)===0)order.set=true;
  else{
   const step=g.nextStep(e,order.at);
   if(step&&!g.enemies.some(o=>o.hp>0&&o!==e&&distance(o,step)===0)&&distance(step,g.player)!==0){e.x=step.x;e.y=step.y;e.moved=true;enemyCallout(g,e,'state',{state:'move'});return true;}
   order.set=true;   // blocked: fight from here rather than shuffle for ever
  }
 }
 if(leader.squad?.state==='deploy'){
  if(squadReady(e))return false;                      // ready: fall through to the volley
  if(canSuppress(g,e,leader)&&suppressFrom(g,e,p,leader))return true;
  enemyCallout(g,e,'state',{state:'hold'});
  return true;
 }
 // Bounding: an advancer walks to its new spot, fast; the turn it arrives it is still fast and still aimed.
 if(order.kind==='bound'){
  if(distance(e,order.at)>0){
   const step=g.nextStep(e,order.at);
   if(step&&!g.enemies.some(o=>o.hp>0&&o!==e&&distance(o,step)===0)&&distance(step,g.player)!==0){
    e.x=step.x;e.y=step.y;e.moved=true;grantTrait(e,'fast','squad:advance',SQUAD_TUNING.fastTurns);
    enemyCallout(g,e,'state',{state:leader.squad.state==='search'?'search':'flank'});return true;
   }
  }
  givePost(g,leader,e,order.at,true);grantTrait(e,'fast','squad:advance',SQUAD_TUNING.fastTurns);
 }
 if(canShoot(g,e,p))return false;                     // a covering soldier with a line shoots, 已就緒 or not
 // Only a leader who senses you right now can call you out: a stunned or blinded one leaves no stale report behind.
 if(leader.squad.blind&&senses(g,leader,p)&&blindFire(ctx))return true;
 enemyCallout(g,e,'state',{state:'hold'});
 return true;                                         // no line: hold the spot and wait for you to show
}
const dutyKeys=['set'],dutyValid=o=>typeof o.set==='boolean';
registerOrder('post',{keys:dutyKeys,valid:dutyValid,act:dutyAct});
registerOrder('bound',{keys:dutyKeys,valid:dutyValid,act:dutyAct,
 start(g,e){grantTrait(e,DETOUR_TRAIT,SQUAD_DETOUR);},end(g,e){removeTraitSource(e,SQUAD_DETOUR);}});
// The leader's own turn: identify and deploy, or hold the squad ready. It never fires while it has a squad.
export function squadLeaderAct(ctx){
 const {g,e,p,los}=ctx;
 if(p!==g.player||!e.alert)return false;
 const weaponId=g.weapon?.id??'unarmed';
 const members=squadMembers(g,e);
 // A member away on an order (3.130.0 伏擊) keeps its place in the squad but is out of the rotation until it is back.
 const all=g.enemies.filter(o=>o.hp>0&&o.squad?.leader===e.id),mine=all.filter(o=>!o.order||DUTY.has(o.order.kind));
 // A member back from an ambush takes up a post where it stands.
 for(const m of mine)if(!m.order)givePost(g,e,m,{x:m.x,y:m.y},true);
 if(!los&&!all.length)return false;
 if(squadStale(g,e,weaponId)||!all.length){
  if(!los||!members.length)return false;
  deploySquad(g,e,members,weaponId);
  enemyCallout(g,e,'telegraph',{action:'flank'});
  g.log(`${enemyDisplayName(e)}識別了你的${g.weapon?.name||'武器'}，小隊開始展開。`,true);
  return true;                                        // the identification turn: orders only, no suppression
 }
 const sensed=mine.some(m=>senses(g,m,p)),reported=!sensed&&senses(g,e,p);
 if(sensed||reported){e.squad.last={x:p.x,y:p.y};e.squad.patience=SQUAD_TUNING.patience;}
 if(e.squad.state==='deploy'){
  if(squadSet(g,e)){
   makeReady(g,e,mine);e.squad.state='ready';
   g.log(`${enemyDisplayName(e)}下令：小隊已就緒。`,true);
   return true;
  }
  if(canSuppress(g,e,e)&&suppressFrom(g,e,p,e))return true;
  return true;
 }
 const hold=holdsTheRoute(g,e,mine);
 if(hold)for(const m of mine)if(m.order?.kind==='bound')givePost(g,e,m,{x:m.x,y:m.y},m.order.set);
 if(sensed||reported){
  e.squad.state='ready';e.squad.blind=reported;
  if(!hold)assignMovers(g,e,mine,p,false);
  makeReady(g,e,mine.filter(m=>m.order?.kind!=='bound'));
  if(reported)g.log(`${enemyDisplayName(e)}回報你的位置。`,true);
  return true;
 }
 e.squad.blind=false;
 if(hold||e.squad.state!=='search'){
  if(!hold)e.squad.patience=Math.max(0,(e.squad.patience??SQUAD_TUNING.patience)-1);
  if(hold||e.squad.patience>0){
   if(e.squad.state!=='patience')g.log(`${enemyDisplayName(e)}：失去目標，原地待命。`,true);
   e.squad.state='patience';makeReady(g,e,mine);return true;
  }
  e.squad.state='search';g.log(`${enemyDisplayName(e)}下令：交叉掩護，搜索最後位置。`,true);
  // 3.130.0 (user decision): the other half goes to wait by the doorway on your way to the lift. The farthest from
  // your last tile go, so the nearest still search.
  const searchers=Math.max(1,Math.floor(mine.length/2)),last=e.squad.last||{x:e.x,y:e.y};
  const ambushers=[...mine].sort((a,b)=>distance(b,last)-distance(a,last)||a.id.localeCompare(b.id)).slice(0,mine.length-searchers);
  for(const m of ambushers){if(m.order?.kind==='bound')givePost(g,e,m,m.order.at,m.order.set);orderAmbush(g,m,{by:e.id,from:last});}
 }
 // The searchers are whoever is not away on an ambush; among them the search bounds half at a time, as before.
 const last=e.squad.last||{x:e.x,y:e.y},search=mine.filter(m=>m.order?.kind!=='ambush');
 if(search.some(m=>distance(m,last)<=1)||!search.length){
  disbandSquad(g,e,all);g.log(`${enemyDisplayName(e)}的小隊找不到你，解散搜索。`,true);return true;
 }
 assignMovers(g,e,search,last,true);
 makeReady(g,e,search.filter(m=>m.order?.kind!=='bound'));
 return true;
}
const point=q=>q&&Number.isInteger(q.x)&&Number.isInteger(q.y)&&q.x>=0&&q.y>=0&&q.x<SIZE&&q.y<SIZE;
export function validSquad(g){
 const actors=[...(g.enemies||[]),...Object.values(g.floorStates||{}).flatMap(f=>f.enemies||[])];
 return actors.every(e=>{
  const s=e.squad;if(s===undefined)return true;
  if(!s||typeof s!=='object'||Array.isArray(s))return false;
  if(isSquadLeader(e))return typeof s.weapon==='string'&&['deploy','ready','patience','search'].includes(s.state)&&Number.isSafeInteger(s.suppressTurn)&&s.suppressTurn>=0&&(s.answer===undefined||typeof s.answer==='string')&&(s.set===undefined||typeof s.set==='boolean')&&(s.since===undefined||Number.isSafeInteger(s.since))&&(s.at===undefined||point(s.at))&&
   (s.patience===undefined||Number.isSafeInteger(s.patience)&&s.patience>=0&&s.patience<=SQUAD_TUNING.patience)&&(s.last===undefined||point(s.last))&&(s.blind===undefined||typeof s.blind==='boolean');
  // 3.132.0 (SAVE 61): a member's spot and state live in its duty order; goal/set/role only arrive in older saves.
  return typeof s.leader==='string'&&s.leader.length>0&&s.leader.length<=100&&Number.isSafeInteger(s.suppressed)&&s.suppressed>=0&&
   s.goal===undefined&&s.set===undefined&&s.role===undefined&&(s.lastMove===undefined||Number.isSafeInteger(s.lastMove)&&s.lastMove>=0);
 });
}
