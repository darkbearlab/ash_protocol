// 3.51.0 armour-plate salvage perk (Claude, user call): armoured enemies drop far more often, ordinary ones
// start dropping at all, and a run without the perk must roll exactly as it did before.
import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,SIZE,makeEnemy,PERKS} from '../src/engine.js';
import {plateDrop,PLATE_DROP,applyPerk} from '../src/perks.js';

const perk=PERKS.find(o=>o.id==='plating');
function arena(character='soldier'){
 const g=new Game(5100,[],0,character,'onyx');g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.lighting=g.grid.map(r=>r.map(()=>1));
 for(const k of ['barriers','props','items','hazards','marks','enemies','allies','smoke'])g[k]=[];
 g.end={x:20,y:20};Object.assign(g.player,{x:10,y:10});g.reveal();return g;
}
// Count random draws so a kill can be compared roll for roll.
function counting(g,value=.99){let calls=0;g.rng=Object.assign(()=>{calls++;return value;},{state:()=>0});return ()=>calls;}
function kill(g,type,value=.99){const calls=counting(g,value);const e=makeEnemy(type,11,10,'qa-'+g.enemies.length,g.floor);g.enemies.push(e);g.hurt(e,e.hp);return calls();}

test('perk data: three tiers, appended, and the immediate plates respect the cap',()=>{
 assert.ok(perk&&perk.cap===3&&perk.effect==='plating'&&perk.amount===10);
 assert.equal(PERKS[11].id,'plating','keeps its original appended index when later content is added');
 const g=arena();g.player.plates=0;applyPerk(g,perk);assert.equal(g.player.plates,10);
 g.player.plates=g.plateCapacity-4;applyPerk(g,perk);assert.equal(g.player.plates,g.plateCapacity,'never above the plate capacity');
 assert.equal(g.player.perks.plating,2);
});

test('drop chances: armoured 20% → 65%, ordinary 0% → 18%',()=>{
 const g=arena();
 assert.deepEqual(plateDrop(g.player,true),{chance:PLATE_DROP.base,amount:PLATE_DROP.amount});
 assert.equal(plateDrop(g.player,false).chance,0);
 g.player.perks.plating=3;
 assert.ok(Math.abs(plateDrop(g.player,true).chance-.65)<1e-9);
 assert.ok(Math.abs(plateDrop(g.player,false).chance-.18)<1e-9);
 assert.equal(plateDrop(g.player,false).amount,PLATE_DROP.plainAmount);
});

test('without the perk an ordinary kill rolls exactly as before; the perk adds one roll and can drop plates',()=>{
 const plain=arena(),plainCalls=kill(plain,'rifleman');
 const modded=arena();modded.player.perks.plating=3;
 assert.equal(kill(modded,'rifleman'),plainCalls+1,'the perk adds the plate roll for ordinary enemies');
 const armoured=arena(),armouredCalls=kill(armoured,'brute');
 const armouredMod=arena();armouredMod.player.perks.plating=3;
 assert.equal(kill(armouredMod,'brute'),armouredCalls,'armoured enemies already rolled, so the stream is unchanged');
 const lucky=arena();lucky.player.perks.plating=3;kill(lucky,'rifleman',.01);
 assert.deepEqual(lucky.items.filter(o=>o.type==='armor').map(o=>o.amount),[PLATE_DROP.plainAmount]);
 const heavy=arena();heavy.player.perks.plating=3;kill(heavy,'brute',.5);
 assert.deepEqual(heavy.items.filter(o=>o.type==='armor').map(o=>o.amount),[PLATE_DROP.amount],'a 50% roll drops at 65% but would fail at the base 20%');
});

test('the perk survives a save round trip',()=>{
 const g=arena();g.player.level=2;g.player.perks.plating=1;g.perkPicks=1;
 const restored=Game.restore(g.serialize());
 assert.equal(restored?.player.perks.plating,1);
});
