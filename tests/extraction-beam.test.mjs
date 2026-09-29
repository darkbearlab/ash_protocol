import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceFamily,memberText} from './helpers/source.mjs';
import {Renderer} from '../src/renderer.js';

// 3.198.5 (user): the extraction beam falls from the top of the screen through whatever lies above the operative, so
// it is drawn after the wall pass (walls occlude every other world-space effect) and before the screen overlays.
test('the extraction beam is drawn over the walls, not under them',()=>{
 // 3.206.3: Renderer.draw runs its passes in order, each living with its topic (src/renderer-*.js); the order they run.
 const calls=[],ctx=new Proxy({},{get:(o,k)=>k in o?o[k]:()=>({addColorStop(){}}),set:(o,k,v)=>{o[k]=v;return true;}});
 const r=Object.assign(Object.create(Renderer.prototype),{ctx,game:{floor:1},w:100,h:100,dpr:1,extraction:{start:0,at:{x:0,y:0}},box(){}});
 for(const pass of ['drawGround','drawTelegraphs','drawActors','drawTargeting','drawEffects','drawWalls','extractionBeam','drawOverlays'])r[pass]=()=>{calls.push(pass);return pass==='drawGround'?[]:new Set();};
 Renderer.prototype.draw.call(r,0);
 assert.deepEqual(calls,['drawGround','drawTelegraphs','drawActors','drawTargeting','drawEffects','drawWalls','extractionBeam','drawOverlays'],'after walls and partitions, before the tactical overlay and callouts');
 const family=sourceFamily('renderer'),walls=memberText(family,'  drawWalls(wallCells){'),overlays=memberText(family,'  drawOverlays(time,hiddenEnemies){');
 assert.ok(walls.includes('this.wall(a,x,y);')&&walls.includes('this.drawBarrier(b)'),'the wall pass draws walls and partitions');
 assert.ok(overlays.indexOf('this.drawTacticalOverlays();')>0&&overlays.indexOf('this.drawTacticalOverlays();')<overlays.indexOf('this.drawCallouts(time);'),'the overlays start with the tactical overlay');
 assert.equal(family.split('this.extractionBeam(').length-1,1,'drawn once');
});
