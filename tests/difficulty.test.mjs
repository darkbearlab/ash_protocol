import test from 'node:test';
import {concealChance} from '../src/concealed.js';
import {heavyChance} from '../src/world.js';
import assert from 'node:assert/strict';
import {Game,generate,makeEnemy,ENEMY_TYPES} from '../src/engine.js';
import {DIFFICULTY_CURVES,DEFAULT_CURVE} from '../src/endless.js';
import {affixChance,deployerChance} from '../src/enemy-affixes.js';
import {eliteChance} from '../src/elite-enemies.js';
import {DIFFICULTY_OPTIONS,runOptions} from '../src/deploy-ui.js';
import {retryPlan} from '../src/result-copy.js';
import {addAlly} from '../src/allies.js';
import {factionDef} from '../src/faction-catalog.js';

// 3.137.0 (user decisions 2026-09-19, docs/DIFFICULTY.md): 簡單 grows numbers slowly; 標準 grows them just as slowly
// but brings affixes (floor 3), elites and deployers (depth 7) and a floor-2 preview special earlier. The curve before
// this release ('classic') is kept for runs started earlier and is never offered.
const easy={curve:'easy',offset:0},standard={curve:'standard',offset:0},classic={curve:'classic',offset:0};

test('three curves are offered, 普通 (hard) by default; they grow numbers the same slow way',()=>{
 assert.equal(DEFAULT_CURVE,'standard');assert.deepEqual(DIFFICULTY_OPTIONS.map(d=>d.curve),['standard','hard','brutal']);assert.equal(runOptions().difficulty,'hard');   // 3.222.0
 for(const key of ['hpStep','damageStep','hpGrowth','damageGrowth'])assert.equal(DIFFICULTY_CURVES.easy[key],DIFFICULTY_CURVES.standard[key],key);
 const hp=(f,d)=>makeEnemy('rifleman',1,1,'x',f,d).maxHp;
 // Riflemen are fragile cards (half the per-floor step); the brute is not.
 assert.deepEqual([1,3,6,12,18].map(f=>hp(f,standard)),[22,23,26,36,45]);assert.deepEqual([1,3,6,12,18].map(f=>hp(f,easy)),[22,23,26,36,45]);   // 3.222.0: frozen at 9, half pace past it
 assert.deepEqual([1,3,6,9].map(f=>hp(f,classic)),[22,24,30,44],'the classic curve is unchanged up to the freeze');assert.deepEqual([12,18].map(f=>hp(f,classic)),[53,75],'3.222.0: frozen at 9 on every curve');
 assert.deepEqual([3,6,18].map(f=>makeEnemy('brute',1,1,'x',f,standard).maxHp),[92,98,152]);assert.deepEqual([3,6,18].map(f=>makeEnemy('brute',1,1,'x',f,classic).maxHp),[94,106,227]);   // 18: 3.222.0, frozen at 9
});

// 3.212.0 (docs/ENEMY_VARIETY.md section 9): deployers, and the enemy-variety affixes after them, start at the curve's
// varietyStart — hard floor 3, standard floor 5, easy depth 8 (never in the campaign), classic 8 as before.
test('standard brings affixes from floor 3, elites from depth 7 and deployers from floor 5; easy keeps them where they were',()=>{
 assert.deepEqual([2,3,4,6].map(f=>affixChance(f,standard)),[0,.05,.1,.2]);
 assert.deepEqual([6,7,8].map(f=>affixChance(f,easy)),[0,.04,.08]);
 assert.equal(eliteChance(6,standard),0);assert.equal(eliteChance(7,standard),.02);assert.equal(eliteChance(8,easy),0);assert.equal(eliteChance(9,easy),.02);
 assert.equal(deployerChance(4,standard),0);assert.equal(deployerChance(5,standard),.03);assert.equal(deployerChance(6,standard),.06);
 assert.equal(deployerChance(7,easy),0);assert.equal(deployerChance(8,easy),.03);assert.equal(deployerChance(7,classic),0);assert.equal(deployerChance(8,classic),.03);
 assert.deepEqual(Object.fromEntries(Object.entries(DIFFICULTY_CURVES).map(([id,c])=>[id,c.varietyStart])),{easy:8,standard:5,hard:3,brutal:3,classic:8});
 // The knob moves it like every other start: an offset of +2 on standard brings deployers to floor 3.
 assert.equal(deployerChance(2,{curve:'standard',offset:2}),0);assert.equal(deployerChance(3,{curve:'standard',offset:2}),.03);
});

test('floor 2 on standard previews exactly one special enemy in place of an ordinary one; easy and other floors do not',()=>{
 for(const faction of ['loyalist','rebel','swarm']){
  const type=factionDef(faction).preview;
  for(let seed=1;seed<=8;seed++){
   const s=generate(seed,2,[],standard,faction),e=generate(seed,2,[],easy,faction);
   assert.equal(s.enemies.filter(x=>x.type===type).length,1,`${faction} ${seed}`);assert.equal(e.enemies.filter(x=>x.type===type).length,0);
   assert.equal(s.enemies.length,e.enemies.length,'replaced, not added');
   const changed=s.enemies.filter((x,i)=>x.type!==e.enemies[i].type);assert.equal(changed.length,1);assert.equal(changed[0].id,e.enemies[s.enemies.indexOf(changed[0])].id,'same place, same id');
  }
  assert.equal(generate(4,1,[],standard,faction).enemies.filter(x=>x.type===type).length,0,'not on floor 1');
 }
 assert.deepEqual(generate(5,2,[],standard,'rebel'),generate(5,2,[],standard,'rebel'),'the pick is fixed by the seed');
});

test('enemy damage follows the curve; allies never do',()=>{
 const shot=d=>{const g=new Game(9,[],0,'soldier','onyx','extraction',{difficulty:d.curve});g.enemies=[];g.floor=4;const e=makeEnemy('rifleman',g.player.x,g.player.y+1,'a',4,g.difficultySpec);Object.assign(e,{alert:true,charge:true,windup:1,aim:{x:g.player.x,y:g.player.y}});g.enemies=[e];g.rng=()=>0;let raw=0;g.damagePlayer=n=>{raw+=n;};g.executeEnemy(e);return raw;};   // 3.185.0: the attack's rounds add up to it
 assert.equal(shot(standard),ENEMY_TYPES.rifleman.damage+4);assert.equal(shot(easy),ENEMY_TYPES.rifleman.damage+4);assert.equal(shot(classic),ENEMY_TYPES.rifleman.damage+8);
 const ally=d=>{const g=new Game(9,[],0,'soldier','onyx','extraction',{difficulty:d.curve});g.floor=6;g.allies=[];const p=g.player,spot=[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>({x:p.x+dx,y:p.y+dy})).find(q=>g.passable(q.x,q.y)&&!g.enemies.some(e=>e.x===q.x&&e.y===q.y));return addAlly(g,'survivor','rifleman',{point:spot}).maxHp;};
 assert.equal(ally(standard),ally(classic));assert.equal(ally(easy),ally(classic));
});

test('the curve is saved; a run from before 3.137.0 keeps the classic curve; an unknown curve is refused',()=>{
 const g=new Game(7,[],0,'soldier','onyx','extraction',{difficulty:'easy'});
 assert.equal(Game.restore(g.serialize()).difficulty,'easy');assert.equal(retryPlan(g).options.difficulty,'standard','3.222.0: retrying a 簡單 run plays 野餐');
 const old=JSON.parse(g.serialize());old.version=63;delete old.data.difficulty;assert.equal(Game.restore(JSON.stringify(old)).difficulty,'classic');
 const bad=JSON.parse(g.serialize());bad.data.difficulty='nightmare';assert.equal(Game.restore(JSON.stringify(bad)),null);
 assert.throws(()=>new Game(7,[],0,'soldier','onyx','extraction',{difficulty:'nightmare'}));
});

// 3.222.0 (user 2026-10-02): the new 困難 is hard's curve with every affix chance and cap doubled, never past certainty.
test('the new 困難 doubles every affix chance of 普通 and its cap, up to certainty',()=>{
 const hard={curve:'hard',offset:0},brutal={curve:'brutal',offset:0};
 for(const f of [1,3,6])for(const fn of [affixChance,deployerChance])assert.equal(fn(f,brutal),Math.min(1,fn(f,hard)*2),`${fn.name} ${f}`);
 assert.equal(affixChance(9,brutal),1,'the cap doubles to certainty');
 assert.equal(concealChance(9,brutal),1,'埋伏 caps at .75: doubled it stops at certainty');assert.equal(heavyChance(9,brutal),1,'so does the heavy flamer (.6)');
 const {hpGrowth,damageGrowth,affixStart,eliteStart,varietyStart}=DIFFICULTY_CURVES.hard;assert.deepEqual({hpGrowth,damageGrowth,affixStart,eliteStart,varietyStart},(({hpGrowth,damageGrowth,affixStart,eliteStart,varietyStart})=>({hpGrowth,damageGrowth,affixStart,eliteStart,varietyStart}))(DIFFICULTY_CURVES.brutal),'the same numbers otherwise');
});
