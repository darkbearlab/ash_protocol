// 相位體 (3.230.0, docs/FACTIONS.md 5.1 and 5.8): the rift body that walks through walls and doors and shows itself only
// up close. Seen only within `revealRange` (the card's, src/game.js revealed(): drawing, targeting, your allies and the
// exposure count all obey it); the officer's sensors still read it (the detector below raises the hidden-unit alert),
// and a floor that holds one gives the bad-feeling cue on arrival (src/comms-events.js hiddenThreat).
// Its walk (`before`, src/behavior-tree.js): one step a turn straight toward you (or where it last knew you were), the
// longer way first, never around. A wall, a closed door or a
// partition in the way does not stop it: it passes straight through and comes out on the first free floor tile beyond,
// at most PHASE_TUNING.through tiles of wall away, all in that one move — it never ends a turn inside a wall. Nowhere to
// come out, it walks the usual way. Numbers are Claude's (user: "你先定就做"), to be tuned after play.
import {enemyDef} from './enemy-data.js';
import {registerUnitTree} from './behavior-tree.js';
import {registerDetector} from './detection.js';
import {distance,key} from './world.js';
import {SIZE} from './data.js';

export const PHASE_TUNING=Object.freeze({through:3,alertRange:6,alertCooldown:8});
export const phases=e=>Boolean(enemyDef(e)?.phase);
const inside=q=>q.x>=0&&q.y>=0&&q.x<SIZE&&q.y<SIZE;
const free=(g,e,q)=>g.passable(q.x,q.y,e)&&key(q)!==key(g.player)&&!g.enemies.some(o=>o!==e&&o.hp>0&&key(o)===key(q))&&!g.activeAllies.some(a=>key(a)===key(q));
// Directions that bring it nearer, the longer axis first.
const toward=(e,to)=>{const dx=Math.sign(to.x-e.x),dy=Math.sign(to.y-e.y),h=[dx,0],v=[0,dy];const out=Math.abs(to.x-e.x)>=Math.abs(to.y-e.y)?[h,v]:[v,h];return out.filter(([x,y])=>x||y);};
// Where one step in a direction takes it: the next tile if it can simply walk there; through a wall or a shut edge, the
// first free floor tile beyond; null when that is not within reach.
export function phaseStep(g,e,[dx,dy]){
 const next={x:e.x+dx,y:e.y+dy};if(!inside(next))return null;
 if(g.grid[next.y]?.[next.x]===1&&g.canCross(e,next))return free(g,e,next)?{point:next,through:false}:null;
 // Something in the way (a wall, or a door or partition on the edge): straight on to the first floor tile beyond.
 for(let n=1;n<=PHASE_TUNING.through+1;n++){
  const q={x:e.x+dx*n,y:e.y+dy*n};if(!inside(q))return null;
  if(g.grid[q.y]?.[q.x]!==1)continue;
  return free(g,e,q)?{point:q,through:true}:null;
 }
 return null;
}
function phaseWalk({g,e,p,los,d}){
 const target=los?p:e.lastKnown;if(!target)return false;
 if(los&&d<=1&&g.canCross(e,p))return false;   // beside you: it attacks the usual way
 for(const dir of toward(e,target)){
  // It does not path around anything: it goes straight for you, through whatever is in the way.
  const step=phaseStep(g,e,dir);if(!step||distance(step.point,target)>=distance(e,target))continue;
  const from={x:e.x,y:e.y};Object.assign(e,step.point);e.moved=true;e.moveDelta=[e.x-from.x,e.y-from.y];
  return true;
 }
 return false;
}
registerUnitTree('phase',{before:phaseWalk});
// Hidden from your side and near you: the officer's sensors read it (the same alert as a cloaked ninja's).
registerDetector({kind:'phase',event:'cloakAlert',range:PHASE_TUNING.alertRange,cooldown:PHASE_TUNING.alertCooldown,contacts:g=>(g.enemies||[]).filter(e=>phases(e)&&e.hp>0&&!g.teamVisible(e))});
