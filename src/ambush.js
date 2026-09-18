// 伏擊 (3.130.0, user design 2026-09-18, docs/ORDERS.md §7): the natural next step after 迂迴. A unit that only
// detours still has to come out of a doorway into your fire; an ambusher waits beside the doorway you have to use.
// Rules the user decided:
// - Given to half of a squad that has lost you (the other half still searches), and taken by snipers on their own.
// - It breaks when it is seen, when it is hit, when you go another way, or after six turns — like the squad's patience.
// - It may call out, but never say what it is doing.
// - It picks the spot that best protects it while still hurting you; a dark tile counts in its favour (you shoot
//   worse into the dark), it is not a hiding place.
// - When the order ends — fired, broken or out of patience — the unit is back to normal.
import {registerOrder,giveOrder,endOrder,resting} from './orders.js';
import {accepts,selfTerms} from './personality.js';
import {DETOUR_TRAIT,exposedFrom} from './detour.js';
import {grantTrait,removeTraitSource} from './traits.js';
import {enemyDef} from './enemy-data.js';
import {enemyCallout} from './enemy-intents.js';
import {isDark} from './lighting.js';
import {distance,key,DIRECTIONS} from './world.js';
import {SIZE} from './data.js';

export const AMBUSH_TUNING=Object.freeze({reach:8,chokeAhead:2});
const SOURCE='order:ambush';

// The way you would take from where it last knew you were to the lift: a plain shortest walk under your own rules.
export function playerRoute(g,from,goal){
 if(!from||!goal)return null;
 const start={x:from.x,y:from.y},prev=new Map([[key(start),null]]),queue=[start];
 for(let i=0;i<queue.length;i++){
  const q=queue[i];
  if(q.x===goal.x&&q.y===goal.y){const path=[];for(let c=q;c;c=prev.get(key(c)))path.unshift(c);return path;}
  for(const [dx,dy] of DIRECTIONS){
   const n={x:q.x+dx,y:q.y+dy},k=key(n);
   if(prev.has(k)||!g.passable(n.x,n.y)||!g.canCross(q,n))continue;
   prev.set(k,q);queue.push(n);
  }
 }
 return null;
}
const open=(g,q)=>g.grid[q.y]?.[q.x]===1;
// A doorway, or a one-tile corridor: walls on both sides across the way you walk through it.
function narrow(g,q,dir){
 if((g.openings||[]).some(o=>(o.cells||[]).some(c=>c.x===q.x&&c.y===q.y)))return true;
 const [dx,dy]=dir,side=[[dy,dx],[-dy,-dx]];
 return side.every(([sx,sy])=>!open(g,{x:q.x+sx,y:q.y+sy}));
}
// The first narrow place on your route, at least two steps ahead of where you were last seen.
export function chokeOnRoute(g,route){
 if(!route)return null;
 for(let i=AMBUSH_TUNING.chokeAhead;i<route.length-1;i++){
  const q=route[i],dir=[q.x-route[i-1].x,q.y-route[i-1].y];
  if(narrow(g,q,dir))return {x:q.x,y:q.y,dir};
 }
 return null;
}
// Where to wait: unseen from your last known tile, with a clear shot at the choke inside its own range, reachable,
// never in the line you come out along, and scored for protection (cover towards the choke, darkness, not too close)
// and for damage (the choke lit, the shot short). Ties go to the nearer spot, then the upper-left one; no dice.
// 堅守 (hidden:false) takes the same doorway but does not need a tile you cannot see.
export function ambushSpot(g,e,from,choke,taken=new Set(),{hidden=true}={}){
 const range=enemyDef(e)?.range||1;if(range<=1)return null;
 const reach=Math.min(range,AMBUSH_TUNING.reach),seen=hidden?exposedFrom(g,from):new Set(),found=[];
 const others=[g.player,...g.enemies.filter(o=>o.hp>0&&o!==e),...g.activeAllies];
 for(let y=choke.y-reach;y<=choke.y+reach;y++)for(let x=choke.x-reach;x<=choke.x+reach;x++){
  if(x<0||y<0||x>=SIZE||y>=SIZE)continue;
  const q={x,y},d=distance(q,choke);
  if(d<2||d>reach||!g.passable(x,y,e)||seen.has(key(q))||taken.has(key(q))||g.hazards.some(h=>distance(h,q)===0))continue;
  if(others.some(a=>distance(a,q)===0))continue;
  const [dx,dy]=choke.dir,ox=x-choke.x,oy=y-choke.y;
  if(dx===0?ox===0:oy===0)continue;                    // straight out of the choke: you would come out facing it
  const at={...e,x,y};if(!g.sight(at,choke)||!g.shotClear(at,choke))continue;
  const protect=(g.protectingCover(q,choke)?3:0)+(isDark(g,q)?2:0)-(d<3?2:0);
  const damage=(isDark(g,choke)?0:2)+(d<=Math.ceil(range/2)?1:0);
  found.push({q,score:protect+damage,near:distance(e,q)});
 }
 found.sort((a,b)=>b.score-a.score||a.near-b.near||a.q.y-b.q.y||a.q.x-b.q.x);
 return found.find(f=>f.near===0||g.routeSearch(e,f.q,null))?.q||null;
}
// Gives the order if the map allows one; false when there is no choke or no spot, and the unit carries on as before.
export function orderAmbush(g,e,{by='self',from=e.lastKnown,taken,kind='ambush',inRange=false}={}){
 const exit=g.exitPoint;if(!from||!exit)return false;
 const choke=chokeOnRoute(g,playerRoute(g,from,exit));if(!choke)return false;
 // 堅守: only a doorway already inside the soldier's own range (user: 必經門口在牠射程內).
 if(inRange&&distance(e,choke)>(enemyDef(e)?.range||1))return false;
 const at=ambushSpot(g,e,from,choke,taken||reserved(g),{hidden:kind==='ambush'});if(!at)return false;
 // A leader's order carries what the leader knows: the member now takes your last tile from it.
 e.lastKnown={x:from.x,y:from.y};
 const order={kind,by,at,watch:{x:choke.x,y:choke.y},from:{x:from.x,y:from.y},patience:6,breakOn:kind==='ambush'?['spotted','hit','passed']:['hit','passed']};
 return giveOrder(g,e,by==='self'?selfTerms(e,order):order);
}
const reserved=g=>new Set(g.enemies.filter(o=>o.hp>0&&o.order?.at).map(o=>key(o.order.at)));

const canShoot=(g,e,p)=>g.sight(e,p)&&g.shotClear(e,p)&&distance(e,p)<=(enemyDef(e)?.range||1);
const watchOrder=cue=>({
 start(g,e){grantTrait(e,DETOUR_TRAIT,SOURCE);e.tactics=null;},
 end(g,e,order,why){
  removeTraitSource(e,SOURCE);
  // Out of patience or given up: the aim on an empty doorway is dropped, so nothing fires at it blind afterwards.
  if(why!=='fired'&&e.aim&&e.aim.x===order.watch?.x&&e.aim.y===order.watch?.y){e.charge=false;e.aim=null;e.windup=1;}
 },
 act(ctx,order){
  const {g,e,p}=ctx;
  // Done: you are in its sights. The order ends and the held aim goes off this very turn, without a telegraph.
  if(p&&canShoot(g,e,p)){endOrder(g,e,'fired');return 'fire';}
  if(order.breakOn.includes('spotted')&&g.teamVisible(e)){endOrder(g,e,'spotted');return false;}
  // You went another way: what it now knows of you no longer leads through its doorway.
  const known=e.lastKnown;
  if(order.breakOn.includes('passed')&&known&&(known.x!==order.from.x||known.y!==order.from.y)){
   const choke=chokeOnRoute(g,playerRoute(g,known,g.exitPoint));
   if(!choke||choke.x!==order.watch.x||choke.y!==order.watch.y){endOrder(g,e,'passed');return false;}
  }
  if(distance(e,order.at)>0){
   // Patience is the wait, not the walk (user: 等六回合): it starts counting once the unit is in place.
   order.since=g.turn;
   const step=g.nextStep(e,order.at);
   if(!step||g.enemies.some(o=>o.hp>0&&o!==e&&distance(o,step)===0)||distance(step,g.player)===0){endOrder(g,e,'blocked');return false;}
   e.x=step.x;e.y=step.y;e.moved=true;return true;
  }
  // In place: aim held on the doorway, so the first shot needs no warning. It says something, never what.
  if(!e.charge||e.aim?.x!==order.watch.x||e.aim?.y!==order.watch.y){order.since=g.turn;e.charge=true;e.windup=1;e.aim={...order.watch};enemyCallout(g,e,'state',{state:cue});}
  e.moved=false;return true;
 },
});
registerOrder('ambush',watchOrder('lurk'));
// 堅守 (3.133.0): the same watch in the open, for a disciplined soldier who knows where you are but cannot see you.
registerOrder('hold',watchOrder('hold'));

// Personality (docs/ORDERS.md §8): a unit whose card accepts ambush takes one by itself when it knows where you were
// but cannot see you, has no order, and belongs to no squad (a squad's orders come from its leader).
export function selfAmbush(ctx){
 const {g,e,p,los}=ctx;
 if(e.order||e.squad||los||p!==g.player||!e.alert||!e.lastKnown||!accepts(e,'ambush')||resting(g,e,'ambush'))return false;
 return orderAmbush(g,e);
}
// 堅守 (3.133.0): knows where you were, cannot see you, and your way to the lift runs through a doorway in its range.
export function selfHold(ctx){
 const {g,e,p,los}=ctx;
 if(e.order||e.squad||los||p!==g.player||!e.alert||!e.lastKnown||!accepts(e,'hold')||resting(g,e,'hold'))return false;
 return orderAmbush(g,e,{kind:'hold',inRange:true});
}
