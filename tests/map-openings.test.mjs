import test from 'node:test';
import assert from 'node:assert/strict';
import {generateWithRecipes,reachable,generationSafe,key} from '../src/world.js';
import {MERGED_RECIPES} from '../src/map-merging.js';
import {OPENING_RECIPES,openingRequest,addOpenings,openingInvariants,roomInterface} from '../src/map-openings.js';
import {roomAt,validMapMetadata,MAP_FIELDS,MAP_GENERATION} from '../src/map-geometry.js';
import {barrierBetween,edgeCells} from '../src/barriers.js';
import {allSupplies} from '../src/containers.js';
import {eligibleMissionEnemy} from '../src/map-population.js';
import {Game} from '../src/game.js';
import {makeBackup,decodeBackup} from '../src/backup.js';
import {normalizeProfile} from '../src/progression.js';

const generate=(seed,floor=1)=>generateWithRecipes(seed,floor,[],OPENING_RECIPES);
const base=(seed,floor=1)=>generateWithRecipes(seed,floor,[],MERGED_RECIPES);
const pair=ids=>[...ids].sort((a,b)=>a-b).join('-');
const roster=m=>m.enemies.map(({type,hp,maxHp,traits})=>JSON.stringify({type,hp,maxHp,traits})).sort();

test('phase three has spaced multiple passages, independently gated paths and no fully gated room links',()=>{
  let current=0,triple=0,moreDoors=0;
  for(let seed=1;seed<=100;seed++)for(const floor of [1,3,6]){
    const m=generate(seed,floor);assert.ok(generationSafe(m));assert.ok(validMapMetadata(m));
    if(m.generation.version!==4){assert.deepEqual(m,base(seed,floor),'complete phase-two fallback');continue;}
    current++;assert.ok(openingInvariants(m),`${seed}/${floor}`);
    const seen=reachable({...m,barriers:m.barriers.map(b=>({...b,open:b.type==='door'&&!b.id.startsWith('edge-opening-')}))},m.start,{openDoors:false});
    assert.ok(seen.has(key(m.end)),'closed connection doors still allow traversal');
    for(const link of m.links){
      const group=m.openings.filter(o=>pair(o.rooms)===pair(link));if(group.length===3)triple++;
      assert.ok(group.length>=1&&group.length<=3);
      const free=group.find(o=>!o.barrierIds.length);assert.ok(free);
      for(let i=1;i<free.path.length;i++)assert.notEqual(barrierBetween(m.barriers,free.path[i-1],free.path[i])?.type,'door');
      const {tangent}=roomInterface(...link.map(id=>m.rooms[id]));
      for(let i=0;i<group.length;i++)for(let j=0;j<i;j++)for(const a of group[i].cells)for(const b of group[j].cells)assert.ok(Math.abs(a[tangent]-b[tangent])>=3);
      for(const o of group)for(const id of o.barrierIds){const d=m.barriers.find(b=>b.id===id);assert.equal(d.type,'door');assert.equal(d.open,false);assert.ok(edgeCells(d).every(p=>o.cells.some(q=>key(p)===key(q))));}
    }
    if(m.barriers.filter(b=>b.id.startsWith('edge-opening-')).length>3)moreDoors++;
  }
  assert.ok(current>270,`phase three applied ${current}/300`);assert.ok(triple>0);assert.ok(moreDoors>0);
});

test('generation through 60 preserves room graph, content and threat while adding only legal floor cells',()=>{
  for(const seed of [1,2,42])for(let floor=1;floor<=60;floor++){
    const old=base(seed,floor),m=generate(seed,floor);
    assert.ok(generationSafe(m));assert.ok(validMapMetadata(m));assert.deepEqual(roster(m),roster(old));assert.deepEqual(allSupplies(m),allSupplies(old));
    for(const field of ['rooms','cells','links','mainRoute','rewardRooms','start','end','props','hazards','annexes'])assert.deepEqual(m[field],old[field]);
    const corridor=new Set(m.openings.flatMap(o=>o.cells.map(key)));
    for(let y=0;y<m.grid.length;y++)for(let x=0;x<m.grid[y].length;x++)if(old.grid[y][x]!==m.grid[y][x]){assert.equal(old.grid[y][x],0);assert.equal(m.grid[y][x],1);assert.ok(corridor.has(`${x},${y}`));assert.equal(roomAt(m.rooms,{x,y}),-1);}
    assert.ok(!m.enemies.some(e=>roomAt(m.rooms,e)===m.startRoom));assert.ok(new Set(m.enemies.filter(eligibleMissionEnemy).map(e=>roomAt(m.rooms,e))).size>=3);
    if(floor%10===0)assert.deepEqual(generate(seed,floor),m);
  }
});

test('recipe door requests reserve extra openings first; warehouse/laboratory profiles produce different layouts',()=>{
  const m=base(1),link=m.links[0],id=pair(link);
  const request=openingRequest(m,link,{openings:{default:[1,1]},doorRatio:.1,doorLinks:[id]},1,1,0);assert.equal(request.count,2);assert.equal(request.wantsDoor,true);
  assert.equal(openingRequest(m,link,{openings:{default:[1,1],[id]:[3,3]},doorRatio:0},1,1,0).count,3);
  let warehouse=0,laboratory=0,wDoors=0,lDoors=0;
  for(let seed=1;seed<=40;seed++)for(const [i,recipe]of OPENING_RECIPES.entries()){
    const map=generateWithRecipes(seed,1,[],[recipe]),count=map.barriers.filter(b=>b.id.startsWith('edge-opening-')).length;
    if(i){laboratory+=map.openings.length;lDoors+=count;}else{warehouse+=map.openings.length;wDoors+=count;}
  }
  assert.ok(warehouse>=laboratory);assert.ok(lDoors>wDoors);
});

test('opening edits are atomic and door extremes still retain free routes',()=>{
  const old=base(1),before=structuredClone(old);
  assert.equal(addOpenings(old,1,1,OPENING_RECIPES[0],{reachable,generationSafe:()=>false}),null);assert.deepEqual(old,before);
  for(const ratio of [0,1]){const m=addOpenings(old,1,1,{...OPENING_RECIPES[0],doorRatio:ratio},{reachable,generationSafe});assert.ok(m);assert.ok(openingInvariants(m));if(!ratio)assert.equal(m.barriers.filter(b=>b.id.startsWith('edge-opening-')).length,0);}
  assert.throws(()=>addOpenings(old,1,1,{...OPENING_RECIPES[0],doorRatio:2},{reachable,generationSafe}),/door ratio/);
});

test('new passages share corridor lighting and leave module doors, partitions and low rails untouched',()=>{
  for(let seed=1;seed<=30;seed++){
    const m=generate(seed),old=base(seed);if(m.generation.version!==4)continue;
    const interior=map=>map.barriers.filter(b=>!b.id.startsWith('edge-1-entrance-')&&!b.id.startsWith('edge-opening-'));
    assert.deepEqual(interior(m),interior(old));
    for(const o of m.openings){const values=o.rooms.map(id=>{const r=m.rooms[id];return m.lighting[r.cy][r.cx];});for(const p of o.cells)if(roomAt(m.rooms,p)<0)assert.ok(values.includes(m.lighting[p.y][p.x]));}
  }
});

test('opened/destroyed connection doors and generation-three archives survive actual return travel and backup',()=>{
  class PhaseTwoGame extends Game{generateFloor(){return base(this.seed,this.floor);}}
  const old=new PhaseTwoGame(1,[],0,'recon','onyx','roundtrip'),original=Object.fromEntries([...MAP_FIELDS,'grid','props','barriers'].map(k=>[k,structuredClone(old[k])]));
  const g=Game.restore(old.serialize());Object.assign(g.player,g.exitPoint);assert.ok(g.descend());assert.equal(g.generation.version,MAP_GENERATION);assert.deepEqual(g.mapGenerations,[3,MAP_GENERATION]);
  const doors=g.barriers.filter(b=>b.id.startsWith('edge-opening-'));assert.ok(doors.length>=2);g.setDoor(doors[0],true);g.damageProp(doors[1],999);
  const floorTwo=structuredClone(g.barriers);Object.assign(g.player,g.exitPoint);assert.ok(g.descend());for(const e of g.enemies)e.hp=0;Object.assign(g.player,g.mission.targets[0]);g.recoverObjective(g.mission.targets[0].id);
  const back=decodeBackup(JSON.stringify(makeBackup(g,normalizeProfile(),'qa')),'qa').game;
  Object.assign(back.player,back.exitPoint);assert.ok(back.descend());assert.deepEqual(back.barriers,floorTwo);
  Object.assign(back.player,back.exitPoint);assert.ok(back.descend());for(const [field,value]of Object.entries(original))assert.deepEqual(back[field],value);assert.deepEqual(back.mapGenerations,[3,MAP_GENERATION]);
});

test('generation-four metadata rejects detached mouths, discontinuous paths and forged fully gated connections',()=>{
  class PhaseThreeGame extends Game{generateFloor(){return generate(this.seed,this.floor);}}
  const g=new PhaseThreeGame(1);assert.equal(g.generation.version,4);
  for(const mutate of [d=>d.generation.skeleton='unknown',d=>d.openings[0].mouths[0]={x:0,y:0},d=>d.openings[0].path.splice(1,0,{x:0,y:0}),d=>d.openings.forEach(o=>o.barrierIds=['forged']),d=>d.links.push(d.links[0])]){
    const raw=JSON.parse(g.serialize());mutate(raw.data);assert.equal(Game.restore(JSON.stringify(raw)),null);
  }
});
