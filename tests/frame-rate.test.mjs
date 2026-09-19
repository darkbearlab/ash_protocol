import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {FRAME_RATES,FRAME_RATE_DEFAULT,frameRate,nextFrameRate,frameDue,nextDue} from '../src/frame-rate.js';

// 3.119.0 (user request): phones ran hot because the battlefield redrew at the screen's full rate even when nothing
// moved; the player now picks the rate, one for the whole game.
const read=async path=>(await readFile(new URL(path,import.meta.url),'utf8')).replace(/\r\n/g,'\n');
// Draws per second over ten seconds of requestAnimationFrame ticks at a refresh rate, the way Renderer.frame runs them.
function drawsPerSecond(rate,refresh,jitter=0){
  let due=null,previous=null,draws=0;
  for(let i=1;i<=refresh*10;i++){
    const t=i*1000/refresh+(i%2?jitter:-jitter),tick=t-(previous??t);previous=t;
    if(!frameDue(t,due??t,tick))continue;
    due=nextDue(due??t,t,rate);draws++;
  }
  return Math.round(draws/10);
}

test('the saved rate falls back to 60, and the button steps down 60, 30, 15',()=>{
  assert.deepEqual(FRAME_RATES,[15,30,60],'15 for old phones (user request)');assert.equal(FRAME_RATE_DEFAULT,60,'nothing changes until the player picks it');
  for(const value of [null,undefined,'','45','abc',0,120])assert.equal(frameRate(value),60,String(value));
  assert.equal(frameRate('30'),30);assert.equal(frameRate(30),30);assert.equal(frameRate('15'),15);
  assert.equal(nextFrameRate(60),30);assert.equal(nextFrameRate(30),15);assert.equal(nextFrameRate(15),60);assert.equal(nextFrameRate('junk'),30);
});

test('the canvas draws at the chosen rate on 60, 90, 120 and 144 Hz screens, and jitter never drops a frame',()=>{
  assert.equal(drawsPerSecond(60,60),60);
  assert.equal(drawsPerSecond(30,60),30);
  assert.equal(drawsPerSecond(60,120),60);
  assert.equal(drawsPerSecond(30,120),30);
  assert.equal(drawsPerSecond(30,60,1.2),30,'vsync jitter');
  assert.equal(drawsPerSecond(60,60,1.2),60);
  assert.equal(drawsPerSecond(60,120,1),60);assert.equal(drawsPerSecond(30,120,1),30);
  for(const refresh of [60,90,120,144])assert.equal(drawsPerSecond(15,refresh),15,`15 on ${refresh} Hz`);
  assert.equal(drawsPerSecond(15,60,1.2),15);
  for(const refresh of [90,144])for(const rate of [30,60])assert.equal(drawsPerSecond(rate,refresh),rate,`${rate} on ${refresh} Hz`);
  assert.equal(drawsPerSecond(60,50),50,'a slower screen simply draws every tick');
  assert.equal(nextDue(100,5000,30),5000+1000/30,'after a stall the schedule restarts instead of racing to catch up');
});

test('the renderer skips frames between draws and draws nothing under a full-page menu; the setting is saved',async()=>{
  const renderer=await read('../src/renderer.js'),source=await read('../src/controller.js');
  assert.ok(renderer.includes('const tick=t-(this.lastTick??t);this.lastTick=t;\n    if(!frameDue(t,this.due??t,tick)){requestAnimationFrame(v=>this.frame(v));return;}\n    this.due=nextDue(this.due??t,t,this.frameRate);'));
  // 3.147.0: the screen shake's offset is taken just before the draw, and its colour split right after.
  assert.ok(renderer.includes('this.updateCamera(dt*1000);if(!this.isCovered?.()){this.shift=this.shakes.length?shakeOffset(this.shakes=liveImpulses(this.shakes,this.time),this.time):null;this.draw(this.time);if(this.shift?.strength)chromaSplit(this.canvas,this.shift,this.dpr);this.placeTargetCard();}'),'the clock and playback keep running while the battlefield is hidden');
  assert.ok(source.includes("renderer.frameRate=frameRate(read('ash-frame-rate'));"));
  assert.ok(source.includes("renderer.isCovered=()=>$('#modal').open&&$('#modal').matches('.title,.standalone');"));
  assert.ok(source.includes("case 'frameRate':renderer.frameRate=nextFrameRate(renderer.frameRate);write('ash-frame-rate',String(renderer.frameRate));settings();break;"));
  // Only menus on an opaque backdrop may stop the drawing; a smaller dialog shows the battlefield behind its veil.
  const css=await read('../expansion.css');
  assert.ok(css.includes('#modal.title::backdrop{background:#0d1211}'));
  assert.ok(css.includes('#modal.standalone:not(.title)::backdrop{background:#0d1211}'));
});
