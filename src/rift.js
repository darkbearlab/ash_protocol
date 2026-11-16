// The rift (3.226.0, docs/FACTIONS.md 5.1–5.3; user 2026-11-16): energy bodies held in the world by anchors. While its
// anchor stands, a body that falls only dissipates and forms again beside the anchor a few rounds later, announced on
// the tile it will take. Breaking the anchor dissipates every body bound to it for good. The bodies hunt life: they
// pass over machines. Numbers are Claude's (user: "你先定就做"), to be tuned after play.
//
// An anchor is a `nest` prop (so it blocks, takes shots and blasts, and draws from the rift row of the nest atlas) that
// carries `anchor` instead of `nest`: {active, serial, reforms:[{type,due,x,y}]}. A body knows its anchor by `anchorId`;
// one that formed again is `reformed` and pays no xp a second time.
//
// 3.227.0: a possessed human (被附身者, a card with `anchorHolder`) is a living anchor: it carries the same `anchor` state
// on the enemy itself, its bodies form again beside it wherever it stands, and when it falls they dissipate as when an
// anchor breaks. "Anchors" below means both, standing; `anchorProps` only the map objects.
import {t} from './i18n.js';
import {enemyDef} from './enemy-data.js';
import {ENEMY_TYPES,SIZE} from './data.js';
import {DIRECTIONS,distance,key} from './world.js';

export const RIFT_TUNING=Object.freeze({anchorHp:60,anchors:2,lateAnchors:3,lateFloor:4,anchorGap:8,startGap:6,reformTurns:4,wakeRadius:6,maxReforms:64});
export const ANCHOR_ID=/^anchor-\d+-\d+$/;
export const isEnergy=e=>Boolean(enemyDef(e)?.energy);
export const huntsLife=e=>Boolean(enemyDef(e)?.huntsLife);
export const isAnchor=p=>Boolean(p&&p.type==='nest'&&p.anchor);
export const isHost=e=>Boolean(enemyDef(e)?.anchorHolder);
export const anchorProps=g=>(g.props||[]).filter(p=>isAnchor(p)&&p.hp>0);
const hostsOf=list=>(list||[]).filter(e=>e.anchor&&isHost(e));
export const liveAnchors=g=>[...anchorProps(g),...hostsOf(g.enemies).filter(e=>e.hp>0)];
export const anchorOf=(g,e)=>e?.anchorId?[...(g.props||[]).filter(isAnchor),...hostsOf(g.enemies)].find(a=>a.id===e.anchorId)||null:null;
const newAnchorState=active=>({active,serial:0,reforms:[]});

// Generation (src/runtime-enemies.js addRuntimePopulation): `points` are free floor tiles in shuffled order; `safe` keeps
// every room reachable. Anchors stand apart from each other and away from the entrance.
export function placeAnchors(map,points,floor,forbidden,safe){
  const want=floor>=RIFT_TUNING.lateFloor?RIFT_TUNING.lateAnchors:RIFT_TUNING.anchors,placed=[];
  for(const p of points){
    if(placed.length>=want)break;
    if(forbidden.has(key(p))||distance(p,map.start)<RIFT_TUNING.startGap||placed.some(q=>distance(p,q)<RIFT_TUNING.anchorGap))continue;
    const prop={id:`anchor-${floor}-${placed.length}`,type:'nest',x:p.x,y:p.y,hp:RIFT_TUNING.anchorHp,maxHp:RIFT_TUNING.anchorHp,anchor:{active:false,serial:0,reforms:[]}};
    map.props.push(prop);if(!safe(map)){map.props.pop();continue;}
    placed.push(prop);forbidden.add(key(p));
  }
  return placed.length;
}
// Each energy body on the floor is bound to its nearest anchor, a possessed human counting as one (ties: map objects
// first, then id order). A floor without anchors binds none.
export function bindAnchors(map){
  for(const e of map.enemies)if(isHost(e))e.anchor=newAnchorState(true);
  const anchors=[...map.props.filter(isAnchor),...map.enemies.filter(isHost)];if(!anchors.length)return map;
  for(const e of map.enemies)if(isEnergy(e))e.anchorId=[...anchors].sort((a,b)=>distance(e,a)-distance(e,b))[0].id;
  return map;
}

const freeCell=(g,p)=>g.passable(p.x,p.y)&&distance(g.player,p)>0&&!g.enemies.some(e=>e.hp>0&&key(e)===key(p))&&!g.activeAllies.some(a=>key(a)===key(p))&&!g.props.some(o=>o.hp>0&&key(o)===key(p))&&!g.hazards.some(o=>key(o)===key(p));
// The tile a body will form on: beside its anchor, in a fixed order, never under anything.
export const reformCell=(g,anchor)=>DIRECTIONS.map(([dx,dy])=>({x:anchor.x+dx,y:anchor.y+dy})).find(p=>freeCell(g,p)&&g.canCross(anchor,p))||null;

// A bound body fell (Game.hurt). With its anchor standing, it will form again: the tile is marked from now on.
export function anchorDeath(g,e){
  const anchor=anchorOf(g,e);if(!anchor||anchor.hp<=0||!isEnergy(e))return;
  const cell=reformCell(g,anchor),s=anchor.anchor;   // 3.227.0: a living anchor marks the tile beside where it stands now
  if(s.reforms.length>=RIFT_TUNING.maxReforms)return;
  s.reforms.push({type:e.type,due:g.turn+RIFT_TUNING.reformTurns,x:cell?cell.x:null,y:cell?cell.y:null});
  if(g.teamVisible(e))g.log(t('rift.dissipates',{target:enemyDef(e).name}));
}

// Each round after the enemies (src/game-actions.js, with the nests): anchors wake when you come near, and bodies
// whose time has come form on their marked tile (or the next free one beside the anchor; none free, it waits).
export function tickAnchors(g){
  for(const anchor of liveAnchors(g)){
    const s=anchor.anchor;
    if(!s.active&&distance(g.player,anchor)<=RIFT_TUNING.wakeRadius){s.active=true;g.log(t('rift.anchorAwake'),true);}
    const waiting=[];
    for(const r of s.reforms){
      if(r.due>g.turn){if(r.x===null||!freeCell(g,r)||distance(r,anchor)!==1){const c=reformCell(g,anchor);r.x=c?c.x:null;r.y=c?c.y:null;}waiting.push(r);continue;}
      const at=r.x!==null&&freeCell(g,r)&&distance(r,anchor)===1?{x:r.x,y:r.y}:reformCell(g,anchor);
      if(!at){r.x=null;r.y=null;waiting.push(r);continue;}
      const e=g.spawnEnemy(r.type,at.x,at.y,`${anchor.id}-r${++s.serial}`,{anchorId:anchor.id,reformed:true});
      e.alert=true;e.lastKnown={x:g.player.x,y:g.player.y};g.enemies.push(e);
      g.effects.push({type:'portalSpawn',from:{x:at.x,y:at.y},to:{x:at.x,y:at.y},damage:0});
      if(g.visible(at))g.log(t('rift.reformed',{target:enemyDef(e).name}));
    }
    s.reforms=waiting;
  }
}

// The anchor breaks (Game.damageProp) or the possessed human falls (Game.hurt, 3.227.0): its pending bodies never form
// and the standing ones dissipate. Returns those, for the caller to run their deaths (no kill, xp or drops: nobody
// killed them).
export function collapseAnchor(g,p){
  const host=!isAnchor(p);
  if(!host)p.hp=0;p.anchor.reforms=[];
  g.effects.push(host?{type:'portalSpawn',from:{x:p.x,y:p.y},to:{x:p.x,y:p.y},damage:0}:{type:'nestCollapse',nestStyle:'rift',from:{x:p.x,y:p.y},to:{x:p.x,y:p.y},damage:0});
  const bodies=g.enemies.filter(e=>e.hp>0&&e.anchorId===p.id);
  for(const e of bodies){e.hp=0;e.dissipated=true;}
  if(host)g.log(bodies.length?t('rift.hostFellBodies',{n:bodies.length}):t('rift.hostFell'),true);
  else g.log(bodies.length?t('rift.anchorBrokenBodies',{n:bodies.length}):t('rift.anchorBroken'),true);
  return bodies;
}

// Load checks (src/runtime-enemies.js validRuntime): broken data refuses; a due later than today's tuning allows is cut
// to it, so a retune of reformTurns never strands a save.
export function validAnchors(g){
  const ok=n=>Number.isInteger(n)&&n>=0&&n<SIZE;
  // 3.227.0: only a possessed human's card carries the state on a unit.
  if((g.enemies||[]).some(e=>e.anchor!==undefined&&!isHost(e)))return false;
  for(const p of [...(g.props||[]).filter(isAnchor),...hostsOf(g.enemies)]){
    const s=p.anchor,prop=isAnchor(p);
    if(prop&&(!ANCHOR_ID.test(p.id)||!Number.isFinite(p.maxHp)||p.maxHp<=0||p.hp>p.maxHp)||!Number.isFinite(p.hp)||!s||typeof s!=='object'||typeof s.active!=='boolean'||!Number.isInteger(s.serial)||s.serial<0||!Array.isArray(s.reforms)||s.reforms.length>RIFT_TUNING.maxReforms)return false;
    for(const r of s.reforms){
      if(!r||!ENEMY_TYPES[r.type]?.energy||!Number.isInteger(r.due)||!(r.x===null&&r.y===null||ok(r.x)&&ok(r.y)))return false;
      r.due=Math.min(r.due,g.turn+RIFT_TUNING.reformTurns);
    }
    if(p.hp<=0&&s.reforms.length)s.reforms=[];
  }
  return g.enemies.every(e=>(e.anchorId===undefined||typeof e.anchorId==='string')&&(e.reformed===undefined||typeof e.reformed==='boolean')&&(e.dissipated===undefined||e.dissipated===true&&e.hp<=0));
}
// Kept floors (src/retreat.js): a body due on departure forms on the first round back; the wait counts on the floor's clock.
// 3.227.0: a frame's possessed humans too.
const framed=f=>[...(f.props||[]).filter(isAnchor),...hostsOf(f.enemies)];
export const archiveAnchors=(frame,turn)=>{for(const p of framed(frame))for(const r of p.anchor.reforms)r.due=Math.max(r.due,turn+1);};
export const resumeAnchors=(frame,elapsed)=>{for(const p of framed(frame))for(const r of p.anchor.reforms)r.due+=elapsed;};
