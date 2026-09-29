// Rebel bosses (3.206.0, user design 2026-09-29; docs/BOSSES.md section 3): fire that covers where you stand, blocks
// sight and drives where you walk. The warning stays, being caught costs a lot, and each has an answer in where you stand.
// Both are fireproof (src/enemy-data.js fireproof): burning floor, a flamethrower's spray and the fixed fire of floors 5-6
// do nothing to them, and they walk through fire and stand in its smoke (src/hazard-paths.js); a shot through burning
// tiles is halved for both sides, as for any haze. A blast is still a blast.
// 縱火者 (the arsonist, floor 3): the warden's chassis with a flamethrower for a gun (`flameOnly`, no shot ever).
// - 火牆: seeing you within `reach`, it marks a straight line of three to five tiles right behind you — or at your side,
//   where that is what fits — for a round (`fireIntent`, kind 'wall'); on its next turn, before anything else, the whole
//   line ignites. 圍困: the tiles two steps from you, leaving gaps (kind 'ring'); on its next turn the ring ignites.
//   Whoever stands on a tile as it ignites is burned as by a spray (no hit roll, no cover, armour subtracts); the tiles
//   then burn as any fire does (src/fire.js).
// - Neither ever seals you in. Lit, with the fire already burning and its own body counted as walls, they must leave
//   every floor tile you can reach now still reachable (locked doors counted open, as the map generator counts them, so
//   no vault door, exit or objective is cut off); a line that would is not drawn, and the ring opens more gaps. The ring
//   keeps its gaps square to the line between it and you (the way out is to the side, out of the line of its spray),
//   never on a tile someone stands on; with fewer than four tiles alight it is not drawn. On the ignition turn each tile
//   is checked again against where you stand then: a tile that can no longer burn, or would now seal you in, stays out.
// - Between them it sprays like a 火焰兵 (`flameIntent`: a round marking the cone toward whoever it fights, then the
//   spray from where it marked it; src/enemy-behavior.js flamerAct's rules).
// - 過熱: every spray, wall and ring is one fire (`heat`). The third sends it venting for two of its own turns
//   (`overheat`): no fire, armour 0 (src/enemy-affixes.js enemyArmor), and it only walks. A wall or a ring starts only on
//   heat 0 or 2, so a spray (or the venting) always comes between two of them; the two take turns (`special`).
// 焚線官 (floor 6; the core guard's chassis, 火線官's rules with fire for the machine gun): it marks you exactly as the
// Designator does (src/loyalist-bosses.js) and takes turns with a set-up flamethrower (`burn`): a round of warning showing
// the cone, three sweeps burning everyone in it (no hit roll, no cover, any side) and setting it alight, then two rounds
// packing up in which it may walk but not fire, mark or set up. Set up it cannot move or turn, and a shot or blow from
// outside the cone gets +15. Between them it fights as the core guard's chassis does; drones at half health, unannounced.
// Boss fire never fails for the floor's 30-tile cap: the oldest burning tiles go out to make room (src/fire.js ignite
// `makeRoom`, Claude's call), and the log says so; tiles that could not catch are counted in the log too.
import {t} from './i18n.js';
import {distance,key,DIRECTIONS,reachable} from './world.js';
import {WEAPONS,seeThrough} from './data.js';
import {enemyDef} from './enemy-data.js';
import {barrierBetween,edgeBlocks} from './barriers.js';
import {inCone} from './shotgun.js';
import {enemyDisplayName as enemyName} from './enemy-affixes.js';
import {scaleEnemy,floorDamageBonus} from './endless.js';
import {flameCells,flamerDamage,sprayFlame,burnUnits,ignite,flammable,FIRE_TUNING,FLAMETHROWER} from './fire.js';
import {canPaint,paintMark,landedNow} from './loyalist-bosses.js';
import {hazardTile} from './hazard-paths.js';
import {unitTree} from './behavior-tree.js';
import {registerSpecial,registerStep,validSpecials,dropStaleSpecials,dropAttack} from './enemy-specials.js';

// The user tunes these after playtesting (docs/BOSSES.md section 3).
// arsonist: `reach` for a wall or a ring (it has to see you that close); `heat` fires before it vents for `vent` of its
// turns; the wall stands `offset` tiles from you and runs `half` tiles each side of its middle, at least `min` tiles; the
// ring is the tiles `radius` steps from you with `gaps` left open, at least `min` tiles alight.
// burn (焚線官's set-up flamethrower): a cone of `halfAngle` each side and `range` steps (the flamethrower's own, not the
// machine gun's 45 and 7: Claude's call), `sweeps` rounds of `damage` each, `packUp` rounds after, +`flank` from outside.
export const REBEL_BOSS_TUNING=Object.freeze({
 arsonist:Object.freeze({reach:6,heat:3,vent:2,wall:Object.freeze({offset:1,half:2,min:3}),ring:Object.freeze({radius:2,gaps:2,min:4})}),
 burn:Object.freeze({halfAngle:30,range:5,sweeps:3,packUp:2,damage:12,flank:15}),
});
const A=REBEL_BOSS_TUNING.arsonist,B=REBEL_BOSS_TUNING.burn;
const specials=e=>enemyDef(e)?.specials||[];
export const setsFires=e=>specials(e).includes('wall');   // the arsonist: walls and rings
export const setsBurn=e=>specials(e).includes('burn');    // 焚線官
const sprays=e=>enemyDef(e)?.flameOnly===true;
const live=e=>e?.hp>0&&!e.control?.disabled;
const at=(e,q)=>Boolean(q&&typeof q==='object'&&q.x===e.x&&q.y===e.y);
const hash=text=>{let h=2166136261;for(const c of text){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
const unitAt=(g,q)=>[g.player,...g.activeAllies,...g.enemies].some(u=>u.hp>0&&u.x===q.x&&u.y===q.y);
const blastEdge=(g,a,b)=>edgeBlocks(barrierBetween(g.barriers||[],a,b),'blast');
// A tile the boss may set alight on purpose: floor that can burn (not a pit, not under a crate, barrel or nest, not the
// fixed fire), not the way in or out, and nothing standing on it (a terminal, a case, a lamp: Claude's call).
const burnable=(g,q)=>flammable(g,q)&&key(q)!==key(g.start)&&key(q)!==key(g.end)&&!g.props.some(o=>o.x===q.x&&o.y===q.y);

// ---- never sealed in ------------------------------------------------------------------------------------------------
// Would setting `cells` alight cut you off from any floor you can reach now? The tiles set alight count as walls; units
// do not (they move). Locked doors count as open (keys), as the map generator counts them, so fire never shuts a vault
// door, the exit or an objective away from you. Checked in three passes, each comparing what you reach before and after:
// with nothing else in the way (the boss steps off its tile sooner or later: review, a ring once took the only corridor
// mouth beside the boss and sealed off everything behind it); with its body as a wall too (a gap it stands in is no way
// out now); and with the fire already burning as walls as well (it must not close the last way out; old fire dies down,
// the boss's may outlast it, which is why the passes without it come first).
export function sealsOff(g,e,cells,from=g.player){
 const walls=list=>({grid:g.grid,barriers:g.barriers||[],props:[...g.props,...list.map(q=>({type:'cover',hp:1,x:q.x,y:q.y}))]});
 const cuts=base=>{
  const before=reachable(walls(base),from,{keys:true}),after=reachable(walls([...base,...cells]),from,{keys:true});
  return after.size!==before.size-new Set(cells.filter(q=>before.has(key(q))&&key(q)!==key(from)).map(key)).size;
 };
 const body={x:e.x,y:e.y};
 return cuts([])||cuts([body])||Boolean(g.fires?.length)&&cuts([...g.fires,body]);
}

// ---- 火牆 -------------------------------------------------------------------------------------------------------------
// Behind you first (the side away from the boss; either, when it stands on a diagonal), then at your sides, never toward
// it; a fixed hash orders equals. The line crosses the way you would step: its middle `offset` tiles from you, running
// `half` tiles each way along floor that burns, stopped by a wall, a closed door or a partition (fire's own edges; a low
// partition does not stop it).
export function wallPlan(g,e,p){
 const W=A.wall,dx=p.x-e.x,dy=p.y-e.y,tie=d=>hash(`${g.seed}:${g.floor}:${g.turn}:${e.id}:${d.x},${d.y}:wall-v1`);
 const dirs=DIRECTIONS.map(([x,y])=>({x,y})).filter(d=>d.x*dx+d.y*dy>=0).sort((a,b)=>(b.x*dx+b.y*dy)-(a.x*dx+a.y*dy)||tie(a)-tie(b));
 for(const d of dirs){
  let c={x:p.x,y:p.y},open=true;
  for(let n=0;n<W.offset&&open;n++){const q={x:c.x+d.x,y:c.y+d.y};if(g.grid[q.y]?.[q.x]!==1||blastEdge(g,c,q))open=false;else c=q;}
  if(!open||!burnable(g,c))continue;
  const side={x:d.y,y:d.x},line=[c];
  for(const s of [1,-1]){let prev=c;for(let n=1;n<=W.half;n++){const q={x:c.x+side.x*s*n,y:c.y+side.y*s*n};if(!burnable(g,q)||blastEdge(g,prev,q))break;if(s>0)line.push(q);else line.unshift(q);prev=q;}}
  if(line.length>=W.min&&!sealsOff(g,e,line))return line;
 }
 return null;
}

// ---- 圍困 -------------------------------------------------------------------------------------------------------------
// The ring: the floor tiles exactly `radius` steps from you by a straight-enough walk (a shortest walk over floor that no
// wall, closed door or partition interrupts), so nothing on the far side of a wall is part of it.
export function ringTiles(g,p,radius=A.ring.radius){
 const depth=new Map([[key(p),0]]),queue=[p],out=[];
 for(let i=0;i<queue.length;i++){
  const q=queue[i],d=depth.get(key(q));if(d>=radius)continue;
  for(const [dx,dy] of DIRECTIONS){const n={x:q.x+dx,y:q.y+dy};if(depth.has(key(n))||g.grid[n.y]?.[n.x]!==1||blastEdge(g,q,n))continue;depth.set(key(n),d+1);queue.push(n);if(d+1===radius&&distance(p,n)===radius)out.push(n);}
 }
 return out.sort((a,b)=>a.y-b.y||a.x-b.x);
}
// Gaps first where they lead out to the side (square to the line from the boss to you), on tiles nobody stands on; a fixed
// hash orders equals. More open, in the same order, while the rest would seal you in.
export function ringPlan(g,e,p){
 const R=A.ring,v={x:p.x-e.x,y:p.y-e.y},len=Math.hypot(v.x,v.y)||1;
 const score=q=>Math.abs((q.x-p.x)*v.x+(q.y-p.y)*v.y)/len,tie=q=>hash(`${g.seed}:${g.floor}:${g.turn}:${e.id}:${q.x},${q.y}:ring-v1`);
 const order=ringTiles(g,p,R.radius).filter(q=>burnable(g,q)).sort((a,b)=>score(a)-score(b)||tie(a)-tie(b));
 const gaps=order.filter(q=>!unitAt(g,q)).slice(0,R.gaps),cells=order.filter(q=>!gaps.includes(q));
 while(cells.length&&sealsOff(g,e,cells))gaps.push(cells.shift());
 return cells.length>=R.min?{cells,gaps}:null;
}

// ---- the arsonist's fire -------------------------------------------------------------------------------------------
const plain=list=>list.map(({x,y})=>({x,y}));
function markFire(g,e,kind,plan){
 // The ring keeps where you stood (`center`), so its gaps can point the way out.
 e.fireIntent={kind,origin:{x:e.x,y:e.y},cells:plain(kind==='wall'?plan:plan.cells),...(kind==='ring'?{center:{x:g.player.x,y:g.player.y},gaps:plain(plan.gaps)}:{})};
 g.effects.push({type:'bossTelegraph',kind,from:{x:e.x,y:e.y},to:{x:g.player.x,y:g.player.y},damage:0});
 g.enemyCallout(e,'telegraph',{action:'attack'});g.log(t(kind==='wall'?'rebelBosses.wallReady':'rebelBosses.ringReady',{enemy:enemyName(e)}),true);
}
// A fire used: the third since it last vented sends it venting.
function heatUp(g,e){
 if(e.hp<=0)return;
 const heat=(e.heat||0)+1;
 if(heat<A.heat){e.heat=heat;return;}
 delete e.heat;if(!(A.vent>0))return;
 e.overheat=A.vent;
 g.effects.push({type:'bossTelegraph',kind:'overheat',from:{x:e.x,y:e.y},to:{x:e.x,y:e.y},damage:0});
 g.log(t('rebelBosses.overheat',{enemy:enemyName(e),n:A.vent}),true);
}
// What a boss's fire says in the log beyond its own line: old tiles that went out for it, tiles that did not catch.
function fireNotes(g,e,asked,{lit,displaced}){
 if(displaced)g.log(t('rebelBosses.fireRoom',{enemy:enemyName(e),n:displaced}));
 if(lit<asked)g.log(t('rebelBosses.fireMissed',{n:asked-lit}),true);
}
// The warned wall or ring goes up. False when it was dropped (its boss no longer stands where it warned from).
function igniteFire(g,e){
 const s=e.fireIntent;delete e.fireIntent;
 if(!live(e)||!at(e,s.origin))return false;
 const cells=[];for(const q of s.cells)if(burnable(g,q)&&!sealsOff(g,e,[...cells,q]))cells.push(q);
 g.log(t(s.kind==='wall'?'rebelBosses.wallLit':'rebelBosses.ringLit',{enemy:enemyName(e)}),true);
 if(cells.length){
  const mid={x:Math.round(cells.reduce((n,q)=>n+q.x,0)/cells.length),y:Math.round(cells.reduce((n,q)=>n+q.y,0)/cells.length)};
  g.effects.push({type:'flame',from:{x:e.x,y:e.y},to:mid.x===e.x&&mid.y===e.y?{...cells[0]}:mid,cells:plain(cells),damage:0});
  burnUnits(g,e,cells,()=>flamerDamage(g));
 }
 fireNotes(g,e,s.cells.length,ignite(g,cells,{makeRoom:true}));
 heatUp(g,e);g.reveal();
 return true;
}
// A cone marked last round, sprayed from where it was marked (the 火焰兵's spray), as a boss's fire.
function sprayCone(g,e,aim){
 g.recordExposure(e,aim);g.log(t('flames.flamerSprays',{enemy:enemyName(e)}),true);
 const {cells,lit,displaced}=sprayFlame(g,e,aim,()=>flamerDamage(g),{makeRoom:true});
 fireNotes(g,e,cells.filter(q=>flammable(g,q)).length,{lit,displaced});
 heatUp(g,e);g.reveal();
}
function markSpray(g,e,p){
 e.flameIntent={origin:{x:e.x,y:e.y},aim:{x:p.x,y:p.y}};
 g.effects.push({type:'flameTelegraph',from:{x:e.x,y:e.y},to:{x:p.x,y:p.y},damage:0});
 g.enemyCallout(e,'telegraph',{action:'attack'});g.log(t('flames.flamerReady',{enemy:enemyName(e)}),true);
}
// Venting: one of its turns gone; after the last its armour is back.
function vent(g,e){
 if(e.overheat>1){e.overheat--;return;}
 delete e.overheat;g.log(t('rebelBosses.cooled',{enemy:enemyName(e)}),true);
}
export const liveFireIntent=e=>Boolean(e?.fireIntent&&live(e)&&at(e,e.fireIntent.origin));
export const flameReach=()=>WEAPONS[FLAMETHROWER].range;

// ---- 焚線官's set-up flamethrower ----------------------------------------------------------------------------------
// The cone: the flamethrower's (src/fire.js flameCells: fire's lines, pits reached but never lit) with the boss's numbers.
export const burnCells=(g,from,aim)=>flameCells(g,from,aim,{range:B.range,flameCone:B.halfAngle});
export const burnDeployed=e=>Boolean(e?.burn&&(e.burn.stage==='set'||e.burn.stage==='sweep'));
export const liveBurn=e=>Boolean(burnDeployed(e)&&live(e)&&at(e,e.burn.origin));
export const inBurn=(g,e,q)=>burnDeployed(e)&&burnCells(g,e.burn.origin,e.burn.aim).some(c=>c.x===q.x&&c.y===q.y);
// Outside the cone is the angle alone, as for 火線官's gun (src/loyalist-bosses.js gunFlank).
export const burnFlank=(g,attacker,target)=>burnDeployed(target)&&attacker&&attacker!==target&&(attacker.x!==target.x||attacker.y!==target.y)&&!inCone(target.burn.origin,target.burn.aim,attacker,B.halfAngle)?B.flank:0;
function deployBurn(g,e,target){
 e.burn={stage:'set',origin:{x:e.x,y:e.y},aim:{x:target.x,y:target.y}};
 e.charge=false;e.aim=null;e.windup=1;   // no aimed shot is left standing behind the flamethrower
 g.effects.push({type:'bossTelegraph',kind:'burn',from:{x:e.x,y:e.y},to:{x:target.x,y:target.y},damage:0});
 g.enemyCallout(e,'telegraph',{action:'attack'});g.log(t('rebelBosses.burnSet',{enemy:enemyName(e)}),true);
}
// One sweep: everyone in the cone burns (any side, as fire does; the fireproof aside), then the cone catches.
export function sweepBurn(g,e){
 const {origin,aim}=e.burn,cells=burnCells(g,origin,aim),damage=scaleEnemy(B.damage+floorDamageBonus(g.floor,g.difficultySpec),g.floor,'damage',g.difficultySpec);
 g.log(t('rebelBosses.burnSweep',{enemy:enemyName(e)}),true);g.recordExposure(e,aim);
 g.effects.push({type:'flame',from:{...origin},to:{...aim},cells:plain(cells),damage:0});
 burnUnits(g,e,cells,()=>damage);
 const caught=ignite(g,cells,{makeRoom:true});fireNotes(g,e,cells.filter(q=>flammable(g,q)).length,caught);
 g.reveal();
}
function burnTurn(g,e){
 const s=e.burn;sweepBurn(g,e);
 if(e.hp<=0)return;   // burned down in its own sweep (a bomber's blast): nothing is left to pack up
 const left=(s.stage==='set'?B.sweeps:s.left)-1;
 if(left>0)e.burn={stage:'sweep',origin:s.origin,aim:s.aim,left};
 else if(B.packUp>0){e.burn={stage:'pack',left:B.packUp};g.log(t('rebelBosses.burnPack',{enemy:enemyName(e),n:B.packUp}),true);}
 else delete e.burn;
}

// ---- the turn (src/enemy-behavior.js) ------------------------------------------------------------------------------
// At the very top of the tree, before an order, a survival walk or a hazard can move it: the fire it warned last round
// goes off from where it warned it — the arsonist's wall or ring, the arsonist's marked spray, 焚線官's set-up sweep.
// `after` is the tree's after-step (the drone call). True when that took the turn.
export function rebelBossAction(ctx,after){
 const {g,e,p,los}=ctx,done=()=>{if(los&&p?.hp>0)e.lastKnown={x:p.x,y:p.y};if(e.hp>0){dropAttack(e);after?.(ctx);}return true;};   // dropAttack: 3.206.2
 if(e.fireIntent&&igniteFire(g,e))return done();
 if(e.flameIntent&&sprays(e)){const s=e.flameIntent;delete e.flameIntent;if(at(e,s.origin)){sprayCone(g,e,s.aim);return done();}}
 if(burnDeployed(e)){if(!at(e,e.burn.origin)){delete e.burn;return false;}burnTurn(g,e);return done();}
 return false;
}
// 3.206.1: at the top of the tree with the other warned specials (src/enemy-specials.js ORDER.top), after a flamer's.
registerStep('top','rebel',ctx=>rebelBossAction(ctx,unitTree(ctx.e).after),e=>setsFires(e)||setsBurn(e)||sprays(e));
// The arsonist's own turn, when no warned fire went off (the tree's `special`; it has no gun, so it is always the whole
// turn). `walk` is the tree's plain walk (off a hazard first, then toward its reach).
export function arsonistTurn(ctx,after,walk){
 const {g,e,p,los}=ctx,done=()=>{if(e.hp>0)after?.(ctx);return true;};
 e.charge=false;e.aim=null;e.windup=1;   // no gun to hold on anyone
 if(e.overheat>0){walk?.(ctx);vent(g,e);return done();}
 if(hazardTile(g,e.x,e.y,e)){walk?.(ctx);return done();}   // acid or steam: off it first (fire is none of its concern)
 const you=g.player;
 if((e.heat||0)%2===0&&you.hp>0&&distance(e,you)<=A.reach&&g.sight(e,you)){
  const first=e.special==='ring'?'ring':'wall';
  for(const kind of [first,first==='wall'?'ring':'wall']){
   const plan=kind==='wall'?wallPlan(g,e,you):ringPlan(g,e,you);if(!plan)continue;
   markFire(g,e,kind,plan);e.special=kind==='wall'?'ring':'wall';return done();
  }
 }
 if(los&&p.hp>0&&distance(e,p)<=flameReach()&&flameCells(g,e,p).some(q=>q.x===p.x&&q.y===p.y)){markSpray(g,e,p);return done();}
 walk?.(ctx);return done();
}
// 焚線官: packing up it walks and does nothing else; otherwise the mark and the set-up flamethrower take turns (火線官's
// order, src/loyalist-bosses.js bossSpecial). Neither starts in the round a mark lands, while a shot is wound up or on a
// hazard. False when neither did: it fights as the core guard's chassis does.
const burnOrder=e=>e.special==='burn'?['burn','mark']:['mark','burn'];
const canSetBurn=(g,e,p,los)=>setsBurn(e)&&!e.burn&&!landedNow(g,e)&&los&&p.hp>0&&distance(e,p)<=B.range&&burnCells(g,e,p).some(q=>q.x===p.x&&q.y===p.y);
export function burnlineSpecial(ctx,after,walk){
 const {g,e,p,los}=ctx,done=()=>{if(e.hp>0)after?.(ctx);return true;};
 if(e.burn?.stage==='pack'){if(e.burn.left>1)e.burn.left--;else delete e.burn;walk?.(ctx);return done();}
 if(e.burn){delete e.burn;return false;}   // set up somewhere it no longer stands (the top of the tree fires it where it does)
 if(e.charge||hazardTile(g,e.x,e.y,e))return false;
 for(const kind of burnOrder(e)){
  if(kind==='mark'&&canPaint(g,e))paintMark(g,e);
  else if(kind==='burn'&&canSetBurn(g,e,p,los))deployBurn(g,e,p);
  else continue;
  e.special=kind==='mark'?'burn':'mark';return done();
 }
 return false;
}
// What stops a telegraph stops these (src/enemy-intents.js): the wall or ring is dropped, a flamethrower being set up is
// dropped, a sweeping one packs up at once; losing sight of you or suppression changes nothing. Venting goes on.
const BOSS_REASONS=Object.freeze(['death','disabled','displaced']);
function interruptBurn(actor,reason){
 if(reason==='death'||actor.burn?.stage==='set')delete actor.burn;
 else if(actor.burn?.stage==='sweep')actor.burn={stage:'pack',left:B.packUp};
 if(actor.burn?.stage==='pack'&&!(actor.burn.left>0))delete actor.burn;
}
// Both as one call (the declarations below are what src/enemy-intents.js runs).
export function interruptRebelBoss(actor,reason){if(reason==='target_lost'||reason==='suppressed')return;delete actor.fireIntent;interruptBurn(actor,reason);}

// ---- saves ---------------------------------------------------------------------------------------------------------
const exactly=(o,keys)=>Boolean(o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).sort().join()===keys);
const tile=(q,grid)=>exactly(q,'x,y')&&Number.isInteger(q.x)&&Number.isInteger(q.y)&&grid?.[q.y]?.[q.x]===1;
const sight=(q,grid)=>exactly(q,'x,y')&&Number.isInteger(q.x)&&Number.isInteger(q.y)&&seeThrough(grid?.[q.y]?.[q.x]);
const tiles=(list,grid,min)=>Array.isArray(list)&&list.length>=min&&list.length<=FIRE_TUNING.maxTiles&&list.every(q=>tile(q,grid))&&new Set(list.map(key)).size===list.length;
const clamp=(o,k,max)=>{if(Number.isSafeInteger(o[k])&&o[k]>max){if(max>=1)o[k]=max;else delete o[k];}};
function validFireIntent(e,grid){
 const s=e.fireIntent,ring=s?.kind==='ring';
 if(!setsFires(e)||!live(e)||!(ring||s?.kind==='wall')||!exactly(s,ring?'cells,center,gaps,kind,origin':'cells,kind,origin')||!tile(s.origin,grid)||!at(e,s.origin)||!tiles(s.cells,grid,1))return false;
 return !ring||tile(s.center,grid)&&tiles(s.gaps,grid,0)&&!s.gaps.some(q=>s.cells.some(c=>c.x===q.x&&c.y===q.y));
}
function validBurn(e,grid){
 const s=e.burn;if(!setsBurn(e))return false;
 if(s?.stage==='pack')return exactly(s,'left,stage')&&Number.isInteger(s.left)&&s.left>=1&&s.left<=Math.max(1,B.packUp);
 const set=s?.stage==='set';
 return (set||s?.stage==='sweep')&&exactly(s,set?'aim,origin,stage':'aim,left,origin,stage')&&tile(s.origin,grid)&&sight(s.aim,grid)&&(s.aim.x!==s.origin.x||s.aim.y!==s.origin.y)&&
  at(e,s.origin)&&live(e)&&(set||Number.isInteger(s.left)&&s.left>=1&&s.left<=Math.max(1,B.sweeps-1));
}
// ---- the shared rules (src/enemy-specials.js) ------------------------------------------------------------------------
// This floor and every kept one; only the cards that do it may carry it (焚線官's mark is the loyalist mark,
// src/loyalist-bosses.js). A warning left on a boss that has since fallen, been stunned or moved outside its own turn is
// dropped when a save loads, as the boss would drop it; so is a marked spray on an arsonist that is venting (the flame's
// declaration, src/fire.js). A number longer than today's tuning (a save from before the user retuned it) is cut to it:
// heat, venting, sweeps and pack-up rounds left. Never a reason to refuse the run (the 3.203.0 and 3.205.0 lessons).
// The wall or ring: warned, the arsonist turns on no decoy, shoots no mine and does not step off a hazard (it goes off
// first, from where it was warned: the 'rebel' step). `special` names which of wall and ring it tries first.
registerSpecial({id:'fire',intent:'fireIntent',carries:setsFires,rotation:['wall','ring'],
 fields:{fireIntent:{valid:(v,e,f)=>validFireIntent(e,f.grid)}},
 interrupt:{on:BOSS_REASONS},
 blocks:{decoy:true,mine:true,stepOff:true},
 load:{stale:e=>{const i=e.fireIntent;return Boolean(i&&typeof i==='object'&&i.origin&&typeof i.origin==='object'&&!(live(e)&&at(e,i.origin)));}},
 card:(g,e)=>[e.fireIntent?t(e.fireIntent.kind==='ring'?'target-card.ringReady':'target-card.wallReady'):''],
});
// 焚線官's set-up flamethrower is 火線官's gun: no decoy, no mine, never kept from stepping off a hazard (it walks while it
// packs up). `special` names which of mark and burn it tries first.
registerSpecial({id:'burn',intent:'burn',carries:setsBurn,rotation:['mark','burn'],
 fields:{burn:{valid:(v,e,f)=>validBurn(e,f.grid)}},
 interrupt:{on:BOSS_REASONS,run:interruptBurn},
 blocks:{decoy:true,mine:true},
 load:{clamp:e=>{const s=e.burn;if(s?.stage==='pack'&&Number.isSafeInteger(s.left)&&s.left>B.packUp){if(B.packUp>=1)s.left=B.packUp;else delete e.burn;}else if(s?.stage==='sweep')clamp(s,'left',Math.max(1,B.sweeps-1));},
  stale:e=>{const b=e.burn;return Boolean(b&&(b.stage==='set'||b.stage==='sweep')&&b.origin&&typeof b.origin==='object'&&!(live(e)&&at(e,b.origin)));}},
 card:(g,e)=>[burnDeployed(e)?t('target-card.burnSet'):'',e.burn?.stage==='pack'?t('target-card.burnPack',{n:e.burn.left}):''],
});
// Venting: the arsonist's fires since it last vented (`heat`) and the turns of venting left (`overheat`); state only, it
// blocks nothing and nothing interrupts it.
registerSpecial({id:'vent',intent:'overheat',carries:setsFires,
 fields:{
  heat:{count:{min:1,max:()=>A.heat-1,carrier:true,clamp:'drop'}},
  overheat:{count:{min:1,max:()=>A.vent,carrier:true,clamp:'drop'}},
 },
 card:(g,e)=>[e.overheat>0?t('target-card.overheat',{n:e.overheat}):'',setsFires(e)&&e.heat>0?t('target-card.heat',{n:e.heat,max:A.heat}):''],
});
export const dropStaleRebelIntents=g=>dropStaleSpecials(g,['flame','fire','burn','vent']);
export const validRebelBosses=g=>validSpecials(g,['fire','burn','vent']);
