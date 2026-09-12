import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game.js';
import {generate,generateWithRecipes,generateLegacy,makeEnemy,key,generationSafe} from '../src/world.js';
import {eligibleMissionEnemy} from '../src/map-population.js';
import {validMapMetadata} from '../src/map-geometry.js';
import {RUNTIME_TUNING,tickNests,enemyRoom,validRuntime} from '../src/runtime-enemies.js';
import {UNARMED_SLOT} from '../src/unarmed.js';
import {grantTrait} from '../src/traits.js';
import {clearGeneratedMap} from './helpers/arena.mjs';
import {archiveFloor,resumedFloor,resolveRetreatWave} from '../src/retreat.js';
import {allSupplies} from '../src/containers.js';
import {makeBackup,decodeBackup} from '../src/backup.js';
import {normalizeProfile} from '../src/progression.js';
function arena(character='soldier',Type=Game){
 const g=new Type(3,[],0,character);clearGeneratedMap(g);g.grid=Array.from({length:27},()=>Array(27).fill(1));g.lighting=g.grid.map(r=>r.slice());g.seen=g.grid.map(r=>r.map(()=>true));
 for(const k of ['props','barriers','items','hazards','marks','smoke','traces','rooms','enemies','allies'])g[k]=[];
 Object.assign(g.player,{x:10,y:10});g.start={x:5,y:5};g.end={x:20,y:20};g.rng=Object.assign(()=>.1,{state:()=>5});g.reveal();return g;
}
function enemy(g,type,x=11,y=10){const e=makeEnemy(type,x,y,`qa-${g.enemies.length}`,g.floor);g.enemies.push(e);g.target=e.id;g.reveal();return e;}
function nest(g){const p={id:`nest-${g.floor}-0`,type:'nest',x:13,y:10,hp:45,maxHp:45,nest:{active:false,total:6,interval:2,remaining:6,cooldown:0,serial:0}};g.props.push(p);return p;}
test('virtual unarmed bump uses no slot/ammo and excludes weapon damage bonuses and melee class multipliers',()=>{
 const g=arena();assert.equal(g.bumpMeleeSlot(),UNARMED_SLOT);const e=enemy(g,'rifleman');e.hp=200;g.player.bonus=100;g.player.perkWeaponBonus=60;grantTrait(g.player,'blade_stash','qa');grantTrait(g.player,'ambush','qa');grantTrait(g.player,'bloodlust','qa');g.player.hp=40;
 const before=structuredClone({owned:g.player.owned,ammo:g.player.ammo,weapon:g.player.weapon}),turn=g.turn;
 assert.ok(g.action('move',[1,0]));assert.equal(g.turn,turn+1);assert.equal(g.player.x,10);assert.equal(e.hp,192);assert.equal(g.player.hp,40);assert.deepEqual({owned:g.player.owned,ammo:g.player.ammo,weapon:g.player.weapon},before);
 for(const id of ['bulwark','berserker','ninja'])assert.notEqual(arena(id).bumpMeleeSlot(),UNARMED_SLOT);
});
test('first expendable kill costs full turn, next arbitrary attack is free; invalid fire preserves credit',()=>{
 class Counting extends Game{enemyAct(e){e.qaActs=(e.qaActs||0)+1;}}
 const g=arena('soldier',Counting),first=enemy(g,'fodder',12),other=enemy(g,'rifleman',14);other.hp=1;other.alert=true;grantTrait(other,'fast','qa');g.target=first.id;
 const turn=g.turn,xp=g.player.xp,scrap=g.player.scrap;assert.ok(g.action('fire'));assert.equal(g.turn,turn+1);assert.equal(other.qaActs,1);assert.equal(g.pursuit,1);assert.equal(g.player.xp,xp);assert.equal(g.player.scrap,scrap);assert.equal(g.items.length,0);
 g.target=other.id;const ammo=g.player.ammo[0];g.player.ammo[0]=0;assert.equal(g.action('fire'),false);assert.equal(g.pursuit,1);g.player.ammo[0]=ammo;
 assert.ok(g.action('fire'));assert.equal(g.turn,turn+1);assert.equal(other.qaActs,1);assert.equal(g.pursuit,0);assert.ok(g.player.xp>xp);
});
test('pursuit chains, multi-kill gives one credit, and environment/ally damage never earns it',()=>{
 const g=arena();enemy(g,'fodder');assert.ok(g.action('move',[1,0]));assert.equal(g.pursuit,1);const turn=g.turn;enemy(g,'fodder',10,11);assert.ok(g.action('move',[0,1]));assert.equal(g.turn,turn);assert.equal(g.pursuit,1);
 g.player.grenades=1;g.player.prepared.grenade='frag';enemy(g,'fodder',14,10);enemy(g,'fodder',14,11);assert.ok(g.action('grenade',{x:14,y:10}));assert.equal(g.turn,turn);assert.equal(g.pursuit,1);
 assert.ok(g.action('wait'));assert.equal(g.pursuit,0);assert.equal(g.turn,turn+1);
 const e=enemy(g,'fodder',16,10);g.hitTarget(e,100,{kind:'pet'},0,{melee:true,ammoType:null});g.finishPursuit();assert.equal(g.pursuit,0);
 const f=enemy(g,'fodder',17,10);g.explode(f,1,30);g.finishPursuit();assert.equal(g.pursuit,0);
});
test('pursuit does not tick smoke, traits, disabled enemies or nest timers; shadow/disable clear credit',()=>{
 const g=arena('recon');g.pursuit=1;g.smoke=[{cells:[{x:10,y:10}],expires:g.turn+4}];grantTrait(g.player,'fast','qa',3);const n=nest(g);n.nest.active=true;n.nest.cooldown=2;const e=enemy(g,'rifleman',12);e.control.disabled=3;
 const before=structuredClone([g.smoke,g.player.traits,n.nest,e.control]);assert.ok(g.action('fire'));assert.deepEqual([g.smoke,g.player.traits,n.nest,e.control],before);
 g.pursuit=1;g.player.control.disabled=1;assert.ok(g.action('wait'));assert.equal(g.pursuit,0);
 const ninja=arena('ninja');ninja.player.perks.ninja_shadowstep=1;ninja.pursuit=1;const target=enemy(ninja,'fodder');target.control.disabled=2;assert.ok(ninja.action('move',[1,0]));assert.ok(ninja.shadowSteps>0);assert.equal(ninja.pursuit,0);
});
test('nests latch, respect paid interval, retry blocked cells and stop after destruction or finite quota',()=>{
 const g=arena(),n=nest(g);g.player.x=1;tickNests(g);assert.equal(n.nest.active,false);g.player.x=10;tickNests(g);assert.equal(n.nest.serial,1);assert.equal(g.enemies[0].type,'brood');assert.equal(g.enemies[0].hp,6);
 g.player.x=1;tickNests(g);assert.equal(n.nest.serial,1);g.enemies[0].hp=0;tickNests(g);assert.equal(n.nest.serial,2);
 for(let i=0;i<30;i++){for(const e of g.enemies)e.hp=0;tickNests(g);}assert.equal(n.nest.serial,6);assert.equal(n.nest.remaining,0);assert.ok(validRuntime(g));
 const b=arena(),blocked=nest(b);for(const [dx,dy]of [[0,-1],[1,0],[0,1],[-1,0]])b.props.push({type:'cover',x:13+dx,y:10+dy,hp:10});tickNests(b);assert.equal(blocked.nest.remaining,6);assert.ok(blocked.nest.active);b.props=b.props.slice(0,1);tickNests(b);assert.equal(blocked.nest.remaining,5);b.damageProp(blocked,100);for(let i=0;i<5;i++)tickNests(b);assert.equal(blocked.nest.remaining,5);
});
test('all runtime spawn sources count the same live limit; deferred retreat retains original rewards',()=>{
 const g=arena(),n=nest(g);for(let i=0;i<RUNTIME_TUNING.liveLimit;i++)enemy(g,'rifleman',1+i%8,1+Math.floor(i/8));assert.equal(enemyRoom(g),0);tickNests(g);assert.equal(n.nest.serial,0);
 g.reinforcements=[{id:'retreat-1-0',type:'rifleman',x:20,y:20,due:g.turn}];resolveRetreatWave(g);assert.equal(g.reinforcements.length,1);
 const boss=enemy(g,'boss',18,18);boss.hp=1;boss.alert=true;g.enemyAct(boss);assert.ok(!boss.reinforced);
 for(const e of g.enemies)e.hp=0;g.turn++;resolveRetreatWave(g);assert.equal(g.reinforcements.length,0);const wave=g.enemies.at(-1);assert.ok(wave.reinforcement);assert.ok(!wave.expendable);const xp=g.player.xp,scrap=g.player.scrap;g.hurt(wave,1000);assert.equal(g.player.xp,xp+1);assert.equal(g.player.scrap,scrap+3);assert.equal(g.items.length,0);
});
test('runtime generation is deterministic, conserves normal enemies/supplies, excludes objectives and preserves v1',()=>{
 for(const seed of [1,2,3])for(const floor of Array.from({length:60},(_,i)=>i+1)){
  const g=generate(seed,floor),old=generateWithRecipes(seed,floor);assert.deepEqual(g,generate(seed,floor));assert.ok(generationSafe(g));assert.ok(validMapMetadata(g));assert.deepEqual(g.enemies.filter(e=>!e.expendable),old.enemies);assert.deepEqual(allSupplies(g),allSupplies(old));assert.ok(g.enemies.filter(e=>e.hp>0).length<=RUNTIME_TUNING.liveLimit);assert.ok(g.enemies.filter(e=>e.expendable).every(e=>!eligibleMissionEnemy(e)));assert.equal(new Set(g.enemies.map(key)).size,g.enemies.length);
 }
 assert.deepEqual(generateWithRecipes(1,2,[],[]),generateLegacy(1,2));
});
test('pursuit and nest state survive saves/archives, old v32 credit defaults to zero, malformed state rejected',()=>{
 const g=new Game(1,[],0,'soldier');g.floor=2;g.loadFloor();const n=g.props.find(p=>p.type==='nest');assert.ok(n);Object.assign(g.player,{x:n.x-2,y:n.y});tickNests(g);g.pursuit=1;
 const restored=Game.restore(g.serialize());assert.ok(restored);assert.equal(restored.pursuit,1);assert.deepEqual(restored.props.find(p=>p.type==='nest'),n);
 const backup=decodeBackup(JSON.stringify(makeBackup(g,normalizeProfile(),'qa')),'qa').game;assert.equal(backup.pursuit,1);assert.deepEqual(backup.props.find(p=>p.type==='nest'),n);
 const archive=archiveFloor(g),resume=resumedFloor(archive,g.turn+30);assert.deepEqual(resume.props.find(p=>p.type==='nest'),n);assert.deepEqual(resume.enemies,g.enemies);
 const raw=JSON.parse(g.serialize());raw.version=32;delete raw.data.pursuit;assert.equal(Game.restore(JSON.stringify(raw)).pursuit,0);
 for(const mutate of [d=>d.pursuit=2,d=>d.props.find(p=>p.type==='nest').nest.remaining=99,d=>d.enemies.find(e=>e.type==='brood').expendable=false]){const bad=JSON.parse(g.serialize());mutate(bad.data);assert.equal(Game.restore(JSON.stringify(bad)),null);}
});
test('free preparation retains pursuit, grenade/grapple spend it, anchored free attack is one attack',()=>{
 const g=arena('recon');g.pursuit=1;assert.ok(g.action('prepare',{category:'grenade',id:'stun'}));assert.equal(g.pursuit,1);const turn=g.turn;enemy(g,'rifleman',14);assert.ok(g.action('grenade',{x:14,y:10}));assert.equal(g.turn,turn);assert.equal(g.player.stun,1);assert.equal(g.pursuit,0);
 const b=arena('berserker');b.pursuit=1;const e=enemy(b,'brute',13);e.hp=200;const t=b.turn;assert.ok(b.action('usePrepared',{category:'skill'}));assert.equal(b.turn,t);assert.equal(b.pursuit,0);assert.ok(b.player.skillState.grapple.cooldown>0);assert.equal(b.player.moved,true);
 const h=arena('bulwark');h.player.skillState.anchor.remaining=1;h.pursuit=1;const a=enemy(h,'rifleman',13);a.hp=500;const ammo=h.player.ammo[6],before=h.turn;assert.ok(h.action('fire'));assert.equal(h.turn,before);assert.equal(h.player.ammo[6],ammo-3);
});
