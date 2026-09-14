import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {Game,generate,FACTIONS,DEFAULT_FACTION,factionDef,factionPool,factionBoss,pickFacilityFaction,enemyFaction,factionOverride,enemyBaseName,ENEMY_TYPES,ENEMY_SPAWNS,ALLY_BASE_TYPES,isBossClass,FLOOR_INFO} from '../src/engine.js';
import {ENDLESS_TUNING} from '../src/endless.js';
import {ENEMY_AFFIXES,affixPickIndex,rollEnemyAffixes,enemyDisplayName} from '../src/enemy-affixes.js';
import {makeEnemy} from '../src/world.js';
import {makeBackup,decodeBackup} from '../src/backup.js';
import {normalizeProfile} from '../src/progression.js';
import {affixArena,sceneEnemy} from '../qa/enemy-affix-scenes.mjs';
import {receiveCallout} from '../src/callouts.js';

test('faction catalog validates references and covers every current enemy card',()=>{
 const used=new Set(Object.values(ALLY_BASE_TYPES));
 assert.deepEqual(Object.keys(FACTIONS),['legacy','loyalist','rebel']);
 for(const d of Object.values(FACTIONS)){
  for(const entries of Object.values(d.roster))for(const [id,n] of entries){assert.ok(ENEMY_TYPES[id]);assert.ok(Number.isInteger(n)&&n>0);used.add(id);}
  for(const id of Object.values(d.bosses)){assert.ok(isBossClass(id));used.add(id);}
  for(const id of [d.scout,...d.retreatWave,d.fodder,d.nestChild].filter(id=>id!==null)){assert.ok(ENEMY_TYPES[id]);used.add(id);}
  for(const [id,n] of Object.entries(d.affixWeights||{}))assert.ok(ENEMY_AFFIXES.some(a=>a.id===id)&&Number.isFinite(n)&&n>0);
  for(const id of Object.keys(d.overrides||{}))assert.ok(ENEMY_TYPES[id]);
 }
 for(const d of Object.values(ENEMY_TYPES))if(d.reinforcement)used.add(d.reinforcement);
 assert.deepEqual([...used].sort(),Object.keys(ENEMY_TYPES).sort());
});
test('legacy roster order, duplicate weights and compatibility views match the old tables',()=>{
 const early=['rifleman','rifleman','raider','gunner','drone','crawler'],late=['rifleman','rifleman','raider','raider','gunner','drone','brute','sniper','bomber'],deep=['brute','sniper','bomber'];
 for(let floor=1;floor<=12;floor++)assert.deepEqual(factionPool(DEFAULT_FACTION,floor),[...(floor<=2?early:late),...(floor>6?deep:[])]);
 assert.deepEqual(ENEMY_SPAWNS,{legacyEarly:early,legacyLate:late,scout:'rifleman',retreatWave:['rifleman','raider'],runtimeFodder:'fodder',nestChild:'brood'});
 assert.deepEqual(ENDLESS_TUNING.heavyExtra,deep);assert.equal(FLOOR_INFO[2].boss,factionBoss(DEFAULT_FACTION,3));assert.equal(FLOOR_INFO[5].boss,factionBoss(DEFAULT_FACTION,6));
 const pool=factionPool(DEFAULT_FACTION,1);pool.reverse();assert.deepEqual(factionPool(DEFAULT_FACTION,1),early);
});
test('facility and born factions persist, old saves migrate, unknown IDs reject and backups restore',()=>{
 const g=new Game(52);assert.equal(g.facilityFaction,DEFAULT_FACTION);assert.ok(g.enemies.every(e=>e.faction===DEFAULT_FACTION));
 assert.equal(pickFacilityFaction(0,'endless'),DEFAULT_FACTION);
 g.floor=3;g.loadFloor();assert.equal(g.facilityFaction,DEFAULT_FACTION);assert.ok(g.enemies.every(e=>e.faction===DEFAULT_FACTION));assert.equal(g.spawnEnemy('drone',5,5,'qa').faction,DEFAULT_FACTION);
 const raw=JSON.parse(g.serialize());raw.version=39;delete raw.data.facilityFaction;for(const e of raw.data.enemies)delete e.faction;
 const h=Game.restore(JSON.stringify(raw));assert.ok(h);assert.ok(h.enemies.every(e=>e.faction===DEFAULT_FACTION));assert.equal(h.facilityFaction,DEFAULT_FACTION);
 assert.equal(decodeBackup(JSON.stringify(makeBackup(h,normalizeProfile(),'qa')),'qa').game.facilityFaction,DEFAULT_FACTION);
 const bad=JSON.parse(g.serialize());bad.data.enemies[0].faction='invalid';assert.equal(Game.restore(JSON.stringify(bad)),null);bad.data.enemies[0].faction=DEFAULT_FACTION;bad.data.facilityFaction='invalid';assert.equal(Game.restore(JSON.stringify(bad)),null);
});
test('another catalog entry flows through generation, runtime births and name overrides without hard-coded identity',()=>{
 FACTIONS.qa_test={...structuredClone(FACTIONS[DEFAULT_FACTION]),overrides:{rifleman:{name:'QA',role:'qa',tint:'#fff',voice:'qa'}}};
 try{
  const map=generate(12,3,[],0,'qa_test');assert.ok(map.enemies.length);assert.ok(map.enemies.every(e=>e.faction==='qa_test'));
  const g=new Game(2);g.facilityFaction='qa_test';assert.equal(g.spawnEnemy('rifleman',5,5,'qa').faction,'qa_test');
  const e=makeEnemy('rifleman',5,5,'qa',1,0,'qa_test');assert.equal(enemyFaction(e),'qa_test');assert.equal(factionOverride(e).name,'QA');assert.equal(enemyBaseName(e),'QA');assert.equal(enemyDisplayName(e),'QA');
 }finally{delete FACTIONS.qa_test;}
});
test('optional affix weights preserve uniform draws and use one weighted draw per pick',()=>{
 const pool=ENEMY_AFFIXES,ones=Object.fromEntries(pool.map(d=>[d.id,1]));
 for(const draw of [0,.1,.3,.5,.8,.999]){assert.equal(affixPickIndex(pool,draw),Math.floor(draw*pool.length));assert.equal(affixPickIndex(pool,draw,ones),affixPickIndex(pool,draw));}
 assert.equal(affixPickIndex(pool,.5,{fast:100}),0);
 FACTIONS.qa_test={...FACTIONS[DEFAULT_FACTION],affixWeights:ones};
 try{for(let seed=1;seed<=100;seed++){const a=makeEnemy('raider',1,1,'qa',15),b={...structuredClone(a),faction:'qa_test'};rollEnemyAffixes(a,seed,15);rollEnemyAffixes(b,seed,15);assert.deepEqual(a.affixes,b.affixes);assert.deepEqual(a.traits,b.traits);}}finally{delete FACTIONS.qa_test;}
});
test('visible and hidden callouts carry faction without exposing hidden identity',()=>{
 const g=affixArena(),e=sceneEnemy(g);for(const visible of [true,false]){g.teamVisible=()=>visible;const event=receiveCallout(g,e,'telegraph',{action:'aim'});assert.equal(event.faction,DEFAULT_FACTION);if(!visible){assert.equal(event.actorId,undefined);assert.equal(event.enemyType,undefined);assert.equal(event.position,undefined);}}
});
test('rules never branch on literal faction identities',()=>{
 for(const file of readdirSync(new URL('../src/',import.meta.url)).filter(f=>f.endsWith('.js')&&f!=='faction-catalog.js')){
  const s=readFileSync(new URL(`../src/${file}`,import.meta.url),'utf8');
  assert.doesNotMatch(s,/(?:faction|facilityFaction)\s*[!=]==?\s*['"]legacy['"]|['"]legacy['"]\s*[!=]==?\s*\w*\.?faction/,file);
 }
});
