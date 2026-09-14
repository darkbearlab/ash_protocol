import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/engine.js';
import {targetDetails,realModeCard} from '../src/target-card.js';
import {affixArena,sceneEnemy} from '../qa/enemy-affix-scenes.mjs';

const arena=realMode=>{const raw=JSON.parse(affixArena().serialize());raw.data.realMode=realMode;return Game.restore(JSON.stringify(raw));};
const hidden=['hp','chance','cover','traits','order','state'];

test('real-mode aiming shows only the name and distance, with no numbers outside the distance line',()=>{
 const g=arena(true),e=sceneEnemy(g,'brute',['fast']);e.affixes[0].revealed=true;e.suppression=2;e.charge=true;
 const d=targetDetails(g);
 assert.ok(d.name.length>0);assert.match(d.distance,/距離/);
 for(const key of hidden)assert.equal(d[key],'',`${key} should be hidden`);
 const standard=arena(false);sceneEnemy(standard,'brute',['fast']).suppression=2;
 const s=targetDetails(standard);assert.match(s.hp,/HP \d+/);assert.match(s.chance,/命中 \d+%/);assert.ok(s.state.length>0&&s.traits.length>0);
});

test('real mode keeps the no-number legality text and hides object durability',()=>{
 const g=arena(true),e=sceneEnemy(g,'raider');e.x=19;// visible (within 10) but beyond the rifle's range
 const far=targetDetails(g);assert.equal(far.withinRange,false);assert.equal(far.chance,'無法射擊');
 g.props=[{id:'barrel',type:'barrel',x:11,y:10,hp:18,maxHp:18}];g.target='barrel';
 const barrel=targetDetails(g);assert.equal(barrel.name,'爆裂油桶');assert.equal(barrel.hp,'');assert.equal(barrel.chance,'');
});

test('the card filter only blanks number-bearing fields',()=>{
 const card=realModeCard({name:'n',fullName:'f',hp:'HP 1 / 2',chance:'命中 50%',distance:'距離 3 格',cover:'無掩護',traits:'快速',order:'行動在你之前',state:'壓制 1/5',withinRange:true});
 assert.deepEqual({name:card.name,fullName:card.fullName,distance:card.distance,withinRange:card.withinRange},{name:'n',fullName:'f',distance:'距離 3 格',withinRange:true});
 for(const key of hidden)assert.equal(card[key],'');
});
