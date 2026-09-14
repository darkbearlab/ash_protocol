import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,generate,makeEnemy,ENEMY_TYPES,CALLOUT_CUES} from '../src/engine.js';
import {factionDef} from '../src/factions.js';
import {isBossClass} from '../src/enemy-data.js';
import {PROTOCOL_REWARDS} from '../src/progression.js';
import {SUPPRESSION_TUNING} from '../src/suppression.js';
import {actorStat} from '../src/actor-stats.js';
import {nestStyle} from '../src/runtime-enemies.js';
import {calloutVoice,calloutLine,VOICE_LINES} from '../src/callout-ui.js';

// First swarm pass (3.83.0, docs/FACTION_DATA.md 16): data plus the accuracy and nest-style hooks.
const swarm=factionDef('swarm'),units=new Set(Object.values(swarm.roster).flat().map(([type])=>type));

test('the swarm is a pickable, tagged faction of creatures and infected soldiers with burrow nests and bug bosses',()=>{
 assert.ok(swarm.pickable&&swarm.tag);assert.equal(swarm.nestStyle,'burrow');assert.equal(swarm.fodder,'fodder');assert.equal(swarm.nestChild,'brood');
 assert.ok(![...units].some(type=>ENEMY_TYPES[type].mechanical),'no machines in the swarm');
 for(const boss of Object.values(swarm.bosses)){
  assert.ok(isBossClass(boss),boss);assert.equal(ENEMY_TYPES[boss].armor,0,boss);assert.ok(!ENEMY_TYPES[boss].mechanical,boss);
  assert.ok(PROTOCOL_REWARDS[boss]>0,`${boss} awards protocol points`);
 }
 assert.equal(nestStyle({x:3,y:4,id:'nest-1'},'swarm'),'burrow');
 assert.ok(['burrow','rift'].includes(nestStyle({x:3,y:4,id:'nest-1'},'legacy')));
});

test('the giant bug and the bug bosses have huge HP, no armour and large bodies',()=>{
 const bug=ENEMY_TYPES.giant_bug;assert.equal(bug.armor,0);assert.ok(bug.hp>=ENEMY_TYPES.brute.hp);assert.ok(bug.traits.includes('large'));
 assert.ok(ENEMY_TYPES.hive_matriarch.hp>ENEMY_TYPES.hive_beast.hp&&ENEMY_TYPES.hive_beast.hp>bug.hp);
});

test('infected soldiers fire more rounds with far worse aim, drop no weapons and still reach the suppression threshold',()=>{
 for(const [card,base] of [['rifleman_infected','rifleman'],['raider_infected','raider']]){
  const d=ENEMY_TYPES[card],b=ENEMY_TYPES[base];
  assert.equal(d.variantOf,base);assert.notEqual(d.name,b.name,'infected soldiers are named, so the bestiary lists them');
  assert.ok(d.rounds>b.rounds&&d.rounds>=SUPPRESSION_TUNING.weaponRounds,card);
  assert.equal(d.loot.weapon,undefined);assert.equal(d.loot.rareWeapon,undefined);
  assert.ok(actorStat(makeEnemy(card,1,1,`qa-${card}`,1,0,'swarm'),'rangedAccuracy')<=-30,card);
  assert.equal(actorStat(makeEnemy(base,1,1,'qa-base',1),'rangedAccuracy'),0,'base cards keep their aim');
 }
});

test('swarm facilities generate only their own units with burrow nests, and a swarm run survives a save round trip',()=>{
 const allowed=new Set([...units,...Object.values(swarm.bosses),swarm.scout,...swarm.retreatWave,swarm.fodder,swarm.nestChild]);
 for(let seed=1;seed<=10;seed++)for(const floor of [1,3,6,9]){
  const map=generate(seed,floor,[],0,'swarm');
  assert.ok(map.enemies.every(e=>allowed.has(e.type)&&e.faction==='swarm'),`${seed}:${floor} ${map.enemies.map(e=>e.type)}`);
  for(const nest of map.props.filter(p=>p.type==='nest'))assert.equal(nestStyle(nest,'swarm'),'burrow');
 }
 const g=new Game(9,[],0,'soldier','onyx','extraction',{facilityFaction:'swarm'});
 assert.ok(g.enemies.some(e=>e.combatModifiers?.rangedAccuracy<0),'infected soldiers are born with their aim penalty');
 const copy=Game.restore(g.serialize());assert.ok(copy);assert.equal(copy.facilityFaction,'swarm');
});

test('swarm callouts: infected soldiers mutter in their own voice, bugs and heard swarm lines are creature noises',()=>{
 const seen=enemyType=>({type:'callout',cue:'move',category:'tactical',priority:'medium',visibility:'visible',enemyType,actorId:'qa',faction:'swarm'});
 assert.equal(calloutVoice(seen('rifleman_infected')),'infected');assert.equal(calloutVoice(seen('giant_bug')),'creature');
 const heard={type:'callout',cue:'move',category:'tactical',priority:'medium',visibility:'heard',direction:'east',faction:'swarm'};
 assert.equal(calloutVoice(heard),'creature');assert.ok(calloutLine(heard).length>0);
 for(const cue of Object.keys(CALLOUT_CUES).filter(c=>!['scream','flee'].includes(c))){
  const lines=VOICE_LINES.infected[cue];assert.ok(lines?.length,cue);
  for(const line of lines)assert.ok(!/[0-9%×]/.test(line),line);
 }
});
