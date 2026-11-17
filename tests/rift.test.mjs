import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,ENEMY_TYPES,SAVE_VERSION} from '../src/engine.js';
import {FACTIONS,rollFacilityFaction} from '../src/faction-catalog.js';
import {RIFT_TUNING,DRAW_TUNING,liveAnchors,anchorProps,isEnergy,budgetUsed,bodyCost,drawWeights,drawKind} from '../src/rift.js';
import {tickNests,validRuntime} from '../src/runtime-enemies.js';
import {addAlly} from '../src/allies.js';
import {applyDisruption} from '../src/throwables.js';
import {applySuppression,suppressionStacks} from '../src/suppression.js';
import {activeTrait} from '../src/traits.js';
import {seesInDark} from '../src/lighting.js';
import {distance} from '../src/world.js';

// 3.226.0 (docs/FACTIONS.md 5.1–5.3; user 2026-11-16): the rift's skeleton — energy bodies bound to anchors; breaking the
// anchor ends every body bound to it. 3.232.0: anchors draw new bodies by weight within a budget (5.10).
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

// 3.232.0 (user 2026-11-17): an anchor draws by weight on its own clock, within its budget; a fallen body gives its share back.
const awake=(g,a)=>{a.anchor.active=true;a.anchor.next=g.turn;};
test('an anchor draws on its clock: what fits its budget forms beside it at once, and pays xp like any body',()=>{
 const g=rift(),anchor=anchorProps(g)[0];
 for(const e of g.enemies)if(e.anchorId===anchor.id)e.hp=0;   // nothing standing: the whole budget is free
 assert.equal(budgetUsed(g,anchor),0);
 awake(g,anchor);const count=g.enemies.length;tickNests(g);
 const made=g.enemies.slice(count);assert.equal(made.length,1,'one draw, one body');
 const e=made[0];assert.ok(drawWeights(g,anchor).some(([type])=>type===e.type));assert.equal(e.anchorId,anchor.id);assert.equal(distance(e,anchor),1);
 assert.equal(anchor.anchor.next,g.turn+DRAW_TUNING.prop.interval,'the clock starts again');assert.ok(g.effects.some(fx=>fx.type==='portalSpawn'));
 assert.equal(budgetUsed(g,anchor),bodyCost(e.type));
 // Not before the clock comes round again.
 tickNests(g);assert.equal(g.enemies.length,count+1);
 const xp=g.player.xp;g.hurt(e,999,g.player);assert.equal(g.player.xp,xp+ENEMY_TYPES[e.type].xp,'it pays its xp');assert.equal(budgetUsed(g,anchor),0,'and gives its share back');
});

test('a draw that does not fit what is left of the budget fails, and the anchor waits for its next clock',()=>{
 const g=rift(),anchor=anchorProps(g)[0];
 for(const e of g.enemies)if(e.anchorId===anchor.id)e.hp=0;
 // Fill the budget to one short of full with bodies of its own: only a cost-1 draw could fit.
 let n=0;while(budgetUsed(g,anchor)<DRAW_TUNING.prop.budget-1){const w=g.spawnEnemy('wisp',1,1+n,`fill-${n++}`,{anchorId:anchor.id});g.enemies.push(w);}
 let formed=0,failed=0;
 const own=()=>g.enemies.filter(e=>e.id.startsWith(`${anchor.id}-r`));   // what this anchor drew (a host draws on its own clock)
 for(let k=0;k<12;k++){awake(g,anchor);const kind=drawKind(g,anchor),before=own().length;tickNests(g);const made=own().length-before;
  if(bodyCost(kind)>1){assert.equal(made,0,kind);failed++;}else{formed+=made;if(made)own().at(-1).hp=0;}g.turn++;}
 assert.ok(failed>0&&formed>0,`both happen over a dozen draws (${failed} failed, ${formed} formed)`);
 // Full: nothing forms.
 const full=rift(),a=anchorProps(full)[0];while(budgetUsed(full,a)<DRAW_TUNING.prop.budget){const w=full.spawnEnemy('wisp',1,1,`f${full.enemies.length}`,{anchorId:a.id});full.enemies.push(w);}
 awake(full,a);const before=full.enemies.length;tickNests(full);assert.equal(full.enemies.length,before);
});

test('a host draws too, and only what fits its small budget; a sleeping map anchor draws nothing',()=>{
 const g=rift(4,4),host=g.spawnEnemy('possessed_melee',3,3,'host');host.anchor={active:true,serial:0,next:g.turn};g.enemies.push(host);
 assert.ok(drawWeights(g,host).every(([type])=>bodyCost(type)<=DRAW_TUNING.host.budget),'no shade on a host');
 const sleeping=anchorProps(g)[0];sleeping.anchor.active=false;sleeping.anchor.next=0;Object.assign(g.player,{x:sleeping.x+RIFT_TUNING.wakeRadius+5,y:sleeping.y});
 for(const e of g.enemies)if(e.anchorId===sleeping.id)e.hp=0;
 const before=g.enemies.filter(e=>e.anchorId===sleeping.id).length;tickNests(g);assert.equal(g.enemies.filter(e=>e.anchorId===sleeping.id).length,before);
});

test('breaking the anchor dissipates its bodies for good: no kill, no xp, and it draws no more',()=>{
 const g=rift(),anchor=anchorProps(g)[0],mine=bound(g,anchor),other=g.enemies.filter(e=>e.hp>0&&e.anchorId&&e.anchorId!==anchor.id);
 assert.ok(mine.length>0);
 const kills=g.player.kills,xp=g.player.xp;
 g.damageProp(anchor,999,g.player);
 assert.equal(anchor.hp,0);assert.equal(bound(g,anchor).length,0);for(const e of mine)assert.equal(e.dissipated,true);
 assert.equal(g.player.kills,kills);assert.equal(g.player.xp,xp);
 assert.equal(other.every(e=>e.hp>0),true,'the other anchor keeps its own');
 anchor.anchor.active=true;anchor.anchor.next=0;const count=g.enemies.length;tickNests(g);assert.equal(g.enemies.filter(e=>e.anchorId===anchor.id&&e.hp>0).length,0);void count;
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

test('saves: the clock round-trips; a long one is cut to the tuning; an old save\'s waiting bodies are dropped; broken data is refused; a kept floor waits',()=>{
 assert.equal(SAVE_VERSION,99);
 const g=rift(),anchor=anchorProps(g)[0];awake(g,anchor);anchor.anchor.next=g.turn+2;
 const copy=roundTrip(g);assert.ok(copy);assert.deepEqual(copy.props.find(p=>p.id===anchor.id).anchor,anchor.anchor);
 const long=JSON.parse(g.serialize());long.data.props.find(p=>p.id===anchor.id).anchor.next=g.turn+99;
 const cut=Game.restore(JSON.stringify(long));assert.ok(cut);assert.equal(cut.props.find(p=>p.id===anchor.id).anchor.next,g.turn+DRAW_TUNING.prop.interval);
 // 3.226–3.231.0: bodies waiting to form again. Dropped, the clock set.
 {const raw=JSON.parse(g.serialize());const s=raw.data.props.find(p=>p.id===anchor.id).anchor;delete s.next;s.reforms=[{type:'wisp',due:g.turn+2,x:1,y:1}];const old=Game.restore(JSON.stringify(raw));assert.ok(old);const a=old.props.find(p=>p.id===anchor.id).anchor;assert.equal(a.reforms,undefined);assert.ok(Number.isInteger(a.next));}
 for(const broken of [s=>{s.next=1.5;},s=>{s.next=-1;},s=>{s.guard='yes';},s=>{s.reforms='x';}]){
  const raw=JSON.parse(g.serialize());broken(raw.data.props.find(p=>p.id===anchor.id).anchor);assert.equal(Game.restore(JSON.stringify(raw)),null);
 }
 const raw=JSON.parse(g.serialize());raw.data.props.find(p=>p.id===anchor.id).id='nest-1-0';assert.equal(Game.restore(JSON.stringify(raw)),null,'an anchor keeps its own id');
 assert.ok(validRuntime(g));
 // A kept floor (the round trip mission) holds its clock until you come back.
 const trip=new Game(7,[],0,'soldier','onyx','roundtrip',{facilityFaction:'rift'});Object.assign(trip.player,{hp:999,maxHp:999});
 const ta=anchorProps(trip)[0];awake(trip,ta);
 for(const e of trip.enemies)e.hp=0;Object.assign(trip.player,trip.exitPoint);const left=trip.turn;assert.ok(trip.descend());
 const kept=trip.floorStates[1]||Object.values(trip.floorStates)[0];assert.ok(kept);
 assert.ok(kept.props.find(p=>p.id===ta.id).anchor.next>=left+1,'a draw due on departure waits for the first round back');
 assert.ok(Game.restore(trip.serialize()),'a save with a kept rift floor loads');
});

test('the wisp card is an energy body with no loot, bound by the rift alone',()=>{
 const card=ENEMY_TYPES.wisp;
 assert.equal(card.energy,true);assert.equal(card.huntsLife,true);assert.equal(card.lifeDrain,true);assert.equal(card.loot,undefined);
 const roster=[...FACTIONS.rift.roster.early,...FACTIONS.rift.roster.late];
 for(const id of ['wisp','flicker','possessed','possessed_melee','shade','phase','displacer','beamer'])assert.ok(roster.some(([type])=>type===id),id);   // 3.227.0–3.231.0
});
