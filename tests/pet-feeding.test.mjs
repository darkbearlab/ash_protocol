import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game.js';
import {SIZE} from '../src/data.js';
import {clearGeneratedMap} from './helpers/arena.mjs';
import {allyAct,departAllies,arriveAllies} from '../src/allies.js';
import {petFeedQuote,petFeedingState,petFuelCost,petCapacity,petRank,petWeapon,fitPet,tickPetBond,ammoFuel,PET_FEEDING_TUNING as T} from '../src/pet-growth.js';
import {AMMO_IDS,AMMUNITION,TERMINAL_AMMO} from '../src/ammunition.js';
import {makeEnemy,distance} from '../src/world.js';
import {makeBarrier} from '../src/barriers.js';
import {activeTrait,grantTrait} from '../src/traits.js';
import {salvageValue} from '../src/weapons.js';
import {captureAction,planPresentation} from '../src/presentation.js';
import {makeBackup,decodeBackup} from '../src/backup.js';
import {normalizeProfile} from '../src/progression.js';
function arena(){const g=new Game(330,[],0,'druid','onyx');g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.lighting=g.grid.map(r=>r.slice());g.seen=g.grid.map(r=>r.map(()=>true));for(const k of ['enemies','props','items','barriers','hazards','marks','rooms','traces','smoke'])g[k]=[];clearGeneratedMap(g);Object.assign(g.player,{x:10,y:10});Object.assign(g.allies[0],{x:11,y:10});g.start={x:5,y:5};g.end={x:20,y:20};g.reveal();return g;}
const feed=(g,optionId,extra={})=>g.action('feedPet',{optionId,...extra});
const grow=(g,line,n)=>{g.player.petBond.growth[line]=n;if(line==='extrusion')g.player.petBond.fedThrowables.frag=n;fitPet(g,g.allies[0]);};
const foe=(g,x=15)=>{const e=makeEnemy('rifleman',x,10,'test-foe',1);e.hp=200;g.enemies.push(e);g.reveal();return e;};
const sure=g=>g.rng=Object.assign(()=>0,{state:()=>1});
test('feeding invariant 1: five explicit ammo foods use terminal values, integer fuel, paid turns, no autonomous reserve drain',()=>{
 for(const id of AMMO_IDS){const g=arena(),key=AMMUNITION[id].key,b=g.player.petBond;g.player[key]=30;const q=petFeedQuote(g,{optionId:'ammo:'+id});assert.equal(q.gain,q.amount*TERMINAL_AMMO[id].cost*72/TERMINAL_AMMO[id].amount);assert.ok(feed(g,'ammo:'+id));assert.equal(g.turn,2);assert.equal(g.player[key],30-q.amount);assert.equal(b.fuel,q.gain);assert.ok(Number.isInteger(b.fuel));const ammo=g.player[key];for(let i=0;i<3;i++)g.action('wait');assert.equal(g.player[key],ammo);assert.equal(b.fuel,q.gain);assert.ok(Game.restore(g.serialize()));}
});
test('feeding invariants 2,3,14: disappearance keeps growth, empties stomach, eight paid turns return partial HP without prepared skill',()=>{
 const g=arena(),a=g.allies[0],b=g.player.petBond;grow(g,'armor',25);b.fuel=500;g.damageAlly(a,999);assert.equal(a.status,'reforming');assert.equal(b.fuel,0);assert.equal(b.growth.armor,25);assert.ok(!g.localAllies.includes(a));
 for(const q of petFeedingState(g).options){const turn=g.turn;assert.equal(g.action('feedPet',q.action),false);assert.equal(g.turn,turn);}
 g.action('prepare',{category:'skill',id:null});assert.equal(b.reviveRemaining,8);for(let i=0;i<7;i++)g.action('wait');assert.equal(a.status,'reforming');g.action('wait');assert.equal(a.status,'active');assert.equal(distance(a,g.player),1);assert.ok(a.hp>0&&a.hp<a.maxHp);assert.ok(Game.restore(g.serialize()));
});
test('feeding invariants 4,5: passive growth consumes no fuel, turret pays per shot and empty stomach bites',()=>{
 const g=arena(),a=g.allies[0],b=g.player.petBond;grow(g,'turret',120);grow(g,'armor',50);b.fuel=petFuelCost(g.player,'shot')*2;const e=foe(g);g.turn=2;sure(g);const reserve=g.player.reserve;allyAct(g,a);assert.equal(g.effects.filter(e=>e.weaponId==='pet_turret').length,2);assert.equal(b.fuel,0);assert.ok(e.hp<200);assert.equal(g.player.reserve,reserve);assert.equal(petWeapon(g.player).melee,true);const hp=e.hp;Object.assign(e,{x:12});allyAct(g,a);assert.ok(e.hp<hp);assert.equal(b.fuel,0);
});
test('turret prefers adjacent bite; insufficient fuel permits one shot; a killed target does not cost a second shot',()=>{
 for(const kill of [false,true]){const g=arena(),a=g.allies[0],b=g.player.petBond;grow(g,'turret',120);b.fuel=petFuelCost(g.player,'shot')*(kill?2:1);const e=foe(g);if(kill)e.hp=1;g.turn=2;sure(g);allyAct(g,a);assert.equal(g.effects.filter(e=>e.weaponId==='pet_turret').length,1);assert.equal(b.fuel,kill?petFuelCost(g.player,'shot'):0);}
 const g=arena(),a=g.allies[0];grow(g,'turret',120);g.player.petBond.fuel=500;foe(g,12);g.turn=2;sure(g);allyAct(g,a);assert.equal(g.player.petBond.fuel,500);
});
test('feeding invariant 6: output is timed, costs fuel, waits without backlog, falls under pet even at carry cap',()=>{
 const g=arena(),b=g.player.petBond,a=g.allies[0];grow(g,'extrusion',1);b.fuel=petFuelCost(g.player,'output');g.player.grenades=4;for(let i=0;i<11;i++)g.action('wait');assert.equal(g.items.length,0);g.action('wait');assert.equal(g.items.length,1);assert.equal(g.items[0].type,'grenade');assert.equal(g.items[0].x,a.x);assert.equal(b.fuel,0);for(let i=0;i<20;i++)g.action('wait');assert.equal(g.items.length,1);assert.equal(b.outputRemaining,0);b.fuel=petFuelCost(g.player,'output');g.action('wait');assert.equal(g.items[0].amount,2);assert.equal(b.outputRemaining,12);
});
test('feeding invariant 7: growth caps reject more food, third extrusion selects freely without ticking',()=>{
 const g=arena();for(const [line,n] of Object.entries({vitality:90,armor:50,turret:120,extrusion:6}))grow(g,line,n);for(const q of [{optionId:'life'},{optionId:'plates'},{optionId:'weapon',weaponSlot:1},{optionId:'grenade:frag'}]){assert.equal(g.action('feedPet',q),false);assert.equal(g.turn,1);}const before=g.player.petBond.outputRemaining;assert.ok(g.action('setPetOutput',{kind:'emp'}));assert.equal(g.turn,1);assert.equal(g.player.petBond.outputRemaining,before);assert.equal(petFeedingState(g).output.kind,'emp');assert.ok(Game.restore(g.serialize()));
});
test('feeding invariant 8: weapon value equals salvage, magazine is returned not digested, last/bound weapons refused',()=>{
 const g=arena(),slot=1;g.player.upgrades[slot]=2;const q=petFeedQuote(g,{optionId:'weapon',weaponSlot:slot}),rounds=g.player.shell,mag=g.player.ammo[slot],scrap=g.player.scrap;assert.equal(q.gain,salvageValue(g.player,slot));assert.ok(feed(g,'weapon',{weaponSlot:slot}));assert.equal(g.player.shell,rounds+mag);assert.equal(g.player.scrap,scrap);assert.equal(g.player.petBond.fuel,0);assert.ok(!g.player.owned.includes(slot));assert.equal(feed(g,'weapon',{weaponSlot:g.player.owned[0]}),false);
 const h=new Game(330,[],0,'berserker');h.player.skills.push('pet_command');assert.equal(petFeedQuote(h,{optionId:'weapon',weaponSlot:h.player.owned[0]}).allowed,false);
});
test('feeding invariants 9,12,13: life floor, no healing from growth, pure medical healing and cardinal adjacency',()=>{
 const g=arena(),a=g.allies[0];a.hp=10;g.player.petBond.growth.vitality=15;assert.ok(feed(g,'life'));assert.equal(a.maxHp,150);assert.equal(a.hp,10);assert.equal(g.player.petBond.growth.vitality,20);const growth=structuredClone(g.player.petBond.growth);assert.ok(feed(g,'medkit'));assert.equal(a.hp,85);assert.deepEqual(g.player.petBond.growth,growth);
 g.player.hp=40;assert.equal(feed(g,'life'),false);assert.equal(g.player.hp,40);a.x=12;const turn=g.turn;assert.equal(feed(g,'ammo:pistol'),false);assert.equal(g.turn,turn);a.x=11;a.y=11;assert.equal(feed(g,'medkit'),false);a.y=10;g.barriers=[makeBarrier('door',g.player,a,'edge-feed')];assert.equal(feed(g,'medkit'),false);assert.equal(g.turn,turn);
});
test('feeding invariant 10: symbiosis still heals on expendable pet kills without granting fuel',()=>{
 const g=arena(),a=g.allies[0];g.player.perks.druid_symbiosis=1;g.player.hp=50;const e=foe(g,12);e.type='fodder';e.expendable=true;e.hp=1;g.turn=2;sure(g);allyAct(g,a);assert.ok(g.player.hp>50);assert.equal(g.player.petBond.fuel,0);
});
test('feeding invariant 11: v34 packed/down migrate once, preserve HP/growth perk counts and backups roundtrip new bond',()=>{
 for(const status of ['packed','down','active']){const g=arena(),raw=JSON.parse(g.serialize());raw.version=34;delete raw.data.player.petBond;Object.assign(raw.data.allies[0],{status,hp:status==='down'?0:37});raw.data.player.perks.druid_beast=2;const h=Game.restore(JSON.stringify(raw));assert.ok(h,status);assert.equal(h.allies.length,1);assert.equal(h.allies[0].status,status==='down'?'reforming':'active');assert.equal(h.allies[0].hp,status==='down'?0:37);assert.equal(h.player.petBond.fuel,0);assert.equal(h.player.perks.druid_beast,2);assert.ok(Game.restore(h.serialize()));const backup=decodeBackup(JSON.stringify(makeBackup(h,normalizeProfile(),'qa')),'qa');assert.deepEqual(backup.game.player.petBond,h.player.petBond);}
});
test('feeding invariant 15: distant and reforming pets always travel, body and bond are not duplicated in archived floors',()=>{
 for(const dead of [false,true]){const g=arena(),a=g.allies[0];a.x=23;if(dead)g.damageAlly(a,999);const ids=departAllies(g);assert.ok(ids.includes(a.id));g.floor=2;arriveAllies(g,ids);assert.equal(a.floor,2);assert.equal(g.allies.length,1);if(dead){for(let i=0;i<8;i++)g.action('wait');}assert.equal(a.status,'active');assert.equal(distance(a,g.player),1);assert.ok(Game.restore(g.serialize()));}
});
test('feeding commits after fast actors: lost adjacency costs the turn but not food',()=>{
 const g=arena(),e=foe(g);grantTrait(e,'fast','test');e.alert=true;g.enemyAct=()=>{g.allies[0].x=13;};const before=g.player.pistol;assert.ok(feed(g,'ammo:pistol'));assert.equal(g.turn,2);assert.equal(g.player.pistol,before);assert.equal(g.player.petBond.fuel,0);
});
test('v35 rejects malformed and missing bond values, legacy states, mismatched identities and overflow',()=>{
 const g=arena();for(const mutate of [d=>delete d.player.petBond,d=>d.player.petBond.fuel=-1,d=>d.player.petBond.fuel=petCapacity(g.player)+1,d=>d.player.petBond.growth.armor=51,d=>d.player.petBond.actorId='ally-2',d=>d.allies[0].status='packed',d=>d.player.petBond.reviveRemaining=9,d=>d.player.petBond.outputChoice='invalid',d=>d.player.petBond.fedThrowables.frag=1]){const raw=JSON.parse(g.serialize());mutate(raw.data);assert.equal(Game.restore(JSON.stringify(raw)),null);}
});
test('satiety increases capacity and discounts each ability; hunger only boosts empty-stomach melee',()=>{
 const g=arena(),p=g.player;p.perks.druid_beast=3;p.perks.druid_claws=3;assert.equal(petCapacity(p),60*72);assert.equal(petFuelCost(p,'shot'),101);assert.equal(petWeapon(p).min,42);p.petBond.fuel=1;assert.equal(petWeapon(p).min,24);
});
test('vitality lethal guard is once per actual floor; armor growth permits cover and only direct damage gets extra reduction',()=>{
 const g=arena(),a=g.allies[0];grow(g,'vitality',90);grow(g,'armor',50);assert.equal(activeTrait(a,'no_cover'),false);g.damageAlly(a,999);assert.equal(a.hp,1);assert.equal(a.status,'active');g.damageAlly(a,999);assert.equal(a.status,'reforming');for(let i=0;i<8;i++)g.action('wait');g.damageAlly(a,999);assert.equal(a.status,'reforming');assert.deepEqual(g.player.petBond.tenacityUsedFloors,[1]);
 const h=arena(),b=h.allies[0];grow(h,'armor',50);h.damageAlly(b,24,null,true);assert.equal(b.hp,74);b.hp=90;h.damageAlly(b,24,null,true,true);assert.equal(b.hp,70);
});
test('full stomach permits only fitting ammo; quoting is side-effect-free and combat regeneration never costs fuel',()=>{
 const g=arena(),b=g.player.petBond,a=g.allies[0];b.fuel=petCapacity(g.player)-ammoFuel('pistol');const before=g.serialize(),q=petFeedQuote(g,{optionId:'ammo:pistol'});assert.equal(q.amount,1);assert.equal(g.serialize(),before);feed(g,'ammo:pistol');assert.equal(b.fuel,petCapacity(g.player));assert.equal(feed(g,'ammo:pistol'),false);grow(g,'vitality',50);a.hp=20;b.lastCombatTurn=g.turn;g.action('wait');assert.equal(a.hp,23);assert.equal(b.fuel,petCapacity(g.player));
});

test('a committed turret shot still spends fuel if its ray disappears; ranged fire records corner exposure',()=>{
 const g=arena(),a=g.allies[0],b=g.player.petBond;grow(g,'turret',20);b.fuel=petFuelCost(g.player,'shot');foe(g);g.turn=2;let checks=0;g.shotClear=()=>++checks===1;sure(g);allyAct(g,a);assert.equal(b.fuel,0);assert.equal(g.effects.find(e=>e.weaponId==='pet_turret').miss,true);
 const h=arena(),pet=h.allies[0];grow(h,'turret',20);h.player.petBond.fuel=500;foe(h);h.turn=2;let exposed=0;const original=h.recordExposure.bind(h);h.recordExposure=(...args)=>{exposed++;return original(...args);};sure(h);allyAct(h,pet);assert.equal(exposed,1);
});
test('no open adjacent spawn waits at zero, survives save, and later appears without duplicates or corpse animation',()=>{
 const g=arena(),a=g.allies[0];g.damageAlly(a,999);g.barriers=[[11,10],[9,10],[10,11],[10,9]].map(([x,y],i)=>makeBarrier('door',g.player,{x,y},'edge-spawn-'+i));for(let i=0;i<8;i++)g.action('wait');assert.equal(g.player.petBond.reviveRemaining,0);assert.equal(a.status,'reforming');assert.ok(Game.restore(g.serialize()));g.barriers=[];g.action('wait');assert.equal(a.status,'active');assert.equal(g.allies.length,1);
});
test('paid feeding discards pursuit, while free output choice and command do not advance output clocks',()=>{
 const g=arena();g.pursuit=1;assert.ok(feed(g,'ammo:pistol'));assert.equal(g.turn,2);assert.equal(g.pursuit,0);grow(g,'extrusion',6);const clock=g.player.petBond.outputRemaining;g.action('setPetOutput',{kind:'smoke'});g.action('commandPet',{x:12,y:10});assert.equal(g.turn,2);assert.equal(g.player.petBond.outputRemaining,clock);
});
