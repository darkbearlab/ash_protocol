import {clearGeneratedMap} from './helpers/arena.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,SIZE,reachable,makeBarrier} from '../src/engine.js';
import {generateWithRecipes} from '../src/world.js';
import {ANNEX_RECIPES} from '../src/map-annexes.js';
const generate=(seed,floor)=>generateWithRecipes(seed,floor,[],ANNEX_RECIPES);
import {MODULE_TYPES,FURNITURE,moduleCells,modulePoint,validModules,addLivingModules} from '../src/modules.js';
import {allSupplies} from '../src/containers.js';
import {TERMINAL_AMMO} from '../src/ammunition.js';
import {makeBackup,decodeBackup} from '../src/backup.js';
import {normalizeProfile} from '../src/progression.js';
import {targetDetails} from '../src/target-card.js';

function arena(){const g=new Game(318);g.barriers=[];g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));Object.assign(g.player,{x:10,y:10});g.props=[];g.enemies=[];g.items=[];g.hazards=[];g.marks=[];g.smoke=[];g.rooms=[];clearGeneratedMap(g);g.end={x:20,y:20};g.reveal();return g;}
function module(g,theme='checkpoint',rotation=0){const m={id:'module-test',type:'module',theme,x:11,y:10,rotation,indestructible:true};g.props.push(m,...MODULE_TYPES[theme].furniture.map((style,n)=>({...modulePoint(m,n,0),id:`${m.id}-${n}`,type:'cover',style,moduleId:m.id,hp:FURNITURE[style].hp,maxHp:FURNITURE[style].hp})));return m;}

test('600 floors retain one or two distinct modules and exactly one main-route and one side-route station',()=>{
  const themes=new Set(),rotations=new Set();
  for(let seed=1;seed<=100;seed++)for(let floor=1;floor<=6;floor++){
    const map=generate(seed,floor),mods=map.props.filter(p=>p.type==='module'),stations=map.props.filter(p=>p.type==='terminal'),seen=reachable(map,map.start);
    assert.ok(mods.length>=1&&mods.length<=2,`${seed}/${floor}`);assert.ok(validModules(map.props,map.grid));assert.equal(stations.length,2);
    const stationRooms=stations.map(p=>Number(p.id.split('-').at(-1)));assert.equal(stationRooms.filter(i=>map.mainRoute.includes(i)).length,1);
    const occupiedRooms=new Set();for(const m of mods){themes.add(m.theme);rotations.add(m.rotation);const index=map.rooms.findIndex(r=>m.x>=r.x&&m.x+1<r.x+r.w&&m.y>=r.y&&m.y+1<r.y+r.h);assert.ok(index>=0);assert.notEqual(index,map.startRoom);occupiedRooms.add(index);}
    assert.equal(occupiedRooms.size,mods.length);
    for(const p of [map.end,...map.items,...map.enemies,...map.props.filter(p=>p.type==='container'||p.type==='terminal')])assert.ok(seen.has(`${p.x},${p.y}`),`${seed}/${floor} ${p.id}`);
    const solids=new Set(map.props.filter(p=>p.type==='cover'&&p.hp>0||p.type==='barrel'&&p.hp>0).map(p=>`${p.x},${p.y}`));
    for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++)if(map.grid[y][x]===1&&!solids.has(`${x},${y}`))assert.ok(seen.has(`${x},${y}`));
  }assert.equal(themes.size,3);assert.ok(rotations.size>=2);
});
test('room templates rotate within the four-cell footprint without changing cardinal geometry',()=>{
  for(let rotation=0;rotation<4;rotation++){const g=arena(),m=module(g,'restroom',rotation),cells=moduleCells(m);assert.equal(new Set(cells.map(p=>`${p.x},${p.y}`)).size,4);assert.ok(cells.every(p=>[11,12].includes(p.x)&&[10,11].includes(p.y)));assert.ok(validModules(g.props,g.grid));}
});
test('module placement preserves existing supply quantities, enemies and combat RNG',()=>{
  const g=new Game(7);g.props=g.props.filter(p=>p.type!=='module'&&!p.moduleId);g.barriers=g.barriers.filter(b=>!b.id.startsWith('edge-module-'));
  const supplies=allSupplies(g),enemies=structuredClone(g.enemies),rng=g.rng.state();addLivingModules(g,g.seed,g.floor,{corridors:new Set(),reachable});
  assert.deepEqual(allSupplies(g),supplies);assert.deepEqual(g.enemies,enemies);assert.equal(g.rng.state(),rng);assert.ok(g.props.filter(p=>p.type==='module').length>=1);
});
test('furniture is directional cover with its own name and durability; destroyed furniture becomes traversable',()=>{
  const g=arena();module(g);const counter=g.props[1];g.target=counter.id;assert.equal(targetDetails(g).name,'門禁櫃檯');assert.equal(g.passable(counter.x,counter.y),false);
  assert.equal(g.accuracy({x:14,y:10,type:'rifleman',traits:[]},g.player).coverPenalty,35);
  g.damagePlayer(20,'test',{x:14,y:10});assert.equal(g.player.hp,89);assert.equal(counter.hp,63);
  g.damageProp(counter,100);assert.ok(g.passable(counter.x,counter.y));assert.equal(g.player.kills,0);assert.equal(g.items.length,0);assert.ok(validModules(g.props,g.grid));
});
test('restroom perimeter uses shared doors and partitions and does not leak through its closed entrance',()=>{
  const g=new Game(1);const m=g.props.find(p=>p.type==='module'&&p.theme==='restroom');assert.ok(m);
  const cells=moduleCells(m),door=g.barriers.find(b=>b.id.startsWith(`edge-${m.id}-`)&&b.type==='door');assert.ok(door);
  const a=door.axis==='x'?{x:door.x-.5,y:door.y}:{x:door.x,y:door.y-.5},b=door.axis==='x'?{x:door.x+.5,y:door.y}:{x:door.x,y:door.y+.5};
  const inside=cells.some(p=>p.x===a.x&&p.y===a.y)?a:b,outside=inside===a?b:a;assert.equal(g.sight(inside,outside),false);g.setDoor(door,true);assert.equal(g.sight(inside,outside),true);
});
test('two stations retain original prices and single-use behavior',()=>{
  const g=new Game(7);g.enemies=[];g.player.scrap=100;g.player.reserve=0;const station=g.props.find(p=>p.type==='terminal');Object.assign(g.player,{x:station.x,y:station.y});g.reveal();
  const cost=TERMINAL_AMMO.rifle.cost;assert.ok(g.action('terminal','rifle'));assert.equal(g.player.scrap,100-cost);assert.equal(station.used,true);const turn=g.turn;assert.equal(g.action('terminal','rifle'),false);assert.equal(g.turn,turn);
});
test('module identity, destroyed furniture and station usage survive saves and complete backups',()=>{
  const g=new Game(7),f=g.props.find(p=>p.moduleId),station=g.props.find(p=>p.type==='terminal');g.damageProp(f,999);station.used=true;
  const restored=decodeBackup(JSON.stringify(makeBackup(g,normalizeProfile(),'qa')),'qa').game;assert.deepEqual(restored.props,g.props);assert.deepEqual(restored.barriers,g.barriers);assert.ok(restored.passable(f.x,f.y));
});
test('legacy v14 floor is preserved without reducing its stations or adding modules',()=>{
  const g=arena();g.props=Array.from({length:9},(_,i)=>({id:`1-console-${i}`,type:'terminal',x:2+i*2,y:2,used:i===0}));g.items=[{type:'ammo',amount:17,x:10,y:10}];const value=JSON.parse(g.serialize());value.version=14;
  const restored=Game.restore(JSON.stringify(value));assert.ok(restored);assert.deepEqual(restored.props,g.props);assert.deepEqual(restored.items,g.items);assert.deepEqual(restored.player,g.player);
});
test('invalid module layouts, themes, styles, ownership and durability fail import validation',()=>{
  const g=arena();module(g);
  for(const mutate of [d=>d.props[0].rotation=4,d=>d.props[0].theme='unknown',d=>d.props[0].x=26,d=>d.props[1].style='unknown',d=>d.props[1].moduleId='missing',d=>d.props[1].maxHp=999,d=>d.props.splice(1,1),d=>d.props.push({...d.props[1]}),d=>d.props[0].id='<script>']){const raw=JSON.parse(g.serialize());mutate(raw.data);assert.equal(Game.restore(JSON.stringify(raw)),null);}
});
