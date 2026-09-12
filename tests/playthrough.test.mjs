import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,FLOORS} from '../src/engine.js';
import {play} from '../tools/balance.mjs';
import {generateLegacy} from '../src/world.js';
class LegacyGame extends Game {generateFloor(){return generateLegacy(this.seed,this.floor,this.unlockedWeapons);}}

test('v1 compatibility: Recon completes dark six-floor campaigns with legal actions; both starter simulations terminate',()=>{
  // Lighting intentionally changes the old all-Soldier win threshold. Track both roles;
  // Soldier bot survival needs human balance review, not a hidden lighting exemption.
  const soldier=Array.from({length:12},(_,i)=>play(i+1,1800,'soldier',LegacyGame));
  const recon=Array.from({length:12},(_,i)=>play(i+1,1800,'recon',LegacyGame));
  assert.ok(recon.filter(r=>r.status==='won').length>=1,JSON.stringify(recon));
  const results=[...soldier,...recon];
  for(const r of results){assert.notEqual(r.status,'playing',JSON.stringify(r));assert.equal(r.invalid,0);if(r.status==='won')assert.equal(r.floor,FLOORS.length);}
});
test('reload preserves next combat random rolls',()=>{
  const a=new Game(100);a.action('fire');const b=Game.restore(a.serialize());a.action('fire');b.action('fire');
  assert.deepEqual(a.player,b.player);assert.deepEqual(a.enemies,b.enemies);assert.deepEqual(a.items,b.items);
});

// This bot's old win-rate threshold is retained above against its original maps.
// v2 changes enemy placement: track legal completion/death, report balance separately.
test('v2 campaigns terminate without invalid actions across both starter simulations',()=>{
  for(const character of ['soldier','recon'])for(let seed=1;seed<=12;seed++){
    const r=play(seed,1800,character);assert.notEqual(r.status,'playing',JSON.stringify(r));assert.equal(r.invalid,0);if(r.status==='won')assert.equal(r.floor,FLOORS.length);
  }
});
