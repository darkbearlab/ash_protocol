import {STORIES} from '../src/story-data.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game.js';
import {normalizeProfile,PROFILE_VERSION} from '../src/progression.js';
import {grantUnlock,availableCharacters,STARTING_CHARACTERS,UNLOCK_SETTINGS,UNLOCK_CATALOG} from '../src/unlock-catalog.js';
import {collectStory,bindUnlocks,populateRunUnlocks} from '../src/run-unlocks.js';
import {makeBackup,decodeBackup} from '../src/backup.js';
import {carryLevels,carryingSpent} from '../src/ammunition.js';
import {createKillhouse} from '../src/killhouse.js';
test('profile v7 refunds every carrying investment once and resets legacy unlocks',()=>{
 const old=normalizeProfile();old.version=6;old.upgrades.carrying=carryLevels(3);old.protocol={balance:20,earned:1000};old.unlocks.characters=['ninja'];
 const p=normalizeProfile(old);assert.equal(PROFILE_VERSION,7);assert.equal(p.protocol.balance,20+6*carryingSpent(3));assert.deepEqual(p.unlocks.characters,STARTING_CHARACTERS);assert.deepEqual(p.unlocks.stories,[]);assert.deepEqual(normalizeProfile(p),p);
 assert.deepEqual(decodeBackup(JSON.stringify(makeBackup(null,old,'qa')),'qa').snapshot.profile,p);
});
test('purchase transaction is copy-on-success and demo gates all purchases',()=>{
 const p=normalizeProfile();p.protocol={balance:1100,earned:1100};const next=grantUnlock(p,'ninja','purchase');assert.equal(next.protocol.balance,100);assert.equal(p.protocol.balance,1100);assert.equal(grantUnlock(next,'ninja','purchase'),false);assert.equal(grantUnlock(next,'druid','purchase'),false);assert.equal(grantUnlock(p,'ninja','purchase',{simulation:true}),false);assert.equal(grantUnlock(p,'ninja','purchase',{settings:{demo:true}}),false);assert.deepEqual(availableCharacters(next,{demo:true}),STARTING_CHARACTERS);
});
test('locked ongoing character survives migration; old carrying spills without losing rounds',()=>{
 const g=new Game(33,[],0,'ninja'),raw=JSON.parse(g.serialize());raw.version=44;raw.data.carryLevel=carryLevels(3);raw.data.player.reserve=120;
 const h=Game.restore(JSON.stringify(raw));assert.ok(h);assert.equal(h.player.character,'ninja');assert.equal(h.carryLevel.rifle,0);assert.equal(h.player.reserve,72);assert.ok(h.items.some(i=>i.type==='ammo'&&i.x===h.player.x&&i.y===h.player.y&&i.amount===48));assert.deepEqual(Game.restore(h.serialize()).items,h.items);
});
test('endless factions and corpse positions are deterministic; encounters never repeat, no lore or demo corpses',()=>{
 const a=new Game(1,[],0,'soldier','onyx','endless'),b=new Game(1,[],0,'soldier','onyx','endless'),factions=new Set();
 for(let floor=1;floor<=35;floor++){for(const g of [a,b]){g.floor=floor;g.loadFloor();}factions.add(a.facilityFaction);assert.equal(a.facilityFaction,b.facilityFaction);assert.deepEqual(a.operatorCorpse,b.operatorCorpse);assert.ok(!a.items.some(i=>i.type==='lore'));if(floor<8)assert.equal(a.operatorCorpse,null);}
 assert.ok(factions.size>1);assert.equal(new Set(a.encounteredCharacters).size,a.encounteredCharacters.length);assert.ok(a.encounteredCharacters.length>0);assert.ok(Game.restore(a.serialize()));
 const c=new Game(1,[],0,'soldier','onyx','endless',{facilityFaction:'rebel'});c.floor=20;c.loadFloor();assert.equal(c.facilityFaction,'rebel');
 UNLOCK_SETTINGS.demo=true;try{populateRunUnlocks(a);assert.equal(a.operatorCorpse,null);}finally{UNLOCK_SETTINGS.demo=false;}
});
test('stories collect without combat RNG and remain pending; simulation never collects',()=>{
 const fixture={id:'qa-unlock-fixture',title:'QA',body:'QA',faction:'any',floors:[1,6],price:100};const original=STORIES.splice(0);STORIES.push(fixture);try{
 const g=new Game(3),state=g.rng.state(),item=g.items.find(i=>i.type==='lore');assert.ok(item);const story=collectStory(g,item);assert.ok(story);assert.equal(g.rng.state(),state);assert.equal(collectStory(g,item),null);assert.deepEqual(Game.restore(g.serialize()).pendingStories,[story.id]);assert.equal(collectStory(createKillhouse(),item),null);
 }finally{STORIES.splice(0,STORIES.length,...original);}
});
test('storage atomically purchases, retries corpse writes and grants stories only on extraction',async()=>{
 const fixture={id:'qa-unlock-fixture',title:'QA',body:'QA',faction:'any',floors:[1,6],price:100,kind:'story',sources:['extraction']};const original=STORIES.splice(0);STORIES.push(fixture);UNLOCK_CATALOG.push(fixture);try{
 const memory=new Map();let fail=false,writes=0;globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>{if(k==='ash-profile'){writes++;if(fail)throw Error('quota');}memory.set(k,v);},removeItem:k=>memory.delete(k)};
 const s=await import('../src/storage.js?unlock-qa');const p=normalizeProfile();p.protocol={balance:2000,earned:2000};memory.set('ash-profile',JSON.stringify(p));const g=s.connectUnlocks(new Game(3));
 assert.throws(()=>s.startCampaign({character:'ninja'}),/未解鎖/);assert.throws(()=>s.startKillhouse({mode:'arcade',character:'ninja'}),/未解鎖/);
 fail=true;assert.equal(s.grantUnlock(g,'ninja','purchase'),false);assert.equal(JSON.parse(memory.get('ash-profile')).protocol.balance,2000);
 fail=false;s.storage.available=true;writes=0;assert.ok(s.grantUnlock(g,'ninja','purchase'));assert.equal(writes,1);assert.equal(s.startCampaign({character:'ninja',seed:4}).player.character,'ninja');assert.equal(s.startKillhouse({mode:'arcade',character:'ninja'}).player.character,'ninja');assert.equal(s.profile().protocol.balance,1000);assert.equal(s.grantUnlock(g,'ninja','purchase'),false);
 g.encounteredCharacters.push('druid');g.operatorCorpse={...g.player,character:'druid',recovered:false};fail=true;assert.equal(g.recoverOperator(),false);assert.equal(g.operatorCorpse.recovered,false);fail=false;s.storage.available=true;assert.ok(g.recoverOperator());assert.ok(s.profile().unlocks.characters.includes('druid'));
 const item=g.items.find(i=>i.type==='lore');const story=collectStory(g,item);g.status='dead';s.recordResult(g);assert.ok(!s.profile().unlocks.stories.includes(story.id));assert.ok(s.profile().unlocks.characters.includes('druid'));
 const winner=s.connectUnlocks(new Game(4));collectStory(winner,winner.items.find(i=>i.type==='lore'));winner.status='won';fail=true;s.recordResult(winner);assert.equal(s.profile().unlocks.stories.length,0);fail=false;s.storage.available=true;s.recordResult(winner);assert.equal(s.profile().unlocks.stories.length,1);s.recordResult(winner);assert.equal(s.profile().unlocks.stories.length,1);
 const before=memory.get('ash-profile');assert.equal(s.grantUnlock(createKillhouse(),'bulwark','corpse'),false);assert.equal(memory.get('ash-profile'),before);
 }finally{delete globalThis.localStorage;STORIES.splice(0,STORIES.length,...original);UNLOCK_CATALOG.splice(UNLOCK_CATALOG.indexOf(fixture),1);}
});

test('a v7 profile rewritten by a 3.89 tab keeps its unlocks; refunds never exceed spending',()=>{
 const fixture={id:'qa-ledger-story',title:'QA',body:'QA',faction:'any',floors:[1,6],price:100,kind:'story',sources:['extraction']};STORIES.push(fixture);UNLOCK_CATALOG.push(fixture);try{
 const p=normalizeProfile();p.protocol={balance:1200,earned:1200};
 const bought=grantUnlock(grantUnlock(p,'ninja','purchase'),'qa-ledger-story','purchase');
 assert.deepEqual(bought.unlockLedger,{characters:[...STARTING_CHARACTERS,'ninja'],stories:['qa-ledger-story']});
 // The 3.89 normalizeProfile writes version 6 and rebuilds unlocks without stories, but keeps unknown top-level fields.
 const downgraded={...JSON.parse(JSON.stringify(bought)),version:6,unlocks:{weapons:[],characters:['operator',...bought.unlocks.characters]}};
 const restored=normalizeProfile(downgraded);
 assert.deepEqual(restored.unlocks.characters,[...STARTING_CHARACTERS,'ninja']);assert.deepEqual(restored.unlocks.stories,['qa-ledger-story']);assert.equal(restored.protocol.balance,100);
 assert.deepEqual(decodeBackup(JSON.stringify(makeBackup(null,restored,'qa')),'qa').snapshot.profile,restored);
 const legacy=normalizeProfile();delete legacy.unlockLedger;legacy.version=6;legacy.unlocks.characters=['ninja','druid'];assert.deepEqual(normalizeProfile(legacy).unlocks.characters,STARTING_CHARACTERS);
 const damaged=normalizeProfile();delete damaged.unlockLedger;damaged.version=6;damaged.upgrades.carrying=carryLevels(3);damaged.protocol={balance:20,earned:100};
 const capped=normalizeProfile(damaged);assert.equal(capped.protocol.balance,100);assert.doesNotThrow(()=>makeBackup(null,capped,'qa'));
 }finally{STORIES.splice(STORIES.indexOf(fixture),1);UNLOCK_CATALOG.splice(UNLOCK_CATALOG.indexOf(fixture),1);}
});

test('the public storage grant only buys; a corpse source cannot unlock for free',async()=>{
 const memory=new Map();globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
 try{const s=await import('../src/storage.js?unlock-public');const p=normalizeProfile();p.protocol={balance:0,earned:0};memory.set('ash-profile',JSON.stringify(p));
 assert.equal(s.grantUnlock(new Game(5),'ninja','corpse'),false);assert.ok(!s.profile().unlocks.characters.includes('ninja'));
 }finally{delete globalThis.localStorage;}
});
