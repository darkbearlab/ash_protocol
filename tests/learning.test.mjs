import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game.js';
import {LEARNING_ITEMS,UNKNOWN_LOOT,LEARNING_SCRAP,RETIRED_LEARNING,validLearningId,fillUnknownContainers} from '../src/learning-data.js';
import {learningInventory} from '../src/learning.js';
import {WEAPONS,SAVE_VERSION} from '../src/data.js';
import {initializeAllies} from '../src/allies.js';
import {hasTrait} from '../src/traits.js';
import {salvageValue} from '../src/weapons.js';
import {validContainers} from '../src/containers.js';
import {makeBackup,decodeBackup} from '../src/backup.js';
import {normalizeProfile} from '../src/progression.js';
import {makeEnemy} from '../src/world.js';
import {clearGeneratedMap} from './helpers/arena.mjs';
const game=()=>new Game(330,[],0,'soldier','onyx');
test('every manual is free, independently usable by a soldier, duplicates stay for terminal trade-in, and all learned states restore',()=>{
 for(const [id,def] of Object.entries(LEARNING_ITEMS).filter(([id])=>id!=='trait_suppression_resistance')){
  const g=game(),p=g.player,t=g.turn,rng=g.rng.state();p.learningItems[id]=2;const native=def.trait?hasTrait(p,def.trait):def.skills.every(s=>p.skills.includes(s));
  assert.equal(g.action('learn',id),!native,id);assert.equal(g.turn,t);assert.equal(g.rng.state(),rng);assert.equal(p.learningItems[id],native?2:1);assert.equal(g.action('learn',id),false);assert.ok(Game.restore(g.serialize()),id);
  if(def.trait)assert.ok(hasTrait(p,def.trait));else for(const skill of def.skills){assert.ok(p.skills.includes(skill));assert.deepEqual(p.skillState[skill],{remaining:0,cooldown:0});}
  // 3.120.0 (user decision): no more dismantling in the pack; the same value is a trade-in at a supply terminal.
  const scrap=p.scrap;assert.equal(g.action('dismantleLearning',id),false);assert.equal(p.scrap,scrap);assert.equal(g.turn,t);assert.ok(learningInventory(g).every(x=>x.count>0));assert.equal(LEARNING_SCRAP,15);
 }
});
// 3.113.0 (user request): class skills are no longer learnable. An older save that still carries one of those data
// items, anywhere, turns it into the scrap it would have dismantled for and keeps loading; skills it already learned stay.
test('retired class-skill data turns into scrap in the pack, on the ground and in cases, and learned skills stay',()=>{
 for(const id of RETIRED_LEARNING)assert.equal(validLearningId(id),false,`${id} is retired`);
 const g=game(),p=g.player;
 p.skills.push('grapple');p.skillState.grapple={remaining:0,cooldown:0};
 // The last version before the retirement (3.113.0 moved to SAVE 55); pinned, since SAVE_VERSION-1 moves on.
 const raw=JSON.parse(g.serialize());raw.version=54;
 const scrap=raw.data.player.scrap;
 raw.data.player.learningItems={skill_grapple:2,trait_rapid_fire:1};
 raw.data.items.push({x:raw.data.player.x,y:raw.data.player.y,type:'learning',learningId:'skill_anchor'});
 const box=raw.data.props.find(c=>c.type==='container');box.kind='unknown';box.opened=false;box.contents=[{type:'learning',learningId:'skill_camouflage'}];
 const back=Game.restore(JSON.stringify(raw));
 assert.ok(back,'the save still loads');
 assert.equal(back.player.scrap,scrap+2*LEARNING_SCRAP,'two retired items in the pack are refunded');
 assert.deepEqual(back.player.learningItems,{trait_rapid_fire:1},'what is still learnable is untouched');
 assert.ok(back.items.some(i=>i.type==='scrap'&&i.amount===LEARNING_SCRAP&&i.x===raw.data.player.x&&i.y===raw.data.player.y),'the ground copy becomes scrap where it lay');
 assert.deepEqual(back.props.find(c=>c.id===box.id).contents,[{type:'scrap',amount:LEARNING_SCRAP}],'the case copy becomes scrap');
 assert.ok(back.player.skills.includes('grapple'),'a skill already learned is kept');
});
test('workshop and pet bodies still initialize once from a learned skill, and survive full backup',()=>{
 const g=game();for(const id of ['drones','pet_command','raise_dead']){g.player.skills.push(id==='drones'?'workshop':id);g.player.skillState[id==='drones'?'workshop':id]={remaining:0,cooldown:0};}initializeAllies(g);initializeAllies(g);
 assert.equal(g.allies.filter(a=>a.kind==='pet').length,1);assert.equal(g.allies.filter(a=>a.kind==='drone').length,0);assert.deepEqual(g.player.productionLines,[{blueprint:'drone_follow'}]);assert.ok(g.player.petBond);const copy=decodeBackup(JSON.stringify(makeBackup(g,normalizeProfile(),'qa')),'qa').game;assert.deepEqual(copy.player.learningItems,g.player.learningItems);assert.deepEqual(copy.allies,JSON.parse(JSON.stringify(g.allies)));
});
test('learning validates ownership, counters and IDs and never consumes rejected input',()=>{
 const g=game(),t=g.turn;assert.equal(g.action('learn','trait_rapid_fire'),false);g.player.learningItems.trait_rapid_fire=1;g.player.control.disabled=1;assert.equal(g.action('learn','trait_rapid_fire'),false);assert.equal(g.player.learningItems.trait_rapid_fire,1);assert.equal(g.turn,t);
 for(const data of [{bad:1},{trait_rapid_fire:0},{trait_rapid_fire:-1},{trait_rapid_fire:1.5},[]]){const raw=JSON.parse(g.serialize());raw.data.player.learningItems=data;assert.equal(Game.restore(JSON.stringify(raw)),null);}
});
// 3.113.0: the eight class skills left the pool; suppressive fire belongs to no class and is the one active manual left.
// 3.135.0 (user decision): night vision and infrared are no longer found; night-vision goggles are.
test('container pool has exactly 3 weapons + 1 active + 14 passive manuals + goggles; deterministic seed-derived contents ignore combat RNG',()=>{
 assert.equal(UNKNOWN_LOOT.length,19);assert.ok(UNKNOWN_LOOT.some(x=>x.type==='nvg'));assert.ok(!UNKNOWN_LOOT.some(x=>['trait_night_vision','trait_infrared'].includes(x.learningId)));const found=new Set();
 for(let seed=0;seed<1000;seed++){const base={generation:{version:2},props:[{id:'case-1-unknown-0',type:'container',kind:'unknown',opened:false}]};const a=fillUnknownContainers(structuredClone(base),seed,1),b=fillUnknownContainers(structuredClone(base),seed,1);assert.deepEqual(a,b);assert.equal(a.props[0].contents.length,1);found.add(JSON.stringify(a.props[0].contents[0]));}
 assert.equal(found.size,19);assert.ok(UNKNOWN_LOOT.every(x=>Object.hasOwn(x,'unlockId')));
});
test('container contents persist, weapon opening registers a stable slot, duplicate manuals are collected unchanged',()=>{
 const g=game(),c=g.props.find(c=>c.type==='container');assert.ok(c);c.kind='unknown';c.contents=[{type:'weapon',weapon:11}];assert.ok(validContainers(g.props,g.grid));Object.assign(g.player,{x:c.x,y:c.y});assert.ok(g.openContainer(c.id));const item=g.items.find(i=>i.weapon===11);assert.ok(Number.isInteger(item.slot));assert.equal(g.player.weaponBases[item.slot],11);assert.ok(Game.restore(g.serialize()));
 g.items.push({x:g.player.x,y:g.player.y,type:'learning',learningId:'trait_braced'});g.pickup();assert.equal(g.player.learningItems.trait_braced,1);assert.equal(g.action('learn','trait_braced'),false);assert.equal(g.player.learningItems.trait_braced,1);
});
test('loot melee weapons remain unbound and integrated, count toward blade stash and can be salvaged',()=>{
 for(const base of [11,12]){const g=game(),p=g.player;assert.ok(!WEAPONS[base].locked&&WEAPONS[base].integrated);p.owned=[0,base];assert.equal(g.bumpMeleeSlot(),base);assert.ok(Game.restore(g.serialize()));const value=salvageValue(p,base);assert.ok(g.salvage(base));assert.equal(p.scrap,value);assert.ok(!p.owned.includes(base));}
 assert.ok(WEAPONS[9].locked&&WEAPONS[10].locked);assert.equal(WEAPONS[9].boundCharacter,'berserker');
});
test('loot blades can be dismantled on the ground or fed to a pet without treating null ammo as a reserve',()=>{
 const g=game(),item=g.registerWeapon({x:g.player.x,y:g.player.y,type:'weapon',weapon:12});g.items.push(item);const scrap=g.player.scrap;assert.ok(g.salvageGround(item.slot));assert.equal(g.player.scrap,scrap+20);assert.ok(Game.restore(g.serialize()));
 const h=new Game(330,[],0,'druid','onyx');const slot=h.addWeapon(11);assert.ok(Number.isInteger(slot));const ammo=h.player.reserve;assert.ok(h.action('feedPet',{optionId:'weapon',weaponSlot:slot}));assert.equal(h.player.petBond.growth.turret,20);assert.equal(h.player.reserve,ammo);assert.ok(Game.restore(h.serialize()));
});
// 3.113.0: these can no longer be learned from data, but a save that learned them before keeps them, so the engine must
// still run a class skill on a class that does not own it.
test('a soldier who already knows grapple uses it with virtual unarmed fallback; other class skills need no native class',()=>{
 const g=game();g.grid=g.grid.map(r=>r.map(()=>1));g.lighting=g.grid.map(r=>r.slice());g.props=[];g.items=[];g.barriers=[];g.enemies=[];g.hazards=[];g.rooms=[];clearGeneratedMap(g);Object.assign(g.player,{x:10,y:10});const e=makeEnemy('rifleman',12,10,'qa-target');e.hp=500;g.enemies.push(e);g.target=e.id;g.reveal();
 for(const id of ['grapple','anchor','camouflage','signal_break']){g.player.skills.push(id);g.player.skillState[id]={remaining:0,cooldown:0};assert.ok(g.action('prepare',{category:'skill',id}));assert.ok(g.action('usePrepared',{category:'skill'}),id);}
 assert.equal(e.x,11);assert.equal(g.player.skillState.anchor.remaining,1);assert.ok(g.player.skillState.camouflage.remaining>0);assert.ok(g.player.skillState.signal_break.remaining>0);
});
test('enemy drops prefer adjacent empty reachable floor, retain original when surrounded, including multiple drops',()=>{
 const g=game();g.grid=g.grid.map(r=>r.map(()=>1));g.props=[];g.barriers=[];g.items=[];g.enemies=[];Object.assign(g.player,{x:1,y:1});const e={x:10,y:10};assert.deepEqual(g.enemyDropPoint(e),e);g.items.push({...e,type:'med'});const next=g.enemyDropPoint(e);assert.notDeepEqual(next,e);g.items.push({...next,type:'med'});assert.notDeepEqual(g.enemyDropPoint(e),next);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])g.grid[10+dy][10+dx]=0;assert.deepEqual(g.enemyDropPoint(e),e);
 g.grid=g.grid.map(r=>r.map(()=>1));g.items=[];g.props=[{id:'crate',x:10,y:10,type:'cover',hp:40,maxHp:40}];
 const spot=g.enemyDropPoint(e);assert.notDeepEqual(spot,e,'a drone shot down over a crate drops its loot beside it');assert.ok(g.passable(spot.x,spot.y));
});
