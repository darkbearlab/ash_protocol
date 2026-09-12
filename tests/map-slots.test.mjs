import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Game as CurrentGame} from '../src/game.js';
import {generateWithRecipes,generationSafe,reachable,key,makeEnemy} from '../src/world.js';
import {ANNEX_RECIPES} from '../src/map-annexes.js';
import {SLOT_RECIPES,furnishMap,slotSafety,buildModule} from '../src/map-slots.js';
import {validMapMetadata,MAP_FIELDS,roomAt} from '../src/map-geometry.js';
import {moduleCells,validModules} from '../src/modules.js';
import {allSupplies,validContainers} from '../src/containers.js';
import {LARGE_MODULE_TYPES,fullProp,SCENERY_ATLAS} from '../src/scenery.js';
import {coverEffects} from '../src/cover.js';
import {grantTrait} from '../src/traits.js';
import {areaCells} from '../src/throwables.js';
import {clearGeneratedMap} from './helpers/arena.mjs';
import {makeBackup,decodeBackup} from '../src/backup.js';
import {normalizeProfile} from '../src/progression.js';
import {partitionGeometry,drawPartition} from '../src/barrier-art.js';
import {Renderer} from '../src/renderer.js';
import {snapshot} from '../src/presentation.js';

const generate=(seed,floor=1)=>generateWithRecipes(seed,floor,[],SLOT_RECIPES);
class Game extends CurrentGame{generateFloor(){return generateWithRecipes(this.seed,this.floor,this.unlockedWeapons,SLOT_RECIPES);}static restore(raw){const g=super.restore(raw);if(g)Object.setPrototypeOf(g,this.prototype);return g;}}
const base=(seed,floor=1)=>generateWithRecipes(seed,floor,[],ANNEX_RECIPES),checks={reachable,generationSafe};
function arena(theme='garage'){
  const g=new Game(11,[],0,'soldier','onyx');clearGeneratedMap(g);
  g.grid=Array.from({length:27},()=>Array(27).fill(1));g.lighting=g.grid.map(r=>r.slice());g.seen=g.grid.map(r=>r.map(()=>false));
  for(const field of ['props','enemies','items','barriers','hazards','marks','rooms','traces','smoke'])g[field]=[];
  const m=buildModule(theme,{x:10,y:8},1,0);g.props=[m.marker,...m.parts];g.barriers=m.barriers;g.start={x:5,y:5};g.end={x:20,y:20};Object.assign(g.player,{x:8,y:10});g.reveal();return g;
}

test('slot generation through floor 60 preserves required content and enemy budget while adding safe modules and empty caches',()=>{
  const themes=new Set(),cacheCounts=new Set();let moved=0,large=0,current=0;
  for(const seed of [1,2,42])for(let floor=1;floor<=60;floor++){
    const old=base(seed,floor),m=generate(seed,floor);assert.ok(validMapMetadata(m));assert.ok(validModules(m.props,m.grid));assert.ok(validContainers(m.props,m.grid));
    for(const field of ['grid','rooms','cells','links','mainRoute','rewardRooms','start','end','lighting','enemies','items','annexes','openings'])assert.deepEqual(m[field],old[field],`${seed}/${floor}/${field}`);
    assert.deepEqual(allSupplies(m),allSupplies(old));assert.equal(m.props.filter(p=>p.type==='terminal').length,2);
    if(m.generation.version!==6){assert.deepEqual(m,old);continue;}
    current++;assert.ok(slotSafety(m,reachable,generationSafe));assert.deepEqual(m.generation.base,old.generation);
    assert.ok(new Set(m.slots.filter(s=>s.kind==='objective').map(s=>s.roomId)).size>=3);
    const barrels=m.props.filter(p=>p.type==='barrel'),prior=old.props.filter(p=>p.type==='barrel');assert.equal(barrels.length,prior.length);
    for(const b of barrels){const o=prior.find(p=>p.id===b.id);assert.deepEqual({...b,x:o.x,y:o.y},o);if(key(b)!==key(o))moved++;assert.ok(m.slots.some(s=>s.kind==='barrel'&&s.refId===b.id&&key(s)===key(b)));}
    for(const p of old.props.filter(p=>p.type!=='barrel'))assert.deepEqual(m.props.find(q=>q.id===p.id),p);
    const mods=m.props.filter(p=>p.type==='module');assert.ok(mods.length>=2&&mods.length<=4);
    for(const mod of mods)if(LARGE_MODULE_TYPES[mod.theme]){large++;themes.add(mod.theme);assert.ok(m.rooms[roomAt(m.rooms,mod)].cellIds.length>1);assert.ok(moduleCells(mod).length>=16);}
    const caches=m.props.filter(p=>p.kind==='unknown');cacheCounts.add(caches.length);assert.ok(caches.length<=2);for(const c of caches)assert.deepEqual(c.contents,[]);
    if(floor%20===0)assert.deepEqual(generate(seed,floor),m);
  }
  assert.ok(current>=170);assert.ok(moved>300);assert.ok(large>90);assert.equal(themes.size,4);assert.deepEqual([...cacheCounts].sort(),[0,1,2]);
});

test('slot pass is atomic and never rerolls resources when every placement fails',()=>{
  const m=base(11),before=structuredClone(m);assert.equal(furnishMap(m,11,1,{reachable,generationSafe:()=>false}),null);assert.deepEqual(m,before);
});

test('full cabin blocks enemy and player sight/shot symmetrically; independent damage opens exactly one cell',()=>{
  const g=arena(),a={x:8,y:10},b={x:15,y:10},cabin=g.props.find(p=>p.style==='rover_2'),other=g.props.find(p=>p.style==='rover_3');
  assert.ok(fullProp(cabin));assert.equal(g.sight(a,b),false);assert.equal(g.sight(b,a),false);assert.equal(g.shotClear(a,b),false);
  assert.equal(g.sight(a,cabin),true);assert.equal(g.shotClear(a,cabin),true);assert.equal(g.passable(cabin.x,cabin.y),false);
  const lowA={x:8,y:9},lowB={x:15,y:9};assert.equal(g.shotClear(lowA,lowB),true);
  g.grid[9][13]=0;assert.equal(g.shotClear(lowA,lowB),false,'cached object overlay must respect an in-place wall edit');
  g.grid[9]=Array(27).fill(1);assert.equal(g.shotClear(lowA,lowB),true,'row replacement also invalidates the overlay');
  assert.equal(coverEffects(cabin,{x:10,y:10},{x:15,y:10}).penalty,42);
  assert.equal(coverEffects(g.props.find(p=>p.style==='rover_0'),{x:10,y:9},{x:15,y:9}).penalty,35);
  const old=other.hp;g.damageProp(cabin,100);assert.ok(cabin.hp<=0);assert.equal(other.hp,old);assert.equal(g.passable(cabin.x,cabin.y),true);assert.equal(g.shotClear(a,b),false,'other half still blocks');
  g.damageProp(other,100);assert.equal(g.shotClear(a,b),true);assert.equal(g.sight(b,a),true);assert.ok(g.visibleTiles.has('15,10'));
  const copy=Game.restore(g.serialize());assert.ok(copy);assert.deepEqual(copy.props,g.props);assert.equal(copy.shotClear(a,b),true);
});

test('full parts stop blasts and infrared cannot bypass physical occlusion; low parts permit both',()=>{
  const g=arena(),from={x:10,y:10},to={x:13,y:10};
  grantTrait(g.player,'infrared','qa');assert.equal(g.sight(g.player,{x:15,y:10}),false);assert.equal(g.sight(from,to),true,'existing corner leaning still works around the cabin');
  assert.equal(areaCells(g.grid,from,4,g.barriers,g).some(p=>key(p)===key(to)),false);
  const lowFrom={x:10,y:9},lowTo={x:13,y:9};assert.equal(g.shotClear(lowFrom,lowTo),true);assert.equal(g.sight(lowFrom,lowTo),true);
  const hp=g.props.filter(fullProp).map(p=>p.hp);g.smoke=[{cells:[{x:10,y:9}],expires:g.turn+5}];assert.equal(g.sight(lowFrom,lowTo),false);grantTrait(lowFrom,'infrared','qa');assert.equal(g.sight(lowFrom,lowTo),true);assert.deepEqual(g.props.filter(fullProp).map(p=>p.hp),hp);
});

test('shots target one part through existing fire entry; all vehicle parts remain independently targetable',()=>{
  const g=arena();g.player.x=10;g.player.y=10;const c=g.props.find(p=>p.style==='rover_2');g.target=c.id;g.reveal();
  const untouched=g.props.filter(p=>p.hp>0&&p!==c).map(p=>[p.id,p.hp]);const turn=g.turn,ammo=g.player.ammo[g.player.weapon];g.rng=Object.assign(()=>0,{state:()=>1});
  assert.ok(g.action('fire'));assert.equal(g.turn,turn+1);assert.equal(g.player.ammo[g.player.weapon],ammo-1);assert.ok(c.hp<c.maxHp);
  assert.deepEqual(g.props.filter(p=>p.hp>0&&p!==c).map(p=>[p.id,p.hp]),untouched);
});

test('reserved objectives serve all recover missions and caches open once without conjuring resources',()=>{
  for(const mission of ['archive','sweep','retrieval','roundtrip'])for(const seed of [1,2,11]){
    const g=new Game(seed,[],0,'recon','onyx',mission);if(mission==='roundtrip'){for(let i=0;i<2;i++){Object.assign(g.player,g.exitPoint);assert.ok(g.descend());}}else{g.floor=6;g.loadFloor();}assert.ok(Game.restore(g.serialize()));
    if(mission!=='sweep')for(const target of g.mission.targets)assert.ok(g.slots.some(s=>s.kind==='objective'&&key(s)===key(target)));
  }
  const g=new Game(2);g.enemies=[];const c=g.props.find(p=>p.kind==='unknown');assert.ok(c);Object.assign(g.player,{x:c.x,y:c.y});
  const before=[...g.items],state=JSON.stringify([g.player.reserve,g.player.scrap]);assert.ok(g.openContainer(c.id));assert.deepEqual(g.items,before);assert.equal(JSON.stringify([g.player.reserve,g.player.scrap]),state);assert.equal(g.openContainer(c.id),false);assert.ok(Game.restore(g.serialize()));
});

test('saved slots, expanded modules and destroyed vehicle pieces survive mixed-generation return and backup',()=>{
  class OldGame extends Game{generateFloor(){return base(this.seed,this.floor);}}
  const old=new OldGame(2,[],0,'recon','onyx','roundtrip'),fields=[...MAP_FIELDS,'props','barriers'];
  const first=Object.fromEntries(fields.map(k=>[k,structuredClone(old[k])]));const g=Game.restore(old.serialize());Object.assign(g.player,g.exitPoint);assert.ok(g.descend());
  const part=g.props.find(p=>p.style==='rover_2');assert.ok(part);g.damageProp(part,999);const second=Object.fromEntries(fields.map(k=>[k,structuredClone(g[k])]));
  Object.assign(g.player,g.exitPoint);assert.ok(g.descend());g.enemies.forEach(e=>e.hp=0);Object.assign(g.player,g.mission.targets[0]);g.recoverObjective(g.mission.targets[0].id);
  const restored=decodeBackup(JSON.stringify(makeBackup(g,normalizeProfile(),'qa')),'qa').game;
  Object.assign(restored.player,restored.exitPoint);assert.ok(restored.descend());for(const [k,v]of Object.entries(second))assert.deepEqual(restored[k],v);
  Object.assign(restored.player,restored.exitPoint);assert.ok(restored.descend());for(const [k,v]of Object.entries(first))assert.deepEqual(restored[k],v);assert.deepEqual(restored.mapGenerations,[5,6]);
});

test('imports reject forged slot ownership and multipart styles, coordinates, rotation and missing segments',()=>{
  const g=new Game(11);assert.ok(g.props.some(p=>p.theme==='garage'));
  for(const mutate of [d=>d.slots[0].roomId=99,d=>d.slots[0].kind='unknown',d=>d.slots[0].x=26,d=>d.slots.push(d.slots[0]),d=>d.slots=d.slots.filter(s=>s.kind!=='objective'),d=>d.props.find(p=>p.theme==='garage').rotation=1,d=>d.props.find(p=>p.style==='rover_2').style='rover_0',d=>d.props.find(p=>p.style==='rover_2').x++,d=>d.props=d.props.filter(p=>p.style!=='rover_2')]){
    const raw=JSON.parse(g.serialize());mutate(raw.data);assert.equal(Game.restore(JSON.stringify(raw)),null);
  }
  const frame=snapshot(g);assert.deepEqual(frame.slots,g.slots);assert.deepEqual(frame.props,g.props);
});

test('both partition types rise half a tile, use generated textures without rotation, and are clickable above ground',()=>{
  for(const axis of ['x','y'])for(const type of ['partition','low_partition']){
    const b={type,axis,hp:60,x:10,y:10},center={x:100,y:100},q=partitionGeometry(b,center,32);assert.equal(q.height,16);
    const draws=[],ctx={save(){},restore(){},drawImage(...a){draws.push(a);},fillRect(){}};drawPartition(ctx,b,center,32,new Map([[SCENERY_ATLAS,{complete:true,naturalWidth:128}]]));assert.equal(draws.length,2);assert.equal(ctx.imageSmoothingEnabled,false);
    const r={game:{barriers:[b],visible:()=>true},tile:32,project:()=>center};assert.equal(Renderer.prototype.hitBarrier.call(r,100,q.top+1),b);
  }
});

test('scenery sprites are independent indexed 32px parts with shared RGB555 palette and source hashes',()=>{
  const root=new URL('../assets/pixel/scenery-v1/',import.meta.url),manifest=JSON.parse(readFileSync(new URL('atlas.json',root))),levels=new Set(Array.from({length:32},(_,i)=>Math.round(i*255/31)));assert.equal(Object.keys(manifest.sprites).length,16);let palette;
  for(const [name,entry]of Object.entries(manifest.sprites)){
    const png=readFileSync(new URL(`${name}.png`,root));assert.equal(png.readUInt32BE(16),32);assert.equal(png.readUInt32BE(20),32);assert.equal(png[25],3);assert.equal(createHash('sha256').update(png).digest('hex'),entry.sha256);
    for(let p=8;p<png.length;){const n=png.readUInt32BE(p);if(png.toString('ascii',p+4,p+8)==='PLTE'){const colors=png.subarray(p+8,p+8+n);assert.ok(n<=96);assert.ok([...colors].every(v=>levels.has(v)));if(palette)assert.deepEqual(colors,palette);palette=colors;}p+=n+12;}
  }
});
