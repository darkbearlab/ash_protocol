import {clearGeneratedMap} from './helpers/arena.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game.js';
import {SIZE,WEAPONS} from '../src/data.js';
import {makeEnemy} from '../src/world.js';
import {allyWeapon,allyAct,validAllies} from '../src/allies.js';
import {mountableSlots} from '../src/workshop.js';

// Weapon mounting, engineer workshop phase 3 (docs/ENGINEER.md section 5, 3.93.0).
// The engineer starts with the SMG in slot 2 (equipped) and the shotgun in slot 1.
const SMG=2,SHOTGUN=1;
function arena(){
 const g=new Game(330,[],0,'engineer','onyx');g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.lighting=g.grid.map(r=>r.slice());g.seen=g.grid.map(r=>r.map(()=>true));
 for(const k of ['allies','enemies','props','items','barriers','hazards','marks','rooms','traces','smoke'])g[k]=[];clearGeneratedMap(g);g.allySerial=0;g.player.petBond=null;Object.assign(g.player,{x:10,y:10,hp:500,maxHp:500});g.start={x:5,y:5};g.end={x:20,y:20};g.enemyAct=()=>{};g.reveal();return g;
}
const enemy=(g,x,y,type='rifleman')=>{const e=makeEnemy(type,x,y,'foe-'+g.enemies.length);e.hp=e.maxHp=500;g.enemies.push(e);return e;};
const zero=g=>g.rng=Object.assign(()=>0,{state:()=>1});
// A unit already built with slot in its line: the weapon has left the pack.
const mounted=(g,slot,blueprint='drone_follow')=>{const p=g.player;p.owned=p.owned.filter(s=>s!==slot);if(p.weapon===slot)p.weapon=p.owned[0];p.productionLines=[{blueprint,weapon:slot}];};

test('building with a mounted weapon takes it out of the pack, keeps one weapon, and tops up its magazine from the pack',()=>{
 const g=arena(),p=g.player;p.productionLines=[];p.scrap=200;p.ammo[SHOTGUN]=1;const shells=p.shell;
 assert.deepEqual(mountableSlots(g).sort(),[SHOTGUN,SMG]);
 assert.equal(g.action('buildUnit',{blueprint:'drone_munition',payload:'frag',weapon:SHOTGUN}),false);
 assert.equal(g.action('buildUnit',{blueprint:'drone_follow',weapon:5}),false);assert.equal(g.action('buildUnit',{blueprint:'drone_follow',weapon:'1'}),false);assert.equal(g.turn,1);
 assert.ok(g.action('buildUnit',{blueprint:'drone_follow',weapon:SHOTGUN}));
 assert.deepEqual(p.owned,[SMG]);assert.equal(p.weapon,SMG);assert.deepEqual(p.productionLines,[{blueprint:'drone_follow',weapon:SHOTGUN}]);
 assert.equal(p.ammo[SHOTGUN],WEAPONS[SHOTGUN].mag);assert.equal(p.shell,shells-(WEAPONS[SHOTGUN].mag-1));assert.ok(Game.restore(g.serialize()));
 p.perks.engineer_lines=1;assert.deepEqual(mountableSlots(g),[]);assert.equal(g.action('buildUnit',{blueprint:'drone_sentry',weapon:SMG}),false);assert.match(g.logs[0].text,/至少保留一把武器/);
 const h=arena();h.player.productionLines=[];h.player.scrap=100;assert.ok(h.action('buildUnit',{blueprint:'drone_sentry',weapon:SMG}));assert.deepEqual(h.player.owned,[SHOTGUN]);assert.equal(h.player.weapon,SHOTGUN);
});

test('a deployed unit fires its mounted weapon with the weapon stats, upgrades and fire control, and reloads that ammunition from the player',()=>{
 const g=arena(),p=g.player;mounted(g,SHOTGUN);p.upgrades[SHOTGUN]=2;
 assert.ok(g.action('deployUnit',{line:0}));const a=g.allies[0];assert.equal(a.weapon,SHOTGUN);assert.equal(p.ammo[SHOTGUN],0);assert.equal(a.ammo,WEAPONS[SHOTGUN].mag);assert.ok(Game.restore(g.serialize()));
 const w=allyWeapon(a,p);assert.equal(w.min,WEAPONS[SHOTGUN].min+10);assert.equal(w.closeMin,WEAPONS[SHOTGUN].closeMin+10);assert.equal(w.range,WEAPONS[SHOTGUN].range);assert.equal(w.accuracyBonus,0,'3.155.0: no machine penalty any more');assert.equal(w.ammoType,'shell');assert.equal(w.mag,WEAPONS[SHOTGUN].mag);   // a mounted player weapon still drains the player
 p.perks.engineer_firecontrol=1;const f=allyWeapon(a,p);assert.equal(f.min,WEAPONS[SHOTGUN].min+13);assert.equal(f.accuracyBonus,8,'fire control is now a plain bonus');
 a.ammo=0;a.bornTurn=1;const shells=p.shell,pistol=p.pistol;allyAct(g,a);assert.equal(a.ammo,WEAPONS[SHOTGUN].mag);assert.equal(p.shell,shells-WEAPONS[SHOTGUN].mag);assert.equal(p.pistol,pistol);
});

test('an SMG unit fires its two-round burst, and a shotgun unit uses close-range damage and splash',()=>{
 const g=arena();mounted(g,SMG);assert.ok(g.action('deployUnit',{line:0,x:11,y:10}));const a=g.allies[0];a.bornTurn=1;const e=enemy(g,13,10);zero(g);g.reveal();
 allyAct(g,a);assert.equal(a.ammo,WEAPONS[SMG].mag-2);assert.ok(e.hp<500);
 const h=arena();mounted(h,SHOTGUN);assert.ok(h.action('deployUnit',{line:0,x:11,y:10}));const b=h.allies[0];b.bornTurn=1;const near=enemy(h,12,10),beside=enemy(h,13,10);zero(h);h.reveal();
 allyAct(h,b);assert.equal(b.ammo,WEAPONS[SHOTGUN].mag-1);assert.ok(500-near.hp>=WEAPONS[SHOTGUN].closeMin-5);assert.ok(beside.hp<500);
});

test('a destroyed unit drops its mounted weapon with the rest of its magazine where it fell',()=>{
 const g=arena(),p=g.player;mounted(g,SHOTGUN);assert.ok(g.action('deployUnit',{line:0}));const a=g.allies[0];a.ammo=3;const at={x:a.x,y:a.y};
 g.damageAlly(a,999);const item=g.items.find(i=>i.type==='weapon'&&i.slot===SHOTGUN);
 assert.ok(item);assert.deepEqual([item.x,item.y],[at.x,at.y]);assert.equal(item.weapon,p.weaponBases[SHOTGUN]);assert.equal(p.ammo[SHOTGUN],3);assert.equal(a.weapon,undefined);assert.equal(a.ammo,0);
 assert.ok(validAllies(g));assert.ok(Game.restore(g.serialize()));
});

test('saves keep one location per weapon and reject melee, unknown or munition-mounted weapons',()=>{
 const g=arena(),p=g.player;mounted(g,SHOTGUN);assert.ok(Game.restore(g.serialize()));
 for(const change of [d=>d.player.owned=[SMG,SHOTGUN],d=>d.player.productionLines[0].weapon=99,d=>{d.player.productionLines[0].weapon=7;d.player.weaponBases[7]=7;},d=>d.player.productionLines=[{blueprint:'drone_munition',payload:'frag',weapon:SHOTGUN}],d=>d.items.push({x:1,y:1,type:'weapon',weapon:d.player.weaponBases[SHOTGUN],slot:SHOTGUN})]){
  const raw=JSON.parse(g.serialize());change(raw.data);assert.equal(Game.restore(JSON.stringify(raw)),null);
 }
 assert.ok(g.action('deployUnit',{line:0}));assert.ok(Game.restore(g.serialize()));
 const dup=JSON.parse(g.serialize());dup.data.player.owned=[SMG,SHOTGUN];assert.equal(Game.restore(JSON.stringify(dup)),null);
 const munition=JSON.parse(g.serialize());Object.assign(munition.data.allies[0],{sourceId:'drone_munition',payload:'frag',ammo:0});assert.equal(Game.restore(JSON.stringify(munition)),null);
 const control=JSON.parse(g.serialize());Object.assign(control.data.allies[0],{sourceId:'drone_munition',payload:'frag',ammo:0});delete control.data.allies[0].weapon;assert.ok(Game.restore(JSON.stringify(control)));
 const wreck=JSON.parse(g.serialize());Object.assign(wreck.data.allies[0],{status:'destroyed',hp:0,ammo:0});assert.equal(Game.restore(JSON.stringify(wreck)),null);
});

test('an explosive mounted weapon never targets an enemy beside its own unit, and a unit destroyed mid-volley stops firing',()=>{
 const THUNDER=WEAPONS.findIndex(w=>w.id==='thunder');assert.ok(WEAPONS[THUNDER].explosive&&WEAPONS[THUNDER].burst>1&&!WEAPONS[THUNDER].locked);
 const g=arena();g.player.ammo[THUNDER]=WEAPONS[THUNDER].mag;mounted(g,THUNDER);assert.ok(g.action('deployUnit',{line:0,x:11,y:10}));const a=g.allies[0];a.bornTurn=1;
 const close=enemy(g,12,10);zero(g);g.reveal();const mag=a.ammo;allyAct(g,a);assert.equal(a.ammo,mag);assert.equal(close.hp,500);assert.equal(a.hp,a.maxHp);
 const far=enemy(g,11,12);allyAct(g,a);assert.ok(a.ammo<mag);assert.ok(far.hp<500);assert.equal(a.status,'active');assert.ok(Game.restore(g.serialize()));
 const h=arena();h.player.ammo[THUNDER]=WEAPONS[THUNDER].mag;mounted(h,THUNDER);assert.ok(h.action('deployUnit',{line:0,x:11,y:10}));const b=h.allies[0];b.bornTurn=1;enemy(h,11,12);zero(h);h.reveal();
 const blast=h.explode.bind(h);h.explode=(...args)=>{blast(...args);h.damageAlly(b,999);};
 const before=b.ammo;allyAct(h,b);assert.equal(b.status,'destroyed');assert.equal(b.ammo,0);
 assert.ok(h.items.some(i=>i.type==='weapon'&&i.slot===THUNDER));assert.equal(h.player.ammo[THUNDER],before-1);assert.ok(validAllies(h));assert.ok(Game.restore(h.serialize()));
});
