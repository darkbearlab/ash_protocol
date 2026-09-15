import test from 'node:test';
import assert from 'node:assert/strict';
import {addPoison,tickPoison,clearPoison,SWARM_TUNING} from '../src/engine.js';
import {affixArena} from '../qa/enemy-affix-scenes.mjs';

// Sealed protection blunts poison by one point per tier (user decision, 3.85.2); floor hazards keep the full value.
test('each sealed protection tier removes one point of poison damage per turn, never below zero',()=>{
 for(const [hazmat,expected] of [[0,4],[5,3],[10,2],[15,1]]){
  const g=affixArena(),p=g.player;p.hazmat=hazmat;addPoison(p,SWARM_TUNING.poisonCap);const hp=p.hp;
  tickPoison(g);assert.equal(hp-p.hp,expected,`hazmat ${hazmat}`);clearPoison(p);
 }
 const g=affixArena(),p=g.player;p.hazmat=15;addPoison(p,1);const hp=p.hp;tickPoison(g);
 assert.equal(p.hp,hp,'one stack against three tiers deals nothing');
});

test('floor hazards still subtract the full protection value',()=>{
 const g=affixArena(),p=g.player;g.hazards=[{x:p.x,y:p.y,type:'acid'}];p.hazmat=5;const hp=p.hp;
 g.environmentTurn();
 assert.equal(hp-p.hp,3,'acid 8 minus 5; the new stack is blunted to zero by one tier');
 assert.equal(p.poison,1);
});
