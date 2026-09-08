import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,FLOORS} from '../src/engine.js';
import {play} from '../tools/balance.mjs';

test('six-floor campaigns finish using only legal actions; all simulations terminate',()=>{
  const results=Array.from({length:12},(_,i)=>play(i+1));
  assert.ok(results.filter(r=>r.status==='won').length>=2,JSON.stringify(results));
  for(const r of results){assert.notEqual(r.status,'playing',JSON.stringify(r));assert.equal(r.invalid,0);if(r.status==='won')assert.equal(r.floor,FLOORS.length);}
});
test('reload preserves next combat random rolls',()=>{
  const a=new Game(100);a.action('fire');const b=Game.restore(a.serialize());a.action('fire');b.action('fire');
  assert.deepEqual(a.player,b.player);assert.deepEqual(a.enemies,b.enemies);assert.deepEqual(a.items,b.items);
});
