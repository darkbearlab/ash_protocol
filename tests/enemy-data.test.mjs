import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {ENEMY_TYPES,ENEMY_LOOT,WEAPONS,Game,makeEnemy,ENEMY_TAGS,ENEMY_SPAWNS,ALLY_BASE_TYPES,enemyDef,hasEnemyTag,isBossClass,enemyStartingTraitIds} from '../src/engine.js';
import {TRAITS,startingTraits} from '../src/traits.js';
import {UNIT_TREES,unitTree} from '../src/behavior-tree.js';
import {enemyWeapon} from '../src/enemy-behavior.js';
import {grantNativeResistance} from '../src/suppression.js';

test('enemy definitions and spawn references use valid rule data',()=>{
 for(const [id,d] of Object.entries(ENEMY_TYPES)){
  assert.ok(Array.isArray(d.tags)&&d.tags.every(t=>ENEMY_TAGS.includes(t)),id);
  assert.equal(new Set(d.tags).size,d.tags.length,id);
  assert.ok(Array.isArray(d.traits)&&d.traits.every(t=>Object.hasOwn(TRAITS,t)),id);
  for(const t of d.floorTraits||[])assert.ok(Object.hasOwn(TRAITS,t.id)&&Number.isInteger(t.minFloor)&&t.minFloor>=1,id);
  if(d.behavior!==undefined)assert.ok(Object.hasOwn(UNIT_TREES,d.behavior),id);
  assert.ok(Number.isInteger(d.rounds)&&d.rounds>0,id);
  assert.ok(['claw','slash','plasma','bullet'].includes(d.attackStyle),id);
  if(d.reinforcement)assert.ok(enemyDef(d.reinforcement),id);
  if(d.loot){for(const [key,value] of Object.entries(d.loot)){
   assert.ok(['weapon','chance','ammo','rareWeapon','rareChance'].includes(key),key);
   if(key==='weapon'||key==='rareWeapon')assert.ok(Number.isInteger(value)&&WEAPONS[value],id);
   if(key==='chance'||key==='rareChance')assert.ok(Number.isFinite(value)&&value>=0&&value<=1,id);
   if(key==='ammo')assert.ok(['ammo','pistol','shell','energy','ordnance'].includes(value),id);
  }assert.equal(ENEMY_LOOT[id],d.loot);}
 }
 for(const id of Object.values(ENEMY_SPAWNS).flat())assert.ok(enemyDef(id),id);
 for(const id of Object.values(ALLY_BASE_TYPES))assert.ok(enemyDef(id),id);
 assert.deepEqual(Object.keys(ENEMY_LOOT),['rifleman','raider','gunner','sniper','drone','brute','warden','boss']);
});

// Pre-refactor snapshot: order and source strings are serialized, not just membership.
const initial={fodder:['slow','no_cover','biological'],brood:['fast','no_cover','biological'],rifleman:['biological'],raider:['biological'],crawler:['biological'],gunner:['biological'],drone:['no_cover','mechanical'],brute:['large','suppression_resistance','biological'],sniper:['night_vision','biological'],bomber:['biological'],warden:['infrared','suppression_resistance','mechanical'],boss:['suppression_resistance','mechanical']};
test('all original trait arrays and sources match at floors 1 through 12',()=>{
 assert.deepEqual(Object.keys(ENEMY_TYPES),Object.keys(initial));
 for(const [id,base] of Object.entries(initial))for(let floor=1;floor<=12;floor++){
  const ids=id==='crawler'&&floor>=4?['fast','biological']:base;
  assert.deepEqual(enemyStartingTraitIds(id,floor),ids,`${id}:${floor}`);
  assert.deepEqual(startingTraits(id,floor),ids.map(t=>({id:t,source:`enemy:${id}`})),`${id}:${floor}`);
 }
});

test('new IDs can share rules without adding identity branches or instance fields',()=>{
 ENEMY_TYPES.qa_variant={...ENEMY_TYPES.warden,tags:['boss','flying','armed'],behavior:'sniper',rounds:2};
 try{
  const e=makeEnemy('qa_variant',5,5,'qa',6),original=makeEnemy('warden',5,5,'qa',6);
  assert.equal(enemyDef(e),ENEMY_TYPES.qa_variant);assert.ok(isBossClass(e));assert.ok(hasEnemyTag(e,'flying'));
  assert.equal(unitTree(e),UNIT_TREES.sniper);assert.equal(enemyWeapon(e).rounds,2);
  assert.equal(e.hp,original.hp);assert.deepEqual(Object.keys(e),Object.keys(original));
  e.traits=[];grantNativeResistance(e);assert.deepEqual(e.traits,[{id:'suppression_resistance',source:'enemy:qa_variant'}]);
 }finally{delete ENEMY_TYPES.qa_variant;}
 assert.equal(enemyDef(null),undefined);assert.equal(hasEnemyTag(null,'boss'),false);
});

// Syntax guard for direct/reversed comparisons and inline lists; kind is intentionally separate.
const ids=Object.keys(initial).join('|'),literal=`['"](?:${ids})['"]`,identity=String.raw`(?:\btype|\b\w+(?:\?\.|\.)type)`;
const forbidden=[new RegExp(`${identity}\\s*(?:===?|!==?)\\s*${literal}`,'g'),new RegExp(`${literal}\\s*(?:===?|!==?)\\s*${identity}`,'g'),new RegExp(`\\[[^\\]\\n]*${literal}[^\\]\\n]*\\]\\s*\\.includes\\(\\s*${identity}\\s*\\)`,'g')];
const violations=source=>forbidden.flatMap(re=>[...source.matchAll(re)].map(m=>m[0]));
test('identity guard catches reintroduced names without mistaking ally kinds for enemy IDs',()=>{
 for(const source of ["e.type==='sniper'","'boss' !== actor.type","['boss','warden'].includes(e.type)","actor?.type == 'drone'"])assert.ok(violations(source).length,source);
 assert.deepEqual(violations("a.kind==='drone'; ['drone','pet'].includes(kind); hasEnemyTag(e,'boss')"),[]);
});
test('rule modules do not branch on literal enemy IDs',()=>{
 // ENEMY_DATA 3.6/3.7 were migrated by Claude in 3.77.1; nothing is deferred any more.
 const deferred=new Set();
 for(const file of readdirSync(new URL('../src/',import.meta.url)).filter(f=>f.endsWith('.js'))){
  if(deferred.has(file))continue;
  const source=readFileSync(new URL(`../src/${file}`,import.meta.url),'utf8');
  const lines=source.split('\n').filter(line=>!line.trimStart().startsWith('//')).map(line=>file==='game.js'&&line.trimStart().startsWith('if(version===1){')?'':line);
  assert.deepEqual(violations(lines.join('\n')),[],file);
 }
});
