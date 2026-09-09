import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,SIZE,makeEnemy} from '../src/engine.js';
import {cameraFrame} from '../src/camera.js';

function arena(){const g=new Game(70);g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));Object.assign(g.player,{x:10,y:10});g.enemies=[];g.props=[];g.hazards=[];g.marks=[];g.items=[];g.reveal();return g;}
test('square camera centers player and fits any visible target, even maximum zoom',()=>{
  const p={x:13,y:13};for(const side of [128,200,318,388,665,1022])for(const zoom of [.65,1,1.6])for(let dx=-10;dx<=10;dx++)for(let dy=-10;dy<=10;dy++){
    const target={x:p.x+dx,y:p.y+dy},f=cameraFrame(p,target,null,side,side,zoom);
    assert.equal(f.x,p.x);assert.equal(f.y,p.y);
    assert.ok(Math.abs(dx*f.tile)+f.tile*.9<side/2);assert.ok(Math.abs(dy*f.tile)+f.tile*.9<side/2);
  }
});
test('grenade aim and locked target fit simultaneously without changing cardinal projection',()=>{
  const p={x:13,y:13},target={x:23,y:13},aim={x:13,y:8},f=cameraFrame(p,target,aim,318,318,1.6);
  for(const a of [p,target,aim]){const x=159+(a.x-f.x)*f.tile,y=159+(a.y-f.y)*f.tile;assert.ok(x>=0&&x<=318&&y>=0&&y<=318);assert.equal(Math.round((x-159)/f.tile+f.x),a.x);assert.equal(Math.round((y-159)/f.tile+f.y),a.y);}
});
test('waiting boosts next shot, evades current enemy phase, and never stacks',()=>{
  // Isolate the waiting rule from Soldier's new consecutive-fire passive.
  const g=arena();g.player.traits=[];const e=makeEnemy('rifleman',14,10,'e');g.enemies=[e];g.props=[{x:13,y:10,type:'cover',hp:1000,maxHp:1000}];g.reveal();g.rng=()=>.76;
  assert.equal(g.accuracy(g.player,e).chance,62);g.action('wait');assert.equal(g.accuracy(g.player,e).chance,77);assert.equal(g.accuracy(e,g.player).chance,82);
  g.action('wait');assert.equal(g.accuracy(g.player,e).chance,77);
  const hp=e.hp;g.action('fire');assert.ok(e.hp<hp);assert.equal(g.player.focus,false);assert.equal(g.player.evasive,false);assert.equal(g.accuracy(g.player,e).chance,62);
});
test('focus survives invalid commands and saves, but expires after other valid actions and floors',()=>{
  const g=arena();g.action('wait');const turn=g.turn;assert.equal(g.action('reload'),false);assert.equal(g.turn,turn);assert.equal(g.player.focus,true);
  const restored=Game.restore(g.serialize());assert.equal(restored.player.focus,true);assert.equal(restored.player.evasive,true);
  restored.action('weapon');assert.equal(restored.player.focus,false);restored.action('wait');Object.assign(restored.player,restored.end);restored.action('interact');assert.equal(restored.player.focus,false);
});
test('focus improves exposed stationary shots to 99%, not guaranteed hits',()=>{
  const g=arena(),e=makeEnemy('brute',14,10,'e');g.player.focus=true;assert.equal(g.accuracy(g.player,e).chance,99);
});
