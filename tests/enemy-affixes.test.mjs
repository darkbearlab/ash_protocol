import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,makeEnemy,generate,ENEMY_TYPES,ENEMY_AFFIXES,AFFIX_TUNING,affixChance,rollEnemyAffixes,giveEnemyAffix,enemyDisplayName,revealedAffixes,enemyWeapon,grenadeTelegraphs,applySuppression,finishSuppression,suppressionResistance,UNKNOWN_LOOT,scaleEnemy,validEnemyMarks} from '../src/engine.js';
import {traitLabels,grantTrait} from '../src/traits.js';
import {applyDisruption} from '../src/throwables.js';
import {archiveFloor,resumedFloor} from '../src/retreat.js';
import {captureAction} from '../src/presentation.js';
import {affixArena,sceneEnemy,affixScenes} from '../qa/enemy-affix-scenes.mjs';
const sure=g=>g.rng=Object.assign(()=>0,{state:()=>1});
test('1: births reproduce per seed/floor/ID without consuming combat RNG, including runtime spawn',()=>{
 const g=affixArena(),state=g.rng.state();g.floor=60;const a=g.spawnEnemy('raider',12,10,'birth');assert.deepEqual(a,g.spawnEnemy('raider',12,10,'birth'));assert.equal(g.rng.state(),state);
 const all=new Set(Array.from({length:30},(_,s)=>JSON.stringify(rollEnemyAffixes(makeEnemy('raider',1,1,'a'),s,60).affixes)));assert.ok(all.size>4);
});
test('2: first and later affix frequency follow independent birth stream and falling count curve',()=>{
 const counts=[0,0,0,0,0,0];for(let i=0;i<20000;i++){const e=rollEnemyAffixes(makeEnemy('raider',1,1,'trial'),i,60);counts[e.affixes.length]++;}
 const atLeast=n=>counts.slice(n).reduce((a,b)=>a+b,0)/20000;
 assert.ok(Math.abs(atLeast(1)-.5)<.02);assert.ok(Math.abs(atLeast(2)-.125)<.015);assert.ok(Math.abs(atLeast(3)-.015625)<.008);
 for(const type of ['drone','brute','crawler','bomber','boss','warden','fodder','brood'])for(let i=0;i<100;i++)assert.ok(rollEnemyAffixes(makeEnemy(type,1,1,'a'),i,60).affixes.every(a=>!['grenadier','suppressor'].includes(a.id)));
});
test('3/4: hidden names and traits reveal only on effect, catalog order and one question mark',()=>{
 const g=affixArena(),e=sceneEnemy(g,'raider',['grenadier','suppressor','fast']);assert.equal(enemyDisplayName(e),ENEMY_TYPES.raider.name+'？');assert.deepEqual(revealedAffixes(e),[]);assert.ok(!traitLabels(e).includes('快速'));
 e.charge=true;e.windup=1;e.aim={x:g.player.x,y:g.player.y};sure(g);g.enemyAct(e);assert.match(enemyDisplayName(e),/快速・壓制者？$/);assert.ok(!g.logs.some(l=>l.text.includes('擲彈')));assert.equal(revealedAffixes(e).length,2);const copy=Game.restore(g.serialize());assert.ok(copy);assert.equal(enemyDisplayName(copy.enemies[0]),enemyDisplayName(e));
});
test('5: generic/type trees preserve sniper fixed tile, boss alternating marks, bomber death and fodder cadence',()=>{
 const g=affixArena(),e=sceneEnemy(g,'sniper');sure(g);g.enemyAct(e);assert.equal(e.windup,2);g.enemyAct(e);assert.equal(e.windup,1);g.player.y++;const hp=g.player.hp;g.enemyAct(e);assert.equal(g.player.hp,hp);assert.ok(g.effects.some(f=>f.miss&&f.to.y===10));
 const b=affixArena(),boss=sceneEnemy(b,'boss');boss.attackCount=1;b.enemyAct(boss);assert.equal(b.marks[0].due,b.turn+2);
 const c=affixArena(),bomb=sceneEnemy(c,'bomber',[],11);c.hurt(bomb,1000);assert.ok(c.player.hp<100);
 const f=affixArena(),fodder=sceneEnemy(f,'fodder',[],11);f.enemyAct(fodder);const charge=fodder.charge;f.enemyAct(fodder);assert.equal(fodder.charge,charge);assert.equal(fodder.actionDelay,0);
});
test('6: grenade prepare can interrupt, pin does not cancel; flight persists after death and hits bystanders',()=>{
 for(const reason of ['disabled','displaced','target_lost']){const g=affixArena(),e=sceneEnemy(g,'raider',['grenadier']);sure(g);g.enemyAct(e);assert.ok(e.grenadeIntent);if(reason==='disabled')applyDisruption(e,'biological');if(reason==='displaced')e.y++;if(reason==='target_lost')g.sight=()=>false;g.enemyAct(e);assert.equal(e.grenadeIntent,undefined);assert.equal(g.marks.length,0);}
 const g=affixArena(),e=sceneEnemy(g,'raider',['grenadier']);sure(g);g.enemyAct(e);e.suppression=5;g.enemyAct(e);assert.equal(grenadeTelegraphs(g)[0].interruptible,false);const mark=structuredClone(g.marks[0]);g.hurt(e,1000);assert.deepEqual(g.marks[0],mark);const other=sceneEnemy(g,'crawler',[],10,11);other.control.disabled=4;g.player.x=8;g.player.y=10;const hp=g.player.hp;g.action('wait');assert.equal(g.player.hp,hp);assert.ok(other.hp<other.maxHp);assert.equal(g.marks.length,0);
});
test('7/10: resistance subtracts once after summed sources, innate rank and repeatable manual max three, machines immune',()=>{
 const g=affixArena('bulwark'),p=g.player;assert.equal(suppressionResistance(p),1);finishSuppression([p],new Set([p]),5,1);assert.equal(p.suppression,1);p.learningItems.trait_suppression_resistance=4;const turn=g.turn;assert.ok(g.action('learn','trait_suppression_resistance'));assert.ok(g.action('learn','trait_suppression_resistance'));assert.equal(suppressionResistance(p),3);assert.equal(g.action('learn','trait_suppression_resistance'),false);assert.equal(p.learningItems.trait_suppression_resistance,2);assert.equal(g.turn,turn);assert.ok(Game.restore(g.serialize()));
 for(const type of ['brute','boss','warden'])assert.equal(suppressionResistance(makeEnemy(type,1,1,'a')),1);
 const robot=makeEnemy('drone',1,1,'r');applySuppression(robot,100);assert.equal(robot.suppression,0);assert.equal(UNKNOWN_LOOT.length,27);   // 3.135.0: −night vision −infrared +goggles; 3.136.0: +5 melee weapons +carry; 3.148.0: +disruption resistance +agile
});
test('8: v37 elites migrate revealed, resistance preserves inventory and RNG; strict current schemas reject tampering',()=>{
 const scenes=affixScenes();for(const v of Object.values(scenes))assert.ok(Game.restore(v instanceof Game?v.serialize():JSON.stringify(v)));
 const old=scenes.legacy,g=Game.restore(JSON.stringify(old));assert.equal(revealedAffixes(g.enemies[0])[0].id,'fast');assert.equal(g.rng.state(),old.rngState);assert.ok(!g.enemies[0].traits.some(t=>t.source==='endless:elite'));
 for(const change of [d=>d.difficultyOffset=1.5,d=>d.enemies[0].affixes[0].id='fake',d=>d.enemies[0].affixes[0].revealed='yes',d=>d.enemies[0].traits=d.enemies[0].traits.filter(t=>!t.source.startsWith('affix:')),d=>d.player.traits.push(...Array.from({length:4},(_,i)=>({id:'suppression_resistance',source:`x:${i}`})))]){const raw=JSON.parse(scenes.hidden.serialize());change(raw.data);assert.equal(Game.restore(JSON.stringify(raw)),null);}
});
// 3.137.0 (user decision): on easy (and the classic curve) the six ordinary floors still have no affixes; standard starts
// them on floor 3 at 5% a floor.
test('9: six ordinary floors have no affixes on easy, standard starts on floor 3, depth offset controls both chance and growth',()=>{
 const easy=o=>({curve:'easy',offset:o});
 for(let f=1;f<=6;f++){assert.equal(affixChance(f,easy(0)),0);assert.ok(generate(19,f,[],easy(0)).enemies.every(e=>!e.affixes.length));}
 assert.deepEqual([1,2,3,4,6].map(f=>affixChance(f)),[0,0,.05,.1,.2]);assert.ok(generate(19,6).enemies.some(e=>e.affixes.length),'standard: affixes by floor 6');
 assert.equal(affixChance(1,easy(6)),affixChance(7,easy(0)));assert.equal(scaleEnemy(100,1,'hp',{curve:'classic',offset:6}),107);assert.equal(scaleEnemy(100,1,'hp',6),104);const low=generate(19,1),high=generate(19,1,[],6);for(let i=0;i<low.enemies.length;i++)if(!low.enemies[i].expendable)assert.equal(high.enemies[i].hp,scaleEnemy(low.enemies[i].hp,1,'hp',6));
});
test('enemy rapid fire matches +1 round/-10 accuracy and actual five-round volley suppresses player without blanket protection',()=>{
 const g=affixArena(),e=sceneEnemy(g,'raider',['suppressor']);assert.equal(enemyWeapon(e).rounds,5);assert.equal(enemyWeapon(e).accuracyBonus,-10);e.charge=true;e.windup=1;e.aim={x:g.player.x,y:g.player.y};sure(g);g.enemyAct(e);assert.equal(g.effects.filter(f=>f.type==='enemyShot').length,5);assert.equal(g.player.suppression,1);   // 3.185.0: a raider fires four
});
test('archived affixes and grenade commitment survive elapsed return; hooks consume neither RNG nor saves',()=>{
 const {flight:g}=affixScenes(),state=g.rng.state(),events=[];g.onEnemyCallout=e=>events.push(e);g.enemyCallout(g.enemies[0],'telegraph',{action:'grenade'});assert.equal(g.rng.state(),state);assert.equal(events.length,1);assert.ok(!g.serialize().includes('onEnemyCallout'));assert.doesNotThrow(()=>captureAction(g,()=>g.action('wait')));
 const {prepare:h}=affixScenes(),frame=archiveFloor(h);h.floorStates[1]=frame;h.turn+=4;const resumed=resumedFloor(frame,h.turn);assert.deepEqual(resumed.enemies,frame.enemies);assert.ok(Game.restore(JSON.stringify({version:38,data:{...JSON.parse(h.serialize()).data,floorStates:{}},rngState:h.rng.state()})));
});

test('reveal waits for an actual extra round or an actual dark accuracy check',()=>{
 const g=affixArena(),e=sceneEnemy(g,'raider',['suppressor']);e.charge=true;e.windup=1;g.player.hp=1;sure(g);g.enemyAct(e);assert.equal(e.affixes[0].revealed,false);assert.ok(!g.logs.some(l=>l.text.includes('壓制者')));
 const h=affixArena(),s=sceneEnemy(h,'sniper',['night_vision']);s.charge=true;s.windup=1;s.aim={x:h.player.x,y:h.player.y};h.lighting=h.grid.map(r=>r.map(()=>0));h.shotClear=()=>false;h.enemyAct(s);assert.equal(s.affixes[0].revealed,false);
});
