import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,generate,FACTIONS,SWARM_TUNING as T,tickSwarmWaves,validSwarmWaves,hordeCount,reinforcementTelegraphs,addPoison,clearPoison,tickPoison,validPoison,poisonHit,SAVE_VERSION} from '../src/engine.js';
import {affixArena} from '../qa/enemy-affix-scenes.mjs';
import {enemyRoom,expendableRoom,RUNTIME_TUNING,tickNests} from '../src/runtime-enemies.js';
import {archiveFloor,resumedFloor,FLOOR_FIELDS} from '../src/retreat.js';
import {key,distance,reachable} from '../src/world.js';
import {roomContains} from '../src/map-geometry.js';
import {MISSIONS} from '../src/missions.js';
import {applyPerk} from '../src/perks.js';
import {makeBackup,decodeBackup} from '../src/backup.js';
import {normalizeProfile} from '../src/progression.js';
const arena=()=>{const g=affixArena();g.facilityFaction='swarm';g.floor=3;g.swarmWaves=structuredClone(generate(475,3,[],0,'swarm').swarmWaves);g.swarmWaves.origin={x:14,y:10};return g;};
const tick=g=>{g.turn++;tickSwarmWaves(g);};

test('horde origins use an independent post-combat stream, outside start rooms, no prop or threat budget, data-gated',()=>{
 for(const floor of [1,2,3,6,12,60])for(let seed=1;seed<=5;seed++){
  const map=generate(seed,floor,[],0,'swarm'),type=FACTIONS.swarm.hordeType;let before;try{delete FACTIONS.swarm.hordeType;before=generate(seed,floor,[],0,'swarm');}finally{FACTIONS.swarm.hordeType=type;}
  const {swarmWaves,...unchanged}=map;assert.deepEqual(unchanged,before);assert.equal(Boolean(swarmWaves),floor>=3);
  if(swarmWaves){assert.ok(reachable(map,map.start).has(key(swarmWaves.origin)));assert.ok(!roomContains(map.rooms[map.startRoom],swarmWaves.origin));assert.ok(!map.props.some(p=>key(p)===key(swarmWaves.origin)));assert.ok(!map.items.some(p=>key(p)===key(swarmWaves.origin)));}
 }
 for(const faction of ['legacy','loyalist','rebel'])assert.equal(generate(475,3,[],0,faction).swarmWaves,undefined);
});
test('activation is within six; four warnings last two full paid ticks; starts at least three ticks apart and stops at sixteen',()=>{
 const g=arena(),s=g.swarmWaves;g.player.x=1;tick(g);assert.equal(s.active,false);g.player.x=8;const rng=g.rng.state(),starts=[];
 for(let n=0;n<20;n++){const previous=s.wave;tick(g);if(s.wave!==previous)starts.push(g.turn);if(n===0){assert.equal(g.enemies.length,0);assert.equal(s.pending.length,4);assert.ok(s.pending.every(p=>p.due===g.turn+2));}if(n===1)assert.equal(g.enemies.length,0);if(n===2)assert.equal(g.enemies.length,4);
  for(const e of g.enemies)e.hp=0;assert.ok(validSwarmWaves(g));
 }
 assert.equal(g.enemies.length,16);assert.equal(s.remaining,0);assert.equal(s.pending.length,0);assert.equal(s.wave,4);assert.equal(g.rng.state(),rng);assert.deepEqual(starts.map(t=>t-starts[0]),[0,3,6,9]);
});
test('horde twelve-cap excludes both normal population counters and waits until four slots are available',()=>{
 const g=arena(),s=g.swarmWaves;for(let n=0;n<14;n++)tick(g);assert.equal(hordeCount(g),12);assert.equal(s.wave,3);assert.equal(enemyRoom(g),RUNTIME_TUNING.liveLimit);assert.equal(expendableRoom(g),RUNTIME_TUNING.expendableLimit);
 for(const e of g.enemies.slice(0,3))e.hp=0;tick(g);assert.equal(s.pending.length,0);g.enemies[3].hp=0;tick(g);assert.equal(s.pending.length,4);tick(g);tick(g);assert.equal(hordeCount(g),12);assert.equal(s.serial,16);assert.ok(validSwarmWaves(g));
});
// 3.85.2 (user decision): waves arrive unannounced, so a blocked cell moves the spawn instead of stalling the surge.
test('a blocked spawn moves to the nearest free cell near the origin, never onto a unit, and never stalls the surge',()=>{
 const g=arena(),s=g.swarmWaves;tick(g);const first={...s.pending[0]};Object.assign(g.player,{x:first.x,y:first.y});tick(g);tick(g);
 assert.equal(s.pending.length,0,'the blocked spawn did not wait');assert.equal(s.serial,4);
 assert.ok(!g.enemies.some(e=>e.hp>0&&key(e)===key(g.player)),'nothing spawns on the player');
 const moved=g.enemies.find(e=>e.id===first.id);assert.ok(moved);assert.notEqual(key(moved),key(first));assert.ok(distance(moved,g.swarmWaves.origin)<=T.hordeSpawnRadius);assert.ok(validSwarmWaves(g));
 for(let n=0;n<20;n++){for(const e of g.enemies)e.hp=0;tick(g);}
 assert.equal(s.serial,16,'a player standing on a spawn cell does not stop later waves');assert.equal(s.remaining,0);
});
test('floor items never block a spawn; only an area with no free cell makes a spawn wait a turn',()=>{
 const h=arena(),w=h.swarmWaves;tick(h);const cell={...w.pending[1]};h.items.push({type:'ammo',amount:10,x:cell.x,y:cell.y});tick(h);tick(h);
 assert.ok(h.enemies.some(e=>e.id===cell.id&&key(e)===key(cell)),'the bug appears on top of the item');
 const g=arena(),s=g.swarmWaves;tick(g);const cells=s.pending.map(p=>key(p)),first={...s.pending[0]};Object.assign(g.player,{x:first.x,y:first.y});
 for(let y=0;y<g.grid.length;y++)for(let x=0;x<g.grid[y].length;x++)if(distance({x,y},s.origin)<=T.hordeSpawnRadius+1&&!cells.includes(key({x,y})))g.grid[y][x]=0;
 tick(g);tick(g);
 assert.equal(s.serial,3);assert.equal(s.pending.length,1);assert.equal(s.pending[0].due,g.turn+1);assert.ok(!g.enemies.some(e=>e.hp>0&&key(e)===key(g.player)));
});
test('nest and horde sources coexist with independent caps; all horde victims give no XP, scrap, loot or infected offspring',()=>{
 const g=arena();for(let n=0;n<14;n++)tick(g);assert.equal(hordeCount(g),12);
 const nest={id:'nest-3-0',type:'nest',x:10,y:12,hp:45,maxHp:45,nest:{active:true,total:6,remaining:6,cooldown:0,interval:2,serial:0}};g.props.push(nest);
 for(let n=0;n<15;n++){tickNests(g);for(const [i,e]of g.enemies.filter(e=>e.nestId).entries()){e.x=1;e.y=i+1;}}
 assert.equal(g.enemies.filter(e=>e.nestId).length,6);assert.equal(expendableRoom(g),0);assert.equal(hordeCount(g),12);assert.equal(enemyRoom(g),RUNTIME_TUNING.liveLimit-6);
 const before={xp:g.player.xp,scrap:g.player.scrap,items:structuredClone(g.items),rng:g.rng.state(),count:g.enemies.length};for(const e of g.enemies.filter(e=>e.horde))g.hurt(e,1000,g.player);
 assert.deepEqual({xp:g.player.xp,scrap:g.player.scrap,items:g.items,rng:g.rng.state(),count:g.enemies.length},before);assert.ok(g.enemies.filter(e=>e.horde).every(e=>e.expendable&&e.reinforcement&&!e.affixes.length&&!e.broodReleased));
});
test('waves freeze through free decisions and archived-floor elapsed time; current save and full backup retain pending and children',()=>{
 const g=arena();tick(g);const s=structuredClone(g.swarmWaves),turn=g.turn;assert.ok(g.action('prepare',{category:'item',id:null}));assert.equal(g.turn,turn);assert.deepEqual(g.swarmWaves,s);
 assert.ok(FLOOR_FIELDS.includes('swarmWaves'));const frame=archiveFloor(g),restored=resumedFloor(frame,g.turn+11);assert.deepEqual(restored.swarmWaves.pending.map(p=>p.due),frame.swarmWaves.pending.map(p=>p.due+11));assert.equal(restored.swarmWaves.cooldown,frame.swarmWaves.cooldown);
 const copy=Game.restore(g.serialize());assert.ok(copy);assert.deepEqual(copy.swarmWaves,s);assert.ok(decodeBackup(JSON.stringify(makeBackup(g,normalizeProfile(),'qa')),'qa').game);tick(g);tick(g);assert.ok(Game.restore(g.serialize()));
 // Test an extended return-trip contract so a wave-bearing floor is actually archived and restored.
 const depth=MISSIONS.roundtrip.depth;MISSIONS.roundtrip.depth=4;try{const trip=new Game(475,[],0,'soldier','onyx','roundtrip',{facilityFaction:'swarm'});for(let n=1;n<3;n++){Object.assign(trip.player,trip.exitPoint);trip.enemies.forEach(e=>e.hp=0);assert.ok(trip.descend());}Object.assign(trip.player,trip.swarmWaves.origin);tick(trip);Object.assign(trip.player,trip.exitPoint);trip.enemies.forEach(e=>e.hp=0);assert.ok(trip.descend());assert.ok(trip.floorStates[3].swarmWaves.pending.length);const saved=Game.restore(trip.serialize());assert.ok(saved);assert.deepEqual(saved.floorStates[3].swarmWaves,trip.floorStates[3].swarmWaves);saved.floorStates[3].swarmWaves.pending[0].due=0;assert.equal(Game.restore(saved.serialize()),null);}finally{MISSIONS.roundtrip.depth=depth;}

});
test('strict wave validation rejects forged horde flags, counters, duplicate IDs, due dates and missing origin state',()=>{
 const g=arena();tick(g);const raw=g.serialize();for(const mutate of [d=>d.swarmWaves.serial++,d=>d.swarmWaves.wave=5,d=>d.swarmWaves.origin.x=99,d=>d.swarmWaves.pending[0].due=d.turn,d=>d.swarmWaves.pending[1].id=d.swarmWaves.pending[0].id]){const bad=JSON.parse(raw);mutate(bad.data);assert.equal(Game.restore(JSON.stringify(bad)),null);}
 tick(g);tick(g);const spawned=g.serialize();for(const mutate of [d=>delete d.swarmWaves,d=>d.enemies[0].horde=false,d=>d.enemies[0].expendable=false,d=>d.enemies[0].affixes=[{id:'brood_host',revealed:false}]]){const bad=JSON.parse(spawned);mutate(bad.data);assert.equal(Game.restore(JSON.stringify(bad)),null);}
});
test('poison damages at current stacks then decays every second paid end; stacking never resets its clock',()=>{
 const g=affixArena(),p=g.player;addPoison(p);tickPoison(g);assert.equal(p.hp,99);assert.equal(p.poison,1);assert.equal(p.poisonClock,1);addPoison(p);tickPoison(g);assert.equal(p.hp,97);assert.equal(p.poison,1);assert.equal(p.poisonClock,undefined);
 addPoison(p,99);const hp=p.hp;for(let n=0;n<8;n++)tickPoison(g);assert.equal(p.hp,hp-20);assert.equal(p.poison,0);assert.equal(p.poisonClock,undefined);
 addPoison(p,4);p.hazmat=5;tickPoison(g);assert.equal(p.hp,hp-23);assert.equal(p.poisonClock,1);clearPoison(p);assert.ok(validPoison(p));
});
test('multi-hit infected volleys apply one stack, misses none; separate attacks and spitter hits each apply one',()=>{
 const g=affixArena();g.facilityFaction='swarm';const e=g.spawnEnemy('raider_infected',12,10,'toxic');e.alert=true;e.charge=true;g.enemies=[e];g.rng=Object.assign(()=>0,{state:()=>1});g.enemyAct(e);assert.equal(g.player.poison,1);assert.equal(g.logs.filter(l=>l.text==='毒液侵入防護服，你中毒了。').length,1);e.charge=true;g.enemyAct(e);assert.equal(g.player.poison,2);
 g.rng=()=>.999;e.charge=true;g.enemyAct(e);assert.equal(g.player.poison,2);const spit=g.spawnEnemy('spitter',12,10,'spit');poisonHit(g,spit,g.player);assert.equal(g.player.poison,3);
});
test('all cures clear timer; acid adds one without refreshing decay, with poison ticking even on hot or acid ground',()=>{
 const g=affixArena(),p=g.player;p.meds=5;addPoison(p,3);tickPoison(g);assert.ok(g.executePlayer('heal'));assert.equal(p.poisonClock,undefined);assert.equal(p.poison,0);
 addPoison(p,3);tickPoison(g);p.scrap=100;g.props.push({type:'terminal',x:10,y:11});assert.ok(g.useTerminal('heal'));assert.equal(p.poisonClock,undefined);assert.equal(p.poison,0);
 addPoison(p,3);tickPoison(g);applyPerk(g,{effect:'hazmat',amount:5});assert.equal(p.poison,0);assert.equal(p.poisonClock,undefined);p.hazmat=0;p.hp=100;g.hazards=[{x:10,y:10,type:'acid'}];g.environmentTurn();assert.equal(p.hp,91);assert.equal(p.poison,1);assert.equal(p.poisonClock,1);g.environmentTurn();assert.equal(p.hp,81);assert.equal(p.poison,1);assert.equal(p.poisonClock,undefined);
});
test('save44 maps old remaining duration by ceil/2 exactly once and preserves new half-decay progress; bad poison state rejects',()=>{
 assert.equal(SAVE_VERSION,73);const g=affixArena();for(let old=0;old<=6;old++){const raw=JSON.parse(g.serialize());raw.version=43;raw.data.player.poison=old;delete raw.data.player.poisonClock;const copy=Game.restore(JSON.stringify(raw));assert.ok(copy);assert.equal(copy.player.poison,Math.ceil(old/2));assert.equal(copy.player.poisonClock,undefined);assert.equal(Game.restore(copy.serialize()).player.poison,Math.ceil(old/2));}
 addPoison(g.player,4);tickPoison(g);const raw=g.serialize();assert.equal(Game.restore(raw).player.poisonClock,1);for(const mutate of [p=>p.poison=5,p=>p.poisonClock=2,p=>p.poisonClock=-1,p=>p.poison=0]){const bad=JSON.parse(raw);mutate(bad.data.player);assert.equal(Game.restore(JSON.stringify(bad)),null);}
});
test('Game paid turns drive emergence after the warning; a pursuit attack advances neither waves nor poison',()=>{
 const g=arena();g.player.hp=1000;addPoison(g.player,4);const start=g.turn;
 assert.ok(g.action('wait'));assert.equal(g.swarmWaves.pending.length,4);assert.equal(g.player.poisonClock,1);assert.ok(g.swarmWaves.pending.every(p=>p.due===start+3));
 assert.ok(g.action('wait'));assert.equal(hordeCount(g),0);assert.equal(g.player.poison,3);assert.ok(g.action('wait'));assert.equal(hordeCount(g),4);
 const state=structuredClone(g.swarmWaves),clock=g.player.poisonClock,stacks=g.player.poison,turn=g.turn;g.pursuit=1;g.target=g.enemies.find(e=>e.horde).id;
 assert.ok(g.action('fire'));assert.equal(g.turn,turn);assert.deepEqual(g.swarmWaves,state);assert.equal(g.player.poisonClock,clock);assert.equal(g.player.poison,stacks);
});
