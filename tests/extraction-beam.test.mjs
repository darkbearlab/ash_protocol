import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// 3.198.5 (user): the extraction beam falls from the top of the screen through whatever lies above the operative, so
// it is drawn after the wall pass (walls occlude every other world-space effect) and before the screen overlays.
test('the extraction beam is drawn over the walls, not under them',async()=>{
 const body=await readFile(new URL('../src/renderer.js',import.meta.url),'utf8');
 const draw=body.slice(body.indexOf('  draw(time) {'),body.indexOf('  drawCallouts(time){'));
 const beam=draw.indexOf('if(this.extraction)this.extractionBeam(time);'),walls=draw.indexOf('this.wall(a,x,y);'),barriers=draw.indexOf('this.drawBarrier(b)'),overlay=draw.indexOf('this.drawTacticalOverlays();');
 assert.ok(beam>0&&walls>0&&barriers>0&&overlay>0);
 assert.ok(beam>walls&&beam>barriers,'after walls and partitions');assert.ok(beam<overlay,'before the tactical overlay and callouts');
 assert.equal(draw.split('this.extractionBeam(').length-1,1,'drawn once');
});
