import test from 'node:test';
import assert from 'node:assert/strict';
import {generateWithRecipes,reachable,generationSafe,key} from '../src/world.js';
import {OPENING_RECIPES} from '../src/map-openings.js';
import {addAnnexes,annexCandidates,annexesSafe} from '../src/map-annexes.js';
import {annexBounds,annexBorder,validMapMetadata,MAP_FIELDS,roomAt,MAP_GENERATION} from '../src/map-geometry.js';
import {barrierBetween,edgeCells,edgeBlocks,vaultable,validBarriers} from '../src/barriers.js';
import {moduleCells} from '../src/modules.js';
import {Game as CurrentGame} from '../src/game.js';
import {ANNEX_RECIPES} from '../src/map-annexes.js';
const generate=(seed,floor=1)=>generateWithRecipes(seed,floor,[],ANNEX_RECIPES);
class Game extends CurrentGame{generateFloor(){return generate(this.seed,this.floor);}}
import {makeBackup,decodeBackup} from '../src/backup.js';
import {normalizeProfile} from '../src/progression.js';
import {themeAt,resolveSprite} from '../src/themes.js';
import {snapshot} from '../src/presentation.js';

const base=(seed,floor=1)=>generateWithRecipes(seed,floor,[],OPENING_RECIPES);
const checks={reachable,generationSafe};
const delta=(a,b)=>[b.x-a.x,b.y-a.y];

test('annexes use real outer margins through floor 60 and preserve all original content and routes',()=>{
  const sides=new Set(),types=new Set(),widths=new Set();let total=0;
  for(const seed of [1,2,42])for(let floor=1;floor<=60;floor++){
    const old=base(seed,floor),m=generate(seed,floor);assert.ok(validMapMetadata(m));assert.ok(generationSafe(m));assert.ok(validBarriers(m.barriers,m.grid));
    for(const field of ['rooms','cells','links','mainRoute','rewardRooms','start','end','startRoom','endRoom','enemies','items','props','hazards','openings'])assert.deepEqual(m[field],old[field],`${seed}/${floor}: ${field}`);
    if(!m.annexes.length){assert.deepEqual(m,old);continue;}
    total++;assert.equal(m.generation.version,5);assert.deepEqual(m.generation.base,old.generation);assert.ok(m.annexes.length<=2);assert.ok(annexesSafe(m,old,checks));
    const cells=new Set(m.annexes.flatMap(a=>a.footprint.map(key)));
    for(let y=0;y<27;y++)for(let x=0;x<27;x++){
      if(cells.has(`${x},${y}`)){assert.equal(old.grid[y][x],0);assert.equal(m.grid[y][x],1);assert.equal(roomAt(m.rooms,{x,y}),-1);}
      else{assert.equal(m.grid[y][x],old.grid[y][x]);assert.equal(m.lighting[y][x],old.lighting[y][x]);}
    }
    for(const a of m.annexes){
      sides.add(a.side);types.add(a.type);const rect=annexBounds(m,a.roomId,a.side);widths.add(['north','south'].includes(a.side)?rect.h:rect.w);
      const r=m.rooms[a.roomId];assert.ok(a.footprint.every(p=>m.lighting[p.y][p.x]===m.lighting[r.cy][r.cx]));
      const border=annexBorder(m,a.roomId,a.side);assert.equal(a.barrierIds.length,border.length-2);
      for(const gate of a.openings)assert.equal(barrierBetween(m.barriers,gate.inside,gate.outside),null);
      for(const id of a.barrierIds){const rail=m.barriers.find(b=>b.id===id);assert.equal(rail.type,'low_partition');assert.ok(edgeBlocks(rail));assert.ok(vaultable(rail));assert.equal(edgeBlocks(rail,'sight'),false);assert.equal(edgeBlocks(rail,'shot'),false);}
    }
    if(floor%20===0)assert.deepEqual(generate(seed,floor),m);
  }
  assert.ok(total>=170,`annexes ${total}/180`);assert.equal(sides.size,4);assert.equal(types.size,3);assert.deepEqual([...widths].sort(),[2,3]);
});

test('annex candidates preserve sealed modules and reject central faces; failed changes leave base intact',()=>{
  for(let seed=1;seed<=24;seed++){
    const old=base(seed),before=structuredClone(old),modules=new Set(old.props.filter(p=>p.type==='module').flatMap(moduleCells).map(key));
    for(const c of annexCandidates(old,seed,1))assert.ok(annexBorder(old,c.roomId,c.side).every(b=>!modules.has(key(b.inside))));
    for(const r of old.rooms)for(const side of ['north','east','south','west']){
      const edge={north:c=>c.row===0,east:c=>c.col===2,south:c=>c.row===2,west:c=>c.col===0}[side];
      if(!old.cells.some(c=>c.roomId===r.id&&edge(c)))assert.equal(annexBounds(old,r.id,side),null);
    }
    assert.equal(addAnnexes(old,seed,1,{reachable,generationSafe:()=>false}),null);assert.deepEqual(old,before);
  }
});

test('actual movement uses open annex gates and vaults rails with existing exposure; destruction removes exposure',()=>{
  const g=new Game(1,[],0,'recon','onyx');g.enemies=[];const a=g.annexes[0],gate=a.openings[0];
  Object.assign(g.player,gate.inside);g.reveal();const turn=g.turn;
  assert.ok(g.action('move',delta(gate.inside,gate.outside)));assert.equal(key(g.player),key(gate.outside));assert.equal(g.turn,turn+1);assert.equal(g.player.vaultExposed,false);
  const rail=g.barriers.find(b=>a.barrierIds.includes(b.id)&&edgeCells(b).every(p=>!g.props.some(q=>key(q)===key(p))));assert.ok(rail);
  const [from,to]=edgeCells(rail);Object.assign(g.player,from);g.reveal();assert.ok(g.action('move',delta(from,to)));assert.equal(key(g.player),key(to));assert.equal(g.player.vaultExposed,true);
  assert.ok(Game.restore(g.serialize()));g.damageProp(rail,999);Object.assign(g.player,from);g.reveal();assert.ok(g.action('move',delta(from,to)));assert.equal(g.player.vaultExposed,false);assert.ok(Game.restore(g.serialize()));
});

test('annexes reach all four grid edges without allowing a paid out-of-bounds move',()=>{
  const checked=new Set();
  for(let seed=1;seed<=50&&checked.size<4;seed++){
    const g=new Game(seed);g.enemies=[];
    for(const a of g.annexes){if(checked.has(a.side))continue;const d={north:[0,-1],east:[1,0],south:[0,1],west:[-1,0]}[a.side];const p=a.footprint.find(p=>p.x+d[0]<0||p.x+d[0]>26||p.y+d[1]<0||p.y+d[1]>26);assert.ok(p);
      Object.assign(g.player,p);g.reveal();const turn=g.turn;assert.equal(g.action('move',d),false);assert.equal(g.turn,turn);assert.equal(key(g.player),key(p));assert.ok(Game.restore(g.serialize()));checked.add(a.side);
    }
  }
  assert.equal(checked.size,4);
});

test('generation-five imports reject corrupt annex metadata while retaining destroyed railing state',()=>{
  const g=new Game(1);assert.equal(g.generation.version,5);
  for(const mutate of [d=>d.annexes[0].type='unknown',d=>d.annexes[0].roomId=999,d=>d.annexes[0].side='inside',d=>d.annexes[0].footprint.pop(),d=>d.annexes[0].footprint[0]={...d.start},d=>d.annexes[0].openings[1]=d.annexes[0].openings[0],d=>d.annexes[0].barrierIds[1]=d.annexes[0].barrierIds[0],d=>d.generation.base={version:5,recipeId:'edge-annexes-v5'},d=>d.annexes.push(d.annexes[0])]){
    const raw=JSON.parse(g.serialize());mutate(raw.data);assert.equal(Game.restore(JSON.stringify(raw)),null);
  }
  const rail=g.barriers.find(b=>g.annexes[0].barrierIds.includes(b.id));g.damageProp(rail,999);const restored=Game.restore(g.serialize());assert.ok(restored);assert.deepEqual(restored.annexes,g.annexes);assert.deepEqual(restored.barriers,g.barriers);
});

test('archived annex geometry and destroyed rails survive actual return and full backup alongside old floors',()=>{
  class PhaseThreeGame extends Game{generateFloor(){return base(this.seed,this.floor);}}
  const old=new PhaseThreeGame(1,[],0,'recon','onyx','roundtrip'),fields=[...MAP_FIELDS,'grid','barriers','lighting'];
  const first=Object.fromEntries(fields.map(k=>[k,structuredClone(old[k])]));
  const g=Game.restore(old.serialize());Object.assign(g.player,g.exitPoint);assert.ok(g.descend());assert.equal(g.generation.version,MAP_GENERATION);
  g.damageProp(g.barriers.find(b=>g.annexes[0].barrierIds.includes(b.id)),999);const second=Object.fromEntries(fields.map(k=>[k,structuredClone(g[k])]));
  Object.assign(g.player,g.exitPoint);assert.ok(g.descend());for(const e of g.enemies)e.hp=0;Object.assign(g.player,g.mission.targets[0]);g.recoverObjective(g.mission.targets[0].id);
  const copy=decodeBackup(JSON.stringify(makeBackup(g,normalizeProfile(),'qa')),'qa').game;
  Object.assign(copy.player,copy.exitPoint);assert.ok(copy.descend());for(const [k,v]of Object.entries(second))assert.deepEqual(copy[k],v,k);
  Object.assign(copy.player,copy.exitPoint);assert.ok(copy.descend());for(const [k,v]of Object.entries(first))assert.deepEqual(copy[k],v,k);assert.deepEqual(copy.mapGenerations,[4,MAP_GENERATION]);
});

test('three annex themes use existing distinct floor sprites and survive presentation snapshots',()=>{
  const sprites=new Set();
  for(let seed=1;seed<=24;seed++){
    const g=new Game(seed);const frame=snapshot(g);assert.deepEqual(frame.annexes,g.annexes);
    for(const a of g.annexes){assert.equal(themeAt(frame,a.footprint[0]),a.type);sprites.add(JSON.stringify(resolveSprite(a.type,'floor')));}
    assert.equal(themeAt({...g,annexes:undefined},{x:0,y:0}),'industrial');
  }
  assert.equal(sprites.size,3);
});
