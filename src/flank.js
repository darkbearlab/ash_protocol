// 側襲 (3.132.0, docs/ORDERS.md §6): go to where the target's cover does not protect it, then fire. An order any unit
// can be given; for now nobody is (the user wants it built with the orders, not yet handed out).
// - The spot: in the unit's own range, with a clear shot at the target, where the target's cover does not face the
//   spot; the unit's own cover counts in its favour, then nearness. No dice.
// - It walks there by the way the target cannot see (迂迴) and fires as soon as it has that open shot — which may be
//   before it arrives. Being hit breaks it; so do six turns, counted from the order.
import {registerOrder,giveOrder,endOrder} from './orders.js';
import {DETOUR_TRAIT} from './detour.js';
import {grantTrait,removeTraitSource} from './traits.js';
import {enemyDef} from './enemy-data.js';
import {distance,key} from './world.js';
import {SIZE} from './data.js';

const SOURCE='order:flank';
const reachOf=e=>Math.min(enemyDef(e)?.range||1,8);
// An open shot: in range, in sight, and the target's cover does not stand between.
export const openShot=(g,from,target)=>distance(from,target)<=(enemyDef(from)?.range||1)&&g.sight(from,target)&&g.shotClear(from,target)&&!g.protectingCover(target,from);
export function flankSpot(g,e,target,taken=new Set()){
 const reach=reachOf(e);if(reach<=1)return null;
 const others=[g.player,...g.enemies.filter(o=>o.hp>0&&o!==e),...g.activeAllies],found=[];
 for(let y=target.y-reach;y<=target.y+reach;y++)for(let x=target.x-reach;x<=target.x+reach;x++){
  if(x<0||y<0||x>=SIZE||y>=SIZE)continue;
  const q={x,y};if(distance(q,target)>reach||distance(q,target)<2||!g.passable(x,y,e)||taken.has(key(q)))continue;
  if(others.some(a=>distance(a,q)===0)||g.hazards.some(h=>distance(h,q)===0))continue;
  if(!openShot(g,{...e,x,y},target))continue;
  found.push({q,score:(g.protectingCover(q,target)?3:0),near:distance(e,q)});
 }
 found.sort((a,b)=>b.score-a.score||a.near-b.near||a.q.y-b.q.y||a.q.x-b.q.x);
 return found.find(f=>f.near===0||g.routeSearch(e,f.q,null))?.q||null;
}
export function orderFlank(g,e,{by='self',target=g.player}={}){
 const at=flankSpot(g,e,target);if(!at)return false;
 return giveOrder(g,e,{kind:'flank',by,at,watch:{x:target.x,y:target.y},breakOn:['hit']});
}
registerOrder('flank',{
 start(g,e){grantTrait(e,DETOUR_TRAIT,SOURCE);e.tactics=null;},
 end(g,e){removeTraitSource(e,SOURCE);},
 act(ctx,order){
  const {g,e,p}=ctx;
  if(p&&openShot(g,e,p)){endOrder(g,e,'fired');return 'fire';}
  if(distance(e,order.at)===0){endOrder(g,e,'arrived');return false;}   // there, but no open shot: back to normal
  const step=g.nextStep(e,order.at);
  if(!step||g.enemies.some(o=>o.hp>0&&o!==e&&distance(o,step)===0)||distance(step,g.player)===0){endOrder(g,e,'blocked');return false;}
  e.x=step.x;e.y=step.y;e.moved=true;return true;
 },
});
