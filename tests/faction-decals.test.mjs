import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Game} from '../src/engine.js';
import {moduleCells} from '../src/modules.js';
import {DECAL_ATLAS,DECAL_PACKS,FACTION_PACKS,CELL_BOUNDS,EXCLUDED_CELLS,DECAL_TUNING,decalPlan,decalPieces,closedGround,faceAt,FactionDecals} from '../src/faction-decals.js';

// 3.139.0 (user decisions 2026-09-19, docs/FACTION_DECALS.md): Codex's faction traces scattered over floors and wall faces,
// never on or into any prop, placed from the floor's generated layout only.
const floors=[];
for(const faction of ['loyalist','rebel','swarm'])for(const seed of [3,8,21,34])for(const floor of [1,3,5]){
 const g=new Game(seed,[],0,'soldier','onyx','extraction',{facilityFaction:faction});if(floor>1){g.floor=floor;g.loadFloor();}floors.push(g);
}
const isFloor=(g,x,y)=>g.grid[y]?.[x]===1;
const cellsOf=g=>g.grid.flatMap((row,y)=>row.map((_,x)=>({x,y})));

test('the atlas is the six cleaned sheets, hash-checked, bounds recorded, and cached for offline play',()=>{
 const png=readFileSync(new URL(DECAL_ATLAS)),manifest=JSON.parse(readFileSync(new URL('../assets/pixel/faction-decals-v1/atlas.json',import.meta.url)));
 assert.equal(png.readUInt32BE(16),768);assert.equal(png.readUInt32BE(20),128);
 assert.equal(createHash('sha256').update(png).digest('hex'),manifest.sha256);
 assert.deepEqual(manifest.order,DECAL_PACKS);assert.deepEqual(manifest.bounds,CELL_BOUNDS);
 assert.deepEqual(Object.values(FACTION_PACKS).flat().sort(),[...DECAL_PACKS].sort());
 assert.ok(readFileSync(new URL('../sw.js',import.meta.url),'utf8').includes('./assets/pixel/faction-decals-v1/atlas.png'));
});

test('the user\'s picks stay out, and decals keep to their rows',()=>{
 for(const [pack,cells] of Object.entries({'loyalist-1':[10,11],'rebel-2':[8,9,10],'swarm':[10]}))for(const c of cells)assert.ok(EXCLUDED_CELLS[pack].includes(c),`${pack} #${c}`);
 let count=0;
 for(const g of floors)for(const o of decalPlan(g)){
  count++;assert.ok(FACTION_PACKS[g.facilityFaction].includes(o.pack));assert.ok(!EXCLUDED_CELLS[o.pack].includes(o.cell),`${o.pack} #${o.cell}`);
  assert.ok((o.layer==='floor'?[0,2]:[1]).includes(Math.floor(o.cell/4)),`${o.layer} row`);
  assert.ok(o.scale>=DECAL_TUNING.minScale&&o.scale<=DECAL_TUNING.maxScale);
 }
 assert.ok(count/floors.length>15&&count/floors.length<45,`about 27 decals a floor, got ${count/floors.length}`);
 assert.deepEqual(decalPlan(new Game(3,[],0,'soldier','onyx','extraction',{facilityFaction:'legacy'})),[],'no pack, no decals');
});

test('no decal starts on, or drifts onto, a prop, a module, the exit or another kind of tile',()=>{
 let drifted=0;
 for(const g of floors){
  const closed=closedGround(g),plan=decalPlan(g),pieces=decalPieces(g,plan),width=g.grid[0].length;
  for(const p of [...g.props,...g.props.filter(p=>p.type==='module').flatMap(moduleCells),g.exitPoint])assert.ok(closed.has(`${p.x},${p.y}`));
  for(const o of plan){
   if(o.layer==='floor'){assert.ok(isFloor(g,o.x,o.y)&&!closed.has(`${o.x},${o.y}`));assert.ok(!(o.x===g.start.x&&o.y===g.start.y));}
   else assert.ok(faceAt(g,o.x,o.y));
  }
  for(const {x,y} of cellsOf(g)){
   for(const {o} of pieces.floor[y*width+x]||[]){assert.ok(isFloor(g,x,y)&&!closed.has(`${x},${y}`),`floor piece at ${x},${y}`);assert.ok(Math.abs(o.x-x)<=1&&Math.abs(o.y-y)<=1);}
   for(const {o} of pieces.face[y*width+x]||[]){assert.ok(faceAt(g,x,y)&&o.y===y&&Math.abs(o.x-x)<=1,`face piece at ${x},${y}`);}
  }
  for(const {box,tiles} of pieces.boxes){
   const v=box.vis,s=DECAL_TUNING.spread;assert.ok(tiles>=1);
   assert.ok(v.x0>=-s-1e-9&&v.y0>=-s-1e-9&&v.x1<=1+s+1e-9&&v.y1<=1+s+1e-9);drifted+=v.x0<0||v.y0<0||v.x1>1||v.y1>1;
  }
 }
 assert.ok(drifted>100,`decals do drift past their tile (${drifted})`);
});

test('the layout depends only on the generated floor: moving units, items, hazards and a reload change nothing',()=>{
 for(const g of floors.slice(0,12)){
  const before=JSON.stringify(decalPlan(g)),save=g.serialize(),rng=g.rng;
  g.rng=()=>{throw new Error('decals must not roll dice');};
  for(const e of g.enemies){e.x=g.player.x;e.y=g.player.y;}
  g.items=[];g.hazards=[{type:'fire',x:g.player.x,y:g.player.y,turns:3}];
  assert.equal(JSON.stringify(decalPlan(g)),before);g.rng=rng;
  assert.equal(JSON.stringify(decalPlan(Game.restore(save))),before,'same after a reload');
 }
 const g=floors[0],state=g.serialize();decalPlan(g);decalPieces(g,decalPlan(g));assert.equal(g.serialize(),state,'nothing in the run changes');
});

test('each tile draws its own pieces, clipped when the decal crosses into a neighbour',()=>{
 const calls=[],ctx=new Proxy({},{get:(o,k)=>k in o?o[k]:(...args)=>calls.push([k,...args]),set:(o,k,v)=>{o[k]=v;return true;}});
 const fake={width:0,height:0,getContext:()=>({drawImage(){},getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4).fill(120)}),putImageData(){}})};
 const previous=globalThis.document;globalThis.document={createElement:()=>({...fake})};
 try{
  const g=floors.find(g=>{const p=decalPieces(g,decalPlan(g));return p.floor.some(list=>list?.some(e=>!e.whole))&&p.floor.some(list=>list?.some(e=>e.whole));});
  const loaded={complete:true,naturalWidth:768},r={game:g,ctx,tile:32,terrainImages:{get:url=>url===DECAL_ATLAS?loaded:{complete:false}},project:(x,y)=>({x:x*32+16,y:y*32+16})};
  const decals=new FactionDecals(),pieces=decals.pieces(g),width=g.grid[0].length;
  for(const want of [true,false]){
   const index=pieces.floor.findIndex(list=>list?.length===1&&list[0].whole===want),x=index%width,y=Math.floor(index/width);calls.length=0;
   decals.floor(r,x,y,r.project(x,y),32);
   assert.equal(calls.filter(c=>c[0]==='drawImage').length,1);assert.equal(calls.some(c=>c[0]==='clip'),!want);
   if(!want)assert.deepEqual(calls.find(c=>c[0]==='rect').slice(1),[x*32,y*32,32,32]);
  }
  calls.length=0;r.terrainImages.get=()=>({complete:false});const index=pieces.floor.findIndex(Boolean);decals.floor(r,index%width,Math.floor(index/width),{x:0,y:0},32);
  assert.equal(calls.length,0,'nothing before the atlas loads');
 }finally{globalThis.document=previous;}
});
