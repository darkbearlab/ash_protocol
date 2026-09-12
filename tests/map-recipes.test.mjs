import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {validateRecipe,recipeGroups,orderedRecipes} from '../src/map-recipes.js';
import {MAP_RECIPES} from '../src/map-recipes-data.js';
import {generate,generateWithRecipes,generateLegacy,generationSafe,reachable,key} from '../src/world.js';
import {SLOT_RECIPES} from '../src/map-slots.js';
import {openingInvariants} from '../src/map-openings.js';
import {validMapMetadata,roomContains,roomAt,MAP_FIELDS} from '../src/map-geometry.js';
import {eligibleMissionEnemy} from '../src/map-population.js';
import {validModules} from '../src/modules.js';
import {Game} from '../src/game.js';
import {makeBackup,decodeBackup} from '../src/backup.js';
import {normalizeProfile} from '../src/progression.js';
import {themeAt} from '../src/themes.js';

test('JSON registry matches sources and rejects malformed shapes, fields and edge requests',()=>{
  const dir=new URL('../maps/recipes/',import.meta.url),files=readdirSync(dir).filter(n=>n.endsWith('.json')).sort();
  assert.deepEqual(MAP_RECIPES,files.map(f=>JSON.parse(readFileSync(new URL(f,dir),'utf8'))));
  for(const r of MAP_RECIPES)assert.equal(validateRecipe(r),r);
  const base=MAP_RECIPES.find(r=>r.id==='workshops');
  for(const change of [r=>r.weight=0,r=>r.weight=Infinity,r=>r.floors=[6,2],r=>r.theme='typo',r=>r.layout[0][2]='A',r=>r.layout[1][2]='D',r=>r.layout[2][0]='D',r=>r.layout[2][2]='A',r=>r.annex={B:'dock-south'},r=>r.annex={Z:'dock-north'},r=>r.openings={'A-G':[1,2]},r=>r.openings={default:[0,3]},r=>r.doorRatio=2,r=>r.dropRate=4]){
    const r=structuredClone(base);change(r);assert.throws(()=>validateRecipe(r));
  }
  assert.throws(()=>orderedRecipes(1,1,[base,base]),/Duplicate/);
});

test('weighted recipe selection is deterministic, floor-filtered and independent of pool order',()=>{
  const base=MAP_RECIPES[0],a={...base,id:'light',weight:1,floors:[1,999]},b={...a,id:'heavy',weight:8};let heavy=0;
  for(let seed=1;seed<=500;seed++){const order=orderedRecipes(seed,1,[a,b]);assert.deepEqual(order,orderedRecipes(seed,1,[b,a]));if(order[0].id==='heavy')heavy++;}
  assert.ok(heavy>390&&heavy<490);assert.deepEqual(orderedRecipes(1,2,[{...a,floors:[3,99]}]),[]);
  assert.deepEqual(generateWithRecipes(42,3,[],[]),generateLegacy(42,3));
  assert.deepEqual(generateWithRecipes(42,2,[],[{...a,floors:[3,99]}]),generateWithRecipes(42,2,[],SLOT_RECIPES));
});

test('recipe maps through floor 60 satisfy all eight topology invariants with three distinct target rooms',()=>{
  let custom=0,pairs=0;const seen=new Set();
  for(const seed of [1,2,42])for(let floor=1;floor<=60;floor++){
    const map=generate(seed,floor),accessible=reachable(map,map.start);
    assert.ok(validMapMetadata(map),`${seed}/${floor}`);assert.ok(generationSafe(map));assert.ok(validModules(map.props,map.grid));
    // 1–2: all required objects and all non-solid floor cells remain reachable.
    assert.ok([map.end,...map.enemies,...map.items,...map.props.filter(p=>p.type==='terminal'||p.type==='container')].every(p=>accessible.has(key(p))));
    const solids=new Set(map.props.filter(p=>p.hp>0&&['cover','barrel'].includes(p.type)).map(key));
    for(let y=0;y<27;y++)for(let x=0;x<27;x++)if(map.grid[y][x]===1&&!solids.has(`${x},${y}`))assert.ok(accessible.has(`${x},${y}`));
    // 3–4: protected corridors, connected room graph and an ungated path per link.
    const blocked=new Set([...map.hazards,...map.props.filter(p=>p.hp>0)].map(key));
    assert.ok(map.openings.every(o=>o.cells.every(p=>!blocked.has(key(p)))));assert.ok(openingInvariants(map));
    // 5: no enemies in the v2 entrance. 7: unique finite posts and guaranteed targets.
    assert.ok(map.enemies.every(e=>Number.isInteger(e.x)&&Number.isInteger(e.y)&&!roomContains(map.rooms[map.startRoom],e)));
    assert.equal(new Set(map.enemies.map(key)).size,map.enemies.length);
    assert.ok(new Set(map.enemies.filter(eligibleMissionEnemy).map(e=>roomAt(map.rooms,e))).size>=3);
    assert.ok(map.enemies.length<=9*(4+3+3)+1,'existing per-cell budget, no area multiplier');
    assert.ok(new Set(map.slots.filter(s=>s.kind==='objective').map(s=>s.roomId)).size>=3);
    // 6: closing annex terrain leaves every original room destination reachable.
    const closed=structuredClone(map);for(const a of map.annexes)for(const p of a.footprint)closed.grid[p.y][p.x]=0;
    const main=reachable(closed,closed.start);assert.ok([map.end,...map.enemies,...map.items].every(p=>main.has(key(p))));
    assert.ok(map.mainRoute.every(id=>map.rooms[id]));assert.equal(new Set(map.rewardRooms).size,3);assert.equal(new Set(map.rewardRooms.map(id=>map.rooms[id].supply)).size,3);
    if(map.generation.version===7){
      custom++;seen.add(map.generation.recipeId);if(map.rooms.filter(r=>r.cellIds.length===2).length>1)pairs++;
      assert.deepEqual(map.rooms.map(r=>r.cellIds),recipeGroups(map.generation.recipe).map(([,ids])=>ids));
      assert.equal(map.rooms[map.startRoom].cellIds.length,1);assert.equal(map.rooms[map.endRoom].cellIds.length,1);
      assert.equal(map.annexes.length,Object.keys(map.generation.recipe.annex||{}).length);
      for(const r of map.rooms)assert.equal(r.visualTheme,map.generation.recipe.theme??'industrial');
    }
    // 8: full repeat, including contents, positions and descriptors.
    if(floor%10===0)assert.deepEqual(generate(seed,floor),map);
  }
  assert.ok(custom>=140);assert.ok(pairs>=60);assert.equal(seen.size,3);
});

test('custom descriptors and saved damage survive archive, backup and return without consulting the recipe pool',()=>{
  class OldGame extends Game{generateFloor(){return generateWithRecipes(this.seed,this.floor,this.unlockedWeapons,SLOT_RECIPES);}}
  const g=Game.restore(new OldGame(1,[],0,'recon','onyx','roundtrip').serialize()),fields=[...MAP_FIELDS,'grid','barriers','props','lighting'];
  const first=Object.fromEntries(fields.map(k=>[k,structuredClone(g[k])]));Object.assign(g.player,g.exitPoint);assert.ok(g.descend());assert.equal(g.generation.version,7);
  const door=g.barriers.find(b=>b.type==='door');assert.ok(door);g.damageProp(door,999);
  // Historical recipe snapshot is authoritative even when its source file is gone.
  g.generation.recipe.id='removed-custom-recipe';g.generation.recipeId='removed-custom-recipe';assert.ok(Game.restore(g.serialize()));
  const second=Object.fromEntries(fields.map(k=>[k,structuredClone(g[k])]));Object.assign(g.player,g.exitPoint);assert.ok(g.descend());
  g.enemies.forEach(e=>e.hp=0);Object.assign(g.player,g.mission.targets[0]);assert.ok(g.recoverObjective(g.mission.targets[0].id));
  const copy=decodeBackup(JSON.stringify(makeBackup(g,normalizeProfile(),'qa')),'qa').game;
  Object.assign(copy.player,copy.exitPoint);assert.ok(copy.descend());for(const [k,v]of Object.entries(second))assert.deepEqual(copy[k],v);
  Object.assign(copy.player,copy.exitPoint);assert.ok(copy.descend());for(const [k,v]of Object.entries(first))assert.deepEqual(copy[k],v);assert.deepEqual(copy.mapGenerations,[6,7]);
});

test('custom save validation rejects false layouts, endpoints, paths and slot ownership',()=>{
  const g=new Game(1);assert.equal(g.generation.version,7);
  for(const change of [d=>d.generation.recipe.layout[0][0]='E',d=>d.generation.recipeId='other',d=>d.rooms[0].cellIds=[8],d=>d.startRoom=d.rooms.find(r=>r.cellIds.length>1).id,d=>d.openings[0].path[0]={x:0,y:0},d=>d.slots[0].roomId=999,d=>d.annexes=[{type:'dock'}]]){
    const raw=JSON.parse(g.serialize());change(raw.data);assert.equal(Game.restore(JSON.stringify(raw)),null);
  }
  assert.equal(themeAt({...g,props:[]},g.rooms[0]),g.generation.recipe.theme);
  for(const mission of ['sweep','archive','retrieval','roundtrip','endless']){
    const run=new Game(1,[],0,'soldier','onyx',mission);if(mission==='roundtrip'){for(let i=0;i<2;i++){Object.assign(run.player,run.exitPoint);assert.ok(run.descend());}}else{run.floor=mission==='endless'?60:6;run.loadFloor();}assert.ok(Game.restore(run.serialize()));assert.ok(run.mission);
  }
});
