// 3.54.1 (Claude, user report): walking into a partition must not steal the lock from a live enemy.
import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,SIZE,makeEnemy,makeBarrier} from '../src/engine.js';

function arena(){
 const g=new Game(6001,[],0,'soldier','onyx');g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.lighting=g.grid.map(r=>r.map(()=>1));
 for(const k of ['barriers','props','items','hazards','marks','enemies','allies','smoke'])g[k]=[];
 g.end={x:20,y:20};Object.assign(g.player,{x:10,y:10});g.rng=Object.assign(()=>0,{state:()=>0});g.reveal();return g;
}
const wall=g=>{g.barriers.push(makeBarrier('partition',g.player,{x:10,y:9},'wallA'));g.reveal();};
const foe=g=>{const e=makeEnemy('rifleman',13,10,'foe',1);e.alert=true;g.enemies.push(e);g.reveal();return e;};

test('a blocked step keeps a live enemy locked and costs no turn',()=>{
 const g=arena();foe(g);wall(g);g.target='foe';const turn=g.turn;
 assert.equal(g.action('move',[0,-1]),false);
 assert.equal(g.target,'foe');assert.equal(g.turn,turn);
 assert.match(g.logs[0].text,/先點隔板鎖定/);
});

test('with nothing locked the partition becomes the target, so firing can break it',()=>{
 const g=arena();wall(g);g.target=null;
 assert.equal(g.action('move',[0,-1]),false);
 assert.equal(g.target,'wallA');assert.match(g.logs[0].text,/可開火破壞/);
});

test('a dead enemy does not hold the lock',()=>{
 const g=arena();const e=foe(g);wall(g);g.target='foe';e.hp=0;
 assert.equal(g.action('move',[0,-1]),false);assert.equal(g.target,'wallA');
});
