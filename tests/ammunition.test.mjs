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
    g.player[info.key]--;assert.equal(g.action('terminal',type),true);assert.ok(g.items.some(i=>i.type===info.item));assert.equal(g.player[info.key],g.ammoCapacity(type));
    assert.equal(g.action('terminal',type),false);
  }
});

test('floor and perk supplies preserve overflow on the current floor and never exceed caps',()=>{
  const g=arena();for(const [type,info]of Object.entries(AMMUNITION))g.player[info.key]=g.ammoCapacity(type);
  g.end={x:10,y:10};assert.equal(g.action('interact'),true);assert.equal(g.floor,2);
  for(const type of AMMO_IDS){assert.ok(g.items.some(i=>i.type===AMMUNITION[type].item&&i.x===g.player.x&&i.y===g.player.y));assert.equal(g.player[AMMUNITION[type].key],g.ammoCapacity(type));}
  g.pendingPerks=1;const grenades=stock(g,'grenade');assert.equal(g.choosePerk('med'),true);assert.equal(stock(g,'grenade'),grenades+2);
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

test('carrying levels raise all capacities without granting ammunition and lower levels spill safely',()=>{
  const g=arena(),p=structuredClone(g.player);
  for(let level=1;level<=3;level++){g.setCarryLevel(level);assert.deepEqual(g.player,p);for(const type of Object.keys(AMMUNITION))assert.ok(g.ammoCapacity(type)>capacity(type,level-1));}
  for(const [type,info]of Object.entries(AMMUNITION))g.player[info.key]=g.ammoCapacity(type);
  const amounts=Object.fromEntries(Object.keys(AMMUNITION).map(type=>[type,stock(g,type)]));g.setCarryLevel(0);
  for(const [type,total]of Object.entries(amounts))assert.equal(stock(g,type),total);
});

test('full backups include permanent levels and reconcile campaign caps; v2 profiles migrate',()=>{
  const g=arena(),p=normalizeProfile();p.protocol={balance:70,earned:200};p.upgrades.carrying.rifle=3;g.setCarryLevel(p.upgrades.carrying);
  const b=makeBackup(g,p,'qa'),restored=decodeBackup(JSON.stringify(b),'qa');assert.equal(restored.game.carryLevel.rifle,3);assert.equal(restored.snapshot.profile.upgrades.carrying.rifle,3);assert.equal(restored.game.carryLevel.shell,0);
  const old=structuredClone(b);old.profile.version=2;delete old.profile.upgrades;old.profile.protocol.balance=200;
  assert.deepEqual(decodeBackup(JSON.stringify(old),'qa').snapshot.profile.upgrades.carrying,carryLevels(0));
  old.profile.upgrades={carrying:3};assert.deepEqual(decodeBackup(JSON.stringify(old),'qa').snapshot.profile.upgrades.carrying,carryLevels(0),'v2 cannot import a permanent upgrade field');
  for(const mutate of [b=>b.profile.upgrades.carrying=4,b=>b.profile.upgrades.carrying=-1,b=>b.profile.upgrades.carrying='1',b=>b.profile.protocol.balance=200,b=>b.campaign.data.player.pistol=-1]){
    const bad=structuredClone(b);mutate(bad);assert.throws(()=>decodeBackup(JSON.stringify(bad),'qa'));
  }
});

test('purchase commits cost and level together, survives reload, rejects repeats and preserves live data',async()=>{
  const memory=new Map([['ash-save','live-save'],['ash-profile','live-profile']]);let reject=false,failSaveOnce=false;
  globalThis.location={search:'?test=1'};globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>{if(failSaveOnce&&k==='qa-ash-save'){failSaveOnce=false;throw new Error('campaign quota');}if(reject&&k==='qa-ash-profile')throw new Error('quota');memory.set(k,v);},removeItem:k=>memory.delete(k)};
  const {purchaseCarrying,profile,saveGame,loadGame,restoreBackup,exportBackup,storage}=await import('../src/storage.js');
  const g=arena(),p=normalizeProfile();g.awardProtocol('lore',1);p.protocol={balance:197,earned:197};memory.set('qa-ash-profile',JSON.stringify(p));saveGame(g);
  const original=exportBackup(g),before=structuredClone(g.player),turn=g.turn;
  reject=true;assert.throws(()=>purchaseCarrying(g,'rifle',0),/尚未扣除/);assert.equal(profile().protocol.balance,200);assert.equal(g.carryLevel.rifle,0);
  reject=false;storage.available=true;purchaseCarrying(g,'rifle',0);assert.equal(profile().protocol.balance,180);assert.equal(profile().upgrades.carrying.rifle,1);assert.equal(loadGame().carryLevel.rifle,1);
  assert.throws(()=>purchaseCarrying(g,'rifle',0),/資料已更新/);assert.equal(profile().protocol.balance,180);
  purchaseCarrying(g,'rifle',1);purchaseCarrying(g,'rifle',2);assert.equal(profile().protocol.balance,200-CARRY_COSTS.reduce((a,b)=>a+b));assert.throws(()=>purchaseCarrying(g,'rifle',3),/最高/);
  assert.equal(g.turn,turn);assert.deepEqual(g.player,before);saveGame(g);assert.equal(profile().protocol.balance,70);
  saveGame(Game.restore(g.serialize()));assert.equal(profile().protocol.balance,70,'reloading a previously rewarded run cannot refund spent points');
  failSaveOnce=true;assert.throws(()=>restoreBackup(original,g),/已復原/);assert.equal(profile().upgrades.carrying.rifle,3);assert.equal(profile().protocol.balance,70);
  const restored=restoreBackup(original,g);assert.equal(restored.game.carryLevel.rifle,0);assert.equal(profile().protocol.balance,200);assert.equal(profile().upgrades.carrying.rifle,0);
  // The first purchase remains affordable; empty wallets and pending recovery are rejected.
  const empty=normalizeProfile();memory.set('qa-ash-profile',JSON.stringify(empty));assert.throws(()=>purchaseCarrying(restored.game,'rifle',0),/不足/);
  storage.recoveryPending=true;assert.throws(()=>purchaseCarrying(restored.game,'rifle',0),/尚未就緒/);storage.recoveryPending=false;
  const legacy=JSON.parse(g.serialize());legacy.version=3;legacy.data.player.reserve=48;delete legacy.data.player.pistol;delete legacy.data.player.shell;const legacyRaw=JSON.stringify(legacy);memory.set('qa-ash-save',legacyRaw);
  const migrated=loadGame();assert.ok(migrated);assert.equal(memory.get('qa-ash-save-v3-backup'),legacyRaw);saveGame(migrated);assert.deepEqual(loadGame().player,migrated.player);
  const v4=JSON.parse(migrated.serialize());v4.version=4;v4.data.carryLevel=0;delete v4.data.player.weaponBases;delete v4.data.player.affixes;v4.data.player.ammo=v4.data.player.ammo.slice(0,6);v4.data.player.upgrades=v4.data.player.upgrades.slice(0,6);for(const item of v4.data.items)delete item.slot;const v4Raw=JSON.stringify(v4);memory.set('qa-ash-save',v4Raw);assert.ok(loadGame());assert.equal(memory.get('qa-ash-save-v4-backup'),v4Raw);
  assert.equal(memory.get('ash-save'),'live-save');assert.equal(memory.get('ash-profile'),'live-profile');
  delete globalThis.location;delete globalThis.localStorage;
});
