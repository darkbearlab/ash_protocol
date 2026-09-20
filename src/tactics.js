import {DIRECTIONS,distance,key} from './world.js';
import {barrierBetween,edgeBlocks,vaultable} from './barriers.js';
import {SIZE} from './data.js';

export const TACTICS={searchNodes:320,maxSteps:24,planTurns:24,holdTurns:2,holdRetry:6};
const point=p=>p&&[p.x,p.y].every(n=>Number.isInteger(n)&&n>=0&&n<SIZE);
const same=(a,b)=>a&&b&&key(a)===key(b);
// Shared by hostile shooters and mobile allies. Occupied firing positions are never pushed aside.
// All target knowledge is supplied by the caller; this function never discovers a hidden target.
export function combatStep(g,a,target,{range,min=0,melee=false,leash=Infinity,peers=[],hold=false,investigate=false}={}){
 const actors=[g.player,...g.enemies.filter(e=>e.hp>0),...g.activeAllies],taken=new Set(actors.filter(b=>b!==a).map(key));
 const reservations=new Set(peers.filter(b=>b!==a&&b.tactics?.goal&&b.tactics.until>=g.turn).map(b=>key(b.tactics.goal)));
 if(investigate&&distance(a,target)<=1&&g.canCross(a,target)){a.tactics=null;return {done:true};}
 const old=a.tactics;
 if(old&&(!same(old.target,target)||old.until<g.turn))a.tactics=null;
 // 3.152.0 有效距離: `min` is the band's near edge, so a shooter standing too close looks for a tile further back.
 const at=q=>({...a,x:q.x,y:q.y}),canFire=q=>investigate?distance(q,target)<=1&&g.canCross(q,target):distance(q,target)<=range&&distance(q,target)>=min&&g.sight(at(q),target)&&g.shotClear(at(q),target)&&(!melee||g.canCross(q,target));
 const flank=peers.some(b=>b!==a&&!b.control?.disabled&&b.tactics?.goal&&!same(b,b.tactics.goal)&&b.tactics.until>=g.turn&&same(b.tactics.target,target)&&distance(a,b)<=5);
 if(hold&&!melee&&flank&&(!old||g.turn>=(old.retryAfter||0))){
  a.tactics={target:{x:target.x,y:target.y},goal:null,until:g.turn+TACTICS.holdRetry,holdUntil:g.turn+TACTICS.holdTurns-1,retryAfter:g.turn+TACTICS.holdRetry};
 }
 if(a.tactics?.holdUntil>=g.turn)return {hold:true};
 const preferred=a.tactics?.goal;
 const vertical=Math.abs(target.y-a.y)>=Math.abs(target.x-a.x),major=q=>Math.abs(vertical?target.y-q.y:target.x-q.x);
 const queue=[{x:a.x,y:a.y,cost:0,d:0,first:null}],costs=new Map([[key(a),0]]);let best=null,visited=0;
 while(queue.length&&visited++<TACTICS.searchNodes){
  queue.sort((b,c)=>b.cost-c.cost||major(b)-major(c)||distance(b,target)-distance(c,target)||b.y-c.y||b.x-c.x);const q=queue.shift();if(q.cost!==costs.get(key(q)))continue;
  if(best&&q.cost>best.score+3)break;
  if(q.first&&canFire(q)){
   const score=q.cost+(reservations.has(key(q))?8:0)-(same(q,preferred)?3:0);
   if(!best||score<best.score)best={...q,score};
  }
  if(q.d>=TACTICS.maxSteps)continue;
  for(const [dx,dy]of DIRECTIONS){
   const n={x:q.x+dx,y:q.y+dy},k=key(n),edge=barrierBetween(g.barriers,q,n);
   if(taken.has(k)||distance(n,g.player)>leash||!g.passable(n.x,n.y,a)||edgeBlocks(edge)&&!vaultable(edge)&&edge.type!=='door')continue;
   const cost=q.cost+1+(edgeBlocks(edge)?1:0)+(g.hazards.some(h=>same(h,n))?4:0)+(reservations.has(k)?3:0);
   if(cost>=(costs.get(k)??Infinity))continue;
   costs.set(k,cost);queue.push({...n,cost,d:q.d+1,first:q.first||n});
  }
 }
 if(!best){
  // A failed route must not erase the hold retry limit and start another hold next turn.
  a.tactics=old?.retryAfter>g.turn?{target:{x:target.x,y:target.y},goal:null,until:old.retryAfter,holdUntil:0,retryAfter:old.retryAfter}:null;
  return null;
 }
 const until=a.tactics&&same(a.tactics.target,target)?a.tactics.until:g.turn+TACTICS.planTurns;
 a.tactics={target:{x:target.x,y:target.y},goal:{x:best.x,y:best.y},until,holdUntil:0,retryAfter:old?.retryAfter||0};
 return {step:best.first,goal:a.tactics.goal};
}
export function validTactics(a,turn){
 const s=a.tactics;if(s==null)return true;
 return point(s.target)&&(s.goal===null||point(s.goal))&&Number.isSafeInteger(s.until)&&s.until>=1&&s.until<=turn+Math.max(TACTICS.planTurns,TACTICS.holdRetry)&&Number.isSafeInteger(s.holdUntil)&&s.holdUntil>=0&&s.holdUntil<=turn+TACTICS.holdTurns&&Number.isSafeInteger(s.retryAfter)&&s.retryAfter>=0&&s.retryAfter<=turn+TACTICS.holdRetry;
}
