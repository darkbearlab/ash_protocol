import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {Game} from '../src/game.js';
import {generate,generateLegacy,generateWithRecipes,PHASE_ONE_RECIPES,generationSafe,reachable,key,makeEnemy} from '../src/world.js';
import {MAP_FIELDS,MAP_GENERATION,roomTiles,roomContains,roomAt,latticeCells,cellNeighbors,collapseCellLinks,validMapMetadata} from '../src/map-geometry.js';
import {allocateThreat,contourPosts,reservationPosts,placePopulation,eligibleMissionEnemy} from '../src/map-population.js';
import {archiveFloor,resumedFloor} from '../src/retreat.js';
import {prepareMission} from '../src/missions.js';
import {ENEMY_TYPES,SAVE_VERSION} from '../src/data.js';
import {makeBackup,decodeBackup,validateProfile} from '../src/backup.js';
import {normalizeProfile} from '../src/progression.js';

test('empty recipe pool preserves 24 pre-refactor v1 maps byte-for-byte, including the entrance scout',()=>{
  const fixtures=JSON.parse(readFileSync(new URL('./fixtures/mapgen-v1.json',import.meta.url)));
  for(const {seed,floor,hash}of fixtures){const map=generateWithRecipes(seed,floor,[],[]);assert.equal(createHash('sha256').update(JSON.stringify(map)).digest('hex'),hash);assert.ok(map.enemies.some(e=>roomContains(map.rooms[map.startRoom],e)));}
});

test('lattice adjacency and collapsed room graph do not depend on room IDs or nine rooms',()=>{
  const cells=latticeCells();cells[0].roomId=7;cells[1].roomId=7;cells[2].roomId=4;
  assert.deepEqual(cellNeighbors(cells,1),[0,2,4]);
  assert.deepEqual(collapseCellLinks(cells,[[0,1],[1,2],[2,1],[1,4]]),[[7,4]]);
  const shape={x:0,y:0,w:2,h:2,footprint:[{x:0,y:0},{x:1,y:0},{x:0,y:1}]};
  assert.equal(roomContains(shape,{x:1,y:1}),false);assert.equal(roomAt([shape],{x:1,y:1}),-1);assert.equal(roomTiles(shape).length,3);
  assert.equal(reservationPosts(shape).length,3);
});

test('v2 ordinary and endless floors through 60 satisfy phase-one invariants without falling back',()=>{
  for(let seed=1;seed<=2;seed++)for(let floor=1;floor<=60;floor++){
    const m=generateWithRecipes(seed,floor,[],PHASE_ONE_RECIPES),old=generateLegacy(seed,floor),message=`seed ${seed}, floor ${floor}`;
    assert.equal(m.generation?.version,2,message);assert.ok(validMapMetadata(m),message);
    assert.ok(generationSafe(m),message); // Invariants 1–3, plus unique positions/IDs.
    assert.equal(m.cells.length,9);assert.ok(m.rooms.every(r=>r.cellIds.length===1));
    assert.ok(m.rooms.every(r=>m.openings.some(o=>o.rooms.includes(r.id)))); // 4: doors remain legacy until phase three.
    assert.ok(!m.enemies.some(e=>roomContains(m.rooms[m.startRoom],e)),message); // 5.
    assert.deepEqual(m.annexes,[]);assert.ok(reachable(m,m.start).has(key(m.end))); // 6: no annex dependency.
    assert.equal(m.enemies.length,old.enemies.length,message); // 7: same sampled budget, no exponential density.
    const roster=es=>es.map(({type,hp,maxHp,traits})=>JSON.stringify({type,hp,maxHp,traits})).sort();
    assert.deepEqual(roster(m.enemies),roster(old.enemies),message);
    const targetRooms=new Set(m.enemies.filter(eligibleMissionEnemy).map(e=>roomAt(m.rooms,e)));
    assert.ok(targetRooms.size>=3,message);
  }
});

test('v2 generation is deterministic, leaves unlock input unchanged and never consumes combat RNG',()=>{
  const unlocks=Object.freeze(['future-test']);
  for(const floor of [1,3,6,7,12,60]){const g=new Game(442),state=g.rng.state();assert.deepEqual(generate(g.seed,floor,unlocks),generate(g.seed,floor,unlocks));assert.equal(g.rng.state(),state);}
});

test('area allocation reserves three eligible target rooms before distributing and refuses impossible plans',()=>{
  const rooms=[1,1,2,4,1].map((area,id)=>({id,x:id*10,y:0,w:area*4,h:4}));
  const roster=Array.from({length:30},()=>({type:'rifleman'}));roster.push({type:'boss'});
  const options={startRoom:0,endRoom:4,capacities:{1:30,2:30,3:30,4:30}};
  const p=allocateThreat(rooms,roster,options);assert.equal(p.budget,31);assert.equal(p.targetRooms.length,3);
  for(const id of p.targetRooms)assert.ok(p.assigned[id].some(eligibleMissionEnemy));
  assert.ok(p.assigned[3].length>p.assigned[2].length);assert.ok(p.assigned[2].length>p.assigned[1].length);
  assert.ok(p.assigned[4].some(e=>e.type==='boss'));
  assert.equal(allocateThreat(rooms,roster,{...options,capacities:{1:1,2:1,3:1,4:1}}),null);
  assert.equal(allocateThreat(rooms,[{type:'rifleman'},{type:'rifleman'},...roster.map(e=>({...e,expendable:true}))],options),null);
});

test('contour posts remain legal beyond seven enemies; exhausted population placement changes nothing',()=>{
  const map=generate(12),r=map.rooms.find(r=>r.id!==map.startRoom),seen=reachable(map,map.start);
  const posts=contourPosts(map,r,seen);assert.ok(posts.length>7);assert.equal(new Set(posts.map(key)).size,posts.length);
  for(const p of posts){assert.ok(seen.has(key(p)));assert.ok(roomContains(r,p));assert.ok(![...map.props,...map.items,...map.hazards].some(o=>key(o)===key(p)));}
  const before=structuredClone(map);assert.equal(placePopulation(map,new Set(),1),false);assert.deepEqual(map,before);
  const bad=structuredClone(map);bad.grid[0][0]=1;assert.equal(generationSafe(bad),false);
  const blocked=structuredClone(map),c=blocked.openings[0].cells[0];blocked.props.push({...c,type:'cover',hp:10});assert.equal(generationSafe(blocked),false);
});

test('v2 sweep and recovery reserve three distinct reachable non-expendable targets',()=>{
  for(const mission of ['sweep','archive'])for(let seed=1;seed<=20;seed++){
    const g=new Game(seed,[],0,'soldier','onyx',mission);g.floor=6;g.loadFloor();
    assert.equal(g.mission.targets.length,3);
    const points=g.mission.targets.map(t=>mission==='sweep'?g.enemies.find(e=>e.id===t.id):t);
    assert.equal(new Set(points.map(p=>roomAt(g.rooms,p))).size,3);
    if(mission==='sweep'){const e=g.enemies.find(e=>eligibleMissionEnemy(e));e.expendable=true;prepareMission(g);assert.ok(!g.mission.targets.some(t=>t.id===e.id));}
  }
});

const descend=g=>{Object.assign(g.player,g.exitPoint);assert.equal(g.descend(),true);};
test('actual 1→2→3→2→1 travel, saves and full backups retain every v2 floor field',()=>{
  const g=new Game(428,[],0,'recon','onyx','roundtrip');
  const original=Object.fromEntries(MAP_FIELDS.map(k=>[k,structuredClone(g[k])]));descend(g);
  for(const k of MAP_FIELDS)assert.deepEqual(g.floorStates[1][k],original[k]);
  descend(g);for(const e of g.enemies)e.hp=0;Object.assign(g.player,g.mission.targets[0]);g.recoverObjective(g.mission.targets[0].id);
  const restored=Game.restore(g.serialize());assert.ok(restored);
  const backup=decodeBackup(JSON.stringify(makeBackup(restored,normalizeProfile(),'qa')),'qa').game;
  descend(backup);descend(backup);for(const k of MAP_FIELDS)assert.deepEqual(backup[k],original[k]);
  assert.equal(JSON.parse(backup.serialize()).version,SAVE_VERSION);
});

test('old v32 floor metadata is optional, mixed archives restore and returning does not inherit the current descriptor',()=>{
  const g=new Game(42,[],0,'recon','onyx','roundtrip'),raw=JSON.parse(g.serialize());
  for(const k of MAP_FIELDS)delete raw.data[k];delete raw.data.mapGenerations;
  const old=Game.restore(JSON.stringify(raw));assert.ok(old);assert.deepEqual(old.mapGenerations,[1]);assert.deepEqual(old.grid,g.grid);
  const oldFrame=archiveFloor(old);descend(old);assert.deepEqual(old.mapGenerations,[1,generate(old.seed,old.floor).generation.version]);
  assert.ok(Game.restore(old.serialize()));
  const state=resumedFloor(oldFrame,old.turn);Object.assign(old,state);for(const k of MAP_FIELDS)assert.equal(old[k],undefined);
  assert.deepEqual(old.rooms,g.rooms); // No regeneration or decoration inserted.
});

test('malformed v2 ownership, openings, generation and archived metadata are rejected',()=>{
  const g=new Game(42,[],0,'recon','onyx','roundtrip');descend(g);
  for(const mutate of [d=>d.cells[0].roomId=999,d=>d.rooms[0].footprint.push(d.rooms[0].footprint[0]),d=>d.openings[0].rooms=[0,999],d=>d.generation.version=99,d=>d.mapGenerations=[0],d=>d.floorStates[1].cells[0].col=99,d=>delete d.floorStates[1].generation]){
    const raw=JSON.parse(g.serialize());mutate(raw.data);assert.equal(Game.restore(JSON.stringify(raw)),null);
  }
});

test('zero-XP entries and expendable flags suppress only the specified rewards; retreat economy is unchanged',()=>{
  const g=new Game(8,[],0,'engineer','onyx'),before={xp:g.player.xp,scrap:g.player.scrap,kills:g.player.kills,items:structuredClone(g.items),rng:g.rng.state()};
  g.player.perks.engineer_salvage=3;g.player.perks.plating=3;
  const e=makeEnemy('rifleman',g.start.x,g.start.y,'expendable');e.expendable=true;g.enemies.push(e);g.hurt(e,999);
  assert.equal(g.player.xp,before.xp);assert.equal(g.player.scrap,before.scrap);assert.deepEqual(g.items,before.items);assert.equal(g.rng.state(),before.rng);assert.equal(g.player.kills,before.kills+1);
  const old=ENEMY_TYPES.rifleman.xp;try{ENEMY_TYPES.rifleman.xp=0;const zero=makeEnemy('rifleman',g.start.x,g.start.y,'zero');zero.reinforcement=true;g.hurt(zero,999);assert.equal(g.player.xp,before.xp);assert.ok(g.player.scrap>before.scrap);}finally{ENEMY_TYPES.rifleman.xp=old;}
  const retreat=makeEnemy('rifleman',g.start.x,g.start.y,'retreat');retreat.reinforcement=true;g.hurt(retreat,999);assert.ok(g.player.xp>before.xp);assert.deepEqual(g.items,before.items);
});

test('generation provenance survives completed records and full profile validation',async()=>{
  const memory=new Map();globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k)};
  const {recordResult}=await import('../src/storage.js?mapgen');const g=new Game(83);g.mapGenerations=[1,2];g.status='dead';
  const p=recordResult(g);assert.deepEqual(p.history[0].mapGenerations,[1,2]);assert.deepEqual(validateProfile(p).history[0].mapGenerations,[1,2]);
});
