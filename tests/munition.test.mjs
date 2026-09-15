import {clearGeneratedMap} from './helpers/arena.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game.js';
import {SIZE} from '../src/data.js';
import {makeEnemy} from '../src/world.js';
import {MUNITION_TUNING,departAllies,validAllies,deployLimit,allySkillState} from '../src/allies.js';
import {UNIT_BLUEPRINTS,deployedUnits,munitionAct} from '../src/workshop.js';
import {GRENADES} from '../src/throwables.js';

// Loitering munition, engineer workshop phase 2 (docs/ENGINEER.md 4.1, 3.92.0).
function arena(){
 const g=new Game(330,[],0,'engineer','onyx');g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.lighting=g.grid.map(r=>r.slice());g.seen=g.grid.map(r=>r.map(()=>true));
 for(const k of ['allies','enemies','props','items','barriers','hazards','marks','rooms','traces','smoke'])g[k]=[];clearGeneratedMap(g);g.allySerial=0;g.player.petBond=null;Object.assign(g.player,{x:10,y:10,hp:500,maxHp:500});g.start={x:5,y:5};g.end={x:20,y:20};g.enemyAct=()=>{};g.reveal();return g;
}
const enemy=(g,x,y,type='rifleman')=>{const e=makeEnemy(type,x,y,'foe-'+g.enemies.length);e.hp=e.maxHp=500;g.enemies.push(e);return e;};
// Deploys a munition from a line (one paid turn), then lets it act on the next turn.
const munition=(g,payload='frag',point={x:11,y:10})=>{g.player.productionLines=[{blueprint:'drone_munition',payload}];assert.ok(g.action('deployUnit',{line:0,...point}));const a=g.allies.find(x=>x.sourceId==='drone_munition');a.bornTurn=1;return a;};

test('building a munition spends its scrap and one throwable of the chosen kind, and it never counts toward the deploy limit',()=>{
 const g=arena();g.player.scrap=100;g.player.productionLines=[];g.player.emp=1;
 assert.equal(g.action('buildUnit',{blueprint:'drone_munition'}),false);assert.equal(g.action('buildUnit',{blueprint:'drone_munition',payload:'stun'}),false);assert.equal(g.action('buildUnit',{blueprint:'drone_munition',payload:'rocket'}),false);assert.equal(g.action('buildUnit',{blueprint:'drone_follow',payload:'emp'}),false);assert.equal(g.turn,1);
 assert.ok(g.action('buildUnit',{blueprint:'drone_munition',payload:'emp'}));assert.equal(g.player.scrap,100-UNIT_BLUEPRINTS.drone_munition.cost);assert.equal(g.player.emp,0);assert.deepEqual(g.player.productionLines,[{blueprint:'drone_munition',payload:'emp'}]);assert.ok(Game.restore(g.serialize()));
 g.player.perks.engineer_lines=1;g.player.scrap=100;assert.ok(g.action('buildUnit',{blueprint:'drone_follow'}));
 assert.ok(g.action('deployUnit',{line:1}));assert.equal(deployedUnits(g).length,deployLimit(g.player));assert.ok(g.action('deployUnit',{line:0}));
 const m=g.allies.find(a=>a.sourceId==='drone_munition');assert.equal(m.payload,'emp');assert.equal(m.maxHp,MUNITION_TUNING.hp);assert.equal(m.ammo,0);assert.equal(deployedUnits(g).length,1);assert.ok(validAllies(g));
});

test('a munition beside an enemy detonates at once without a windup, and the munition is spent',()=>{
 const g=arena(),a=munition(g),e=enemy(g,12,10);g.player.x=3;g.reveal();
 assert.ok(munitionAct(g,a));assert.ok(!g.allies.includes(a));assert.equal(e.hp,455);assert.ok(Game.restore(g.serialize()));
});

test('within dive range it lands beside the enemy and detonates in the same action; farther it flies one tile closer; with nothing in sight it hovers',()=>{
 const g=arena(),a=munition(g);g.player.x=3;g.reveal();const e=enemy(g,15,10);
 assert.equal(Math.abs(a.x-e.x),MUNITION_TUNING.dive);assert.ok(munitionAct(g,a));assert.ok(!g.allies.includes(a));assert.deepEqual([a.x,a.y],[14,10]);assert.ok(e.hp<500);
 const h=arena(),b=munition(h);h.player.x=3;h.reveal();const f=enemy(h,18,10);
 assert.ok(munitionAct(h,b));assert.deepEqual([b.x,b.y],[12,10]);assert.ok(h.allies.includes(b));assert.equal(f.hp,500);
 h.enemies=[];assert.equal(munitionAct(h,b),false);assert.deepEqual([b.x,b.y],[12,10]);assert.ok(Game.restore(h.serialize()));
});

test('a munition never dives or detonates while the player would be inside the blast',()=>{
 const g=arena(),a=munition(g),e=enemy(g,12,10);g.reveal();
 assert.equal(munitionAct(g,a),false);assert.ok(g.allies.includes(a));assert.equal(e.hp,500);assert.equal(g.player.hp,500);assert.deepEqual([a.x,a.y],[11,10]);
});

test('the blast follows the payload: EMP disables machines, stun disables organics, smoke fills the area without damage',()=>{
 for(const [payload,type] of [['emp','drone'],['stun','rifleman'],['smoke','rifleman']]){
  const g=arena(),a=munition(g,payload);g.player.x=3;g.reveal();const e=enemy(g,12,10,type);
  assert.ok(munitionAct(g,a),payload);assert.ok(!g.allies.includes(a),payload);
  if(payload==='smoke'){assert.equal(g.smoke.length,1);assert.equal(e.hp,500);}else assert.ok(e.control.disabled>0,payload);
  assert.match(g.logs.map(l=>l.text).join('\n'),new RegExp(GRENADES[payload].name),payload);
 }
});

test('munitions refuse swaps, stay behind on floor changes, and saves reject a missing or unknown payload',()=>{
 const g=arena(),a=munition(g);
 assert.equal(g.action('move',[1,0]),false);assert.match(g.logs[0].text,/浮游彈藥/);assert.equal(g.turn,2);
 assert.ok(!departAllies(g).includes(a.id));assert.ok(Game.restore(g.serialize()));
 const bad=JSON.parse(g.serialize());bad.data.allies[0].payload='rocket';assert.equal(Game.restore(JSON.stringify(bad)),null);
 const bare=JSON.parse(g.serialize());delete bare.data.allies[0].payload;assert.equal(Game.restore(JSON.stringify(bare)),null);
 const line=JSON.parse(g.serialize());line.data.player.productionLines=[{blueprint:'drone_munition'}];assert.equal(Game.restore(JSON.stringify(line)),null);
 const extra=JSON.parse(g.serialize());extra.data.player.productionLines=[{blueprint:'drone_follow',payload:'frag'}];assert.equal(Game.restore(JSON.stringify(extra)),null);
});

test('the turn loop runs munitions: a paid wait lets a deployed munition dive and detonate',()=>{
 const g=arena(),a=munition(g);g.player.x=3;g.reveal();const e=enemy(g,15,10);
 assert.ok(g.action('wait'));assert.ok(!g.allies.includes(a));assert.equal(e.hp,455);assert.ok(Game.restore(g.serialize()));
});

test('a frag munition holds when a barrel in its blast would reach the player, and dives past an unsafe target to a safe one',()=>{
 const g=arena(),a=munition(g);g.player.x=7;const e=enemy(g,12,10);g.props=[{id:'barrel-test',type:'barrel',x:9,y:10,hp:30,maxHp:30}];g.reveal();
 assert.equal(munitionAct(g,a),false);assert.ok(g.allies.includes(a));assert.equal(e.hp,500);
 g.props=[];assert.ok(munitionAct(g,a));assert.equal(e.hp,455);
 const h=arena(),b=munition(h);h.player.x=9;const near=enemy(h,12,10),far=enemy(h,11,14);h.reveal();
 assert.ok(munitionAct(h,b));assert.deepEqual([b.x,b.y],[11,13]);assert.equal(near.hp,500);assert.ok(far.hp<500);assert.equal(h.player.hp,500);
});

test('the workshop status leaves munitions out of the deploy count, and only munitions may carry a payload in a save',()=>{
 const g=arena();munition(g);assert.equal(allySkillState(g,'workshop'),'序列 0/1 · 部署 0/1');
 const raw=JSON.parse(g.serialize());raw.data.allies[0].payload=['frag'];assert.equal(Game.restore(JSON.stringify(raw)),null);
 const h=arena();assert.ok(h.action('deployUnit',{line:0}));const follow=JSON.parse(h.serialize());follow.data.allies[0].payload='frag';assert.equal(Game.restore(JSON.stringify(follow)),null);
});
