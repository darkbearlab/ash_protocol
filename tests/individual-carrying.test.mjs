import {PROFILE_VERSION} from '../src/progression.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game.js';
import {AMMUNITION,carryLevels,capacity,CARRY_COSTS} from '../src/ammunition.js';
import {normalizeProfile} from '../src/progression.js';
import {makeBackup,decodeBackup} from '../src/backup.js';

let serial=0;
async function storageHarness(){
  const memory=new Map([['ash-save','live-campaign'],['ash-profile','live-profile'],['unrelated','other-app']]);let fail=null;
  globalThis.location={search:'?test=1'};
  globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>{if(fail===`set:${k}`){fail=null;throw Error('write failed');}memory.set(k,v);},removeItem:k=>{if(fail===`remove:${k}`){fail=null;throw Error('remove failed');}memory.delete(k);}};
  const storage=await import(`../src/storage.js?individual=${serial++}`);
  return {memory,storage,failNext:op=>fail=op};
}
function legacyProfile(level=3){return {...normalizeProfile(),version:3,upgrades:{carrying:level},protocol:{earned:200,balance:200-CARRY_COSTS.slice(0,level).reduce((a,b)=>a+b,0)}};}
function assertIsolated(memory){assert.equal(memory.get('ash-save'),'live-campaign');assert.equal(memory.get('ash-profile'),'live-profile');assert.equal(memory.get('unrelated'),'other-app');}

test('every legacy type purchase and reset is inert, without changing wallet or campaign',async()=>{
 const {storage:s,memory}=await storageHarness(),g=new Game(39),p=normalizeProfile();p.protocol={balance:1000,earned:1000};memory.set('qa-ash-profile',JSON.stringify(p));const before=JSON.stringify(g.player);
 for(const type of Object.keys(AMMUNITION))assert.throws(()=>s.purchaseCarrying(g,type,0),/取消/);
 assert.throws(()=>s.resetCarrying(g),/取消/);assert.equal(s.profile().protocol.balance,1000);assert.equal(JSON.stringify(g.player),before);assertIsolated(memory);
});
test('legacy group refund is once-only, backed up, and preserves the grant ledger',async()=>{
 const {storage:s,memory}=await storageHarness(),old=legacyProfile();old.protocolRuns.previous={earned:200,recorded:true};memory.set('qa-ash-profile',JSON.stringify(old));
 assert.equal(s.profile().protocol.balance,200);assert.equal(s.profile().version,PROFILE_VERSION);assert.deepEqual(s.profile().upgrades.carrying,carryLevels(0));assert.equal(memory.get('qa-ash-profile-v3-backup'),JSON.stringify(old));assert.deepEqual(s.profile().protocolRuns,old.protocolRuns);
 for(let level=0;level<4;level++)assert.equal(normalizeProfile(legacyProfile(level)).protocol.balance,200);
 const before=memory.get('qa-ash-profile');s.profile();assert.equal(memory.get('qa-ash-profile'),before);assertIsolated(memory);
});
test('failed migration write keeps the old profile and blocks unlock purchase until recovered',async()=>{
 const {storage:s,memory,failNext}=await storageHarness(),raw=JSON.stringify(legacyProfile());memory.set('qa-ash-profile',raw);failNext('set:qa-ash-profile');s.profile();assert.equal(memory.get('qa-ash-profile'),raw);assert.equal(s.storage.available,false);assert.equal(s.grantUnlock(null,'ninja','purchase'),false);
 s.storage.available=true;assert.equal(s.profile().protocol.balance,200);
});

test('loading a v5 campaign refunds profile upgrades and preserves excess stock on the ground',async()=>{
  const {storage:s,memory}=await storageHarness(),g=new Game(39,[],3);
  for(const [id,info] of Object.entries(AMMUNITION))g.player[info.key]=capacity(id,3);
  const raw=JSON.parse(g.serialize());raw.version=5;raw.data.carryLevel=3;memory.set('qa-ash-save',JSON.stringify(raw));memory.set('qa-ash-profile',JSON.stringify(legacyProfile()));
  const restored=s.loadGame();assert.ok(restored);assert.equal(s.profile().protocol.balance,200);assert.deepEqual(restored.carryLevel,carryLevels(0));
  for(const [id,info] of Object.entries(AMMUNITION)){
    assert.equal(restored.player[info.key],info.base);
    const feet=restored.items.filter(o=>o.x===restored.player.x&&o.y===restored.player.y&&o.type===info.item).reduce((sum,o)=>sum+o.amount,0);
    assert.equal(feet,info.step*3);
  }
  assert.equal(restored.turn,g.turn);assert.equal(restored.rng.state(),g.rng.state());assert.deepEqual(restored.player.owned,g.player.owned);
  s.saveGame(restored);assert.deepEqual(s.loadGame().items,restored.items);assert.ok(memory.has('qa-ash-save-v5-backup'));
});
test('old full backups refund group spending; new backups preserve independent levels and reject bad maps',()=>{
  const p=normalizeProfile();p.protocol={earned:200,balance:200};const original=makeBackup(new Game(9),p,'qa');original.profile=legacyProfile();
  const old=decodeBackup(JSON.stringify(original),'qa');assert.equal(old.snapshot.profile.protocol.balance,200);assert.deepEqual(old.game.carryLevel,carryLevels(0));
  const next=old.snapshot;next.profile.version=6;next.profile.upgrades.carrying.rifle=1;next.profile.upgrades.carrying.grenade=2;next.profile.protocol.balance=120;
  for(const carry of [3,{rifle:1},{...carryLevels(0),grenade:-1}]){const bad=JSON.parse(new Game(9).serialize());bad.data.carryLevel=carry;assert.equal(Game.restore(JSON.stringify(bad)),null);}
  const restored=decodeBackup(JSON.stringify(next),'qa');assert.equal(restored.game.ammoCapacity('rifle'),72);assert.equal(restored.game.ammoCapacity('grenade'),4);assert.equal(restored.game.ammoCapacity('shell'),24);
  for(const mutate of [p=>delete p.upgrades.carrying.shell,p=>p.upgrades.carrying.shell=4,p=>p.upgrades.carrying.rifle='1',p=>p.upgrades.carrying.extra=1,p=>p.protocol.balance=200]){
    const invalid=structuredClone(next);mutate(invalid.profile);assert.throws(()=>decodeBackup(JSON.stringify(invalid),'qa'));
  }
});
test('abandonment keeps earned points and upgrades, records once, removes the run and preserves a backup',async()=>{
  const {storage:s,memory}=await storageHarness(),g=new Game(39);const p=normalizeProfile();p.version=6;p.upgrades.carrying.shell=1;p.protocol={balance:10,earned:30};memory.set('qa-ash-profile',JSON.stringify(p));g.awardProtocol('lore',1);s.saveGame(g);
  const turn=g.turn,hp=g.player.hp;assert.equal(s.abandonRun(g),true);assert.equal(g.status,'abandoned');assert.equal(g.turn,turn);assert.equal(g.player.hp,hp);assert.equal(s.loadGame(),null);
  assert.equal(s.profile().protocol.balance,33);assert.equal(s.profile().upgrades.carrying.shell,0);assert.equal(s.profile().runs,1);assert.equal(s.profile().wins,0);assert.equal(s.profile().history[0].outcome,'abandoned');
  assert.equal(s.abandonRun(g),false);s.saveGame(g);assert.equal(s.profile().runs,1);assert.equal(s.profile().protocol.balance,33);
  const before=s.previewBackup(memory.get('qa-ash-backup-before-restore'));assert.equal(before.game.runId,g.runId);assert.equal(before.game.status,'playing');assertIsolated(memory);
});
test('abandonment rolls back failed campaign removal and leaves the current run playable',async()=>{
  const {storage:s,memory,failNext}=await storageHarness(),g=new Game(39);g.awardProtocol('lore',1);s.saveGame(g);const before=memory.get('qa-ash-profile');
  failNext('remove:qa-ash-save');assert.throws(()=>s.abandonRun(g),/已復原/);assert.equal(g.status,'playing');assert.equal(memory.get('qa-ash-profile'),before);assert.equal(s.loadGame().runId,g.runId);assert.equal(s.profile().runs,0);
});
test('progress reset clears only game progress and its rollback backup can restore everything',async()=>{
  const {storage:s,memory}=await storageHarness(),g=new Game(39);const p=normalizeProfile();p.protocol={balance:30,earned:50};p.upgrades.carrying.energy=1;p.unlocks.characters.push('future');memory.set('qa-ash-profile',JSON.stringify(p));memory.set('qa-ash-sound','off');g.awardProtocol('lore',1);s.saveGame(g);
  const before=s.exportBackup(g),next=s.resetProgress(g);assert.equal(next.game,null);assert.equal(s.loadGame(),null);assert.equal(s.profile().protocol.balance,0);assert.equal(s.profile().protocol.earned,0);assert.deepEqual(s.profile().upgrades.carrying,carryLevels(0));assert.deepEqual(s.profile().unlocks.characters,['soldier','recon','engineer']);assert.deepEqual(s.profile().protocolRuns,{});
  assert.equal(memory.get('qa-ash-sound'),'off');assertIsolated(memory);
  const backup=memory.get('qa-ash-backup-before-restore');assert.deepEqual(s.previewBackup(backup).snapshot.profile,s.previewBackup(before).snapshot.profile);
  const restored=s.restoreBackup(backup,null);assert.equal(restored.game.runId,g.runId);assert.equal(s.profile().protocol.balance,33);assert.equal(s.profile().upgrades.carrying.energy,0);
});
test('reset write failure restores the original campaign and permanent progress',async()=>{
  const {storage:s,memory,failNext}=await storageHarness(),g=new Game(39);g.awardProtocol('lore',1);s.saveGame(g);const before=memory.get('qa-ash-profile');
  failNext('set:qa-ash-profile');assert.throws(()=>s.resetProgress(g),/已復原/);assert.equal(memory.get('qa-ash-profile'),before);assert.equal(s.loadGame().runId,g.runId);assertIsolated(memory);
});
