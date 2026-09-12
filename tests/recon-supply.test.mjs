import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game.js';
import {makeEnemy} from '../src/world.js';
import {grenadeTotal} from '../src/throwables.js';
import {captureAction} from '../src/presentation.js';
import {clearGeneratedMap} from './helpers/arena.mjs';
function arena(character='recon'){
 const g=new Game(17,[],0,character);clearGeneratedMap(g);g.grid=Array.from({length:27},()=>Array(27).fill(1));g.lighting=g.grid.map(r=>r.slice());
 for(const k of ['props','barriers','items','hazards','marks','smoke','traces','rooms'])g[k]=[];
 Object.assign(g.player,{x:10,y:10});const e=makeEnemy('rifleman',12,10,'supply-qa');e.hp=1;e.control.disabled=4;g.enemies=[e];g.target=e.id;g.reveal();return g;
}
test('Recon starts with smoke and stun; public kill awards one smoke per level without another turn',()=>{
 const g=arena(),p=g.player;assert.deepEqual([p.smoke,p.stun,p.emp,p.grenades],[2,2,0,0]);
 p.xp=2;const turn=g.turn;g.rng=()=>0;
 const result=captureAction(g,()=>g.action('fire'));assert.equal(result.success,true);assert.equal(p.level,2);assert.equal(p.smoke,3);assert.equal(g.turn,turn+1);assert.equal(g.pendingPerks,1);
 assert.ok(g.logs.some(l=>JSON.stringify(l).includes('戰術配給')));
 assert.ok(g.choosePerk(g.perkChoices[0].id));assert.equal(p.smoke,3,'choosing the perk must not award again');
});
test('multiple level gains spill every excess smoke, merge stacks, and survive save restore exactly once',()=>{
 const g=arena(),p=g.player;p.grenades=2;p.xp=6;const e=g.enemies[0];g.hurt(e,9999);
 assert.equal(p.level,3);assert.equal(grenadeTotal(p),g.ammoCapacity('grenade'));
 const stack=g.items.find(i=>i.type==='smoke');assert.deepEqual(stack,{x:p.x,y:p.y,type:'smoke',amount:2});
 const copy=Game.restore(g.serialize());assert.ok(copy);assert.equal(copy.player.smoke,2);assert.equal(copy.items.find(i=>i.type==='smoke').amount,2);
 assert.deepEqual(Game.restore(copy.serialize()).items,copy.items);
});
test('level 20 receives last smoke; capped XP rewards and other classes do not trigger it',()=>{
 const g=arena();g.player.level=19;g.player.xp=20;g.hurt(g.enemies[0],9999);assert.equal(g.player.level,20);assert.equal(g.player.smoke,3);
 const e=makeEnemy('rifleman',12,11,'cap-qa');g.enemies.push(e);g.player.xp=21;g.hurt(e,9999);assert.equal(g.player.smoke,3);assert.equal(g.items.filter(i=>i.type==='smoke').length,0);
 const s=arena('soldier');s.player.xp=2;s.hurt(s.enemies[0],9999);assert.equal(s.player.level,2);assert.equal(s.player.smoke,0);
});
test('old Recon gets passive but retains old EMP, current resources and RNG; no retroactive grant',()=>{
 const g=new Game(11,[],0,'recon');g.player.stun=0;g.player.emp=2;g.player.level=8;
 g.player.traits=g.player.traits.filter(t=>t.id!=='tactical_supply');const state=g.rng.state();
 const copy=Game.restore(g.serialize());assert.ok(copy);assert.deepEqual([copy.player.smoke,copy.player.emp,copy.player.stun],[2,2,0]);assert.equal(copy.rng.state(),state);
 assert.equal(copy.player.traits.filter(t=>t.id==='tactical_supply').length,1);assert.equal(Game.restore(copy.serialize()).player.traits.filter(t=>t.id==='tactical_supply').length,1);
});
