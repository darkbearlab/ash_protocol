import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game.js';
import {WEAPONS} from '../src/data.js';
import {weaponStats} from '../src/weapons.js';
import {grantTrait} from '../src/traits.js';
import {makeEnemy} from '../src/world.js';
import {captureAction,projectileVisuals} from '../src/presentation.js';
import {clearGeneratedMap} from './helpers/arena.mjs';
import {makeBackup,decodeBackup} from '../src/backup.js';
import {normalizeProfile} from '../src/progression.js';
function arena(range,affix=null,Type=Game){
  const g=new Type(1,[],0,'recon');clearGeneratedMap(g);g.grid=Array.from({length:27},()=>Array(27).fill(1));g.lighting=g.grid.map(r=>r.slice());
  for(const k of ['props','barriers','items','hazards','marks','smoke','traces','rooms'])g[k]=[];
  Object.assign(g.player,{x:10,y:10,perkWeaponBonus:12});g.player.affixes[2]=affix;
  const e=makeEnemy('rifleman',10+range,10,'target');e.hp=e.maxHp=9999;e.control.disabled=4;g.enemies=[e];g.target=e.id;g.reveal();return g;
}
test('only SMG receives the passive range extension; longbarrel shifts both zones without changing burst damage',()=>{
  const g=new Game(1,[],0,'recon');assert.ok(g.player.traits.some(t=>t.id==='extended_burst'));
  for(const [i,w]of WEAPONS.entries())for(const affix of [null,'longbarrel']){
    const base=weaponStats(i,affix),withTrait=weaponStats(i,affix,g.player);
    if(w.weaponClass==='smg'){assert.equal(withTrait.range,base.range+2);assert.equal(withTrait.burstRange,base.range);assert.equal(withTrait.burst,base.burst);assert.equal(withTrait.min,base.min);}
    else assert.deepEqual(withTrait,base);
  }
  for(const id of ['engineer','necromancer','soldier','ninja'])assert.equal(weaponStats(2,null,new Game(1,[],0,id).player).range,5);
});
test('actual public fire consumes and animates 2/1 rounds at standard and longbarrel boundaries; out-of-range is free',()=>{
  for(const [affix,cases]of [[null,[[4,2],[5,2],[6,1],[7,1],[8,0]]],['longbarrel',[[6,2],[7,2],[8,1],[9,1],[10,0]]]])for(const [range,count]of cases){
    const g=arena(range,affix),ammo=g.player.ammo[2],turn=g.turn,damage=g.weaponDamage(2,g.enemies[0]);g.rng=()=>0;
    assert.equal(damage.min,(affix?12:13)+6,'per-volley perk division still uses two rounds');
    const result=captureAction(g,()=>g.action('fire'));assert.equal(result.success,count>0);assert.equal(g.player.ammo[2],ammo-count);assert.equal(g.turn,turn+(count?1:0));
    const shots=result.steps.flatMap(s=>s.effects).filter(e=>e.type==='shot');assert.equal(shots.length,count);
    if(count===1){assert.ok(shots[0].singleShot);assert.equal(projectileVisuals(shots[0]).length,1);}
    if(count===2)assert.equal(projectileVisuals(shots[0]).length,3,'near burst keeps existing cosmetic shots');
  }
  const g=arena(5);g.player.ammo[2]=1;g.rng=()=>0;assert.ok(g.action('fire'));assert.equal(g.player.ammo[2],0);
});
test('fast enemy crossing the boundary changes volley at resolution, never retargets; lost target still spends far ammunition',()=>{
  class MovingGame extends Game{enemyAct(e){if(e.id==='target'){e.x=this.destination;this.reveal();}}}
  for(const [before,after,count]of [[5,6,1],[6,5,2]]){
    const g=arena(before,null,MovingGame),e=g.enemies[0];e.control.disabled=0;e.alert=true;grantTrait(e,'fast','qa');g.destination=10+after;g.rng=()=>0;
    const ammo=g.player.ammo[2];assert.ok(g.action('fire'));assert.equal(ammo-g.player.ammo[2],count);assert.ok(g.effects.filter(s=>s.type==='shot').every(s=>s.to.x===10+after));
  }
  class HidingGame extends Game{enemyAct(e){if(e.id==='target'){e.x=24;this.reveal();}}}
  const g=arena(6,null,HidingGame),e=g.enemies[0];e.alert=true;e.control.disabled=0;grantTrait(e,'fast','qa');g.rng=()=>0;
  const decoy=makeEnemy('rifleman',12,10,'decoy');decoy.control.disabled=4;g.enemies.push(decoy);g.reveal();const ammo=g.player.ammo[2],hp=decoy.hp;
  assert.ok(g.action('fire'));assert.equal(ammo-g.player.ammo[2],1);assert.equal(decoy.hp,hp);const shot=g.effects.find(s=>s.type==='shot');assert.equal(shot.to.x,16);assert.equal(shot.miss,true);
});
test('existing Recon save receives passive exactly once, retaining ammo, affixes, resources and RNG through backup',()=>{
  const g=new Game(4,[],0,'recon');g.player.affixes[2]='longbarrel';g.player.ammo[2]=3;g.player.hp=51;
  const raw=JSON.parse(g.serialize());raw.data.player.traits=raw.data.player.traits.filter(t=>t.id!=='extended_burst');
  const copy=Game.restore(JSON.stringify(raw));assert.ok(copy);assert.equal(copy.weapon.range,9);assert.equal(copy.weapon.burstRange,7);
  for(const k of ['ammo','affixes','hp','meds','scrap','pistol','reserve','skillState'])assert.deepEqual(copy.player[k],g.player[k]);assert.equal(copy.rng.state(),g.rng.state());
  const twice=Game.restore(copy.serialize());assert.equal(twice.player.traits.filter(t=>t.id==='extended_burst').length,1);
  const restored=decodeBackup(JSON.stringify(makeBackup(twice,normalizeProfile(),'qa')),'qa').game;assert.deepEqual(restored.player,twice.player);assert.equal(restored.weapon.range,9);
});
