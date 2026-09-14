import test from 'node:test';
import assert from 'node:assert/strict';
import {SAVE_VERSION,Game,generate,makeEnemy,isNoncombatant,ENEMY_TYPES,FACTIONS,rollEnemyAffixes,rollEnemyElite,CIVILIAN_TUNING,addNoncombatants,tickCivilianCooldowns,scream,enemyKillXp} from '../src/engine.js';
import {affixArena,sceneEnemy} from '../qa/enemy-affix-scenes.mjs';
import {eligibleMissionEnemy} from '../src/map-population.js';
import {enemyRoom,expendableRoom,RUNTIME_TUNING} from '../src/runtime-enemies.js';
import {receiveCallout} from '../src/callouts.js';
import {distance,reachable,key} from '../src/world.js';
import {roomContains} from '../src/map-geometry.js';
import {makeBackup,decodeBackup} from '../src/backup.js';
import {normalizeProfile} from '../src/progression.js';
import {barrierBetween,edgeCells} from '../src/barriers.js';
const civilian=(g,x=12,y=10)=>{const e=makeEnemy('civilian',x,y,'civilian-test');g.enemies.push(e);return e;};

test('civilian card has no combat role, affixes, elite, rewards or population cost',()=>{
 const g=affixArena(),e=civilian(g);assert.equal(e.hp,12);assert.deepEqual(ENEMY_TYPES.civilian.tags,['noncombatant']);assert.equal(ENEMY_TYPES.civilian.rounds,0);
 assert.equal(enemyRoom(g),RUNTIME_TUNING.liveLimit);assert.equal(expendableRoom(g),RUNTIME_TUNING.expendableLimit);
 for(let seed=0;seed<200;seed++){const c=makeEnemy('civilian',1,1,'test',60);assert.equal(c.hp,12);rollEnemyAffixes(c,seed,60);rollEnemyElite(c,seed,60);assert.deepEqual(c.affixes,[]);assert.equal(c.elite,undefined);assert.equal(eligibleMissionEnemy(c),false);assert.equal(enemyKillXp(c),0);}
 const before={kills:g.player.kills,xp:g.player.xp,scrap:g.player.scrap,rng:g.rng.state(),items:structuredClone(g.items)};g.hurt(e,500);
 assert.deepEqual({kills:g.player.kills,xp:g.player.xp,scrap:g.player.scrap,rng:g.rng.state(),items:g.items},before);
});
test('first sight screams; cooldown lasts five paid ticks, wakes combatants through walls and repeats with current position',()=>{
 const g=affixArena(),e=civilian(g),near=sceneEnemy(g,'rifleman',[],19,10),far=sceneEnemy(g,'rifleman',[],21,10),other=civilian(g,12,11);other.id='other';
 e.screamCooldown=0;near.alert=false;far.alert=false;other.alert=false;g.effects=[];g.logs=[];
 g.sight=(a,b)=>a===e&&b===g.player;const rng=g.rng.state();g.reveal();
 assert.equal(e.alert,true);assert.equal(e.screamCooldown,5);assert.equal(near.alert,true);assert.deepEqual(near.lastKnown,{x:10,y:10});assert.equal(far.alert,false);assert.equal(other.alert,false);
 assert.equal(g.effects.filter(e=>e.cue==='scream').length,1);assert.ok(!g.effects.some(e=>e.cue==='spotted'));
 for(let i=0;i<4;i++){tickCivilianCooldowns(g);g.reveal();assert.equal(g.logs.length,1);}
 g.player.y=9;tickCivilianCooldowns(g);g.reveal();assert.equal(g.logs.length,2);assert.deepEqual(near.lastKnown,{x:10,y:9});assert.equal(g.rng.state(),rng);
});
test('flee moves strictly farther with fixed ties; unseen uses last known and cornered waits; never attacks',()=>{
 const g=affixArena(),e=civilian(g);e.alert=true;e.lastKnown={x:10,y:10};g.sight=()=>false;const hp=g.player.hp,rng=g.rng.state();
 for(let i=0;i<4;i++){const d=distance(e,e.lastKnown);g.enemyAct(e);assert.ok(distance(e,e.lastKnown)>d);}
 assert.equal(e.x,12);assert.equal(e.y,6); // up wins the stable up/right/down/left tie
 g.passable=()=>false;const pos={x:e.x,y:e.y};g.enemyAct(e);assert.deepEqual({x:e.x,y:e.y},pos);assert.equal(e.alert,true);
 assert.equal(g.player.hp,hp);assert.equal(g.rng.state(),rng);assert.equal(e.charge,false);
});
test('civilian doors use an action; suppression and disability stop movement, disability stops screams',()=>{
 const g=affixArena(),e=civilian(g);e.alert=true;e.lastKnown={x:10,y:10};g.sight=()=>false;
 g.barriers=[{id:'door',type:'door',axis:'y',x:12,y:9.5,hp:30,maxHp:30,open:false}];
 // Use an existing generated door's schema for the crossing test.
 const source=generate(1,1).barriers.find(b=>b.type==='door');g.barriers=[structuredClone(source)];const door=g.barriers[0];
 const cells=edgeCells(door);
 Object.assign(e,cells[0]);e.lastKnown={x:e.x-(cells[1].x-e.x),y:e.y-(cells[1].y-e.y)};g.passable=(x,y)=>x===cells[1].x&&y===cells[1].y;
 assert.equal(barrierBetween(g.barriers,e,cells[1]),door);g.enemyAct(e);assert.equal(door.open,true);assert.equal(distance(e,cells[0]),0);g.enemyAct(e);assert.equal(distance(e,cells[1]),0);
 e.suppression=3;g.passable=()=>true;const pos={x:e.x,y:e.y};g.enemyAct(e);assert.deepEqual({x:e.x,y:e.y},pos);
 e.suppression=0;e.control.disabled=2;g.sight=()=>true;e.screamCooldown=0;g.enemyAct(e);assert.deepEqual({x:e.x,y:e.y},pos);assert.equal(scream(g,e),false);
});
test('auto lock skips civilians but manual target and shooting/explosion remain valid; heard voice hides identity',()=>{
 const g=affixArena(),e=civilian(g);g.reveal();g.target=null;g.autoTarget();assert.equal(g.target,null);g.target=e.id;assert.equal(g.targeted,e);assert.ok(g.validateAction('fire'));
 g.teamVisible=()=>false;g.effects=[];const log=g.logs.length,event=receiveCallout(g,e,'telegraph',{action:'scream'});
 assert.equal(event.voice,'civilian');assert.equal(event.priority,'high');assert.deepEqual(Object.keys(event).sort(),['category','cue','direction','faction','priority','type','visibility','voice']);assert.equal(g.logs.length,log);
 g.turn=3;e.alert=true;g.enemyAct(e);g.turn=6;g.enemyAct(e);assert.equal(g.effects.filter(f=>f.cue==='flee').length,2);
 g.explode(e,1,100);assert.ok(e.hp<=0);assert.equal(g.player.kills,0);
});
test('post-combat population has 3–5 reachable researchers without altering combat or supplies, including floor60',()=>{
 for(let seed=1;seed<=8;seed++)for(const floor of [1,2,3,4,5,6,12,60]){
  const map=generate(seed,floor,[],0,'loyalist'),config=FACTIONS.loyalist.noncombatants;let before;
  try{delete FACTIONS.loyalist.noncombatants;before=generate(seed,floor,[],0,'loyalist');}finally{FACTIONS.loyalist.noncombatants=config;}
  const people=map.enemies.filter(isNoncombatant);assert.ok(people.length>=3&&people.length<=5,`${seed}:${floor} ${people.length}`);assert.deepEqual(map.enemies.filter(e=>!isNoncombatant(e)),before.enemies);
  const reachableTiles=reachable(map,map.start);for(const e of people){assert.ok(reachableTiles.has(key(e)));assert.ok(!roomContains(map.rooms[map.startRoom],e));assert.ok(!map.slots.some(s=>key(s)===key(e)));assert.ok(distance(e,map.end)>2);}
  const copy={...map,enemies:before.enemies,generation:map.generation.base};assert.deepEqual(copy,before);
 }
});
test('test faction and alternate noncombatant card need only data; no room means graceful zero population',()=>{
 ENEMY_TYPES.qa_staff={...ENEMY_TYPES.civilian};FACTIONS.qa_staff={...FACTIONS.rebel,noncombatants:{roster:[['qa_staff',1]],perFloor:{min:4,max:4}}};
 try{const map=generate(5,2,[],0,'qa_staff');assert.equal(map.enemies.filter(e=>e.type==='qa_staff').length,4);const empty={...map,rooms:[],enemies:[]};assert.equal(addNoncombatants(empty,1,1,'qa_staff').enemies.length,0);}finally{delete ENEMY_TYPES.qa_staff;delete FACTIONS.qa_staff;}
});
test('save42 preserves cooldown/flee and archives; migration supplies zero; malformed counters fail',()=>{
 const g=new Game(1,[],0,'soldier','onyx','roundtrip',{facilityFaction:'loyalist'}),e=g.enemies.find(isNoncombatant);e.alert=true;e.lastKnown={...g.start};e.screamCooldown=3;
 Object.assign(g.player,g.exitPoint);assert.ok(g.descend());const raw=JSON.parse(g.serialize()),copy=Game.restore(g.serialize());assert.equal(raw.version,SAVE_VERSION);assert.ok(copy);
 const saved=copy.floorStates[1].enemies.find(isNoncombatant);assert.equal(saved.screamCooldown,3);assert.equal(saved.alert,true);assert.deepEqual(saved.lastKnown,g.floorStates[1].start);
 assert.ok(decodeBackup(JSON.stringify(makeBackup(g,normalizeProfile(),'qa')),'qa').game);
 raw.version=41;for(const x of raw.data.enemies)if(isNoncombatant(x))delete x.screamCooldown;assert.ok(Game.restore(JSON.stringify(raw)));
 for(const val of [-1,1.5,'3',null]){const raw=JSON.parse(g.serialize());raw.data.floorStates[1].enemies.find(isNoncombatant).screamCooldown=val;assert.equal(Game.restore(JSON.stringify(raw)),null);}
});
