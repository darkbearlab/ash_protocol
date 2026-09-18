import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,SIZE,makeEnemy,WEAPONS} from '../src/engine.js';
import {grantTrait} from '../src/traits.js';
import {projectileVisuals} from '../src/presentation.js';
import {UNKNOWN_LOOT,LEARNING_ITEMS} from '../src/learning-data.js';
import {UNARMED_SLOT} from '../src/unarmed.js';
import {thrustCells} from '../src/melee-weapons.js';
import {bladeMultiplier} from '../src/melee-classes.js';

// 3.136.0 (user decisions 2026-09-19, docs/MELEE_WEAPONS.md).
const W=Object.fromEntries(WEAPONS.map((w,i)=>[w.id,i]));
function arena(character='soldier'){
 const g=new Game(3470,[],0,character,'onyx');g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.lighting=g.grid.map(r=>r.map(()=>1));g.barriers=[];g.props=[];g.items=[];g.hazards=[];g.marks=[];g.enemies=[];g.allies=[];g.smoke=[];g.end={x:20,y:20};Object.assign(g.player,{x:10,y:10});g.rng=Object.assign(()=>0,{state:()=>0});g.reveal();return g;
}
function enemy(g,type='rifleman',x=11,y=10,hp=1000){const e=makeEnemy(type,x,y,'qa-'+g.enemies.length);Object.assign(e,{hp,maxHp:hp,alert:true});g.enemies.push(e);g.target=e.id;g.reveal();return e;}
function give(g,id){const item={x:g.player.x,y:g.player.y,type:'weapon',weapon:W[id]};g.registerWeapon(item);g.collectWeapon(item);return item.slot;}
const quiet=g=>Object.defineProperty(g,'enemyAct',{value:()=>{},configurable:true});

test('a bump uses the melee weapon picked in the pack; with no pick, the first one; the pick is free and saved',()=>{
 const g=arena('berserker'),knife=give(g,'knife');quiet(g);
 assert.equal(g.bumpMeleeSlot(),W.axe,'the bound axe comes first, as before');
 const turn=g.turn;assert.ok(g.action('meleeChoice',knife));assert.equal(g.turn,turn,'picking is free');assert.equal(g.bumpMeleeSlot(),knife);
 const e=enemy(g);assert.ok(g.action('move',[1,0]));assert.equal(e.hp,1000-Math.round(16*bladeMultiplier(g.player)),'the knife, not the axe (blade stash counts both blades)');
 assert.equal(g.action('meleeChoice',g.player.owned.find(s=>!g.weaponAt(s).melee)),false,'a gun cannot be picked');
 const back=Game.restore(g.serialize());assert.equal(back.player.meleeSlot,knife);assert.equal(back.bumpMeleeSlot(),knife);
 assert.ok(g.action('meleeChoice',null));assert.equal(g.bumpMeleeSlot(),W.axe);
 const s=arena();assert.equal(s.bumpMeleeSlot(),UNARMED_SLOT);const k=give(s,'knife');assert.equal(s.bumpMeleeSlot(),k,'a gun class bumps with a knife it carries, though switching to it is not free');
});

test('claws strike in the fast phase and hit an unarmoured enemy half again as hard',()=>{
 const order=[];const run=weapon=>{
  const g=arena(),slot=give(g,weapon);g.player.meleeSlot=slot;order.length=0;
  const e=enemy(g);grantTrait(e,'fast','test');const plain=g.strike.bind(g);g.strike=(...a)=>{order.push('strike');return plain(...a);};
  Object.defineProperty(g,'enemyAct',{value:()=>order.push('enemy'),configurable:true});g.action('move',[1,0]);return {order:[...order],e,g};
 };
 assert.deepEqual(run('claws').order,['strike','enemy']);assert.deepEqual(run('knife').order,['enemy','strike']);
 const bare=run('claws').e;assert.equal(bare.hp,1000-21,'14 × 1.5');
 const g=arena(),slot=give(g,'claws');g.player.meleeSlot=slot;quiet(g);const armoured=enemy(g,'rifleman_armored');assert.ok(g.action('move',[1,0]));assert.equal(armoured.hp,1000-13,'14 − 1 armour, no bonus');
});

test('the sabre splashes 45% onto the target\'s visible neighbours',()=>{
 const g=arena(),slot=give(g,'sabre');g.player.meleeSlot=slot;quiet(g);
 const side=enemy(g,'rifleman',12,10),far=enemy(g,'rifleman',13,10),target=enemy(g,'rifleman',11,10);
 assert.ok(g.action('move',[1,0]));assert.equal(target.hp,1000-26);assert.equal(side.hp,1000-12);assert.equal(far.hp,1000);
});

test('the spear bumps like any blade; held, it thrusts two tiles through everyone on the line, friends too',()=>{
 assert.deepEqual(thrustCells({x:10,y:10},{x:11,y:10}),[{x:11,y:10},{x:12,y:10}],'a target next to you is run through');
 assert.deepEqual(thrustCells({x:10,y:10},{x:11,y:11}),[{x:11,y:11}]);
 const g=arena(),slot=give(g,'spear');quiet(g);assert.ok(g.action('weapon',slot));
 const near=enemy(g,'rifleman',11,10),back=enemy(g,'rifleman',12,10),beyond=enemy(g,'rifleman',13,10);g.target=back.id;
 assert.ok(g.action('fire'));assert.equal(near.hp,1000-20);assert.equal(back.hp,1000-20);assert.equal(beyond.hp,1000,'three tiles is past the spear');
 g.target=near.id;assert.ok(g.action('fire'));assert.equal(back.hp,1000-40,'run through from the front');
 const b=arena(),held=give(b,'spear');quiet(b);b.player.meleeSlot=held;const e=enemy(b);assert.ok(b.action('move',[1,0]));assert.equal(e.hp,1000-20,'bumping still works while a gun is in hand');
});

test('the chainsaw bites in the slow phase: ten cuts of 3–10 through armour, then your next action is lost',()=>{
 const g=arena(),slot=give(g,'chainsaw');g.player.meleeSlot=slot;const order=[];
 const e=enemy(g,'brute');const plain=g.strike.bind(g);g.strike=(...a)=>{order.push('strike');return plain(...a);};
 Object.defineProperty(g,'enemyAct',{value:()=>order.push('enemy'),configurable:true});
 assert.ok(g.action('move',[1,0]));assert.deepEqual(order,['enemy','strike'],'normal enemies act first');
 assert.equal(e.hp,1000-30,'ten cuts of 3, armour 7 ignored');assert.equal(g.player.recovery,1);
 g.player.adrenaline=1;assert.equal(g.action('surge'),false,'free actions wait too');
 const x=g.player.x,turn=g.turn;assert.ok(g.action('move',[0,1]));assert.equal(g.turn,turn+1);assert.equal(g.player.x,x);assert.equal(g.player.y,10,'the move was skipped');assert.equal(g.player.recovery,0);
 assert.ok(g.action('move',[0,1]));assert.equal(g.player.y,11,'free again');
 const u=arena(),saw=give(u,'chainsaw');u.player.upgrades[saw]=1;assert.deepEqual(u.weaponDamage(saw),{min:4,max:11},'an upgrade is shared across the ten cuts');
});

test('a missed chainsaw costs nothing more; the lost action survives a save',()=>{
 const g=arena(),slot=give(g,'chainsaw');g.player.meleeSlot=slot;quiet(g);g.rng=Object.assign(()=>.99,{state:()=>0});const e=enemy(g);
 assert.ok(g.action('move',[1,0]));assert.equal(e.hp,1000);assert.equal(g.player.recovery,0);
 g.player.recovery=1;const back=Game.restore(g.serialize());assert.equal(back.player.recovery,1);
 const bad=JSON.parse(g.serialize());bad.data.player.recovery=2;assert.equal(Game.restore(JSON.stringify(bad)),null);
 const old=JSON.parse(g.serialize());old.version=62;delete old.data.player.recovery;delete old.data.player.meleeSlot;const o=Game.restore(JSON.stringify(old));assert.equal(o.player.recovery,0);assert.equal(o.player.meleeSlot,null);
});

test('every carried item stops at five; the rest stays at your feet; the carry learning data widens every pouch',()=>{
 const g=arena();g.player.meds=4;g.items.push({x:10,y:10,type:'med',amount:3});g.pickup();assert.equal(g.player.meds,5);assert.equal(g.items.find(i=>i.type==='med').amount,2,'two left on the floor');
 g.items=[];g.player.flares=5;g.items.push({x:10,y:10,type:'flare',amount:1});g.pickup();assert.equal(g.player.flares,5);assert.equal(g.items.length,1);
 g.items=[];g.props=[{id:'t',type:'terminal',x:10,y:10,used:false}];g.player.scrap=100;assert.ok(g.useTerminal('med'));assert.equal(g.player.meds,5);assert.equal(g.items.find(i=>i.type==='med')?.amount,1,'bought past the cap, left at your feet');
 const rifle=g.ammoCapacity('rifle'),throws=g.ammoCapacity('grenade');
 g.player.learningItems={trait_extended_carry:1};assert.ok(g.action('learn','trait_extended_carry'));
 assert.equal(g.itemCapacity(),7);assert.equal(g.ammoCapacity('rifle'),Math.round(rifle*1.5));assert.equal(g.ammoCapacity('grenade'),throws+2);
 const h=arena();h.items=[];h.player.meds=8;h.setCarryLevel(0);assert.equal(h.player.meds,5);assert.equal(h.items.find(i=>i.type==='med').amount,3,'an older save over the cap drops the rest at your feet');
});

test('difficult healing halves the medkit alone; the medic bonus is added in full',()=>{
 const g=arena('bulwark'),p=g.player;p.hp=10;p.healBonus=20;assert.ok(g.action('heal'));assert.equal(p.hp,10+22+20);
 const s=arena('soldier');s.player.hp=10;s.player.healBonus=20;assert.ok(s.action('heal'));assert.equal(s.player.hp,75);
});

test('unidentified crates hold the five new blades and the carry learning data; a blade swing is drawn as a slash',()=>{
 for(const id of ['knife','claws','sabre','spear','chainsaw'])assert.ok(UNKNOWN_LOOT.some(x=>x.type==='weapon'&&x.weapon===W[id]),id);
 assert.ok(UNKNOWN_LOOT.some(x=>x.learningId==='trait_extended_carry'));assert.ok(LEARNING_ITEMS.trait_extended_carry);assert.equal(UNKNOWN_LOOT.length,25);
 for(const id of ['axe','katana','loot_axe','sabre','chainsaw'])assert.deepEqual(projectileVisuals({type:'shot',weaponId:id,style:'slash',from:{x:0,y:0},to:{x:1,y:0}}).map(v=>[v.style,v.flash]),[['slash',null]],id);
});
