import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,generate,makeEnemy} from '../src/engine.js';
import {ENDLESS_TUNING,effectiveDepth,scaleEnemy,extraEnemies,supplyShare} from '../src/endless.js';
import {affixChance} from '../src/enemy-affixes.js';
import {eliteChance} from '../src/elite-enemies.js';
import {TERMINAL_TUNING} from '../src/terminal.js';
import {floorBoss,BOSS_DRAW_FROM,OPERATIVE_CLASSES} from '../src/operative-draw.js';
import {factionDef} from '../src/factions.js';

// 3.222.0 無盡改版 (user 2026-10-02, docs/ENDLESS.md): the difficulty freezes at floor 9; past it the numbers grow at half
// pace, one more enemy a room from floor 10, the supplies thin every three floors, and every boss floor past the campaign
// draws its boss.
const hard={curve:'hard',offset:0};
test('the freeze: depth, affixes and elites stop at 9; numbers go on at half pace; one more enemy a room from 10',()=>{
 assert.equal(ENDLESS_TUNING.freeze,9);
 for(const f of [9,10,15,60]){assert.equal(effectiveDepth(f,hard),9);assert.equal(affixChance(f,hard),affixChance(9,hard));assert.equal(eliteChance(f,hard),eliteChance(9,hard));}
 assert.equal(effectiveDepth(7,hard),7,'the campaign and floors 7 and 8 are as before');
 const g=.04;assert.equal(scaleEnemy(1000,9,'hp',hard),Math.round(1000*(1+g)**3));assert.equal(scaleEnemy(1000,15,'hp',hard),Math.round(1000*(1+g)**3*(1+g/2)**6),'half pace past 9');
 assert.ok(makeEnemy('rifleman',1,1,'x',20,hard).maxHp>makeEnemy('rifleman',1,1,'x',9,hard).maxHp,'still growing');
 assert.deepEqual([6,7,9,10,12,30].map(extraEnemies),[0,0,0,1,1,1]);
});
test('past the freeze every three floors the cases and terminals hold a fifth less, down to a quarter; emptied cases show opened',()=>{
 assert.deepEqual([9,10,12,13,16,19,40].map(f=>Math.round(supplyShare(f)*100)/100),[1,.8,.8,.6,.4,.25,.25]);
 const count=m=>m.props.filter(o=>o.type==='container'&&o.kind!=='vault').reduce((n,o)=>n+o.contents.length,0);
 let at9=0,at19=0;for(let seed=1;seed<=10;seed++){at9+=count(generate(seed,9,[],hard,'loyalist'));at19+=count(generate(seed,19,[],hard,'loyalist'));}
 assert.ok(at19<at9*.45,`${at19} vs ${at9}`);
 const m=generate(3,19,[],hard,'loyalist');
 for(const o of m.props){if(o.type==='terminal')assert.equal(o.spent,Math.round(TERMINAL_TUNING.credit*(1-supplyShare(19))));if(o.type==='container'&&!o.opened)assert.ok(o.contents.length>0,'an unopened case is never empty');}
 assert.ok(m.props.some(o=>o.type==='container'&&o.opened&&!o.contents.length),'some cases come already emptied');
 const v=generate(3,9,[],hard,'loyalist');assert.ok(v.props.filter(o=>o.type==='terminal').every(o=>!o.spent),'up to the freeze terminals are full');
 const deep=new Game(5,[],0,'soldier','onyx','endless',{facilityFaction:'loyalist'});deep.floor=19;deep.loadFloor();assert.ok(Game.restore(deep.serialize()),'a thinned floor saves');
});
test('past the campaign every boss floor draws its boss: either of the facility\'s two or an operative; the campaign keeps its own',()=>{
 for(const faction of ['loyalist','rebel','swarm']){
  const def=factionDef(faction),seen=new Set();
  for(let seed=1;seed<=60;seed++){
   assert.deepEqual(floorBoss(seed,3,faction,def.bosses[3]).boss,def.bosses[3],'campaign floor 3');
   const r=floorBoss(seed,12,faction,def.bosses[6]);assert.deepEqual(r,floorBoss(seed,12,faction,def.bosses[6]),'deterministic');
   if(r.operative){assert.ok(def.delisted&&OPERATIVE_CLASSES.includes(r.operative));seen.add('operative');}else{assert.ok([def.bosses[3],def.bosses[6]].includes(r.boss));seen.add(r.boss);}
  }
  assert.deepEqual([...seen].sort(),[def.bosses[3],def.bosses[6],...(def.delisted?['operative']:[])].sort(),faction);
 }
 assert.equal(BOSS_DRAW_FROM,7);
});
