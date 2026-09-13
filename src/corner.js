import {anchors,combatSight} from './combat.js';
import {lineOfSight,key} from './world.js';
import {objectSightGrid} from './scenery.js';
import {isBarrier} from './barriers.js';
import {SIZE} from './data.js';

export const CORNER_TURNS=2;
const direction=(p,q)=>q.x>p.x?'east':q.x<p.x?'west':q.y>p.y?'south':'north';
const directions=['north','east','south','west'];
const actorTarget=(g,b)=>b===g.player||g.enemies.includes(b)||(g.allies||[]).includes(b);
export function exposedUntil(a,dir,turn){
 const s=a.cornerExposure;
 return s&&key(s.origin)===key(a)&&s.until[dir]>=turn?s.until[dir]:null;
}
// Observation still uses symmetric leaning. Only an actor's exposed endpoints are shootable.
export function cornerRay(g,a,b,{tile=false}={}){
 const grid=objectSightGrid(g,a,b),edges=isBarrier(b)?g.barriers.filter(e=>e!==b):g.barriers;
 if(lineOfSight(grid,a,b,edges,'shot'))return {clear:true,origin:{x:a.x,y:a.y},target:{x:b.x,y:b.y},peekDirection:null,targetDirection:null};
 const origins=anchors(grid,a,edges,'shot'),targets=anchors(grid,b,edges,'shot');
 const restricted=!tile&&actorTarget(g,b);
 for(const origin of origins)for(const target of targets){
  const targetLean=key(target)!==key(b),dir=targetLean?direction(b,target):null;
  if(targetLean&&restricted&&exposedUntil(b,dir,g.turn)===null)continue;
  if(lineOfSight(grid,origin,target,edges,'shot'))return {clear:true,origin,target,peekDirection:key(origin)===key(a)?null:direction(a,origin),targetDirection:dir};
 }
 return {clear:false,reason:restricted&&combatSight(grid,a,b,edges,'shot')?'target_corner_hidden':'blocked'};
}
export function recordExposure(g,a,b){
 const ray=cornerRay(g,a,b);
 if(!ray.clear||!ray.peekDirection)return;
 if(!a.cornerExposure||key(a.cornerExposure.origin)!==key(a))a.cornerExposure={origin:{x:a.x,y:a.y},until:{}};
 a.cornerExposure.until[ray.peekDirection]=g.turn+CORNER_TURNS;
}
export function clearMovedExposure(g){
 for(const a of [g.player,...g.enemies,...(g.allies||[])])if(a.cornerExposure&&key(a.cornerExposure.origin)!==key(a))a.cornerExposure=null;
}
export function expireExposure(actors,turn){
 for(const a of actors)if(a.cornerExposure){
  for(const d of Object.keys(a.cornerExposure.until))if(a.cornerExposure.until[d]<=turn)delete a.cornerExposure.until[d];
  if(!Object.keys(a.cornerExposure.until).length)a.cornerExposure=null;
 }
}
export function cornerStatus(g,a,b){
 const ray=cornerRay(g,a,b),visible=g.sight(a,b),until=ray.targetDirection?exposedUntil(b,ray.targetDirection,g.turn):null;
 return {visible,attackable:visible&&ray.clear,reason:!visible?'not_visible':ray.clear?null:ray.reason,targetExposed:until!==null,exposureRemaining:until===null?0:Math.max(0,until-g.turn),peekDirection:ray.peekDirection||null};
}
export function validCorner(a,turn){
 const s=a.cornerExposure;if(s==null)return true;
 return s&&typeof s==='object'&&s.origin&&[s.origin.x,s.origin.y].every(n=>Number.isInteger(n)&&n>=0&&n<SIZE)&&s.until&&typeof s.until==='object'&&!Array.isArray(s.until)&&Object.keys(s.until).length<=4&&Object.entries(s.until).every(([d,t])=>directions.includes(d)&&Number.isSafeInteger(t)&&t>=1&&t<=turn+CORNER_TURNS);
}
