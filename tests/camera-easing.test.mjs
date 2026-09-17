import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,SIZE,makeEnemy} from '../src/engine.js';
import {captureAction,planPresentation,Playback,DEATH_MS,KILL_HOLD_MS,KILL_HOLD_REACH} from '../src/presentation.js';
import {cameraFrame,zoomStep,CAMERA_TUNING} from '../src/camera.js';

// 3.115.0 (user request): a far kill is held in frame for a beat, and the zoom eases without pumping.
function arena(){
  const g=new Game(51);g.barriers=[];g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));
  Object.assign(g.player,{x:10,y:10});g.enemies=[];g.items=[];g.props=[];g.hazards=[];g.marks=[];g.reveal();
  g.rng=Object.assign(()=>0,{state:()=>0});return g;
}
function killAt(distance,options){
  const g=arena(),e=makeEnemy('brute',10+distance,10,'far');e.hp=1;g.enemies.push(e);g.reveal();
  return {e,plan:planPresentation(captureAction(g,()=>g.action('fire')).steps,options)};
}

test('a kill the camera had to zoom out for stays framed through the fall and a beat, and the turn waits for it',()=>{
  const {e,plan}=killAt(KILL_HOLD_REACH+3);
  const impact=plan.events.find(event=>event.effects.some(fx=>fx.type==='fall'));
  const hold=impact.effects.find(fx=>fx.type==='cameraHold');
  assert.deepEqual(hold.to,{x:e.x,y:e.y});assert.equal(hold.duration,DEATH_MS+KILL_HOLD_MS);
  assert.equal(plan.duration-impact.time,DEATH_MS+KILL_HOLD_MS,'the presentation ends only after the beat');
  const quiet=killAt(KILL_HOLD_REACH+3,{reduceMotion:true}).plan,held=quiet.events.flatMap(ev=>ev.effects).find(fx=>fx.type==='cameraHold');
  assert.equal(held.duration,120+KILL_HOLD_MS,'reduced motion shortens the fall, not the confirmation');
});

test('a close kill never moved the camera, so it gets no beat',()=>{
  const {plan}=killAt(KILL_HOLD_REACH-2);
  const impact=plan.events.find(event=>event.effects.some(fx=>fx.type==='fall'));
  assert.ok(!impact.effects.some(fx=>fx.type==='cameraHold'));
  assert.equal(plan.duration-impact.time,DEATH_MS);
  // The threshold is where the framing starts to zoom out.
  const p={x:10,y:10};
  assert.equal(cameraFrame(p,{x:10+KILL_HOLD_REACH-1,y:10},null,375,375).tile,cameraFrame(p,null,null,375,375).tile);
  assert.ok(cameraFrame(p,{x:10+KILL_HOLD_REACH,y:10},null,375,375).tile<cameraFrame(p,null,null,375,375).tile);
});

test('a held point frames exactly like a locked target',()=>{
  const p={x:10,y:10},far={x:19,y:12};
  assert.equal(cameraFrame(p,null,null,375,500,1,[far]).tile,cameraFrame(p,far,null,375,500).tile);
});

test('the zoom eases towards a new framing and reduced motion jumps straight to it',()=>{
  const start=zoomStep(null,{key:'a',want:38});assert.equal(start.tile,38,'a first frame is exact');
  const next=zoomStep(start,{key:'b',want:20,dt:16});
  assert.equal(next.goal,20);assert.ok(next.tile<38&&next.tile>20,'part of the way after one frame');
  let s=next;for(let i=0;i<60;i++)s=zoomStep(s,{key:'b',want:20,dt:16});assert.equal(s.tile,20,'settles exactly');
  assert.equal(zoomStep(start,{key:'b',want:20,dt:16,reduceMotion:true}).tile,20);
  const outward=zoomStep(start,{key:'b',want:20,dt:40}),inward=zoomStep({key:'b',goal:20,tile:20},{key:'c',want:38,dt:40});
  assert.ok((38-outward.tile)/18>(inward.tile-20)/18,'zooming out is quicker than zooming in');
});

test('an enemy walking closer turn after turn does not pump the zoom',()=>{
  const p={x:10,y:10};let s=null;const goals=[];
  for(const reach of [9,8,7,6,5,4]){
    const want=cameraFrame(p,{x:10+reach,y:10},null,375,560).tile;
    for(let i=0;i<30;i++)s=zoomStep(s,{key:'enemy',want,dt:16});
    goals.push(s.goal);
  }
  const changes=goals.filter((goal,i)=>i&&goal!==goals[i-1]).length;
  assert.ok(changes<=1,`one zoom-in at most while the same enemy closes six tiles, got ${changes}: ${goals}`);
  // Walking away still zooms out at once, or it would leave the frame.
  const away=cameraFrame(p,{x:16,y:10},null,375,560).tile;
  assert.equal(zoomStep(s,{key:'enemy',want:away,dt:16}).goal,away);
  // A small step closer is ignored, a large change is not, and a different target always reframes.
  assert.equal(zoomStep({key:'enemy',goal:20,tile:20},{key:'enemy',want:20*(CAMERA_TUNING.zoomInRatio-.05),dt:16}).goal,20);
  assert.equal(zoomStep({key:'enemy',goal:20,tile:20},{key:'enemy',want:20*CAMERA_TUNING.zoomInRatio,dt:16}).goal,20*CAMERA_TUNING.zoomInRatio);
  assert.equal(zoomStep({key:'enemy',goal:20,tile:20},{key:'other',want:21,dt:16}).goal,21);
});

test('the renderer keys the zoom on what it frames, and skips the hold when drawing effects',async()=>{
  const {readFile}=await import('node:fs/promises');
  const source=await readFile(new URL('../src/renderer.js',import.meta.url),'utf8');
  assert.ok(source.includes("key=[this.zoom,this.mode||'',this.aim?'aim':'',locked?.id??'',holds.length?'hold':''].join('|')"));
  assert.ok(source.includes("scene=[g.seed,g.floor,this.w,this.h].join(':')"),'a new run, floor or board size starts exact');
  assert.ok(source.includes("fx.type==='cameraHold')continue;"));
  assert.ok(source.includes('time-e.time<Math.max(700,e.duration||0)'),'a hold outlives the usual effect lifetime if it needs to');
});
