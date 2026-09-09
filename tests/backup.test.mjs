import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game.js';
import {makeBackup,decodeBackup} from '../src/backup.js';
import {normalizeProfile,creditProtocol} from '../src/progression.js';
import {landscapeTouch} from '../src/layout.js';

test('full backup roundtrip preserves wallet, unlocks, history, run and grant ledger',()=>{
  const g=new Game(23);g.awardProtocol('lore',1);const p=normalizeProfile();p.unlocks.weapons=['future-rifle'];p.unlocks.characters.push('scout');creditProtocol(p,g);
  const b=makeBackup(g,p,'qa'),result=decodeBackup(JSON.stringify(b),'qa');
  assert.deepEqual(result.snapshot.profile,p);assert.equal(result.game.runId,g.runId);assert.deepEqual(result.game.player,g.player);assert.deepEqual(result.game.grid,g.grid);
  assert.equal(creditProtocol(result.snapshot.profile,result.game),0);
});
test('profile-only snapshots preserve the wallet without creating a campaign',()=>{
  const p=normalizeProfile();p.protocol={balance:8,earned:12};const b=makeBackup(null,p,'live');
  assert.equal(b.campaign,null);assert.equal(decodeBackup(JSON.stringify(b),'live').game,null);assert.equal(b.profile.protocol.balance,8);
});
test('wrong namespace, versions, negative currency, unsafe IDs and missing grants are rejected',()=>{
  const g=new Game(23);g.awardProtocol('lore',1);const raw=JSON.stringify(makeBackup(g,normalizeProfile(),'qa'));
  assert.throws(()=>decodeBackup(raw,'live'),/測試與正式/);
  for(const mutate of [b=>b.version=99,b=>b.profile.version=99,b=>b.profile.protocol.balance=-1,b=>b.profile.protocol.balance=99,b=>b.profile.unlocks.characters=['<script>'],b=>b.profile.protocolRuns={},b=>b.campaign.data.player.level='<img>',b=>b.campaign.data.items[0].type='invalid']){
    const b=JSON.parse(raw);mutate(b);assert.throws(()=>decodeBackup(JSON.stringify(b),'qa'));
  }
  assert.throws(()=>decodeBackup(g.serialize(),'qa'),/完整備份/);
});
test('touch landscape pauses; physical portrait and desktop stay usable when viewport is wide',()=>{
  assert.equal(landscapeTouch({coarse:true,type:'landscape-primary',width:844,height:390}),true);
  assert.equal(landscapeTouch({coarse:true,type:'portrait-primary',width:390,height:250}),false);
  assert.equal(landscapeTouch({coarse:true,angle:-90,width:844,height:390}),true);
  assert.equal(landscapeTouch({coarse:false,type:'landscape-primary',width:1440,height:900}),false);
  assert.equal(landscapeTouch({coarse:true,width:390,height:250,editing:true}),false);
  assert.equal(landscapeTouch({coarse:true,width:844,height:390}),true);
});

test('restore is a replacement, repeat imports do not add currency, and failed writes roll back both keys',async()=>{
  const memory=new Map([['ash-profile','untouched'],['ash-save','untouched']]);let failSave=false,failJournal=false;
  globalThis.location={search:'?test=1'};
  globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>{if(failSave&&k==='qa-ash-save'){failSave=false;throw new Error('disk full');}if(failJournal&&k==='qa-ash-restore-journal')throw new Error('disk full');memory.set(k,v);},removeItem:k=>memory.delete(k)};
  const store=await import('../src/storage.js');
  const old=new Game(31);old.awardProtocol('lore',1);store.saveGame(old);
  const other=new Game(32);other.awardProtocol('floor',1);const raw=JSON.stringify(makeBackup(other,normalizeProfile(),'qa'));
  const applied=store.restoreBackup(raw,old);assert.equal(store.profile().protocol.balance,4);assert.equal(store.loadGame().runId,other.runId);
  store.restoreBackup(raw,applied.game);assert.equal(store.profile().protocol.balance,4);
  assert.ok(memory.has('qa-ash-backup-before-restore'));assert.equal(memory.has('qa-ash-restore-journal'),false);
  const rollback=JSON.stringify(makeBackup(old,normalizeProfile(),'qa'));
  failSave=true;assert.throws(()=>store.restoreBackup(rollback,applied.game),/已復原/);
  assert.equal(store.profile().protocol.balance,4);assert.equal(store.loadGame().runId,other.runId);
  failJournal=true;assert.throws(()=>store.restoreBackup(rollback,applied.game),/原資料尚未變更/);failJournal=false;
  assert.equal(store.profile().protocol.balance,4);assert.equal(store.loadGame().runId,other.runId);
  // Simulate an interrupted process after only the profile key was replaced.
  memory.set('qa-ash-restore-journal',raw);memory.set('qa-ash-profile',JSON.stringify(normalizeProfile()));
  assert.equal(store.loadGame().runId,other.runId);assert.equal(store.profile().protocol.balance,4);
  const empty=JSON.stringify(makeBackup(null,normalizeProfile(),'qa'));store.restoreBackup(empty,applied.game);
  assert.equal(store.profile().protocol.balance,0);assert.equal(store.loadGame(),null);
  assert.equal(memory.get('ash-profile'),'untouched');assert.equal(memory.get('ash-save'),'untouched');
  delete globalThis.localStorage;delete globalThis.location;
});
