import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,SIZE,WEAPONS,makeEnemy,generate,RARE_ARMORY} from '../src/engine.js';
import {CHARACTERS} from '../src/characters.js';
import {captureAction,planPresentation} from '../src/presentation.js';
import {rollAffix} from '../src/weapons.js';

function arena(){const g=new Game(3148);g.barriers=[];g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));Object.assign(g.player,{x:10,y:10,hp:500,maxHp:500});g.enemies=[];g.items=[];g.props=[];g.hazards=[];g.marks=[];g.rng=()=>0;const item=g.registerWeapon({type:'weapon',weapon:8,x:10,y:10});g.items.push(item);g.pickup();g.player.weapon=item.slot;g.reveal();return g;}
function add(g,x=14,y=10){const e=makeEnemy('brute',x,y,'target');Object.assign(e,{hp:1000,maxHp:1000,alert:false});g.enemies.push(e);g.target=e.id;g.reveal();return e;}
test('Thunder is loot-only, appears in later armories and heavy-enemy drops, and keeps the guaranteed cache',()=>{
  assert.equal(WEAPONS[8].lootOnly,true);assert.ok(Object.values(CHARACTERS).every(c=>!c.weapons.includes(8)));
  let found=0;for(let seed=1;seed<=60;seed++){
    assert.ok(!generate(seed,2).items.some(i=>i.type==='weapon'&&i.weapon===8));
    const map=generate(seed,3);if(map.items.some(i=>i.type==='weapon'&&i.weapon===RARE_ARMORY.weapon))found++;
    assert.ok(map.items.some(i=>i.type==='weapon'&&i.weapon===4));
  }assert.ok(found>0&&found<60);
  const g=arena();g.floor=3;g.items=[];g.hurt(makeEnemy('brute',14,10,'drop'),999);assert.ok(g.items.some(i=>i.weapon===8));
  g.items=[];g.floor=2;g.hurt(makeEnemy('brute',14,10,'early'),999);assert.ok(!g.items.some(i=>i.weapon===8));
});
test('three grenades each consume ordnance and explode; collateral ignores cover and armor',()=>{
  const g=arena(),e=add(g),other=makeEnemy('brute',14,11,'splash');other.hp=other.maxHp=1000;g.enemies.push(other);
  const {steps}=captureAction(g,()=>g.action('fire'));assert.equal(g.player.ammo[g.player.weapon],6);assert.equal(g.player.stats.shots,3);assert.equal(e.hp,928);assert.equal(other.hp,958);
  assert.equal(steps.flatMap(s=>s.effects).filter(e=>e.type==='blast').length,3);
  const projectiles=planPresentation(steps).events.flatMap(e=>e.effects).filter(e=>e.weaponId==='thunder');assert.equal(projectiles.length,3);assert.ok(projectiles.every(e=>e.style==='grenade'));
});
test('misses spend rounds without blasts, partial bursts respect remaining ammo and reload uses ordnance',()=>{
  const g=arena(),e=add(g);g.player.ammo[g.player.weapon]=2;g.rng=()=>.999;g.action('fire');assert.equal(g.player.ammo[g.player.weapon],0);assert.equal(e.hp,1000);assert.equal(g.effects.some(e=>e.type==='blast'),false);
  g.enemies=[];g.player.ordnance=5;g.action('reload');assert.equal(g.player.ammo[g.player.weapon],5);assert.equal(g.player.ordnance,0);
  for(let seed=0;seed<100;seed++)assert.notEqual(rollAffix(8,seed),'piercing');
});
test('blast can hurt its user and chain barrels; death or target death stops the remaining burst',()=>{
  const g=arena(),e=add(g,11,10);g.player.hp=1;g.action('fire');assert.equal(g.status,'dead');assert.equal(g.player.stats.shots,1);assert.equal(g.player.ammo[g.player.weapon],8);
  const h=arena(),f=add(h);f.hp=1;h.props=[{id:'barrel',type:'barrel',x:14,y:11,hp:1,maxHp:1}];h.action('fire');assert.equal(h.player.stats.shots,1);assert.equal(h.props[0].hp<=0,true);assert.ok(h.effects.filter(e=>e.type==='blast').length>=2);
});
