import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game.js';
import {SIZE,SAVE_VERSION} from '../src/data.js';
import {clearGeneratedMap} from './helpers/arena.mjs';
import {allyAct,swapWithPlayer,departAllies,arriveAllies,PET_TETHER} from '../src/allies.js';
import {fitPet,petRank,petNodes,petFeedingState,petReactions,petDefense,petFuelCost,petScanContacts,petVisionActive,PET_FEEDING_TUNING as T} from '../src/pet-growth.js';
import {makeEnemy,distance} from '../src/world.js';
import {applyDisruption,skipDisabled,SMOKE_DURATION} from '../src/throwables.js';
import {grantTrait,activeTrait,removeTraitSource} from '../src/traits.js';
import {actorStat} from '../src/actor-stats.js';
import {SKILLS} from '../src/skills.js';
import {archiveFloor,resumedFloor} from '../src/retreat.js';
import {makeBackup,decodeBackup} from '../src/backup.js';
import {normalizeProfile} from '../src/progression.js';
function arena(){const g=new Game(330,[],0,'druid','onyx');g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.lighting=g.grid.map(r=>r.slice());g.seen=g.grid.map(r=>r.map(()=>true));for(const k of ['enemies','props','items','barriers','hazards','marks','rooms','traces','smoke'])g[k]=[];clearGeneratedMap(g);Object.assign(g.player,{x:10,y:10});Object.assign(g.allies[0],{x:11,y:10});g.start={x:5,y:5};g.end={x:20,y:20};g.reveal();return g;}
function unlock(g,line,rank){const b=g.player.petBond;b.growth[line]=rank?T.thresholds[line][rank-1]:0;if(line==='extrusion')b.fedThrowables.frag=b.growth[line];fitPet(g,g.allies[0]);}
function foe(g,x=13,y=10,type='rifleman'){const e=makeEnemy(type,x,y,'node-foe-'+g.enemies.length,g.floor);g.enemies.push(e);return e;}
const sure=g=>g.rng=Object.assign(()=>0,{state:()=>1});

test('24 discrete nodes: first normal or partial portion unlocks, rank only changes on thresholds, six caps reject',()=>{
 const feeds={vitality:{optionId:'life'},armor:{optionId:'plates'},turret:{optionId:'weapon',weaponSlot:1},extrusion:{optionId:'grenade:frag'}};
 for(const line of Object.keys(T.thresholds)){const g=arena();g.player.plates=1;assert.ok(g.action('feedPet',feeds[line]));assert.equal(petRank(g.player,line),1,line);const b=g.player.petBond;for(const [i,n] of T.thresholds[line].entries()){b.growth[line]=n-1;assert.equal(petRank(g.player,line),i);b.growth[line]=n;assert.equal(petRank(g.player,line),i+1);}fitPet(g,g.allies[0]);const turn=g.turn;assert.equal(g.action('feedPet',feeds[line]),false);assert.equal(g.turn,turn);const nodes=petNodes(g.player,line);assert.equal(nodes.length,6);assert.deepEqual(nodes.map(n=>n.major),[false,true,false,true,false,true]);assert.ok(nodes.every(n=>n.unlocked));}
 assert.ok(T.thresholds.vitality[5]>=690);assert.ok(T.thresholds.armor[5]>=174);assert.ok(T.thresholds.armor[3]>174/2);
});
test('steadfast starts only after a stationary own action; movement and player swaps remove it immediately',()=>{
 const g=arena(),a=g.allies[0],b=g.player.petBond;unlock(g,'armor',2);assert.equal(petDefense(g,a,100),100);g.turn=2;allyAct(g,a);assert.equal(b.steadfast,true);assert.equal(petDefense(g,a,100),80);g.action('commandPet',{x:12,y:10});g.action('wait');assert.equal(a.x,12);assert.equal(b.steadfast,false);g.action('wait');assert.equal(b.steadfast,true);swapWithPlayer(g,a);assert.equal(b.steadfast,false);
});
test('armor direct reduction stacks multiplicatively with steadfast, but neither applies to environmental damage',()=>{
 const g=arena(),a=g.allies[0];unlock(g,'armor',5);g.player.petBond.steadfast=true;assert.equal(petDefense(g,a,100),64);a.hp=90;g.damageAlly(a,24,null,true);assert.equal(a.hp,77);a.hp=90;g.damageAlly(a,24,null,true,true);assert.equal(a.hp,70);assert.ok(activeTrait(a,'disruption_resistant'));
});
test('armor node 5 halves disruption to exactly two own opportunities; other actors still lose four',()=>{
 const g=arena(),a=g.allies[0];unlock(g,'armor',5);assert.ok(applyDisruption(a,'biological'));assert.equal(a.control.disabled,2);assert.ok(skipDisabled(a));assert.equal(a.control.disabled,1);assert.ok(skipDisabled(a));assert.equal(a.control.disabled,0);assert.equal(skipDisabled(a),false);const e=foe(g);applyDisruption(e,'biological');assert.equal(e.control.disabled,4);
});
test('lifesteal heals actual non-overkill damage only and never revives a pet killed by its victim explosion',()=>{
 const g=arena(),a=g.allies[0];unlock(g,'vitality',6);a.hp=20;const e=foe(g);e.hp=10;g.hitTarget(e,999,a,0,{melee:true});assert.equal(a.hp,21);const e2=foe(g,12);e2.hp=100;g.hitTarget(e2,20,a,0,{melee:true});assert.equal(a.hp,24);
 const h=arena(),pet=h.allies[0];unlock(h,'vitality',6);pet.hp=1;h.player.petBond.tenacityUsedFloors=[1];const bomber=foe(h,12,10,'bomber');bomber.hp=1;h.hitTarget(bomber,999,pet,0,{melee:true});assert.equal(pet.status,'reforming');assert.equal(pet.hp,0);
});
test('vitality node 5 changes only future rebirths: six full paid turns and forty percent health',()=>{
 const g=arena(),a=g.allies[0];unlock(g,'vitality',5);g.player.petBond.tenacityUsedFloors=[1];g.damageAlly(a,999);assert.equal(g.player.petBond.reviveRemaining,6);for(let i=0;i<5;i++)g.action('wait');assert.equal(a.status,'reforming');g.action('wait');assert.equal(a.hp,60);assert.equal(a.status,'active');assert.equal(distance(a,g.player),1);
});
test('suppression affects shooting and melee for the next own opportunity only, including charge and disabled skips',()=>{
 for(const speed of ['fast','slow']){const g=arena(),a=g.allies[0],e=foe(g);unlock(g,'turret',2);grantTrait(e,speed,'qa');e.hp=200;g.hitTarget(e,1,a,0,{melee:false});assert.equal(e.petSuppressed,15);assert.equal(actorStat(e,'rangedAccuracy'),-15);assert.equal(actorStat(e,'meleeAccuracy'),-15);e.alert=true;g.enemyAct(e);assert.equal(e.petSuppressed,undefined);}
 const g=arena(),a=g.allies[0],e=foe(g);unlock(g,'turret',2);g.hitTarget(e,1,a,0,{melee:true});e.control.disabled=1;e.alert=true;a.order={x:11,y:10};g.enemies[0].x=20;g.action('wait');assert.equal(e.petSuppressed,undefined);assert.equal(e.control.disabled,0);
});
test('suppression applied after a fast enemy acted remains across save and floor archive until its next opportunity',()=>{
 const g=arena(),a=g.allies[0],e=foe(g);unlock(g,'turret',2);grantTrait(e,'fast','qa');e.alert=true;g.enemyAct(e);g.hitTarget(e,1,a,0,{melee:false});assert.equal(e.petSuppressed,15);assert.ok(Game.restore(g.serialize()));const frame=archiveFloor(g),returned=resumedFloor(frame,g.turn+20);assert.equal(returned.enemies[0].petSuppressed,15);const raw=JSON.parse(g.serialize());raw.data.enemies[0].petSuppressed=-1;assert.equal(Game.restore(JSON.stringify(raw)),null);
});
test('precision ignores half cover accuracy and damage, but full cover, darkness and blocked rays stay intact',()=>{
 const g=arena(),a=g.allies[0],e=foe(g,13,12);Object.assign(a,{x:11,y:10});g.props=[{id:'test-cover',type:'cover',x:12,y:12,hp:100,maxHp:100}];g.player.petBond.fuel=500;unlock(g,'turret',3);const before=g.accuracy(a,e);assert.equal(before.coverEfficiency,.5);unlock(g,'turret',4);assert.equal(g.accuracy(a,e).coverPenalty,0);e.hp=100;g.hitTarget(e,20,a,0,{melee:false});assert.equal(e.hp,80);a.y=12;assert.equal(g.accuracy(a,e).coverEfficiency,1);g.lighting[e.y][e.x]=0;assert.equal(g.accuracy(a,e).darkPenalty,40);
});
test('shared vision uses only its own sources and disappears immediately on tether loss, death or floor transition',()=>{
 const g=arena(),a=g.allies[0];grantTrait(g.player,'night_vision','qa:innate');unlock(g,'armor',6);assert.ok(petVisionActive(g));assert.ok(activeTrait(g.player,'infrared'));assert.ok(activeTrait(a,'infrared'));assert.ok(Game.restore(g.serialize()));a.x=g.player.x+PET_TETHER+1;g.reveal();assert.equal(activeTrait(g.player,'infrared'),false);assert.ok(activeTrait(g.player,'night_vision'));a.x=11;g.reveal();g.damageAlly(a,999);assert.equal(activeTrait(g.player,'infrared'),false);assert.ok(activeTrait(g.player,'night_vision'));assert.ok(!activeTrait(a,'infrared'));assert.ok(Game.restore(g.serialize()));
});
test('scan is silent, radius 4, six paid turns, immutable one-turn positions and no sight/ray/seen grants',()=>{
 const g=arena(),a=g.allies[0];unlock(g,'armor',4);for(let y=0;y<SIZE;y++)g.grid[y][12]=0;g.seen=g.grid.map(r=>r.map(()=>false));const e=foe(g,14);e.alert=false;g.enemyAct=()=>{};assert.ok(T.scanRadius<SKILLS.early_warning.radius);assert.equal(g.sight(a,e),false);const rng=g.rng.state();g.action('commandPet',{x:11,y:10});for(let i=0;i<5;i++)g.action('wait');assert.deepEqual(petScanContacts(g),[]);g.action('wait');assert.deepEqual(petScanContacts(g),[{x:14,y:10}]);assert.equal(e.alert,false);assert.equal(e.lastKnown,null);assert.equal(g.seen[10][14],false);assert.equal(g.sight(a,e),false);assert.equal(g.shotClear(a,e),false);assert.equal(g.rng.state(),rng);e.x=15;assert.deepEqual(petScanContacts(g),[{x:14,y:10}]);assert.ok(Game.restore(g.serialize()));g.action('prepare',{category:'skill',id:null});assert.equal(petScanContacts(g).length,1);g.action('wait');assert.deepEqual(petScanContacts(g),[]);
});
test('critical smoke is once per actual floor, costs no fuel or item, and lethal damage cannot trigger it',()=>{
 const g=arena(),a=g.allies[0],b=g.player.petBond;unlock(g,'extrusion',4);b.fuel=432;const items=g.items.length;g.damageAlly(a,70);assert.equal(g.smoke.length,1);assert.equal(g.smoke[0].expires,g.turn+SMOKE_DURATION-1);assert.deepEqual(b.criticalUsedFloors,[1]);assert.equal(b.fuel,432);assert.equal(g.items.length,items);petReactions(g);assert.equal(g.smoke.length,1);assert.ok(Game.restore(g.serialize()));g.floor=2;const ids=departAllies(g);arriveAllies(g,ids);petReactions(g);assert.deepEqual(b.criticalUsedFloors,[1,2]);g.floor=1;arriveAllies(g,ids);petReactions(g);assert.equal(b.criticalUsedFloors.length,2);
 const h=arena();unlock(h,'extrusion',6);h.damageAlly(h.allies[0],999);assert.equal(h.smoke.length,0);assert.deepEqual(h.player.petBond.criticalUsedFloors,[]);assert.deepEqual(h.player.petBond.guardianUsedFloors,[]);
});
test('guardian smoke retries without spending its quota when out of range or blocked, then fires at player, separately from critical',()=>{
 const g=arena(),a=g.allies[0],b=g.player.petBond;unlock(g,'extrusion',6);g.player.hp=20;a.x=16;petReactions(g);assert.deepEqual(b.guardianUsedFloors,[]);a.x=14;g.grid[10][12]=0;g.grid[9][12]=0;g.grid[11][12]=0;petReactions(g);assert.deepEqual(b.guardianUsedFloors,[]);a.x=11;petReactions(g);assert.deepEqual(b.guardianUsedFloors,[1]);assert.equal(g.effects.find(e=>e.type==='shot').to.x,g.player.x);assert.equal(b.fuel,0);assert.equal(g.items.length,0);assert.deepEqual(b.criticalUsedFloors,[]);g.damageAlly(a,70);assert.deepEqual(b.criticalUsedFloors,[1]);assert.equal(g.smoke.length,2);
});
test('v35 migration preserves all investment and spent tenacity while recalculating weaker stats; v36 backups retain new fields',()=>{
 const g=arena(),raw=JSON.parse(g.serialize());raw.version=35;const b=raw.data.player.petBond,a=raw.data.allies[0];Object.assign(b,{growth:{vitality:90,armor:50,turret:120,extrusion:6},fedThrowables:{frag:6,smoke:0,emp:0,stun:0},outputChoice:'emp',outputRemaining:8,tenacityUsedFloors:[1]});Object.assign(a,{maxHp:150,hp:140,armor:4,traits:a.traits.filter(t=>t.id!=='no_cover')});for(const k of ['criticalUsedFloors','guardianUsedFloors','steadfast','scanRemaining','scanTurn','scanContacts'])delete b[k];const h=Game.restore(JSON.stringify(raw));assert.ok(h);assert.deepEqual(h.player.petBond.growth,b.growth);assert.deepEqual(h.player.petBond.tenacityUsedFloors,[1]);assert.equal(petRank(h.player,'vitality'),3);assert.equal(h.allies[0].hp,140);assert.equal(h.player.petBond.outputChoice,'emp');assert.equal(SAVE_VERSION,36);assert.deepEqual(decodeBackup(JSON.stringify(makeBackup(h,normalizeProfile(),'qa')),'qa').game.player.petBond,h.player.petBond);
 raw.data.player.petBond.growth.vitality=20;raw.data.allies[0].hp=140;const weak=Game.restore(JSON.stringify(raw));assert.equal(weak,null,'old spent tenacity is invalid below old tier 3');raw.data.player.petBond.tenacityUsedFloors=[];const weak2=Game.restore(JSON.stringify(raw));assert.ok(weak2);assert.equal(weak2.allies[0].maxHp,110);assert.equal(weak2.allies[0].hp,110);
});
test('v36 rejects missing counters, invalid floors, forged linked vision and malformed scan points',()=>{
 const g=arena();for(const mutate of [d=>delete d.player.petBond.criticalUsedFloors,d=>d.player.petBond.guardianUsedFloors=[1,1],d=>d.player.petBond.scanRemaining=7,d=>d.player.petBond.scanTurn=2,d=>d.player.petBond.scanContacts=[{x:999,y:0}],d=>d.player.petBond.steadfast='yes',d=>d.player.traits.push({id:'infrared',source:'pet:vision'})]){const raw=JSON.parse(g.serialize());mutate(raw.data);assert.equal(Game.restore(JSON.stringify(raw)),null);}
});
