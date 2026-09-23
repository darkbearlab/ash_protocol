// 3.165.0 (user requests 2026-09-23): speech bubbles crackle, a pit's railings are lower, and a shot refused for range
// outlines where the player could shoot from here.
import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,SIZE,makeEnemy} from '../src/engine.js';
import {Renderer} from '../src/renderer.js';
import {bubbleGlitch,GLITCH_TUNING} from '../src/signal-glitch.js';
import {partitionGeometry,PIT_RAIL_HEIGHT,PARTITION_HEIGHT,pitRail} from '../src/barrier-art.js';
import {makeBarrier} from '../src/barriers.js';
import {distance} from '../src/world.js';

test('a bubble may crackle as it pops up and again at random while it stays, never for long',()=>{
 const T=GLITCH_TUNING.bubble,item={};bubbleGlitch(item,0);assert.ok(item.glitchNext>=T.every[0]&&item.glitchNext<=T.every[1]);
 if(item.glitch)assert.equal(item.glitch.duration,T.appear.ms);
 const due=item.glitchNext,gl=bubbleGlitch(item,due);assert.ok(gl,'a glitch at its due time');assert.ok(gl.duration>=T.ms[0]&&gl.duration<=T.ms[1]);
 assert.equal(bubbleGlitch(item,due+gl.duration+1),null,'and then it is over');assert.ok(item.glitchNext>due);
});
test('a pit railing is the low partition squashed, a plain low partition keeps its height',()=>{
 const rail=makeBarrier('low_partition',{x:4,y:4},{x:5,y:4},'edge-pit-1-0'),plain=makeBarrier('low_partition',{x:4,y:4},{x:5,y:4},'edge-plain');
 assert.ok(pitRail(rail)&&!pitRail(plain));
 const r=partitionGeometry(rail,{x:100,y:100},40),q=partitionGeometry(plain,{x:100,y:100},40);
 assert.equal(q.height,Math.round(40*PARTITION_HEIGHT));assert.equal(r.height,Math.round(40*PARTITION_HEIGHT*PIT_RAIL_HEIGHT));assert.ok(r.height<q.height);assert.equal(r.bottom,q.bottom,'it stands on the same edge');
});
test('the range flash covers every tile within range with a clear line of fire, and nothing beyond',()=>{
 const g=new Game(3165,[],0,'soldier','onyx');g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.barriers=[];g.props=[];g.enemies=[];Object.assign(g.player,{x:10,y:10});
 for(let y=7;y<=13;y++)g.grid[y][13]=0;   // a wall east of the player
 const r={game:g,time:500};Renderer.prototype.flashRange.call(r);const cells=r.rangeFlash.cells,range=g.weapon.range;
 assert.equal(r.rangeFlash.start,500);
 for(const k of cells){const [x,y]=k.split(',').map(Number);if(x===10&&y===10)continue;assert.ok(distance(g.player,{x,y})<=range);assert.ok(g.shotClear(g.player,{x,y}));}
 assert.ok(cells.has('10,3')&&cells.has('3,10'),'the edge of the range is in');assert.ok(!cells.has('10,2'),'one past it is not');
 assert.ok(!cells.has('14,10'),'behind the wall is not');assert.ok(cells.has('10,10'),'your own tile is inside, so no ring is drawn around you');
});
