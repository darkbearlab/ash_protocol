// The rift (3.226.0, docs/FACTIONS.md 5.1–5.3; user 2026-11-16): energy bodies held in the world by anchors. Breaking the
// anchor dissipates every body bound to it for good. The bodies hunt life: they pass over machines. Numbers are Claude's
// (user: "你先定就做"), to be tuned after play.
//
// 3.232.0 (user 2026-11-17, docs/FACTIONS.md 5.10): an anchor no longer brings back the body that fell. It draws. Each
// anchor has a weighted list of what it can form, a total budget and its own clock: when the clock comes round it draws
// one kind by weight; if that kind's cost fits in what is left of the budget, the body forms beside the anchor at once (no
// warning, user) and holds that much of the budget while it stands; if not, that draw fails and the anchor waits for the
// next. A body gives its cost back when it falls (user: 倒下就還) and pays xp like any other (user: 全部照常給). The bodies
// bound at generation hold their share from the start.
//
// An anchor is a `nest` prop (so it blocks, takes shots and blasts, and draws from the rift row of the nest atlas) that
// carries `anchor` instead of `nest`: {active, serial, next, guard?} — `next` the turn of its next draw, `guard` (3.232.0)
// one of the four set round the rift core. A body knows its anchor by `anchorId`. (`reformed` and `reforms` are 3.226–
// 3.231.0's: a save's `reforms` is dropped on load, a `reformed` body still loads.)
//
// 3.227.0: a possessed human (被附身者, a card with `anchorHolder`) is a living anchor: it carries the same `anchor` state
// on the enemy itself, its bodies form again beside it wherever it stands, and when it falls they dissipate as when an
// anchor breaks. "Anchors" below means both, standing; `anchorProps` only the map objects.
import {t} from './i18n.js';
import {enemyDef} from './enemy-data.js';
import {ENEMY_TYPES,SIZE} from './data.js';
import {DIRECTIONS,distance,key} from './world.js';
import {DRAIN_TUNING,drainStacks,cutToDrain,maxHpOf} from './drain.js';
import {activeTrait} from './traits.js';
import {isNoncombatant} from './enemy-data.js';
import {factionTraitRank,factionPool} from './faction-catalog.js';
import {hash01} from './faction-decals.js';

export const RIFT_TUNING=Object.freeze({anchorHp:60,anchors:2,lateAnchors:3,lateFloor:4,anchorGap:8,startGap:6,wakeRadius:6,
 guards:4,guardGap:3,guardNear:3,guardFar:4});
// 3.232.0: what a body holds of its anchor's budget, and the budget and clock of each kind of anchor. A boss's are on its
// card (`anchorDraw`); a map anchor's and a host's weights are the floor's rift roster (only what could ever fit).
export const DRAW_TUNING=Object.freeze({cost:Object.freeze({wisp:1,flicker:2,phase:2,displacer:2,beamer:2,shade:4}),
 prop:Object.freeze({budget:6,interval:4}),host:Object.freeze({budget:3,interval:5}),guard:Object.freeze({budget:0,interval:4})});   // a guard only wards and binds
export const bodyCost=type=>DRAW_TUNING.cost[type]??(ENEMY_TYPES[type]?.energy?2:0);
export const ANCHOR_ID=/^anchor-\d+-\d+$/;
export const isEnergy=e=>Boolean(enemyDef(e)?.energy);
export const huntsLife=e=>Boolean(enemyDef(e)?.huntsLife);
export const isAnchor=p=>Boolean(p&&p.type==='nest'&&p.anchor);
export const isHost=e=>Boolean(enemyDef(e)?.anchorHolder);
export const anchorProps=g=>(g.props||[]).filter(p=>isAnchor(p)&&p.hp>0);
const hostsOf=list=>(list||[]).filter(e=>e.anchor&&isHost(e));
export const liveAnchors=g=>[...anchorProps(g),...hostsOf(g.enemies).filter(e=>e.hp>0)];
export const anchorOf=(g,e)=>e?.anchorId?[...(g.props||[]).filter(isAnchor),...hostsOf(g.enemies)].find(a=>a.id===e.anchorId)||null:null;
const newAnchorState=(active,next)=>({active,serial:0,next});
const drawCard=a=>isAnchor(a)?(a.anchor?.guard?DRAW_TUNING.guard:DRAW_TUNING.prop):enemyDef(a)?.anchorDraw||DRAW_TUNING.host;
export const anchorBudget=a=>drawCard(a).budget;
export const drawInterval=a=>drawCard(a).interval;
// What it can draw, by weight: a boss's own list, otherwise the floor's rift roster (energy bodies; a kind that could never
// fit the budget is left out, so it does not waste draws).
export function drawWeights(g,a){
  const own=enemyDef(a)?.anchorDraw?.weights;if(own)return own.filter(([type])=>bodyCost(type)<=anchorBudget(a));
  const counts=new Map();for(const type of factionPool('rift',g.floor))if(ENEMY_TYPES[type]?.energy&&!ENEMY_TYPES[type]?.anchorHolder&&bodyCost(type)<=anchorBudget(a))counts.set(type,(counts.get(type)||0)+1);
  return [...counts];
}
export const budgetUsed=(g,a)=>g.enemies.filter(e=>e.hp>0&&e.anchorId===a.id).reduce((n,e)=>n+bodyCost(e.type),0);

// Generation (src/runtime-enemies.js addRuntimePopulation): `points` are free floor tiles in shuffled order; `safe` keeps
// every room reachable. Anchors stand apart from each other and away from the entrance.
export function placeAnchors(map,points,floor,forbidden,safe){
  const want=floor>=RIFT_TUNING.lateFloor?RIFT_TUNING.lateAnchors:RIFT_TUNING.anchors,placed=[];
  for(const p of points){
    if(placed.length>=want)break;
    if(forbidden.has(key(p))||distance(p,map.start)<RIFT_TUNING.startGap||placed.some(q=>distance(p,q)<RIFT_TUNING.anchorGap))continue;
    const prop={id:`anchor-${floor}-${placed.length}`,type:'nest',x:p.x,y:p.y,hp:RIFT_TUNING.anchorHp,maxHp:RIFT_TUNING.anchorHp,anchor:newAnchorState(false,0)};
    map.props.push(prop);if(!safe(map)){map.props.pop();continue;}
    placed.push(prop);forbidden.add(key(p));
  }
  // 3.232.0: the rift core's four guard anchors, 3–4 tiles round it, apart from each other (its ward, src/rift-bosses.js).
  // A cramped room gets a second, looser pass (2–5 tiles, two apart) so the four still stand.
  const core=map.enemies.find(e=>enemyDef(e)?.guardAnchors);let n=placed.length,guards=0;
  if(core)for(const [near,far,gap] of [[RIFT_TUNING.guardNear,RIFT_TUNING.guardFar,RIFT_TUNING.guardGap],[2,5,2]]){
    const ring=[];for(let dy=-far;dy<=far;dy++)for(let dx=-far;dx<=far;dx++){const q={x:core.x+dx,y:core.y+dy},d=Math.abs(dx)+Math.abs(dy);if(d>=near&&d<=far&&map.grid[q.y]?.[q.x]===1&&!forbidden.has(key(q))&&!map.enemies.some(e=>key(e)===key(q))&&!map.props.some(o=>key(o)===key(q)))ring.push(q);}
    ring.sort((a,b)=>Math.atan2(a.y-core.y,a.x-core.x)-Math.atan2(b.y-core.y,b.x-core.x)||a.x-b.x||a.y-b.y);
    for(const p of ring){
      if(guards>=RIFT_TUNING.guards)break;
      if(map.props.some(o=>isAnchor(o)&&o.anchor.guard&&distance(o,p)<gap))continue;
      const prop={id:`anchor-${floor}-${n}`,type:'nest',x:p.x,y:p.y,hp:RIFT_TUNING.anchorHp,maxHp:RIFT_TUNING.anchorHp,anchor:{...newAnchorState(false,0),guard:true}};
      map.props.push(prop);if(!safe(map)){map.props.pop();continue;}
      n++;guards++;forbidden.add(key(p));
    }
  }
  return placed.length+guards;
}
// Each energy body on the floor is bound to its nearest anchor, a possessed human counting as one (ties: map objects
// first, then id order). A floor without anchors binds none.
export function bindAnchors(map){
  for(const e of map.enemies)if(isHost(e))e.anchor=newAnchorState(true,1+drawInterval(e));
  const anchors=[...map.props.filter(isAnchor),...map.enemies.filter(isHost)];if(!anchors.length)return map;
  for(const e of map.enemies)if(isEnergy(e)&&!isHost(e))e.anchorId=[...anchors].sort((a,b)=>distance(e,a)-distance(e,b))[0].id;
  return map;
}

const freeCell=(g,p)=>g.passable(p.x,p.y)&&distance(g.player,p)>0&&!g.enemies.some(e=>e.hp>0&&key(e)===key(p))&&!g.activeAllies.some(a=>key(a)===key(p))&&!g.props.some(o=>o.hp>0&&key(o)===key(p))&&!g.hazards.some(o=>key(o)===key(p));
// The tile a body forms on: beside its anchor, in a fixed order, never under anything.
export const formCell=(g,anchor)=>DIRECTIONS.map(([dx,dy])=>({x:anchor.x+dx,y:anchor.y+dy})).find(p=>freeCell(g,p)&&g.canCross(anchor,p))||null;

// A bound body fell (Game.hurt): its cost is back in its anchor's budget at once (counted from the standing bodies).
export function anchorDeath(g,e){
  const anchor=anchorOf(g,e);if(!anchor||anchor.hp<=0||!isEnergy(e))return;
  if(g.teamVisible(e))g.log(t('rift.dissipates',{target:enemyDef(e).name}));
}
// One draw: by weight, on a hash of the seed, floor, turn and anchor (no combat dice are spent). The kind, or null.
export function drawKind(g,a){
  const list=drawWeights(g,a),total=list.reduce((n,[,w])=>n+w,0);if(!total)return null;
  let roll=hash01(g.seed,g.floor,g.turn,a.id,'rift-draw-v1')*total;
  for(const [type,w] of list){if((roll-=w)<0)return type;}
  return list[list.length-1][0];
}
// Each round after the enemies (src/game-actions.js, with the nests): map anchors wake when you come near; an awake anchor
// whose clock has come round draws once. It forms only what fits its budget, on a free tile beside it; otherwise that draw
// is lost and it waits for the next.
export function tickAnchors(g){
  for(const anchor of liveAnchors(g)){
    const s=anchor.anchor;
    if(!s.active&&distance(g.player,anchor)<=RIFT_TUNING.wakeRadius){s.active=true;s.next=g.turn+drawInterval(anchor);g.log(t('rift.anchorAwake'),true);continue;}
    if(!s.active||g.turn<s.next)continue;
    s.next=g.turn+drawInterval(anchor);
    const type=drawKind(g,anchor);if(!type||bodyCost(type)>anchorBudget(anchor)-budgetUsed(g,anchor))continue;
    const at=formCell(g,anchor);if(!at)continue;
    const e=g.spawnEnemy(type,at.x,at.y,`${anchor.id}-r${++s.serial}`,{anchorId:anchor.id});
    e.alert=true;e.lastKnown={x:g.player.x,y:g.player.y};g.enemies.push(e);
    g.effects.push({type:'portalSpawn',from:{x:at.x,y:at.y},to:{x:at.x,y:at.y},damage:0});
    if(g.visible(at))g.log(t('rift.formed',{target:enemyDef(e).name}));
  }
}

// The anchor breaks (Game.damageProp) or the possessed human falls (Game.hurt, 3.227.0): its pending bodies never form
// and the standing ones dissipate. Returns those, for the caller to run their deaths (no kill, xp or drops: nobody
// killed them).
export function collapseAnchor(g,p){
  const host=!isAnchor(p);
  if(!host)p.hp=0;
  g.effects.push(host?{type:'portalSpawn',from:{x:p.x,y:p.y},to:{x:p.x,y:p.y},damage:0}:{type:'nestCollapse',nestStyle:'rift',from:{x:p.x,y:p.y},to:{x:p.x,y:p.y},damage:0});
  const bodies=g.enemies.filter(e=>e.hp>0&&e.anchorId===p.id);
  for(const e of bodies){e.hp=0;e.dissipated=true;}
  if(host)g.log(bodies.length?t('rift.hostFellBodies',{n:bodies.length}):t('rift.hostFell'),true);
  else g.log(bodies.length?t('rift.anchorBrokenBodies',{n:bodies.length}):t('rift.anchorBroken'),true);
  if(!liveAnchors(g).length)clearDrain(g);   // 3.228.0: the last anchor gone, 流逝 lifts at once
  return bodies;
}

// 流逝 (3.228.0, docs/FACTIONS.md 5.2; src/drain.js): at the end of each enemy phase, every living thing within a
// drain aura gains a stack per source — you, living allies and pets, civilians and researchers; never machines. The
// stacks hold across floors and lift only when the floor you are on has no anchor left standing (or the run ends).
// A source counts while it stands and your side sees it (3.232.0).
export const drainAura=e=>factionTraitRank(e,'drain_aura');
const living=a=>a&&a.hp>0&&!activeTrait(a,'mechanical');
const drainTargets=g=>[g.player,...(g.activeAllies||[]),...g.enemies.filter(isNoncombatant)].filter(living);
export function clearDrain(g){
  let lifted=false;
  for(const a of [g.player,...(g.allies||[]),...(g.enemies||[])])if(a&&a.drain!==undefined){if(a===g.player&&a.drain>0)lifted=true;delete a.drain;}
  if(lifted){g.log(t('drain.cleared'),true);g.effects.push({type:'pulse',from:{x:g.player.x,y:g.player.y},to:{x:g.player.x,y:g.player.y},radius:.5,color:'#d9c6ff',damage:0});}
}
export function tickDrain(g){
  if(!liveAnchors(g).length){clearDrain(g);return;}
  // 3.232.0 (5.2: 「來源必須已經現形」): a source counts only while your side can see it.
  const sources=g.enemies.filter(e=>e.hp>0&&drainAura(e)>0&&g.teamVisible(e));if(!sources.length)return;
  for(const a of drainTargets(g)){
    const n=sources.filter(s=>distance(s,a)<=drainAura(s)).length;if(!n)continue;
    const before=drainStacks(a);a.drain=Math.min(DRAIN_TUNING.maxStacks,before+n);cutToDrain(a);
    if(a.drain>before)g.effects.push({type:'pulse',from:{x:a.x,y:a.y},to:{x:a.x,y:a.y},radius:.5,color:'#a46be2',damage:0});   // also what records the step for the HUD (src/presentation.js)
    if(a===g.player&&a.drain>before)g.log(t('drain.gained',{n:a.drain,max:maxHpOf(a)}),true);
  }
}

// Load checks (src/runtime-enemies.js validRuntime): broken data refuses; a due later than today's tuning allows is cut
// to it, so a retune of the clocks never strands a save. 3.232.0: a 3.226–3.231 save's `reforms` (the bodies waiting to
// form again) is dropped — the draws take over from the next clock.
export function validAnchors(g){
  const ok=n=>Number.isInteger(n)&&n>=0&&n<SIZE;
  // 3.227.0: only a possessed human's card carries the state on a unit.
  if((g.enemies||[]).some(e=>e.anchor!==undefined&&!isHost(e)))return false;
  for(const p of [...(g.props||[]).filter(isAnchor),...hostsOf(g.enemies)]){
    const s=p.anchor,prop=isAnchor(p);
    if(prop&&(!ANCHOR_ID.test(p.id)||!Number.isFinite(p.maxHp)||p.maxHp<=0||p.hp>p.maxHp)||!Number.isFinite(p.hp)||!s||typeof s!=='object'||typeof s.active!=='boolean'||!Number.isInteger(s.serial)||s.serial<0)return false;
    if(s.guard!==undefined&&(s.guard!==true||!prop))return false;
    if(s.reforms!==undefined){if(!Array.isArray(s.reforms))return false;delete s.reforms;if(s.next===undefined)s.next=g.turn+drawInterval(p);}
    if(!Number.isInteger(s.next)||s.next<0)return false;
    s.next=Math.min(s.next,g.turn+drawInterval(p));
  }
  // 3.228.0: 流逝 stacks are whole and positive; more than the tuning allows is cut to it, health above the maximum too.
  const actors=[g.player,...(g.allies||[]),...g.enemies];
  for(const a of actors){if(a?.drain===undefined)continue;if(!Number.isInteger(a.drain)||a.drain<1)return false;a.drain=Math.min(a.drain,DRAIN_TUNING.maxStacks);cutToDrain(a);}
  return g.enemies.every(e=>(e.anchorId===undefined||typeof e.anchorId==='string')&&(e.reformed===undefined||typeof e.reformed==='boolean')&&(e.dissipated===undefined||e.dissipated===true&&e.hp<=0));
}
// Kept floors (src/retreat.js): a draw due on departure comes on the first round back; the clock counts on the floor's.
// 3.227.0: a frame's possessed humans too.
const framed=f=>[...(f.props||[]).filter(isAnchor),...hostsOf(f.enemies)];
export const archiveAnchors=(frame,turn)=>{for(const p of framed(frame))p.anchor.next=Math.max(p.anchor.next,turn+1);};
export const resumeAnchors=(frame,elapsed)=>{for(const p of framed(frame))p.anchor.next+=elapsed;};
