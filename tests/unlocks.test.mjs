import {oldScaleAmmo,oldSaveText} from './helpers/old-ammo.mjs';
import {STORIES} from '../src/story-data.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game.js';
import {normalizeProfile,PROFILE_VERSION} from '../src/progression.js';
import {grantUnlock,availableCharacters,STARTING_CHARACTERS,UNLOCK_SETTINGS,UNLOCK_CATALOG,SHELVED_CHARACTERS,CHARACTER_IDS,unlockEntry} from '../src/unlock-catalog.js';
import {collectStory,bindUnlocks,populateRunUnlocks,corpseChance,corpseFloor,CORPSE_NOTE} from '../src/run-unlocks.js';
import {makeBackup,decodeBackup} from '../src/backup.js';
import {carryLevels,carryingSpent} from '../src/ammunition.js';
import {createKillhouse} from '../src/killhouse.js';
test('profile v7 refunds every carrying investment once and resets legacy unlocks',()=>{
 const old=normalizeProfile();old.version=6;old.upgrades.carrying=carryLevels(3);old.protocol={balance:20,earned:1000};old.unlocks.characters=['ninja'];
 const p=normalizeProfile(old);assert.equal(PROFILE_VERSION,7);assert.equal(p.protocol.balance,20+6*carryingSpent(3));assert.deepEqual(p.unlocks.characters,STARTING_CHARACTERS);assert.deepEqual(p.unlocks.stories,[]);assert.deepEqual(normalizeProfile(p),p);
 assert.deepEqual(decodeBackup(JSON.stringify(makeBackup(null,old,'qa')),'qa').snapshot.profile,p);
});
// 3.156.0 (user decision 2026-09-20): the druid and the necromancer are shelved until their redesigns land. They cannot
// be chosen, bought or found on a corpse, but a profile or a save that already holds one still loads.
test('shelved operators leave the board without breaking the profiles that already hold them',()=>{
 assert.deepEqual(SHELVED_CHARACTERS,['druid','necromancer']);
 for(const id of SHELVED_CHARACTERS){
  assert.ok(CHARACTER_IDS.includes(id),`${id} stays a known id`);
  assert.equal(unlockEntry(id),null,`${id} is not in the catalogue`);
  assert.equal(grantUnlock(normalizeProfile(),id,'purchase'),false);
  assert.equal(grantUnlock(normalizeProfile(),id,'corpse'),false);
 }
 const held=normalizeProfile();held.unlocks.characters=[...STARTING_CHARACTERS,'druid','ninja'];
 const kept=normalizeProfile(held);
 assert.ok(kept.unlocks.characters.includes('druid'),'the profile keeps what it bought before');
 assert.ok(!availableCharacters(kept).includes('druid'),'but it is not offered');
 assert.deepEqual(availableCharacters(kept),[...STARTING_CHARACTERS,'ninja']);
 // Endless corpses never draw one either.
 const g=new Game(1,[],0,'soldier','onyx','endless');let floor=5;while(!corpseFloor(g.seed,floor))floor++;
 g.floor=floor;g.loadFloor();
 if(g.operatorCorpse)assert.ok(!SHELVED_CHARACTERS.includes(g.operatorCorpse.character));
 assert.ok(!g.encounteredCharacters.some(id=>SHELVED_CHARACTERS.includes(id)));
 // A run already under way as one of them still loads.
 const run=new Game(5,[],0,'druid');assert.ok(Game.restore(run.serialize()));
});

test('purchase transaction is copy-on-success and demo gates all purchases',()=>{
 const p=normalizeProfile();p.protocol={balance:150,earned:150};const next=grantUnlock(p,'ninja','purchase');assert.equal(next.protocol.balance,50);assert.equal(p.protocol.balance,150);   // 3.156.0: every operator costs 100assert.equal(grantUnlock(next,'ninja','purchase'),false);assert.equal(grantUnlock(next,'druid','purchase'),false);assert.equal(grantUnlock(p,'ninja','purchase',{simulation:true}),false);assert.equal(grantUnlock(p,'ninja','purchase',{settings:{demo:true}}),false);assert.deepEqual(availableCharacters(next,{demo:true}),STARTING_CHARACTERS);
});
test('locked ongoing character survives migration; old carrying spills without losing rounds',()=>{
 const g=new Game(33,[],0,'ninja'),raw=JSON.parse(g.serialize());raw.version=44;oldScaleAmmo(raw.data);raw.data.carryLevel=carryLevels(3);raw.data.player.reserve=120;
 const h=Game.restore(JSON.stringify(raw));assert.ok(h);assert.equal(h.player.character,'ninja');assert.equal(h.carryLevel.rifle,0);assert.equal(h.player.reserve,216);assert.ok(h.items.some(i=>i.type==='ammo'&&i.x===h.player.x&&i.y===h.player.y&&i.amount===144));assert.deepEqual(Game.restore(h.serialize()).items,h.items);   // 120 old rounds are 360 today
});
test('endless factions and corpse positions are deterministic; encounters never repeat, no lore or demo corpses',()=>{
 const a=new Game(1,[],0,'soldier','onyx','endless'),b=new Game(1,[],0,'soldier','onyx','endless'),factions=new Set();
 for(let floor=1;floor<=35;floor++){for(const g of [a,b]){g.floor=floor;g.loadFloor();}factions.add(a.facilityFaction);assert.equal(a.facilityFaction,b.facilityFaction);assert.deepEqual(a.operatorCorpse,b.operatorCorpse);assert.ok(!a.items.some(i=>i.type==='lore'));if(floor<5)assert.equal(a.operatorCorpse,null);}
 assert.ok(factions.size>1);assert.equal(new Set(a.encounteredCharacters).size,a.encounteredCharacters.length);assert.ok(a.encounteredCharacters.length>0);assert.ok(Game.restore(a.serialize()));
 const c=new Game(1,[],0,'soldier','onyx','endless',{facilityFaction:'rebel'});c.floor=20;c.loadFloor();assert.equal(c.facilityFaction,'rebel');
 UNLOCK_SETTINGS.demo=true;try{populateRunUnlocks(a);assert.equal(a.operatorCorpse,null);}finally{UNLOCK_SETTINGS.demo=false;}
});
// 3.151.0 (user 2026-09-20): corpses from endless floor 5 at 10% a floor up to 50%, never more than 4 dry floors in a row,
// announced in the log and marked with a beam.
test('corpse chance starts on floor 5 and a fifth floor after four dry ones always has one',()=>{
 assert.deepEqual([4,5,6,8,9,20].map(corpseChance),[0,.1,.2,.4,.5,.5]);
 let hits=0,floors=0;
 for(let seed=1;seed<=400;seed++){let dry=0;for(let floor=1;floor<=16;floor++){const hit=corpseFloor(seed,floor);if(floor<5){assert.equal(hit,false);continue;}floors++;hits+=hit;dry=hit?0:dry+1;assert.ok(dry<=4,`seed ${seed} floor ${floor}`);}}
 assert.ok(hits/floors>.4&&hits/floors<.6,`rate ${hits/floors}`);
 const g=new Game(1,[],0,'soldier','onyx','endless');let floor=5;while(!corpseFloor(g.seed,floor))floor++;
 g.floor=floor;g.logs=[];g.loadFloor();assert.ok(g.operatorCorpse);assert.ok(g.logs.some(l=>l.text===CORPSE_NOTE));
 let dry=floor+1;while(corpseFloor(g.seed,dry))dry++;g.floor=dry;g.logs=[];g.loadFloor();assert.equal(g.operatorCorpse,null);assert.ok(!g.logs.some(l=>l.text===CORPSE_NOTE));
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
 fail=false;s.storage.available=true;writes=0;assert.ok(s.grantUnlock(g,'ninja','purchase'));assert.equal(writes,1);assert.equal(s.startCampaign({character:'ninja',seed:4}).player.character,'ninja');assert.equal(s.startKillhouse({mode:'arcade',character:'ninja'}).player.character,'ninja');assert.equal(s.profile().protocol.balance,1900);assert.equal(s.grantUnlock(g,'ninja','purchase'),false);
 g.encounteredCharacters.push('bulwark');g.operatorCorpse={...g.player,character:'bulwark',recovered:false};fail=true;assert.equal(g.recoverOperator(),false);assert.equal(g.operatorCorpse.recovered,false);fail=false;s.storage.available=true;assert.ok(g.recoverOperator());assert.ok(s.profile().unlocks.characters.includes('bulwark'));
 const item=g.items.find(i=>i.type==='lore');const story=collectStory(g,item);g.status='dead';s.recordResult(g);assert.ok(!s.profile().unlocks.stories.includes(story.id));assert.ok(s.profile().unlocks.characters.includes('bulwark'));
 const winner=s.connectUnlocks(new Game(4));collectStory(winner,winner.items.find(i=>i.type==='lore'));winner.status='won';fail=true;s.recordResult(winner);assert.equal(s.profile().unlocks.stories.length,0);fail=false;s.storage.available=true;s.recordResult(winner);assert.equal(s.profile().unlocks.stories.length,1);s.recordResult(winner);assert.equal(s.profile().unlocks.stories.length,1);
 const before=memory.get('ash-profile');assert.equal(s.grantUnlock(createKillhouse(),'bulwark','corpse'),false);assert.equal(memory.get('ash-profile'),before);
 }finally{delete globalThis.localStorage;STORIES.splice(0,STORIES.length,...original);UNLOCK_CATALOG.splice(UNLOCK_CATALOG.indexOf(fixture),1);}
});

test('a v7 profile rewritten by a 3.89 tab keeps its unlocks; refunds never exceed spending',()=>{
 const fixture={id:'qa-ledger-story',title:'QA',body:'QA',faction:'any',floors:[1,6],price:100,kind:'story',sources:['extraction']};STORIES.push(fixture);UNLOCK_CATALOG.push(fixture);try{
 const p=normalizeProfile();p.protocol={balance:1200,earned:1200};
 const bought=grantUnlock(grantUnlock(p,'ninja','purchase'),'qa-ledger-story','purchase',{settings:{...UNLOCK_SETTINGS,storiesWip:false}});   // 3.190.0: records are for sale again once the stories return
 assert.deepEqual(bought.unlockLedger,{characters:[...STARTING_CHARACTERS,'ninja'],stories:['qa-ledger-story']});
 // The 3.89 normalizeProfile writes version 6 and rebuilds unlocks without stories, but keeps unknown top-level fields.
 const downgraded={...JSON.parse(JSON.stringify(bought)),version:6,unlocks:{weapons:[],characters:['operator',...bought.unlocks.characters]}};
 const restored=normalizeProfile(downgraded);
 assert.deepEqual(restored.unlocks.characters,[...STARTING_CHARACTERS,'ninja']);assert.deepEqual(restored.unlocks.stories,['qa-ledger-story']);assert.equal(restored.protocol.balance,1000);   // 3.156.0: 100 for the operator, 100 for the record
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
