import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,ENEMY_TYPES,SAVE_VERSION} from '../src/engine.js';
import {FACTIONS,rollFacilityFaction} from '../src/faction-catalog.js';
import {RIFT_TUNING,liveAnchors,anchorProps,isEnergy} from '../src/rift.js';
import {tickNests,validRuntime} from '../src/runtime-enemies.js';
import {addAlly} from '../src/allies.js';
import {applyDisruption} from '../src/throwables.js';
import {applySuppression,suppressionStacks} from '../src/suppression.js';
import {activeTrait} from '../src/traits.js';
import {seesInDark} from '../src/lighting.js';
import {distance} from '../src/world.js';

// 3.226.0 (docs/FACTIONS.md 5.1–5.3; user 2026-11-16): the rift's skeleton — energy bodies bound to anchors. A body
// that falls while its anchor stands forms again beside it; breaking the anchor ends every body bound to it.
const rift=(seed=7,floor=1)=>{const g=new Game(seed,[],0,'soldier','onyx','extraction',{facilityFaction:'rift'});if(floor!==1){g.floor=floor;g.loadFloor();}Object.assign(g.player,{hp:999,maxHp:999});return g;};
const bound=(g,anchor)=>g.enemies.filter(e=>e.hp>0&&e.anchorId===anchor.id);
const roundTrip=g=>Game.restore(g.serialize());

test('a rift floor stands two anchors (three from floor 4) and binds every body to its nearest one',()=>{
 for(const seed of [1,2,3]){
  for(const [floor,want] of [[1,RIFT_TUNING.anchors],[4,RIFT_TUNING.lateAnchors]]){
   const g=rift(seed,floor),props=anchorProps(g),anchors=liveAnchors(g);
   assert.equal(props.length,want,`seed ${seed} floor ${floor}`);
   for(const a of props){assert.equal(a.hp,RIFT_TUNING.anchorHp);assert.ok(distance(a,g.start)>=RIFT_TUNING.startGap);for(const b of props)if(a!==b)assert.ok(distance(a,b)>=RIFT_TUNING.anchorGap);}
   const bodies=g.enemies.filter(isEnergy);assert.ok(bodies.length>0);
   for(const e of bodies){const mine=anchors.find(a=>a.id===e.anchorId);assert.ok(mine,e.id);assert.equal(distance(e,mine),Math.min(...anchors.map(a=>distance(e,a))));}
  }
 }
 // Not finished yet: no random facility (and so no ranked daily) is ever the rift.
 assert.equal(FACTIONS.rift.pickable,undefined);
 for(let seed=0;seed<200;seed++)assert.notEqual(rollFacilityFaction(seed),'rift');
 // Other facilities have no anchors.
 assert.equal(liveAnchors(new Game(7,[],0,'soldier','onyx','extraction',{facilityFaction:'swarm'})).length,0);
});

test('a body that falls with its anchor standing forms again on the marked tile, and pays its xp only once',()=>{
 const g=rift(),w=g.enemies.find(e=>e.anchorId?.startsWith('anchor-')),anchor=liveAnchors(g).find(a=>a.id===w.anchorId);
 const xp=g.player.xp,scrap=g.player.scrap,items=g.items.length;
 g.hurt(w,999,g.player);
 assert.equal(w.hp<=0,true);assert.equal(g.player.xp,xp+1,'the first fall pays its xp');
 assert.equal(g.player.scrap,scrap,'an energy body leaves no scrap');assert.equal(g.items.length,items,'and no loot');
 assert.equal(anchor.anchor.reforms.length,1);
 const r=anchor.anchor.reforms[0];assert.equal(r.type,w.type);assert.equal(r.due,g.turn+RIFT_TUNING.reformTurns);assert.equal(distance(r,anchor),1,'the marked tile is beside the anchor');
 // Not before its time.
 const count=g.enemies.length;g.turn=r.due-1;tickNests(g);assert.equal(g.enemies.length,count);
 g.turn=r.due;tickNests(g);
 const again=g.enemies[g.enemies.length-1];
 assert.equal(again.type,w.type);assert.equal(again.reformed,true);assert.equal(again.anchorId,anchor.id);assert.deepEqual([again.x,again.y],[r.x,r.y]);
 assert.ok(g.effects.some(fx=>fx.type==='portalSpawn'));assert.equal(anchor.anchor.reforms.length,0);
 const before=g.player.xp;g.hurt(again,999,g.player);assert.equal(g.player.xp,before,'a body that formed again pays nothing');
 assert.equal(anchor.anchor.reforms.length,1,'and it forms again while the anchor stands');
});

test('a marked tile taken in the meantime moves the body to another tile beside the anchor; none free, it waits',()=>{
 const g=rift(),w=g.enemies.find(e=>e.anchorId?.startsWith('anchor-')),anchor=liveAnchors(g).find(a=>a.id===w.anchorId);
 g.hurt(w,999,g.player);const r=anchor.anchor.reforms[0];
 const blocker=g.enemies.find(e=>e.hp>0&&e!==w);Object.assign(blocker,{x:r.x,y:r.y});
 g.turn=r.due;tickNests(g);const again=g.enemies[g.enemies.length-1];
 assert.equal(again.reformed,true);assert.notDeepEqual([again.x,again.y],[blocker.x,blocker.y]);assert.equal(distance(again,anchor),1);
});

test('breaking the anchor dissipates its bodies for good: no kill, no xp, and nothing forms again',()=>{
 const g=rift(),anchor=anchorProps(g)[0],mine=bound(g,anchor),other=g.enemies.filter(e=>e.hp>0&&e.anchorId&&e.anchorId!==anchor.id);
 assert.ok(mine.length>0);
 const first=mine[0];g.hurt(first,999,g.player);assert.equal(anchor.anchor.reforms.length,1);
 const kills=g.player.kills,xp=g.player.xp;
 g.damageProp(anchor,999,g.player);
 assert.equal(anchor.hp,0);assert.equal(anchor.anchor.reforms.length,0,'what was forming never forms');
 assert.equal(bound(g,anchor).length,0);for(const e of mine.slice(1))assert.equal(e.dissipated,true);
 assert.equal(g.player.kills,kills);assert.equal(g.player.xp,xp);
 assert.equal(other.every(e=>e.hp>0),true,'the other anchor keeps its own');
 g.turn+=RIFT_TUNING.reformTurns*2;const count=g.enemies.length;tickNests(g);assert.equal(g.enemies.length,count);
 // A body bound to a broken anchor simply dies.
 const stray=g.spawnEnemy('wisp',first.x,first.y,'stray',{anchorId:anchor.id});g.enemies.push(stray);g.hurt(stray,999,g.player);assert.equal(anchor.anchor.reforms.length,0);
 assert.ok(roundTrip(g),'a broken anchor and its dissipated bodies load');
});

test('rift bodies hunt life: they pass over a machine for the operative or a pet',()=>{
 const g=rift(),w=g.enemies.find(e=>e.type==='wisp');
 for(const e of g.enemies)if(e!==w)e.hp=0;
 const spot=[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>({x:w.x+dx,y:w.y+dy})).find(p=>g.passable(p.x,p.y)&&g.canCross(w,p)&&!(p.x===g.player.x&&p.y===g.player.y));
 const drone=addAlly(g,'drone','drone',{point:spot,sourceId:'drone_follow'});assert.ok(drone);
 g.reveal();assert.ok(g.sight(w,drone),'the drone is right beside it');
 assert.notEqual(g.enemyTarget(w),drone,'never the drone');
 assert.equal(g.enemyTarget(w),g.player);
 // A swarm hunter beside the same drone does go for it: the rule is the rift's.
 const bug=g.spawnEnemy('crawler',w.x,w.y,'bug');bug.faction='swarm';assert.equal(g.enemyTarget(bug),drone);
});

test('an energy body: EMP disables it, stun does not; no suppression; it sees in the dark; its touch heals it',()=>{
 const g=rift(),w=g.enemies.find(e=>e.type==='wisp');
 assert.ok(activeTrait(w,'energy'));assert.equal(activeTrait(w,'biological'),false);assert.equal(activeTrait(w,'mechanical'),false);
 assert.equal(applyDisruption(w,'biological'),false,'stun does nothing');
 assert.ok(applyDisruption(w,'mechanical'),'EMP disables it');
 applySuppression(w,3);assert.equal(suppressionStacks(w),0);
 assert.ok(seesInDark(g,w));
 w.hp=5;g.damagePlayer(7,'test',w);assert.ok(w.hp>5,'it healed by what it took');assert.ok(w.hp<=w.maxHp);
 const before=w.hp;g.damagePlayer(7,'test',w,true);assert.equal(w.hp,before,'never from a blast');
});

test('saves: a pending body keeps its tile and time; a long wait is cut to the tuning; broken data is refused; a kept floor waits',()=>{
 assert.equal(SAVE_VERSION,97);
 const g=rift(),w=g.enemies.find(e=>e.anchorId?.startsWith('anchor-')),anchor=liveAnchors(g).find(a=>a.id===w.anchorId);
 g.hurt(w,999,g.player);
 const copy=roundTrip(g);assert.ok(copy);assert.deepEqual(copy.props.find(p=>p.id===anchor.id).anchor,anchor.anchor);
 assert.equal(copy.enemies.find(e=>e.id===w.id).anchorId,anchor.id);
 const long=JSON.parse(g.serialize());long.data.props.find(p=>p.id===anchor.id).anchor.reforms[0].due=g.turn+99;
 const cut=Game.restore(JSON.stringify(long));assert.ok(cut);assert.equal(cut.props.find(p=>p.id===anchor.id).anchor.reforms[0].due,g.turn+RIFT_TUNING.reformTurns);
 for(const broken of [r=>{r.type='rifleman';},r=>{r.due=1.5;},r=>{r.x=3;r.y=null;}]){
  const raw=JSON.parse(g.serialize());broken(raw.data.props.find(p=>p.id===anchor.id).anchor.reforms[0]);assert.equal(Game.restore(JSON.stringify(raw)),null);
 }
 const raw=JSON.parse(g.serialize());raw.data.props.find(p=>p.id===anchor.id).id='nest-1-0';assert.equal(Game.restore(JSON.stringify(raw)),null,'an anchor keeps its own id');
 assert.ok(validRuntime(g));
 // A kept floor (the round trip mission) holds its pending body until you come back.
 const trip=new Game(7,[],0,'soldier','onyx','roundtrip',{facilityFaction:'rift'});Object.assign(trip.player,{hp:999,maxHp:999});
 const tw=trip.enemies.find(e=>e.anchorId?.startsWith('anchor-')),ta=liveAnchors(trip).find(a=>a.id===tw.anchorId);trip.hurt(tw,999,trip.player);
 const wait=ta.anchor.reforms[0].due-trip.turn;
 for(const e of trip.enemies)e.hp=0;Object.assign(trip.player,trip.exitPoint);assert.ok(trip.descend());
 const kept=trip.floorStates[1]||Object.values(trip.floorStates)[0];assert.ok(kept);
 const held=kept.props.find(p=>p.id===ta.id).anchor.reforms[0];assert.ok(held.due>=trip.turn+1);
 assert.ok(Game.restore(trip.serialize()),'a save with a kept rift floor loads');
 assert.ok(wait>0);
});

test('the wisp card is an energy body with no loot, bound by the rift alone',()=>{
 const card=ENEMY_TYPES.wisp;
 assert.equal(card.energy,true);assert.equal(card.huntsLife,true);assert.equal(card.lifeDrain,true);assert.equal(card.loot,undefined);
 for(const id of ['wisp','flicker','possessed'])assert.ok(FACTIONS.rift.roster.early.some(([type])=>type===id),id);   // 3.227.0
});
