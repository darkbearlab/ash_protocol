import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game.js';
import {activeTrait,healingAmount,grantTrait} from '../src/traits.js';
const arena=character=>{const g=new Game(3460,[],0,character);g.enemies=[];g.allies=[];g.hazards=[];g.marks=[];g.props=[];return g;};
test('only bulwark and necromancer start difficult healing; upgrade bonus is included before halving',()=>{
 for(const id of ['bulwark','necromancer','soldier','recon','engineer','druid']){
  const g=arena(id),p=g.player,affected=['bulwark','necromancer'].includes(id);assert.equal(activeTrait(p,'difficult_healing'),affected);
  p.hp=10;p.healBonus=20;p.poison=2;const meds=p.meds;assert.ok(g.action('heal'));assert.equal(p.hp,affected?42:75);assert.equal(p.poison,0);assert.equal(p.meds,meds-1);
 }
});
test('health perk increases full capacity but halves healing; terminal and descending also obey passive',()=>{
 for(const id of ['bulwark','necromancer']){
  const g=arena(id),p=g.player,max=p.maxHp;p.hp=10;g.pendingPerks=1;g.perkDraft={index:0,ids:['health']};assert.ok(g.choosePerk('health'));assert.equal(p.maxHp,max+25);assert.equal(p.hp,30);
  g.props=[{id:'qa-terminal',type:'terminal',x:p.x,y:p.y,used:false}];p.scrap=100;assert.ok(g.useTerminal('heal'));assert.equal(p.hp,60);assert.equal(p.scrap,85);
  p.hp=10;p.x=g.end.x;p.y=g.end.y;assert.ok(g.descend());assert.equal(p.hp,22);
 }
});
test('healing halves before missing-health clamp, duplicate trait sources do not compound',()=>{
 const g=arena('bulwark'),p=g.player;grantTrait(p,'difficult_healing','test:extra');assert.equal(healingAmount(p,65),32);p.hp=p.maxHp-5;assert.ok(g.action('heal'));assert.equal(p.hp,p.maxHp);
});
test('existing saves gain one permanent source without healing or changing inventory, repeated restores stay stable',()=>{
 for(const id of ['bulwark','necromancer']){
  const g=arena(id);g.player.hp=17;g.player.traits=g.player.traits.filter(t=>t.id!=='difficult_healing');const raw=g.serialize(),h=Game.restore(raw);assert.ok(h);assert.equal(h.player.hp,17);assert.equal(h.player.meds,g.player.meds);assert.equal(h.rng.state(),g.rng.state());
  const k=Game.restore(h.serialize());assert.equal(k.player.traits.filter(t=>t.id==='difficult_healing').length,1);assert.deepEqual(k.player,h.player);
 }
});
