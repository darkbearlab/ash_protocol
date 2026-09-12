import test from 'node:test';
import assert from 'node:assert/strict';
import {generateWithRecipes,PHASE_ONE_RECIPES,generationSafe,reachable,key} from '../src/world.js';
import {mergeMap,mergePlans,MERGED_RECIPES} from '../src/map-merging.js';
import {MAP_FIELDS,MAP_GENERATION,roomContains,roomAt,validMapMetadata} from '../src/map-geometry.js';
import {eligibleMissionEnemy} from '../src/map-population.js';
import {allSupplies} from '../src/containers.js';
import {edgeCells} from '../src/barriers.js';
import {Game} from '../src/game.js';
import {makeBackup,decodeBackup} from '../src/backup.js';
import {normalizeProfile} from '../src/progression.js';

const generate=(seed,floor=1)=>generateWithRecipes(seed,floor,[],MERGED_RECIPES);
const phaseOne=(seed,floor=1)=>generateWithRecipes(seed,floor,[],PHASE_ONE_RECIPES);
const roster=map=>map.enemies.map(({type,hp,maxHp,traits})=>JSON.stringify({type,hp,maxHp,traits})).sort();

test('phase two generates both long-hall axes and 2×2 halls with single-cell endpoints',()=>{
  const shapes=new Set();
  for(let seed=1;seed<=100;seed++){
    const m=generate(seed),hall=m.rooms.find(r=>r.cellIds.length>1);
    assert.equal(m.generation.version,3,`seed ${seed}`);assert.ok(validMapMetadata(m));
    assert.equal(m.rooms.filter(r=>r.cellIds.length>1).length,1);
    assert.equal(m.rooms[m.startRoom].cellIds.length,1);assert.equal(m.rooms[m.endRoom].cellIds.length,1);
    shapes.add(hall.cellIds.length===4?'square':hall.w>hall.h?'horizontal':'vertical');
    assert.ok(hall.footprint.every(p=>m.grid[p.y][p.x]===1),'no internal tile walls');
    assert.ok(!m.barriers.some(b=>edgeCells(b).every(p=>roomContains(hall,p))),'no internal partitions');
    const central=m.props.filter(p=>p.type==='cover'&&roomContains(hall,p));
    assert.ok(central.some(a=>central.some(b=>a!==b&&Math.abs(a.x-b.x)+Math.abs(a.y-b.y)===1)),'contiguous central cover group');
    assert.equal(new Set(m.links.map(e=>[...e].sort((a,b)=>a-b).join(':'))).size,m.links.length);
    assert.equal(m.openings.length,m.links.length);assert.ok(m.links.every(([a,b])=>a!==b));
  }
  assert.deepEqual([...shapes].sort(),['horizontal','square','vertical']);
});

test('merged floors preserve population and supplies through floor 60 and meet geometry/mission invariants',()=>{
  for(let seed=1;seed<=3;seed++)for(let floor=1;floor<=60;floor++){
    const base=phaseOne(seed,floor),m=generate(seed,floor),message=`${seed}/${floor}`;
    assert.equal(m.generation.version,3,message);assert.ok(generationSafe(m),message);assert.ok(validMapMetadata(m),message);
    assert.deepEqual(roster(m),roster(base),message);assert.deepEqual(allSupplies(m),allSupplies(base),message);
    const ordinaryProps=map=>map.props.filter(p=>p.hp>0&&!p.moduleId).map(({id,type,hp,maxHp})=>({id,type,hp,maxHp})).sort((a,b)=>a.id.localeCompare(b.id));
    assert.deepEqual(ordinaryProps(m),ordinaryProps(base),message);
    assert.deepEqual(m.start,base.start);assert.deepEqual(m.end,base.end);
    assert.ok(!m.enemies.some(e=>roomContains(m.rooms[m.startRoom],e)));
    assert.ok(new Set(m.enemies.filter(eligibleMissionEnemy).map(e=>roomAt(m.rooms,e))).size>=3);
    assert.equal(new Set(m.rewardRooms).size,3);assert.ok(m.rewardRooms.some(id=>!m.mainRoute.includes(id)));
    // Invariants 1–3: connectivity, occupied destinations, clear connecting lanes.
    // 4 keeps the existing door policy until phase three; 5 entrance above;
    // 6 no annex dependency; 7 unchanged budget above; 8 sampled determinism below.
    assert.deepEqual(m.annexes,[]);assert.ok(reachable(m,m.start).has(key(m.end)));
    if(floor%10===0)assert.deepEqual(generate(seed,floor),m);
    for(const r of m.rooms)if(r.cellIds.length===1){const old=base.rooms[r.cellIds[0]];for(const p of r.footprint)assert.equal(m.grid[p.y][p.x],base.grid[p.y][p.x]);assert.equal(r.kind,old.kind);}
  }
});

test('candidate rejection is transactional, illegal groups are refused, and fallback remains phase one',()=>{
  const base=phaseOne(2),before=structuredClone(base),ids=mergePlans(base,2,1,'hangar-v3')[0];
  assert.equal(mergeMap(base,ids,2,1,'hangar-v3',{reachable,generationSafe:()=>false}),null);
  assert.deepEqual(base,before);
  for(const bad of [[base.startRoom,4],[0,1,2],[0,8]])assert.equal(mergeMap(base,bad,2,1,'long-halls-v3',{reachable,generationSafe}),null);
  assert.equal(phaseOne(2).generation.version,2);assert.equal(generateWithRecipes(2,1,[],[]).generation,undefined);
  assert.throws(()=>generateWithRecipes(2,1,[],[{id:'unknown'}]),/Unsupported/);
});

test('saved generation two floor survives a current-generation trip and complete backup without regeneration',()=>{
  class PhaseOneGame extends Game{generateFloor(){return phaseOne(this.seed,this.floor);}}
  const old=new PhaseOneGame(2,[],0,'recon','onyx','roundtrip');
  const original=Object.fromEntries(['grid','rooms','props','barriers',...MAP_FIELDS].map(k=>[k,structuredClone(old[k])]));
  const g=Game.restore(old.serialize());assert.ok(g);Object.assign(g.player,g.exitPoint);assert.ok(g.descend());
  assert.deepEqual(g.mapGenerations,[2,MAP_GENERATION]);assert.equal(g.generation.version,MAP_GENERATION);
  Object.assign(g.player,g.exitPoint);assert.ok(g.descend());for(const e of g.enemies)e.hp=0;
  Object.assign(g.player,g.mission.targets[0]);g.recoverObjective(g.mission.targets[0].id);
  const copy=decodeBackup(JSON.stringify(makeBackup(g,normalizeProfile(),'qa')),'qa').game;
  for(let i=0;i<2;i++){Object.assign(copy.player,copy.exitPoint);assert.ok(copy.descend());}
  for(const [k,v]of Object.entries(original))assert.deepEqual(copy[k],v,k);
  assert.deepEqual(copy.mapGenerations,[2,MAP_GENERATION]);assert.equal(copy.generation.version,2);
});

test('generation three rejects invalid merge topology and recipe ownership on import',()=>{
  class PhaseTwoGame extends Game{generateFloor(){return generate(this.seed,this.floor);}}
  const game=new PhaseTwoGame(2);
  for(const mutate of [d=>d.generation.recipeId='grid-v2',d=>d.generation.version='3',d=>d.startRoom=d.rooms.find(r=>r.cellIds.length>1).id,d=>d.rooms.find(r=>r.cellIds.length>1).footprint.pop(),d=>d.generation.recipeId=d.generation.recipeId==='hangar-v3'?'long-halls-v3':'hangar-v3']){
    const raw=JSON.parse(game.serialize());mutate(raw.data);assert.equal(Game.restore(JSON.stringify(raw)),null);
  }
});
