import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,makeEnemy,generate,ENEMY_TYPES,ENEMY_AFFIXES,rollEnemyAffixes,enemyDisplayName,revealedAffixes,ELITE_TUNING,eliteChance,rollEnemyElite,enemyKillXp,SAVE_VERSION} from '../src/engine.js';
import {affixArena,sceneEnemy} from '../qa/enemy-affix-scenes.mjs';
import {archiveFloor,resumedFloor} from '../src/retreat.js';
import {makeBackup,decodeBackup} from '../src/backup.js';
import {normalizeProfile} from '../src/progression.js';
import {addAlly} from '../src/allies.js';

test('elite depth curve starts at 9, uses offset, and caps at 15 percent',()=>{
 for(let f=1;f<9;f++)assert.equal(eliteChance(f),0);
 assert.equal(eliteChance(9),.02);assert.equal(eliteChance(3,6),.02);
 assert.equal(eliteChance(15),.14);assert.equal(eliteChance(16),.15);assert.equal(eliteChance(999),.15);
});
test('independent elite stream preserves every nonelite and fills only applicable hidden affixes',()=>{
 let elites=0,normal=0;
 for(const type of Object.keys(ENEMY_TYPES))for(let seed=1;seed<=200;seed++){
  const before=rollEnemyAffixes(makeEnemy(type,1,1,'test',60),seed,60),e=structuredClone(before);
  rollEnemyElite(e,seed,60);assert.deepEqual(e,rollEnemyElite(structuredClone(before),seed,60));
  if(!e.elite){normal++;assert.deepEqual(e,before);continue;}
  elites++;assert.ok(!['boss','warden','fodder','brood'].includes(type));
  assert.ok(e.affixes.length>=ELITE_TUNING.minAffixes||ENEMY_AFFIXES.every(d=>e.affixes.some(a=>a.id===d.id)||!d.applies(e)));
  assert.equal(new Set(e.affixes.map(a=>a.id)).size,e.affixes.length);
  assert.deepEqual(revealedAffixes(e),[]);assert.equal(enemyDisplayName(e),ENEMY_TYPES[type].name+'？');
  assert.deepEqual(e.affixes.slice(0,before.affixes.length),before.affixes);
  assert.equal(e.hp,before.hp);assert.equal(e.maxHp,before.maxHp);
 }
 assert.ok(elites>100&&normal>1000);
 for(const type of ['boss','warden','fodder','brood'])for(let seed=0;seed<300;seed++)assert.equal(rollEnemyElite(makeEnemy(type,1,1,'exclude'),seed,60).elite,undefined);
 const flagged=makeEnemy('raider',1,1,'flagged');flagged.expendable=true;assert.equal(rollEnemyElite(flagged,1,60).elite,undefined);
});
test('runtime births and generated floor share elite rules without combat RNG consumption',()=>{
 const g=new Game(1,[],0,'soldier','onyx','endless',{facilityFaction:'legacy'});g.floor=12;g.loadFloor();
 const rng=g.rng.state();let found=false;
 for(let i=0;i<100;i++){const id=`birth-${i}`,e=g.spawnEnemy('raider',2,2,id),expected=rollEnemyElite(rollEnemyAffixes(makeEnemy('raider',2,2,id,12),1,12),1,12);assert.deepEqual(e,expected);found||=Boolean(e.elite);}
 assert.ok(found);assert.equal(g.rng.state(),rng);
 const map=generate(1,12);assert.ok(map.enemies.some(e=>e.elite));assert.equal(map.generation.version,11);assert.deepEqual(map.enemies.map(({alert,lastKnown,...e})=>e),g.enemies.map(({alert,lastKnown,...e})=>e));
 assert.equal(generate(1,8).generation.version,10);assert.ok(Game.restore(g.serialize()));
});
test('elite generation preserves every terrain, loot and base-stat value at deep and offset depths',()=>{
 for(const [floor,offset] of [[9,0],[12,0],[60,0],[3,6]]){
  const actual=generate(5,floor,[],offset),cap=ELITE_TUNING.chanceCap;let original;
  try{ELITE_TUNING.chanceCap=0;original=generate(5,floor,[],offset);}finally{ELITE_TUNING.chanceCap=cap;}
  if(actual.generation.version===11)actual.generation=actual.generation.base;
  for(let i=0;i<actual.enemies.length;i++){
   const e=actual.enemies[i],before=original.enemies[i];
   if(!e.elite){assert.deepEqual(e,before);continue;}
   delete e.elite;e.affixes=before.affixes;e.traits=before.traits;
  }
  assert.deepEqual(actual,original);
 }
});
test('elite kill doubles only XP, preserving loot, scrap and combat randomness, including retreat waves',()=>{
 for(const reinforcement of [false,true]){
  const results=[];
  for(const elite of [false,true]){const g=affixArena(),e=sceneEnemy(g,'raider');if(elite)e.elite=true;e.reinforcement=reinforcement;g.player.level=19;g.player.xp=0;
   g.hurt(e,500);results.push({xp:g.player.xp,scrap:g.player.scrap,items:g.items,rng:g.rng.state(),protocol:g.protocol,level:g.player.level});}
  assert.equal(results[1].xp,results[0].xp*2);delete results[0].xp;delete results[1].xp;assert.deepEqual(...results);
 }
 assert.equal(enemyKillXp({type:'fodder',expendable:true,elite:true}),0);
});
test('save41, archived floors and complete backup preserve elite; save40 clears it everywhere',()=>{
 const g=new Game(1,[],0,'soldier','onyx','roundtrip');g.enemies[0].elite=true;Object.assign(g.player,g.exitPoint);assert.ok(g.descend());g.enemies[0].elite=true;
 assert.ok(SAVE_VERSION>=41);const copy=Game.restore(g.serialize());assert.ok(copy);assert.deepEqual(copy.enemies,g.enemies);assert.deepEqual(resumedFloor(copy.floorStates[1],g.turn).enemies,g.floorStates[1].enemies);
 const backup=decodeBackup(JSON.stringify(makeBackup(g,normalizeProfile(),'qa')),'qa');assert.ok(backup);
 const raw=JSON.parse(g.serialize());raw.version=40;const old=Game.restore(JSON.stringify(raw));assert.ok(old);assert.ok(old.enemies.every(e=>!Object.hasOwn(e,'elite')));assert.ok(old.floorStates[1].enemies.every(e=>!Object.hasOwn(e,'elite')));
 for(const location of ['current','archive'])for(const value of [false,null,1,'true']){const raw=JSON.parse(g.serialize());(location==='current'?raw.data.enemies:raw.data.floorStates[1].enemies)[0].elite=value;assert.equal(Game.restore(JSON.stringify(raw)),null);}
});
test('summoned allies borrow only the base card and never inherit elite or its affixes',()=>{
 const g=affixArena('necromancer'),corpse=sceneEnemy(g,'raider',['fast','grenadier','suppressor']);corpse.hp=0;corpse.elite=true;
 const a=addAlly(g,'summon',corpse.type,{sourceId:'raise_dead',point:{x:11,y:10}});assert.ok(a);assert.equal(a.elite,undefined);assert.ok(!a.traits.some(t=>t.source.startsWith('affix:')));
});
