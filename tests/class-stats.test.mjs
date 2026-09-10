import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,SIZE,makeEnemy} from '../src/engine.js';
import {actorStat,meleeChance,validCombatModifiers} from '../src/actor-stats.js';
import {makeBackup,decodeBackup} from '../src/backup.js';
import {normalizeProfile} from '../src/progression.js';

function arena(character='soldier'){
  const g=new Game(325,[],0,character);g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.lighting=g.grid.map(r=>r.slice());
  for(const key of ['barriers','props','items','hazards','marks','enemies','smoke','rooms'])g[key]=[];
  Object.assign(g.player,{x:10,y:10});g.end={x:20,y:20};g.reveal();return g;
}
function enemy(g,type='rifleman',x=14,y=10){const e=makeEnemy(type,x,y,'stats-target');e.hp=e.maxHp=1000;e.alert=true;e.charge=true;g.enemies.push(e);g.target=e.id;g.reveal();return e;}

test('class accuracy and evasion are percentage-point modifiers before the shared cap',()=>{
  const g=arena(),e=enemy(g);assert.equal(g.accuracy(g.player,e).chance,99);
  e.moved=true;assert.equal(g.accuracy(g.player,e).chance,83);e.moved=false;
  g.grid[10][13]=0;assert.equal(g.accuracy(g.player,e).chance,63);
  g.lighting[10][14]=0;assert.equal(g.accuracy(g.player,e).chance,23);
  const r=arena('recon'),shooter=enemy(r);assert.equal(r.accuracy(shooter,r.player).chance,87);
  r.player.moved=true;r.player.moveDelta=[1,0];assert.equal(r.accuracy(shooter,r.player).chance,65);
  r.player.moveDelta=[0,1];assert.equal(r.accuracy(shooter,r.player).chance,45);
  assert.equal(meleeChance(shooter,r.player),97,'ranged evasion does not evade melee');
});
test('four independent signed hooks work for enemies and players without mixing attack channels',()=>{
  const g=arena(),e=enemy(g);g.player.combatModifiers={rangedAccuracy:-20,rangedEvasion:7,meleeAccuracy:5,meleeEvasion:30};
  e.combatModifiers={rangedAccuracy:4,rangedEvasion:6,meleeAccuracy:-10,meleeEvasion:20};
  assert.equal(g.accuracy(g.player,e).chance,79);assert.equal(g.accuracy(e,g.player).chance,94);
  assert.equal(meleeChance(g.player,e,99),84);assert.equal(meleeChance(e,g.player),57);
  assert.equal(meleeChance({combatModifiers:{meleeAccuracy:-100}},{combatModifiers:{meleeEvasion:100}}),10);
  assert.equal(meleeChance({combatModifiers:{meleeAccuracy:100}},{}),99);
});
test('power fist prediction and actual miss use melee accuracy and evasion, with no ammunition cost',()=>{
  const g=arena('bulwark'),e=enemy(g,'rifleman',11);assert.equal(g.action('weapon',7),true);
  e.combatModifiers={meleeEvasion:20,rangedEvasion:100};
  assert.equal(g.accuracy(g.player,e).chance,79);assert.equal(g.fireChance(e),79);
  const ammo=structuredClone(g.player.ammo),turn=g.turn;g.rng=()=>.9;
  assert.equal(g.action('fire'),true);assert.equal(e.hp,1000);assert.equal(g.turn,turn+1);assert.deepEqual(g.player.ammo,ammo);
  assert.ok(g.effects.some(f=>f.style==='slash'&&f.miss));
});
test('enemy melee rolls use melee hooks while ignoring ranged evasion',()=>{
  const g=arena('recon'),e=enemy(g,'crawler',11);g.player.combatModifiers={meleeEvasion:30,rangedEvasion:100};
  e.combatModifiers={meleeAccuracy:10};g.rng=()=>.8;const hp=g.player.hp;g.enemyAct(e);assert.equal(g.player.hp,hp);
  e.charge=true;g.rng=()=>.7;g.enemyAct(e);assert.ok(g.player.hp<hp);
});
test('new Recon receives smoke and EMP, prepares smoke and can immediately throw it',()=>{
  const g=arena('recon');assert.equal(g.player.grenades,0);assert.equal(g.player.smoke,2);assert.equal(g.player.emp,2);assert.equal(g.player.meds,2);
  assert.equal(g.player.prepared.grenade,'smoke');const turn=g.turn;
  assert.equal(g.action('grenade',{x:12,y:10}),true);assert.equal(g.player.smoke,1);assert.equal(g.player.emp,2);assert.equal(g.turn,turn+1);assert.ok(g.smoke.length);
  for(const [id,hp,armor,plates]of [['soldier',100,0,0],['recon',100,0,0],['bulwark',200,6,30]]){
    const a=arena(id);assert.equal(a.player.hp,hp);assert.equal(a.player.maxHp,hp);assert.equal(a.player.armor,armor);assert.equal(a.player.plates,plates);assert.equal(a.weaponCapacity,3);assert.equal(a.plateCapacity,30);
    if(id!=='recon'){assert.equal(a.player.grenades,2);assert.equal(a.player.smoke,0);assert.equal(a.player.emp,0);}
  }
});
test('Recon extra carrying adds to grenade upgrades only, retains overflow and rejects a full purchase',()=>{
  const g=arena('recon');for(let level=0;level<=3;level++){g.setCarryLevel({grenade:level});assert.equal(g.ammoCapacity('grenade'),6+level);assert.equal(g.ammoCapacity('rifle'),72);}
  g.receiveGrenade('frag',5);assert.equal(g.player.grenades,5);g.setCarryLevel({grenade:0});
  assert.equal(g.player.grenades+g.player.smoke+g.player.emp+g.player.stun,6);
  assert.equal(g.items.reduce((n,i)=>n+(i.amount||0),0),3);
  g.props=[{type:'terminal',x:11,y:10,used:false}];g.player.scrap=100;const turn=g.turn;
  assert.equal(g.action('terminal','emp'),false);assert.equal(g.turn,turn);assert.equal(g.player.scrap,100);assert.equal(g.props[0].used,false);
});
test('v18 migration and repeated restore preserve live health, supplies, prepared selection and random state',()=>{
  const g=arena('recon');Object.assign(g.player,{hp:63,maxHp:125,armor:3,grenades:1,smoke:0,emp:1,meds:1});g.player.prepared.grenade='emp';
  const old=JSON.parse(g.serialize());old.version=18;const restored=Game.restore(JSON.stringify(old));assert.ok(restored);
  assert.deepEqual(restored.player,g.player);assert.equal(actorStat(restored.player,'rangedEvasion'),10);assert.equal(restored.ammoCapacity('grenade'),6);assert.equal(restored.rng.state(),g.rng.state());
  const again=Game.restore(restored.serialize());assert.deepEqual(again.player,g.player);
  Object.assign(again.player,again.end);again.action('interact');assert.equal(again.player.smoke,0);assert.equal(again.player.emp,1);assert.equal(again.player.prepared.grenade,'emp');
});
test('save and full backup retain all four optional hooks and reconcile class capacity with profile upgrades',()=>{
  const g=arena('recon'),e=enemy(g);g.player.combatModifiers={rangedAccuracy:-2,rangedEvasion:3,meleeAccuracy:4,meleeEvasion:-5};e.combatModifiers={meleeEvasion:20};
  const profile=normalizeProfile();profile.protocol={balance:0,earned:200};profile.upgrades.carrying.grenade=3;g.setCarryLevel(profile.upgrades.carrying);
  const decoded=decodeBackup(JSON.stringify(makeBackup(g,profile,'qa')),'qa').game;
  assert.deepEqual(decoded.player.combatModifiers,g.player.combatModifiers);assert.deepEqual(decoded.enemies[0].combatModifiers,e.combatModifiers);assert.equal(decoded.ammoCapacity('grenade'),9);
});
test('malformed actor modifiers fail restoration instead of changing combat math',()=>{
  assert.ok(validCombatModifiers(undefined));assert.ok(validCombatModifiers({}));
  for(const value of [null,[],{unknown:2},{rangedAccuracy:'8'},{meleeEvasion:.5},{rangedEvasion:101},{meleeAccuracy:-101}]){
    assert.equal(validCombatModifiers(value),false);
    for(const who of ['player','enemy']){const g=arena();const e=enemy(g);(who==='player'?g.player:e).combatModifiers=value;assert.equal(Game.restore(g.serialize()),null);}
  }
});
test('first v18 local load keeps the original backup without refilling supplies or touching live storage',async()=>{
  const memory=new Map();globalThis.location={search:'?test=1'};globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
  const storage=await import('../src/storage.js?class-stats');
  const g=arena('recon');g.player.emp=0;g.player.smoke=1;const old=JSON.parse(g.serialize());old.version=18;const raw=JSON.stringify(old);
  memory.set('qa-ash-save',raw);const restored=storage.loadGame();assert.ok(restored);assert.equal(restored.player.emp,0);assert.equal(restored.player.smoke,1);
  assert.equal(memory.get('qa-ash-save-v18-backup'),raw);storage.saveGame(restored);storage.loadGame();assert.equal(memory.get('qa-ash-save-v18-backup'),raw);assert.equal(memory.has('ash-save'),false);
});
