import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,SIZE,WEAPONS,makeEnemy} from '../src/engine.js';
import {AFFIXES,weaponStats,rollAffix} from '../src/weapons.js';
import {targetDetails} from '../src/target-card.js';
import {captureAction} from '../src/presentation.js';
import {makeBackup,decodeBackup} from '../src/backup.js';
import {normalizeProfile} from '../src/progression.js';

function arena(){const g=new Game(42);g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));Object.assign(g.player,{x:10,y:10});g.enemies=[];g.props=[];g.items=[];g.hazards=[];g.marks=[];g.reveal();return g;}
function loot(g,base=0,affix='stable'){
  const item=g.registerWeapon({type:'weapon',weapon:base,x:11,y:10});g.player.affixes[item.slot]=affix;g.player.ammo[item.slot]=g.weaponAt(item.slot).mag;g.items.push(item);return item.slot;
}
test('six tradeoffs change real stats; launchers never roll meaningless penetration',()=>{
  assert.equal(Object.keys(AFFIXES).length,6);
  assert.equal(weaponStats(0,'stable').min,20);assert.equal(weaponStats(0,'stable').accuracyBonus,10);
  assert.equal(weaponStats(3,'piercing').pierce,.95);assert.equal(weaponStats(3,'piercing').mag,2);
  assert.equal(weaponStats(0,'extended').mag,12);assert.equal(weaponStats(0,'extended').accuracyBonus,-8);
  assert.equal(weaponStats(0,'powerful').min,25);assert.equal(weaponStats(0,'powerful').mag,6);
  assert.equal(weaponStats(1,'longbarrel').range,6);assert.equal(weaponStats(1,'longbarrel').min,38);
  assert.equal(weaponStats(0,'tracking').tracking,12);
  const seen=new Set();for(let seed=0;seed<1000;seed++){seen.add(rollAffix(0,seed));assert.notEqual(rollAffix(5,seed),'piercing');}
  assert.equal(seen.size,7);
});
test('ground rolls persist across inspection, collecting and reloading without combat RNG consumption',()=>{
  const a=new Game(65),b=new Game(65);assert.deepEqual(a.player.affixes,b.player.affixes);
  const state=a.rng.state(),item=a.registerWeapon({type:'weapon',weapon:2,x:a.player.x,y:a.player.y},true);a.items.push(item);
  const before=a.player.affixes[item.slot];a.weaponAt(item.slot);a.registerWeapon(item,true);assert.equal(a.rng.state(),state);
  const restored=Game.restore(a.serialize());assert.ok(restored);assert.equal(restored.player.affixes[item.slot],before);
  assert.equal(restored.takeWeapon(item.slot),true);assert.equal(restored.player.affixes[item.slot],before);
});
test('duplicates have independent magazines and tuning, never become scrap automatically',()=>{
  const g=arena(),slot=loot(g);assert.equal(g.action('takeWeapon',slot),true);assert.deepEqual(g.player.owned,[0,1,slot]);
  g.player.ammo[0]=2;g.player.scrap=100;g.action('weapon',slot);g.action('upgrade');
  assert.equal(g.player.upgrades[0],0);assert.equal(g.player.upgrades[slot],1);assert.equal(g.weaponDamage().min,25);
  assert.equal(g.player.ammo[0],2);assert.equal(g.player.ammo[slot],8);
  const other=loot(g,0,'powerful');g.items.find(o=>o.slot===other).x=10;const scrap=g.player.scrap;g.pickup();
  assert.ok(g.items.some(o=>o.slot===other));assert.equal(g.player.scrap,scrap);
});
test('full pack exchange costs one turn and preserves both guns including active selection',()=>{
  const g=arena(),p=g.player;g.addWeapon(2);const slot=loot(g,0,'extended');p.ammo[0]=2;p.upgrades[0]=2;p.ammo[slot]=3;
  const turn=g.turn;assert.equal(g.action('replaceWeapon',{take:999,leave:0}),false);assert.equal(g.turn,turn);
  assert.equal(g.action('replaceWeapon',{take:slot,leave:0}),true);assert.equal(g.turn,turn+1);assert.equal(p.weapon,slot);assert.equal(p.owned.length,3);
  assert.equal(g.items.find(o=>o.slot===0).x,p.x);assert.equal(p.ammo[0],2);assert.equal(p.upgrades[0],2);assert.equal(p.ammo[slot],3);
  const back=Game.restore(g.serialize());assert.ok(back);assert.equal(back.action('replaceWeapon',{take:0,leave:slot}),true);
  assert.equal(back.player.weapon,0);assert.equal(back.player.ammo[0],2);assert.equal(back.player.upgrades[0],2);assert.equal(back.player.affixes[slot],'extended');
  assert.equal(back.items.filter(o=>o.type==='weapon').length,1);
});
test('exchanging a spare keeps the current gun; stale pickup and swap cannot duplicate loot',()=>{
  const g=arena(),slot=loot(g);assert.equal(g.action('replaceWeapon',{take:slot,leave:1}),true);assert.equal(g.player.weapon,0);
  const turn=g.turn;assert.equal(g.action('takeWeapon',slot),false);assert.equal(g.action('replaceWeapon',{take:slot,leave:0}),false);assert.equal(g.turn,turn);
  assert.equal(g.items[0].slot,1);assert.equal(g.player.ammo[1],4);
});
test('affix accuracy applies to player shots and target card, never enemy shots',()=>{
  const g=arena(),e=makeEnemy('rifleman',13,10,'target');g.enemies=[e];g.target=e.id;g.player.affixes[0]='tracking';e.moved=true;
  assert.equal(g.fireChance(e),87);assert.equal(targetDetails(g).chance,'命中 87%');
  g.player.moved=true;assert.equal(g.accuracy(e,g.player).chance,75);
  g.player.affixes[0]='stable';assert.equal(g.fireChance(e),85);g.player.focus=true;assert.equal(g.fireChance(e),99);
  const prop={id:'box',type:'cover',x:12,y:11,hp:65};g.props=[prop];g.target=prop.id;g.player.focus=false;g.player.affixes[0]='extended';
  assert.equal(g.fireChance(prop),89);assert.equal(targetDetails(g).chance,'命中 89%');
});
test('extended magazine reload and salvage conserve capped ammunition',()=>{
  const g=arena(),slot=loot(g,0,'extended');g.takeWeapon(slot);g.player.weapon=slot;g.player.ammo[slot]=1;
  assert.equal(g.action('reload'),true);assert.equal(g.player.ammo[slot],12);assert.equal(g.player.reserve,37);
  g.player.reserve=72;assert.equal(g.action('salvage',slot),true);assert.equal(g.player.reserve,72);assert.equal(g.items.find(o=>o.type==='ammo').amount,12);
  assert.equal(g.player.ammo[slot],0);assert.equal(g.action('salvage',slot),false);
});
test('penetration and longer range affect actual attacks; visuals retain gun family',()=>{
  const shoot=affix=>{const g=arena(),e=makeEnemy('brute',14,10,'e');g.enemies=[e];g.target=e.id;g.player.affixes[0]=affix;g.rng=()=>0;g.action('fire');return {hp:e.hp,effect:g.effects.find(o=>o.type==='shot')};};
  const normal=shoot(null),piercing=shoot('piercing');assert.ok(piercing.hp<normal.hp);assert.equal(piercing.effect.weaponId,'rifle');
  const g=arena(),e=makeEnemy('brute',16,10,'e');g.enemies=[e];g.target=e.id;g.player.weapon=1;assert.equal(g.action('fire'),false);
  g.player.affixes[1]='longbarrel';assert.equal(g.action('fire'),true);
});
test('v4 migration preserves old guns, ground weapons, ammo, currency and RNG exactly once',()=>{
  const g=new Game(12),old=JSON.parse(g.serialize());old.version=4;const p=old.data.player;
  p.weapon=1;p.ammo=[3,2,0,0,0,0];p.upgrades=[2,1,0,0,0,0];delete p.weaponBases;delete p.affixes;
  for(const item of old.data.items)delete item.slot;
  const restored=Game.restore(JSON.stringify(old));assert.ok(restored);assert.deepEqual(restored.player.ammo.slice(0,6),p.ammo);assert.deepEqual(restored.player.upgrades.slice(0,6),p.upgrades);
  assert.equal(restored.player.weapon,1);assert.deepEqual(restored.player.owned,p.owned);assert.ok(restored.player.affixes.every(a=>a===null));
  assert.equal(restored.rng.state(),old.rngState);assert.deepEqual(restored.protocol,old.data.protocol);assert.equal(restored.turn,old.data.turn);
  assert.deepEqual(restored.items.map(({slot,...item})=>item),old.data.items);
  const again=Game.restore(restored.serialize());assert.equal(again.serialize(),restored.serialize());
});
test('save validation rejects aliased weapon ownership, missing slots and invalid affixes',()=>{
  const g=arena(),slot=loot(g);
  for(const mutate of [d=>d.player.owned.push(0),d=>d.items[0].slot=0,d=>d.items[0].slot=999,d=>d.player.affixes[slot]='unknown',d=>d.player.ammo.pop(),d=>d.items.push({...d.items[0]}),d=>d.player.upgrades[slot]=4]){
    const raw=JSON.parse(g.serialize());mutate(raw.data);assert.equal(Game.restore(JSON.stringify(raw)),null);
  }
});
test('complete backups and combat snapshots keep weapon instances independently',()=>{
  const g=arena(),slot=loot(g,0,'powerful');g.action('takeWeapon',slot);g.action('weapon',slot);
  const e=makeEnemy('brute',14,10,'e');g.enemies=[e];g.target=e.id;
  const captured=captureAction(g,()=>g.action('fire'));assert.equal(captured.success,true);assert.equal(captured.steps[0].before.weapon.affix,'powerful');assert.equal(captured.steps[0].before.player.ammo[slot],6);assert.equal(captured.steps[0].after.player.ammo[slot],5);assert.equal(captured.steps[0].before.player.ammo[0],8);
  const restored=decodeBackup(JSON.stringify(makeBackup(g,normalizeProfile(),'qa')),'qa').game;
  assert.deepEqual(restored.player,g.player);assert.equal(restored.weapon.name,`強擊・${WEAPONS[0].name}`);
});
