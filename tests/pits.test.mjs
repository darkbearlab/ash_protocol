// 3.164.0 (user decisions 2026-09-23, docs/PITS.md): pits — no floor, only flyers over them, sight, shots and blasts
// across them, railings on some edges, dug like a living module and never breaking the floor.
import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,SIZE,makeEnemy} from '../src/engine.js';
import {generate,generationSafe,lineOfSight} from '../src/world.js';
import {makeBarrier,validBarriers,edgeCells} from '../src/barriers.js';
import {VOID,SAVE_VERSION} from '../src/data.js';
import {PIT_TUNING,pitsOf,takenTiles} from '../src/pits.js';
import {adjacentWalls} from '../src/combat.js';
import {lineReason} from '../src/lines.js';

function arena(character='soldier'){
 const g=new Game(3164,[],0,character,'onyx');g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.lighting=g.grid.map(r=>r.map(()=>1));g.barriers=[];g.props=[];g.items=[];g.hazards=[];g.marks=[];g.enemies=[];g.allies=[];g.smoke=[];g.end={x:20,y:20};Object.assign(g.player,{x:10,y:10});g.rng=Object.assign(()=>0,{state:()=>0});Object.defineProperty(g,'enemyAct',{value:()=>{},configurable:true});
 // A 3x3 pit east of the player: x 12-14, y 9-11.
 for(let y=9;y<=11;y++)for(let x=12;x<=14;x++)g.grid[y][x]=VOID;
 g.reveal();return g;
}
function enemy(g,type,x,y){const e=makeEnemy(type,x,y,'qa-'+g.enemies.length);Object.assign(e,{hp:1000,maxHp:1000,alert:true});g.enemies.push(e);g.target=e.id;g.reveal();return e;}

test('generation: about half the floors dig one pit, 2x2 to 5x5, inside a room, never on anything, and the floor stays whole',()=>{
 let floors=0,dug=0;const sizes=new Set();
 for(let seed=1;seed<=40;seed++)for(let floor=1;floor<=6;floor++){
  const map=generate(seed,floor),pits=pitsOf(map.grid);floors++;assert.ok(generationSafe(map),`${seed}:${floor} stays connected`);
  assert.ok(pits.length<=1,'one pit at most');if(!pits.length)continue;dug++;
  const [pit]=pits;assert.equal(pit.cells.length,pit.w*pit.h,'a rectangle');sizes.add(`${pit.w}x${pit.h}`);
  assert.ok(pit.w>=PIT_TUNING.min&&pit.w<=PIT_TUNING.max&&pit.h>=PIT_TUNING.min&&pit.h<=PIT_TUNING.max);
  // What the floor was generated with — the pit's own railings aside, which stand on its edge by design.
  const inside=new Set(pit.cells.map(p=>`${p.x},${p.y}`)),taken=takenTiles({...map,barriers:map.barriers.filter(b=>!b.id.startsWith('edge-pit-'))});
  assert.ok(pit.cells.every(p=>!taken.has(`${p.x},${p.y}`)),'nothing the floor was generated with stands in it');
  for(const p of pit.cells)for(const [dx,dy]of[[0,-1],[1,0],[0,1],[-1,0]]){const q={x:p.x+dx,y:p.y+dy};if(!inside.has(`${q.x},${q.y}`))assert.equal(map.grid[q.y][q.x],1,'a floor walkway all round');}
  const room=map.rooms.findIndex(r=>pit.cells.every(p=>Array.isArray(r.footprint)?r.footprint.some(q=>q.x===p.x&&q.y===p.y):p.x>=r.x&&p.x<r.x+r.w&&p.y>=r.y&&p.y<r.y+r.h));
  assert.ok(room>=0&&room!==map.startRoom,'inside one room, never the start room');
  for(const b of map.barriers.filter(b=>b.id.startsWith('edge-pit-'))){assert.equal(b.type,'low_partition');const cells=edgeCells(b);assert.deepEqual(cells.map(c=>map.grid[c.y][c.x]).sort(),[1,VOID],'a railing stands between floor and pit');}
  assert.ok(validBarriers(map.barriers,map.grid,[...map.enemies,...map.props].map(o=>o.id)));
 }
 assert.ok(dug/floors>.35&&dug/floors<.65,`about half: ${dug}/${floors}`);assert.ok(sizes.size>=6,'sizes vary with the room');
});
test('rules: nobody walks into a pit; sight and shots cross it; its edge is no wall to lean on',()=>{
 const g=arena(),p=g.player;Object.assign(p,{x:11,y:10});g.reveal();
 assert.equal(g.action('move',[1,0]),false);assert.equal(g.refusal.cue,'blocked');assert.deepEqual([p.x,p.y],[11,10]);
 assert.ok(lineOfSight(g.grid,p,{x:15,y:10}),'the far rim is in sight');assert.ok(g.visible({x:15,y:10}));
 const e=enemy(g,'rifleman',15,10);assert.ok(g.shotClear(p,e));const turn=g.turn,hp=e.hp;assert.ok(g.action('fire'));assert.equal(g.turn,turn+1);assert.ok(e.hp<hp,'the shot lands across the pit');
 assert.equal(adjacentWalls(g.grid,p).length,0,'standing at the edge is standing in the open');
});
test('a railing on the edge gives half cover and never lets you step off',()=>{
 const g=arena(),p=g.player;Object.assign(p,{x:11,y:10});g.barriers=[makeBarrier('low_partition',{x:11,y:10},{x:12,y:10},'edge-rail')];g.reveal();
 const e=enemy(g,'rifleman',15,10);assert.ok(g.accuracy(e,p).coverPenalty>0,'the rail covers you from across the pit');assert.ok(lineOfSight(g.grid,p,e,g.barriers,'shot'));
 assert.equal(g.action('move',[1,0]),false);assert.equal(g.refusal.cue,'blocked');assert.deepEqual([p.x,p.y],[11,10]);
 assert.ok(validBarriers(g.barriers,g.grid,[]));
});
test('ropes cross a pit to the far rim but never land in it; grenades never land in it either',()=>{
 const g=arena(),p=g.player;Object.assign(p,{x:11,y:10});p.escapeLines=1;g.reveal();
 assert.equal(lineReason(g,{item:'escape_line',x:15,y:10}),'');assert.ok(lineReason(g,{item:'escape_line',x:13,y:10}),'the pit is no landing');
 p.grenades=1;p.prepared.grenade='frag';assert.equal(g.action('grenade',{x:13,y:10}),false);
});
test('flyers hover over a pit, walkers do not; a flyer shot down there drops its loot at the rim',()=>{
 const g=arena();const drone=enemy(g,'drone',13,10),walker=enemy(g,'rifleman',16,12);
 assert.ok(g.passable(13,10,drone));assert.equal(g.passable(13,10,walker),false);assert.equal(g.passable(13,10),false);
 const drop=g.enemyDropPoint(drone);assert.equal(g.grid[drop.y][drop.x],1,'on the floor');assert.ok(Math.abs(drop.x-13)+Math.abs(drop.y-10)<=2,'at the rim');
});
test('a blast reaches across a pit, smoke only settles on the floor, and it all survives a save',()=>{
 assert.equal(SAVE_VERSION,78);
 const g=arena(),p=g.player;Object.assign(p,{x:10,y:10});const drone=enemy(g,'drone',12,10),far=enemy(g,'rifleman',12,12);
 const hp=drone.hp;g.explode({x:11,y:10},2,20);assert.ok(drone.hp<hp,'a blast at the rim catches the flyer over the pit');
 p.smoke=1;p.prepared.grenade='smoke';assert.ok(g.action('grenade',{x:11,y:11}));assert.ok(g.smoke.at(-1).cells.every(q=>g.grid[q.y][q.x]===1),'no smoke over the pit');
 assert.ok(g.action('skill','early_warning'));assert.ok(g.sensorContacts.some(q=>g.grid[q.y][q.x]===VOID),'the scan caught the flyer over the pit');
 const back=Game.restore(g.serialize());assert.ok(back,'a floor with a pit, a flyer over it and a scan of it loads');assert.equal(back.grid[10][13],VOID);
 assert.ok(far.hp>0);
});
