// Blind fire (3.151.0, user decisions 2026-09-20, docs/WEAPONS.md 盲射): shoot at a floor tile you cannot see into, such
// as a smoke cloud. Whatever enemy stands there takes the shot at −40, the squad's called-shot penalty, in place of the
// darkness penalty; the shotgun's pellets are not affected and hit everything in the cone, seen or not.
// You learn only what you can see (option 丙): no hit or miss line, no impact at a tile out of sight, every tracer drawn
// as a miss, and what the shot left there (a body, blood, dropped loot) shows once you see the tile. Whether firing gives
// your position away is the usual rule: enemies who can see you. A hit enemy still cries out as usual, which you hear.
import {t,sentence} from './i18n.js';
import {distance,key} from './world.js';

export const BLIND_TUNING={penalty:40};

// Presentation-only state, never serialized: the aim of the blind shot in progress and the muted log.
const aims=new WeakMap(),silent=new WeakSet();
export const blindAim=g=>aims.get(g);
export const silenced=g=>silent.has(g);

const hiddenAt=(g,tile)=>g.enemies.find(e=>e.hp>0&&e.x===tile.x&&e.y===tile.y);
export function blindReason(g,tile){
  const p=g.player,w=g.weapon;
  if(!tile||!Number.isInteger(tile.x)||!Number.isInteger(tile.y)||g.grid[tile.y]?.[tile.x]!==1)return t('blind-fire.floorOnly');
  if(w.melee)return t('blind-fire.noMelee');
  if(w.lance||w.pointTarget||w.explosive)return t('blind-fire.weaponCannot',{weapon:w.name});
  if(distance(p,tile)===0)return t('blind-fire.notUnderfoot');
  if(distance(p,tile)>w.range)return t('blind-fire.outOfRange');
  if(!g.shotClear(p,tile))return t('blind-fire.lineBlocked');
  const seen=hiddenAt(g,tile);if(seen&&g.teamVisible(seen))return t('blind-fire.targetVisible');
  if(g.activeAllies.some(a=>a.hp>0&&a.x===tile.x&&a.y===tile.y))return t('blind-fire.allyThere');
  if(p.ammo[p.weapon]<(w.shotCost||1))return t('blind-fire.magShort');
  return '';
}

// What the floor showed before the shot. Afterwards every unseen tile where something new lies (a body, blood, loot,
// which scatters to the next tiles too) keeps showing its old contents until it is seen.
const floorState=g=>({dead:g.enemies.filter(e=>e.hp<=0).map(e=>e.id),traces:[...g.traces],items:[...g.items]});
function rememberUnseen(g,before){
  const fresh=[...g.enemies.filter(e=>e.hp<=0&&!before.dead.includes(e.id)),...g.traces.filter(t=>!before.traces.includes(t)),...g.items.filter(i=>!before.items.includes(i))];
  for(const k of new Set(fresh.map(key))){
    if(g.visibleTiles?.has(k)||g.blindAftermath?.has(k))continue;const at=o=>key(o)===k;
    (g.blindAftermath??=new Map()).set(k,{dead:g.enemies.filter(e=>at(e)&&before.dead.includes(e.id)).map(e=>e.id),traces:before.traces.filter(at).map(t=>({...t})),items:before.items.filter(at).map(i=>({...i}))});
  }
}
// The items a player may know of: an unseen blind-fired tile still holds what it held before the shot.
export function shownItems(g){const memo=g.blindAftermath;if(!memo?.size)return g.items;const hidden=k=>memo.has(k)&&!g.visibleTiles?.has(k);
  return [...g.items.filter(i=>!hidden(key(i))),...[...memo].filter(([k])=>hidden(k)).flatMap(([,m])=>m.items)];}
export function forgetSeenAftermath(g){if(g.blindAftermath?.size)for(const k of g.blindAftermath.keys())if(g.visibleTiles?.has(k))g.blindAftermath.delete(k);}

export function blindFire(g,tile){
  const reason=blindReason(g,tile);if(reason)return g.fail(sentence(reason));
  const p=g.player,w=g.weapon,k=key(tile),seen=Boolean(g.visibleTiles?.has(k)),ammo=p.ammo[p.weapon];
  const before=floorState(g);
  const effects=g.effects,push=effects.push,tileOf=e=>e.to||e.from;
  // Effects pushed during the shot: tracers read as misses at an unseen tile, and nothing lands where you cannot see.
  effects.push=function(...items){return push.apply(this,items.flatMap(e=>{
    if(e.type==='shot')return [seen?e:{...e,miss:true}];
    const at=tileOf(e);return !at||g.visibleTiles?.has(`${Math.round(at.x)},${Math.round(at.y)}`)?[e]:[];
  }));};
  aims.set(g,{target:hiddenAt(g,tile)||null});silent.add(g);p.blindShot=BLIND_TUNING.penalty;
  let done=false;
  try{done=w.cone?g.fireCone(tile,true):g.fire(tile);}
  finally{delete p.blindShot;silent.delete(g);aims.delete(g);delete effects.push;}
  p.fireChain=null;   // no correction from shots you could not see land
  rememberUnseen(g,before);
  const spent=ammo-p.ammo[p.weapon];
  g.log(t('blind-fire.spent',{n:spent}));
  return done;
}
