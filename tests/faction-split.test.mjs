import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,generate,makeEnemy,ENEMY_TYPES,CALLOUT_CUES} from '../src/engine.js';
import {factionDef,rollFacilityFaction,pickFacilityFaction} from '../src/factions.js';
import {rollEnemyElite,ELITE_TUNING} from '../src/elite-enemies.js';
import {ENEMY_AFFIXES} from '../src/enemy-affixes.js';
import {UNIT_TREES,unitTree} from '../src/behavior-tree.js';
import {suppressionState} from '../src/suppression.js';
import {VOICE_LINES} from '../src/callout-ui.js';

const units=id=>new Set(Object.values(factionDef(id).roster).flat().map(([type])=>type));

test('the first split adds two pickable human factions without fodder or nests',()=>{
 for(const id of ['loyalist','rebel']){const d=factionDef(id);assert.ok(d.pickable&&d.tag,id);assert.equal(d.fodder,null);assert.equal(d.nestChild,null);assert.deepEqual(d.bosses,{3:'warden',6:'boss'});}
 assert.ok(!units('loyalist').has('bomber')&&!units('loyalist').has('bomber_bot'),'loyalists field no suicide units');
 assert.ok(units('rebel').has('bomber_bot')&&!units('rebel').has('bomber'),'rebels use the robot; the spore bomber waits for the swarm');
 const robotShare=id=>{let robots=0,all=0;for(const [type,n] of factionDef(id).roster.late){all+=n;if(ENEMY_TYPES[type].mechanical)robots+=n;}return robots/all;};
 assert.ok(robotShare('rebel')>robotShare('loyalist'));
 assert.ok([...units('rebel')].some(type=>ENEMY_TYPES[type].elite)&&![...units('loyalist')].some(type=>ENEMY_TYPES[type].elite));
 for(const id of ['loyalist','rebel'])assert.ok(units(id).has('crawler'),`${id} keeps the watch dog`);
 assert.equal(factionDef('legacy').pickable,undefined);
});

test('facilities roll by seed over pickable factions; construction without a choice keeps the legacy default',()=>{
 const counts={};for(let seed=1;seed<=200;seed++){const id=rollFacilityFaction(seed);assert.equal(rollFacilityFaction(seed),id);assert.ok(factionDef(id).pickable);counts[id]=(counts[id]||0)+1;}
 for(const id of ['loyalist','rebel'])assert.ok(counts[id]>=60,JSON.stringify(counts));
 assert.equal(new Game(7).facilityFaction,pickFacilityFaction(7,'extraction'));
 assert.equal(new Game(7,[],0,'soldier','onyx','extraction',{facilityFaction:'random'}).facilityFaction,rollFacilityFaction(7));
 const rebel=new Game(7,[],0,'soldier','onyx','extraction',{facilityFaction:'rebel'});
 assert.equal(rebel.facilityFaction,'rebel');assert.ok(rebel.enemies.every(e=>e.faction==='rebel'));
 assert.equal(Game.restore(rebel.serialize()).facilityFaction,'rebel');
});

test('human facilities generate only their own units, with no fodder or nests',()=>{
 for(const id of ['loyalist','rebel'])for(let seed=1;seed<=12;seed++)for(const floor of [1,3,6,9]){
  const d=factionDef(id),allowed=new Set([...units(id),...Object.values(d.bosses),d.scout,...d.retreatWave]),map=generate(seed,floor,[],0,id);
  assert.ok(map.enemies.every(e=>allowed.has(e.type)&&e.faction===id),`${id}:${seed}:${floor} ${map.enemies.map(e=>e.type)}`);
  assert.ok(!map.props.some(p=>p.type==='nest'),`${id}:${seed}:${floor} nest`);
 }
});

test('always-elite cards are elite from the first floor and keep the base name; base cards are not',()=>{
 for(const base of ['raider','gunner']){
  const card=`${base}_elite`;assert.equal(ENEMY_TYPES[card].elite,true);assert.equal(ENEMY_TYPES[card].name,ENEMY_TYPES[base].name,'the name must not give the elite away');
  const e=rollEnemyElite(makeEnemy(card,1,1,`qa-${card}`,1),5,1,0);assert.equal(e.elite,true,card);
  const applicable=ENEMY_AFFIXES.filter(d=>d.applies(makeEnemy(base,1,1,'probe',1))).length;
  assert.ok((e.affixes?.length||0)>=Math.min(ELITE_TUNING.minAffixes,applicable),card);
  assert.equal(rollEnemyElite(makeEnemy(base,1,1,`qa-${base}`,1),5,1,0).elite,undefined,base);
 }
});

test('the suicide robot is a mechanical bomber, and both human voices cover every cue without numbers',()=>{
 const bot=makeEnemy('bomber_bot',1,1,'qa-bot',3);
 assert.ok(bot.traits.some(t=>t.id==='mechanical'));assert.equal(unitTree(bot),UNIT_TREES.bomber);assert.equal(suppressionState(bot).immune,true);
 for(const voice of ['loyalist','rebel'])for(const cue of Object.keys(CALLOUT_CUES)){
  const lines=VOICE_LINES[voice][cue];assert.ok(lines?.length,`${voice}:${cue}`);for(const line of lines)assert.ok(!/[0-9%×]/.test(line),line);
 }
});
