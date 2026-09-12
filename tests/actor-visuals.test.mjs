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
