import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game.js';
import {SIZE,ENEMY_LOOT} from '../src/data.js';
import {makeEnemy,generate,reachable,key,lineOfSight} from '../src/world.js';
import {makeBarrier,edgeBlocks,validBarriers} from '../src/barriers.js';
import {grantTrait} from '../src/traits.js';
import {areaCells} from '../src/throwables.js';
import {createLighting,floorShading} from '../src/lighting.js';
import {movementBoundaries} from '../src/movement-boundaries.js';
import {targetDetails} from '../src/target-card.js';
import {Renderer} from '../src/renderer.js';
function arena(character='soldier'){
 const g=new Game(329,[],0,character,'onyx');g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.lighting=g.grid.map(r=>r.slice());
 for(const k of ['enemies','props','items','barriers','hazards','marks','rooms','traces','smoke'])g[k]=[];
 Object.assign(g.player,{x:10,y:10,hp:500,maxHp:500});g.start={x:5,y:5};g.end={x:20,y:20};g.reveal();return g;
}
const enemy=(g,x=14,y=10,type='rifleman')=>{const e=makeEnemy(type,x,y,'qa-'+g.enemies.length);e.hp=e.maxHp=500;g.enemies.push(e);return e;};
const low=(g,a={x:10,y:10},b={x:11,y:10})=>{const edge=makeBarrier('low_partition',a,b,'edge-low-'+g.barriers.length);g.barriers.push(edge);return edge;};
const zero=g=>g.rng=Object.assign(()=>0,{state:()=>1});

test('rifle loot uses 20% threshold, logs the exact weapon, and retreat enemies never drop',()=>{
 assert.equal(ENEMY_LOOT.rifleman.chance,.2);
 for(const roll of [.199,.2]){const g=arena(),e=enemy(g);g.rng=()=>roll;g.hurt(e,1000);assert.equal(g.items.filter(i=>i.type==='weapon').length,roll<.2?1:0);if(roll<.2)assert.ok(g.logs.some(l=>l.text.includes(g.weaponAt(g.items.find(i=>i.type==='weapon').slot).name)&&l.text.startsWith('戰利品')));}
 const g=arena(),e=enemy(g);zero(g);e.reinforcement=true;g.hurt(e,1000);assert.equal(g.items.length,0);
});
test('shotgun close range changes previews, real damage and affixes without changing distant profile',()=>{
 const g=arena(),p=g.player,e=enemy(g,12);p.weapon=1;p.traits=[];p.combatModifiers={rangedAccuracy:-8};e.moved=true;g.reveal();zero(g);
 assert.equal(g.accuracy(p,e).chance,90);assert.equal(g.accuracy(p,e).closeBonus,15);assert.deepEqual(g.weaponDamage(1,e),{min:60,max:72});
 g.target=e.id;assert.equal(g.action('fire'),true);assert.equal(e.hp,440);assert.equal(p.ammo[1],3);
 e.x=13;assert.equal(g.accuracy(p,e).closeBonus,0);assert.deepEqual(g.weaponDamage(1,e),{min:42,max:54});
 p.affixes[1]='powerful';p.upgrades[1]=2;p.bonus=3;e.x=12;assert.deepEqual(g.weaponDamage(1,e),{min:82,max:96});e.x=13;assert.deepEqual(g.weaponDamage(1,e),{min:61,max:75});
});
test('warning is free, through walls, radius eight, snapshot only, and does not reveal or allow fire',()=>{
 const g=arena();for(let y=0;y<SIZE;y++)g.grid[y][12]=0;g.seen=g.grid.map(r=>r.map(()=>false));const inside=enemy(g,14),outside=enemy(g,19);g.reveal();const seen=structuredClone(g.seen),rng=g.rng.state(),turn=g.turn;
 assert.equal(g.visible(inside),false);assert.equal(g.action('skill','early_warning'),true);assert.equal(g.turn,turn);assert.equal(g.rng.state(),rng);assert.deepEqual(g.seen,seen);
 assert.deepEqual(g.sensorContacts,[{x:14,y:10}]);assert.equal(inside.alert,true);assert.deepEqual(inside.lastKnown,{x:10,y:10});assert.equal(outside.alert,false);assert.equal(g.targeted,undefined);
 inside.x=15;assert.deepEqual(g.sensorContacts,[{x:14,y:10}]);assert.equal(g.action('fire'),false);assert.deepEqual(Game.restore(g.serialize()).sensorContacts,g.sensorContacts);
 g.action('prepare',{category:'item',id:null});assert.equal(g.sensorContacts.length,1);assert.equal(g.player.skillState.early_warning.cooldown,5);
 g.action('wait');assert.equal(g.sensorContacts.length,0);assert.equal(g.player.skillState.early_warning.cooldown,4);
 for(let i=0;i<4;i++)g.action('wait');assert.equal(g.action('skill','early_warning'),true);
});
test('warning floor changes clear dots while preserving paid cooldown',()=>{
 const g=arena();enemy(g);g.action('skill','early_warning');Object.assign(g.player,g.end);g.action('interact');assert.equal(g.floor,2);assert.deepEqual(g.sensorContacts,[]);assert.equal(g.player.skillState.early_warning.cooldown,4);
});
test('v21 Soldier migration grants warning, preserves resources and archived floors, rejects corrupt new state',()=>{
 const g=new Game(329,[],0,'soldier','onyx','roundtrip');Object.assign(g.player,g.exitPoint);g.descend();const old=JSON.parse(g.serialize());old.version=21;const p=old.data.player;p.skills=[];p.skillState={};p.prepared.skill=null;p.hp=27;p.reserve=7;delete p.vaultExposed;delete old.data.sensorContacts;
 for(const e of [...old.data.enemies,...old.data.floorStates[1].enemies])delete e.vaultExposed;
 const restored=Game.restore(JSON.stringify(old));assert.ok(restored);assert.equal(restored.player.hp,27);assert.equal(restored.player.reserve,7);assert.equal(restored.player.prepared.skill,'early_warning');assert.equal(restored.rng.state(),g.rng.state());assert.ok(restored.floorStates[1].enemies.every(e=>e.vaultExposed===false));
 for(const change of [d=>d.player.vaultExposed=1,d=>d.sensorContacts=[{x:10,y:10}],d=>d.sensorContacts=[{x:-1,y:0}],d=>delete d.sensorContacts]){const bad=JSON.parse(restored.serialize());change(bad.data);assert.equal(Game.restore(JSON.stringify(bad)),null);}
});
test('low rail shares geometry, permits sight shot blast, and gives low directional cover',()=>{
 const g=arena(),b=low(g),e=enemy(g,13);assert.ok(validBarriers(g.barriers,g.grid));assert.equal(g.canCross(g.player,{x:11,y:10}),false);assert.equal(g.canRoute(g.player,{x:11,y:10}),true);
 for(const channel of ['sight','shot','blast']){assert.equal(edgeBlocks(b,channel),false);assert.equal(lineOfSight(g.grid,g.player,e,g.barriers,channel),true);}
 assert.ok(areaCells(g.grid,g.player,2,g.barriers).some(p=>p.x===11&&p.y===10));assert.equal(g.accuracy(e,g.player).coverPenalty,35);assert.equal(g.accuracy(e,g.player).coverReduction,.45);
 e.x=13;e.y=13;assert.equal(g.accuracy(e,g.player).coverPenalty,18);e.y=16;assert.equal(g.accuracy(e,g.player).coverPenalty,0);
});
test('vault costs one turn, moves one tile, retains rail and exposes actor until own next action',()=>{
 const g=arena(),b=low(g);assert.ok(g.action('move',[1,0]));assert.equal(g.player.x,11);assert.equal(g.turn,2);assert.equal(b.hp,60);assert.equal(g.player.vaultExposed,true);assert.equal(g.player.moved,true);
 assert.ok(Game.restore(g.serialize()).player.vaultExposed);g.action('prepare',{category:'item',id:null});assert.equal(g.player.vaultExposed,true);g.action('move',[1,1]);assert.equal(g.player.vaultExposed,true);
 g.action('wait');assert.equal(g.player.vaultExposed,false);
});
test('vault exposure lasts one enemy opportunity for every relative initiative',()=>{
 for(const speed of ['fast','normal','slow']){const g=arena();low(g);const e=enemy(g,15);if(speed!=='normal')grantTrait(e,speed,'qa:speed');g.reveal();const observations=[];g.enemyAct=()=>observations.push(g.player.vaultExposed);
 g.action('move',[1,0]);g.action('wait');assert.deepEqual(observations,speed==='fast'?[false,true]:[true,false]);}
});
test('occupied vault landing rejects without bump melee; a fast blocker consumes the committed turn',()=>{
 const g=arena('bulwark');low(g);const e=enemy(g,11);g.reveal();assert.equal(g.action('move',[1,0]),false);assert.equal(g.turn,1);assert.equal(e.hp,500);
 e.x=13;grantTrait(e,'fast','qa:speed');g.enemyAct=actor=>actor.x=11;assert.ok(g.action('move',[1,0]));assert.equal(g.turn,2);assert.equal(g.player.x,10);assert.equal(g.player.vaultExposed,false);
});
test('enemies vault rather than opening rails, take the same ranged exposure, and cannot overlap player',()=>{
 const g=arena();const e=enemy(g,12,10,'crawler');low(g,{x:12,y:10},{x:11,y:10});g.reveal();g.action('wait');assert.equal(e.x,11);assert.equal(e.vaultExposed,true);assert.equal(g.accuracy(g.player,e).vaultBonus,20);
 const blocked=arena(),other=enemy(blocked,11,10,'crawler'),b=low(blocked);blocked.reveal();blocked.action('wait');assert.equal(other.x,11);assert.equal(blocked.player.x,10);assert.ok(b.hp<60);
});
test('destroyed rails no longer cost exposure or cover, intact rails are targetable and excluded from white caps',()=>{
 const g=arena(),b=low(g);g.reveal();g.target=b.id;assert.match(targetDetails(g).name,/矮隔板/);assert.match(targetDetails(g).state,/可翻越/);
 assert.equal(movementBoundaries(g).some(e=>e.x1===10.5&&e.x2===10.5&&e.y1===9.5),false);zero(g);g.damageProp(b,60);assert.equal(g.action('move',[1,0]),true);assert.equal(g.player.vaultExposed,false);assert.ok(!g.protectingCover(g.player,{x:8,y:10}));
});
test('generated rails preserve reachable floor cells and existing sealed rooms for twenty seeds',()=>{
 for(let seed=0;seed<20;seed++){const g=generate(seed);assert.ok(validBarriers(g.barriers,g.grid));assert.ok(g.barriers.some(b=>b.type==='low_partition'));const noRails={...g,barriers:g.barriers.filter(b=>b.type!=='low_partition')};assert.deepEqual(reachable(g,g.start),reachable(noRails,g.start));assert.ok(g.barriers.some(b=>b.type==='partition'));}
});
test('corridor lighting matches either endpoint and dark-dark corridors remain dark',()=>{
 const grid=Array.from({length:3},()=>Array(16).fill(1)),rooms=[0,4,8,12].map(x=>({x,y:0,w:2,h:3,cx:x,cy:1})),paths=[{rooms:[1,2],cells:[{x:6,y:1},{x:7,y:1}]},{rooms:[0,1],cells:[{x:2,y:1},{x:3,y:1}]}];
 for(let seed=0;seed<20;seed++){const light=createLighting(grid,rooms,{x:0,y:1},seed,1,paths);assert.equal(light[1][6],0);assert.equal(light[1][7],0);assert.equal(light[1][2],light[1][3]);assert.equal(light[1][0],1);assert.equal(light[1][4],0);}
});
test('soft shading stays inside explored tiles and hidden lighting cannot influence an edge',()=>{
 const g=arena();g.seen=g.grid.map(r=>r.map(()=>false));g.seen[10][10]=true;g.lighting[10][10]=0;g.visibleTiles=new Set(['10,10']);const bands=floorShading(g,10,10);g.lighting[10][11]=0;assert.deepEqual(floorShading(g,10,10),bands);assert.deepEqual(floorShading(g,11,10),[]);
 g.seen[10][11]=true;g.lighting[10][11]=1;assert.ok(floorShading(g,10,10).some(b=>b.w<1));assert.ok(floorShading(g,10,10).every(b=>b.x>=0&&b.y>=0&&b.x+b.w<=1&&b.y+b.h<=1));
});

test('world rendering keeps weapon markers above corpses and supplies, sensor dots above walls, without mutations',()=>{
 const g=arena();g.grid[10][13]=0;const e=enemy(g,11);e.hp=0;g.items=[{x:11,y:10,type:'weapon',slot:0},{x:11,y:10,type:'ammo'}];g.sensorContacts=[{x:14,y:10}];g.reveal();
 const stages=[],gradient={addColorStop(){}},ctx=new Proxy({globalAlpha:1,createRadialGradient(){return gradient;}},{get(o,k){return k in o?o[k]:()=>{};},set(o,k,v){o[k]=v;return true;}});
 const r=Object.create(Renderer.prototype);Object.assign(r,{ctx,game:g,tile:38,w:300,h:400,dpr:1,camera:{x:10,y:10},effects:[],reduceMotion:true,targetingEnabled:false,terrain(){return true;},wall(){stages.push('wall');},prop(){},actor(){},corpse(){stages.push('corpse');},item(a,i){stages.push(i.type);},drawBarrier(){},hazard(){},exit(){},terrainReady:true});
 r.box=(x,y,w,h,color)=>{if(color==='#ffe6a5')stages.push('sensor');};const before=g.serialize();r.draw(0);
 assert.ok(stages.indexOf('corpse')<stages.indexOf('ammo'));assert.ok(stages.indexOf('ammo')<stages.indexOf('weapon'));assert.ok(stages.lastIndexOf('wall')<stages.indexOf('sensor'));assert.equal(g.serialize(),before);
});
test('v21 first read keeps an exact QA original and current intentionally unprepared warning stays empty',async()=>{
 const memory=new Map([['ash-save','untouched']]);globalThis.location={search:'?test=1'};globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
 const storage=await import('../src/storage.js?warning329');const old=JSON.parse(arena().serialize());old.version=21;old.data.player.skills=[];old.data.player.skillState={};old.data.player.prepared.skill=null;const raw=JSON.stringify(old);memory.set('qa-ash-save',raw);
 const g=storage.loadGame();assert.ok(g);assert.equal(memory.get('qa-ash-save-v21-backup'),raw);g.action('prepare',{category:'skill',id:null});storage.saveGame(g);assert.equal(storage.loadGame().player.prepared.skill,null);assert.equal(memory.get('ash-save'),'untouched');
});
