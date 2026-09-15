import {clearGeneratedMap} from './helpers/arena.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game.js';
import {SIZE} from '../src/data.js';
import {REPAIR_TUNING,DRONE_HP,ENEMY_UNIT_TUNING,fitDrone} from '../src/allies.js';
import {UNIT_BLUEPRINTS,repairTargets} from '../src/workshop.js';

// Field repair, engineer workshop phase 6 (docs/ENGINEER.md sections 9 and 16, 3.96.0). No dismantling (user decision).
function arena(character='engineer'){
 const g=new Game(330,[],0,character,'onyx');g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.lighting=g.grid.map(r=>r.slice());g.seen=g.grid.map(r=>r.map(()=>true));
 for(const k of ['allies','enemies','props','items','barriers','hazards','marks','rooms','traces','smoke'])g[k]=[];clearGeneratedMap(g);g.allySerial=0;g.player.petBond=null;Object.assign(g.player,{x:10,y:10,hp:500,maxHp:500});g.start={x:5,y:5};g.end={x:20,y:20};g.enemyAct=()=>{};g.reveal();return g;
}
// Deploys a unit from a line (one paid turn), acquiring and marking its blueprint as needed.
const unit=(g,blueprint='drone_follow',point={x:11,y:10})=>{const p=g.player,def=UNIT_BLUEPRINTS[blueprint];if(def.enemy)p.blueprints=[...new Set([...p.blueprints,blueprint])];if(def.once)p.usedBlueprints=[...new Set([...p.usedBlueprints,blueprint])];p.productionLines=[{blueprint}];assert.ok(g.action('deployUnit',{line:0,...point}));return g.allies.find(x=>x.sourceId===blueprint);};

test('an adjacent damaged unit is repaired for scrap in one turn, restoring half its maximum HP up to full',()=>{
 const g=arena(),p=g.player,a=unit(g);p.scrap=50;a.hp=20;const turn=g.turn;
 assert.deepEqual(repairTargets(g).map(x=>x.id),[a.id]);
 assert.ok(g.action('repairUnit',a.id));assert.equal(g.turn,turn+1);assert.equal(p.scrap,50-REPAIR_TUNING.cost);assert.equal(a.hp,20+Math.ceil(DRONE_HP*REPAIR_TUNING.share));
 assert.match(g.logs.map(l=>l.text).join('\n'),/修理追隨無人機/);assert.ok(Game.restore(g.serialize()));
 assert.ok(g.action('repairUnit',a.id));assert.equal(a.hp,a.maxHp);assert.equal(p.scrap,50-2*REPAIR_TUNING.cost);assert.deepEqual(repairTargets(g),[]);
});

test('the frame upgrade raises what a repair restores, and a boss chassis repairs by half of its own maximum',()=>{
 const g=arena(),p=g.player,a=unit(g);p.scrap=50;p.perks.engineer_frame=2;fitDrone(a,p);a.hp=10;
 assert.equal(a.maxHp,DRONE_HP+40);assert.ok(g.action('repairUnit',a.id));assert.equal(a.hp,10+Math.ceil((DRONE_HP+40)*REPAIR_TUNING.share));
 const h=arena(),b=unit(h,'unit_boss');h.player.scrap=50;b.hp=1;
 assert.ok(h.action('repairUnit',b.id));assert.equal(b.hp,1+Math.ceil(ENEMY_UNIT_TUNING.boss.hp*REPAIR_TUNING.share));assert.ok(Game.restore(h.serialize()));
});

test('repair is refused without spending a turn when the unit is not beside you, undamaged, destroyed or unknown, when scrap is short, or without a workshop',()=>{
 const g=arena(),p=g.player,a=unit(g,'drone_follow',{x:12,y:10});p.scrap=50;a.hp=20;const turn=g.turn;
 assert.equal(g.action('repairUnit',a.id),false);assert.match(g.logs[0].text,/旁邊/);
 Object.assign(a,{x:11,y:11});assert.equal(g.action('repairUnit',a.id),false);assert.deepEqual(repairTargets(g),[]);
 Object.assign(a,{x:11,y:10,hp:a.maxHp});assert.equal(g.action('repairUnit',a.id),false);assert.match(g.logs[0].text,/沒有損傷/);
 a.hp=20;p.scrap=REPAIR_TUNING.cost-1;assert.equal(g.action('repairUnit',a.id),false);assert.match(g.logs[0].text,/廢料不足/);
 p.scrap=50;for(const bad of ['ally-99',undefined,{id:a.id},42])assert.equal(g.action('repairUnit',bad),false);
 assert.equal(g.turn,turn);assert.equal(a.hp,20);assert.equal(p.scrap,50);
 Object.assign(a,{status:'destroyed',hp:0});assert.equal(g.action('repairUnit',a.id),false);assert.deepEqual(repairTargets(g),[]);
 const s=arena('soldier');assert.equal(s.action('repairUnit','ally-1'),false);assert.match(s.logs[0].text,/工坊/);assert.equal(s.turn,1);
});
