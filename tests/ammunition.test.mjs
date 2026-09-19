import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,SIZE,WEAPONS} from '../src/engine.js';
import {AMMUNITION,AMMO_IDS,capacity,carryLevels,splitLegacyRounds,CARRY_COSTS} from '../src/ammunition.js';
import {normalizeProfile} from '../src/progression.js';
import {makeBackup,decodeBackup} from '../src/backup.js';

function arena(){const g=new Game(51);g.barriers=[];g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));Object.assign(g.player,{x:10,y:10});g.enemies=[];g.items=[];g.props=[];g.hazards=[];g.marks=[];g.reveal();return g;}
const stock=(g,type)=>g.player[AMMUNITION[type].key]+g.items.filter(i=>i.type===AMMUNITION[type].item).reduce((sum,i)=>sum+(i.amount??AMMUNITION[type].pickup),0);

test('five reserves reload only their matching weapons and wrong ammunition cannot pay for reload',()=>{
  for(const [weapon,type]of [[0,'rifle'],[1,'shell'],[2,'pistol'],[3,'rifle'],[4,'energy'],[5,'ordnance']]){
    const g=arena();g.player.owned=[weapon];g.player.weapon=weapon;g.player.ammo[weapon]=0;
    for(const info of Object.values(AMMUNITION))g.player[info.key]=0;
    g.player[AMMUNITION[type].key]=3;assert.equal(g.action('reload'),true);
    assert.equal(g.player.ammo[weapon],Math.min(3,WEAPONS[weapon].mag));
    for(const other of AMMO_IDS.filter(id=>id!==type))assert.equal(g.player[AMMUNITION[other].key],0);
    g.player.ammo[weapon]=0;g.player[AMMUNITION[type].key]=0;
    for(const other of AMMO_IDS.filter(id=>id!==type))g.player[AMMUNITION[other].key]=5;
    const turn=g.turn;assert.equal(g.action('reload'),false);assert.equal(g.turn,turn);
  }
});

test('every ammunition and grenade pickup respects capacity and preserves a partial stack',()=>{
  for(const [type,info]of Object.entries(AMMUNITION)){
    const g=arena();g.player[info.key]=g.ammoCapacity(type)-1;g.items=[{x:10,y:10,type:info.item,amount:5}];
    g.pickup();assert.equal(g.player[info.key],g.ammoCapacity(type));assert.equal(g.items[0].amount,4);
    g.pickup();assert.equal(g.items[0].amount,4);g.player[info.key]-=4;g.pickup();assert.equal(g.items.length,0);
  }
});

test('salvage recovers the correct magazine and places overflow on the ground',()=>{
  const g=arena();g.player.shell=capacity('shell')-1;const total=g.player.shell+g.player.ammo[1];
  assert.equal(g.action('salvage',1),true);assert.equal(g.player.shell,capacity('shell'));
  assert.equal(stock(g,'shell'),total);assert.equal(g.player.ammo[1],0);assert.equal(g.player.reserve,48);
});

test('terminal purchases reject full stock without spending and preserve paid overflow',()=>{
  for(const type of [...AMMO_IDS,'grenade']){
    const g=arena(),info=AMMUNITION[type];g.props=[{type:'terminal',x:11,y:10,used:false}];g.player.scrap=100;g.player[info.key]=g.ammoCapacity(type);
    const turn=g.turn;assert.equal(g.action('terminal',type),false);assert.equal(g.turn,turn);assert.equal(g.player.scrap,100);assert.equal(g.props[0].used,false);
    // 3.150.0: a frag is bought one at a time now, so one short of full takes it without overflow.
    g.player[info.key]--;assert.equal(g.action('terminal',type),true);if(type!=='grenade')assert.ok(g.items.some(i=>i.type===info.item));assert.equal(g.player[info.key],g.ammoCapacity(type));
    assert.equal(g.action('terminal',type),false);
  }
});

test('floor and perk supplies preserve overflow on the current floor and never exceed caps',()=>{
  const g=arena();for(const [type,info]of Object.entries(AMMUNITION))g.player[info.key]=g.ammoCapacity(type);
  g.end={x:10,y:10};assert.equal(g.action('interact'),true);assert.equal(g.floor,2);
  for(const type of AMMO_IDS){assert.ok(g.items.some(i=>i.type===AMMUNITION[type].item&&i.x===g.player.x&&i.y===g.player.y));assert.equal(g.player[AMMUNITION[type].key],g.ammoCapacity(type));}
  g.player.level=2;g.pendingPerks=1;g.perkDraft={index:g.perkPicks,ids:['med']};const grenades=stock(g,'grenade');assert.equal(g.choosePerk('med'),true);assert.equal(stock(g,'grenade'),grenades+2);
  assert.equal(g.player.grenades,g.ammoCapacity('grenade'));
});

test('legacy distribution conserves every round for every weapon combination and small remainder',()=>{
  for(let mask=1;mask<16;mask++)for(const total of [0,1,2,3,47,1000]){
    const owned=WEAPONS.slice(0,4).filter((_,i)=>mask&(1<<i)),split=splitLegacyRounds(total,owned,owned[0].ammoType);
    assert.equal(Object.values(split).reduce((a,b)=>a+b,0),total);
    assert.ok(Object.values(split).every(n=>Number.isInteger(n)&&n>=0));
    for(const id of ['pistol','rifle','shell'])if(!owned.some(w=>w.ammoType===id))assert.equal(split[id],0);
  }
});

test('v3 campaigns migrate held and ground rounds once, preserve overflow and remain loadable',()=>{
  const g=arena();g.player.owned=[0,1,2];g.player.reserve=301;g.player.energy=80;g.player.ordnance=20;g.player.grenades=9;g.items=[{x:10,y:10,type:'ammo',amount:47}];
  const old=JSON.parse(g.serialize());old.version=3;delete old.data.player.pistol;delete old.data.player.shell;delete old.data.carryLevel;
  const restored=Game.restore(JSON.stringify(old));assert.ok(restored);
  assert.equal(['rifle','pistol','shell'].reduce((sum,id)=>sum+stock(restored,id),0),348);
  for(const [type,total]of [['energy',80],['ordnance',20],['grenade',9]])assert.equal(stock(restored,type),total);
  for(const [type,info]of Object.entries(AMMUNITION))assert.ok(restored.player[info.key]<=restored.ammoCapacity(type));
  const again=Game.restore(restored.serialize());assert.deepEqual(again.player,restored.player);assert.deepEqual(again.items,restored.items);
  assert.equal(again.rng.state(),restored.rng.state());assert.equal(again.turn,g.turn);
});

test('obsolete carrying levels cannot raise capacity and overflow spills safely',()=>{
  const g=arena(),p=structuredClone(g.player);
  for(let level=1;level<=3;level++){g.setCarryLevel(level);assert.deepEqual(g.player,p);for(const type of Object.keys(AMMUNITION))assert.equal(g.ammoCapacity(type),capacity(type,0));}
  for(const [type,info]of Object.entries(AMMUNITION))g.player[info.key]=g.ammoCapacity(type);
  const amounts=Object.fromEntries(Object.keys(AMMUNITION).map(type=>[type,stock(g,type)]));g.setCarryLevel(0);
  for(const [type,total]of Object.entries(amounts))assert.equal(stock(g,type),total);
});

test('full backups include permanent levels and reconcile campaign caps; v2 profiles migrate',()=>{
  const g=arena(),p=normalizeProfile();p.version=6;p.protocol={balance:70,earned:200};p.upgrades.carrying.rifle=3;g.setCarryLevel(p.upgrades.carrying);
  const b=makeBackup(g,p,'qa'),restored=decodeBackup(JSON.stringify(b),'qa');assert.equal(restored.game.carryLevel.rifle,0);assert.equal(restored.snapshot.profile.upgrades.carrying.rifle,0);assert.equal(restored.game.carryLevel.shell,0);
  const old=structuredClone(b);old.profile.version=2;delete old.profile.upgrades;old.profile.protocol.balance=200;
  assert.deepEqual(decodeBackup(JSON.stringify(old),'qa').snapshot.profile.upgrades.carrying,carryLevels(0));
  old.profile.upgrades={carrying:3};assert.deepEqual(decodeBackup(JSON.stringify(old),'qa').snapshot.profile.upgrades.carrying,carryLevels(0),'v2 cannot import a permanent upgrade field');
  for(const mutate of [b=>b.profile.upgrades.carrying=4,b=>b.profile.upgrades.carrying=-1,b=>b.profile.upgrades.carrying='1',b=>b.profile.protocol.balance=201,b=>b.campaign.data.player.pistol=-1]){
    const bad=structuredClone(b);mutate(bad);assert.throws(()=>decodeBackup(JSON.stringify(bad),'qa'));
  }
});

test('removed carrying purchase cannot spend; legacy save backup and migration remain isolated',async()=>{
  const memory=new Map([['ash-save','live-save'],['ash-profile','live-profile']]);
  globalThis.location={search:'?test=1'};globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
  const {purchaseCarrying,profile,saveGame,loadGame}=await import('../src/storage.js');
  const g=arena(),p=normalizeProfile();p.protocol={balance:200,earned:200};memory.set('qa-ash-profile',JSON.stringify(p));
  assert.throws(()=>purchaseCarrying(g,'rifle',0),/取消/);assert.equal(profile().protocol.balance,200);
  const legacy=JSON.parse(g.serialize());legacy.version=3;legacy.data.player.reserve=48;delete legacy.data.player.pistol;delete legacy.data.player.shell;const legacyRaw=JSON.stringify(legacy);memory.set('qa-ash-save',legacyRaw);
  const migrated=loadGame();assert.ok(migrated);assert.equal(memory.get('qa-ash-save-v3-backup'),legacyRaw);saveGame(migrated);assert.deepEqual(loadGame().player,migrated.player);
  const v4=JSON.parse(migrated.serialize());v4.version=4;v4.data.carryLevel=0;delete v4.data.player.weaponBases;delete v4.data.player.affixes;v4.data.player.ammo=v4.data.player.ammo.slice(0,6);v4.data.player.upgrades=v4.data.player.upgrades.slice(0,6);for(const item of v4.data.items)delete item.slot;const v4Raw=JSON.stringify(v4);memory.set('qa-ash-save',v4Raw);assert.ok(loadGame());assert.equal(memory.get('qa-ash-save-v4-backup'),v4Raw);
  assert.equal(memory.get('ash-save'),'live-save');assert.equal(memory.get('ash-profile'),'live-profile');
  delete globalThis.location;delete globalThis.localStorage;
});
