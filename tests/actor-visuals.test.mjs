import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,SIZE,makeEnemy} from '../src/engine.js';
import {snapshot,captureAction,presentStep,planPresentation} from '../src/presentation.js';
import {actorMoves,actorPosition,MOVE_MS,shadeActorPixels,DarkActorCache,DARK_ACTOR_BRIGHTNESS} from '../src/actor-visuals.js';
const arena=()=>{const g=new Game(353);g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.lighting=g.grid.map(r=>r.map(()=>1));Object.assign(g.player,{x:10,y:10});g.enemies=[];g.allies=[];g.props=[];g.items=[];g.hazards=[];g.barriers=[];g.reveal();return g;};
test('ordinary movement has its own visual interval; rules/saves remain at the destination',()=>{
 const g=arena(),copy=Game.restore(g.serialize()),recorded=captureAction(g,()=>g.action('move',[1,0]));copy.action('move',[1,0]);assert.equal(g.serialize(),copy.serialize());assert.equal(g.effects.filter(e=>e.type==='move').length,0);
 const plan=planPresentation(recorded.steps),move=plan.events[0].effects.find(e=>e.type==='move');assert.ok(move);assert.equal(plan.events[0].state.player.x,10);assert.equal(plan.events[1].state.player.x,11);assert.equal(plan.events[1].time,MOVE_MS);assert.equal(plan.duration,MOVE_MS);
 const fx=[{...move,time:100}];assert.deepEqual(actorPosition(plan.events[0].state.player,'player',1,fx,160),{x:10.5,y:10});assert.equal(g.player.x,11);
 assert.deepEqual(actorPosition(g.player,'player',1,fx,160),{x:11,y:10},'committed positions cannot be displaced by old movement events');
});
test('normal-speed visible enemies get movement steps before subsequent enemy fire',()=>{
 const g=arena(),mover=makeEnemy('brute',13,10,'mover'),shooter=makeEnemy('rifleman',10,13,'shooter');Object.assign(shooter,{charge:true,windup:1});g.enemies=[mover,shooter];g.reveal();g.rng=Object.assign(()=>0,{state:()=>0});
 const {steps}=captureAction(g,()=>g.action('wait')),plan=planPresentation(steps),move=plan.events.find(e=>e.effects.some(f=>f.type==='move')),shot=plan.events.find(e=>e.effects.some(f=>f.type==='enemyShot'));assert.ok(move&&shot);assert.ok(shot.time>=move.time+MOVE_MS);
});
test('simultaneous swaps move both actors, while floor changes, dead actors and unseen enemies never interpolate',()=>{
 const g=arena();g.allies=[{id:'ally-1',kind:'pet',status:'active',floor:1,hp:10,x:11,y:10}];const before=snapshot(g);g.player.x=11;g.allies[0].x=10;const after=snapshot(g),moves=actorMoves(before,after);assert.equal(moves.length,2);assert.deepEqual(moves.map(m=>m.actorId),['player','ally-1']);
 after.floor=2;assert.deepEqual(actorMoves(before,after),[]);after.floor=1;after.allies[0].hp=0;assert.equal(actorMoves(before,after).length,1);
 const h=arena();h.enemies=[makeEnemy('rifleman',23,23,'hidden')];h.reveal();const b=snapshot(h);h.enemies[0].x=22;h.reveal();assert.deepEqual(actorMoves(b,snapshot(h)),[]);
});
test('reduced motion commits position without interpolation; failed moves create no animation',()=>{
 const g=arena(),{steps}=captureAction(g,()=>g.action('move',[0,1])),plan=planPresentation(steps,{reduceMotion:true});assert.equal(plan.duration,0);assert.ok(plan.events.every(e=>!e.effects.some(f=>f.type==='move')));
 g.grid[g.player.y+1][g.player.x]=0;assert.equal(captureAction(g,()=>g.action('move',[0,1])).steps.length,0);
 const a={x:1,y:1};assert.deepEqual(actorPosition(a,'player',1,[{type:'move',actorId:'player',floor:1,from:a,to:{x:2,y:1},travel:120,time:0}],60,true),a);
});
test('darkening changes RGB without changing alpha or hue direction, and caches one copy per image',()=>{
 const p=new Uint8ClampedArray([200,100,50,107,0,0,0,0]);shadeActorPixels(p);assert.deepEqual([...p],[Math.round(200*DARK_ACTOR_BRIGHTNESS),55,28,107,0,0,0,0]);
 const prior=globalThis.document;let reads=0;const source={width:1,height:1};globalThis.document={createElement:()=>({getContext:()=>({drawImage(){},getImageData(){reads++;return {data:new Uint8ClampedArray([200,100,50,255])};},putImageData(){}})})};
 try{const cache=new DarkActorCache(),a=cache.get(source);assert.notEqual(a,source);assert.equal(cache.get(source),a);assert.equal(reads,1);}finally{globalThis.document=prior;}
});

// Corner presentation must not use ammo/range as a proxy for hiding.
import {cornerHidden,muteCornerPixels} from '../src/actor-visuals.js';
import {recordExposure} from '../src/corner.js';
import {Renderer} from '../src/renderer.js';
test('corner cue follows geometric exposure without changing game or marking dead/friendly actors',()=>{
 const g=arena();Object.assign(g.player,{x:12,y:11});for(let y=0;y<=10;y++)g.grid[y][10]=0;
 const e=makeEnemy('rifleman',9,10,'corner');g.enemies=[e];g.reveal();const saved=g.serialize();
 assert.equal(cornerHidden(g,e),true);assert.equal(g.serialize(),saved);
 recordExposure(g,e,g.player);assert.equal(cornerHidden(g,e),false);e.cornerExposure=null;
 e.hp=0;assert.equal(cornerHidden(g,e),false);e.hp=10;g.enemies=[];assert.equal(cornerHidden(g,e),false);
 g.enemies=[e];g.grid=g.grid.map(r=>r.map(()=>1));g.player.ammo[g.player.weapon]=0;
 Object.assign(e,{x:22,y:11});g.reveal();assert.equal(cornerHidden(g,e),false,'open distant target with empty weapon is not corner-hidden');
});
test('corner tint preserves alpha and some color, including on dark sprites',()=>{
 const p=new Uint8ClampedArray([220,90,30,255,100,80,60,33]);muteCornerPixels(p);
 assert.equal(p[3],255);assert.equal(p[7],33);assert.ok(p[0]>p[1]&&p[1]>p[2]);assert.ok(p[0]-p[2]<190);assert.ok(p[0]>100);
 shadeActorPixels(p);assert.equal(p[3],255);assert.ok(p[0]>p[1]);
});
test('battlefield corner badge stays icon-only with terminal colors even when selected',()=>{
 const labels=[],boxes=[];const r={tile:45,ctx:{save(){},restore(){},beginPath(){},arc(){},stroke(){}},line(){},box(...args){boxes.push(args);},text(...args){labels.push(args);}};
 Renderer.prototype.cornerBadge.call(r,{x:100,y:100},false);assert.equal(labels.length,0);assert.equal(boxes[0][2],16);
 Renderer.prototype.cornerBadge.call(r,{x:100,y:100},true);assert.equal(labels.length,0);assert.equal(boxes[1][2],16);assert.equal(boxes[1][4],'#263c34ee');
});
