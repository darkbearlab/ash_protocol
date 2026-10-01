// 3.210.0 (user rule 2026-10-01, docs/CHECKLIST.md section 3): an unfinished run saved by a version below RUN_SAVE_FLOOR
// is settled exactly like 放棄任務 on load (src/stale-runs.js), its raw save kept in a backup key, the profile untouched
// beyond that settlement; a current run loads as before.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game,SAVE_VERSION} from '../src/engine.js';
import {RUN_SAVE_FLOOR} from '../src/data.js';
import {STORY_IDS} from '../src/story-data.js';
import {normalizeProfile} from '../src/progression.js';
import {makeBackup,decodeBackup} from '../src/backup.js';
import {settleRun,settleStaleRun,staleRunOf} from '../src/stale-runs.js';

let serial=0;
async function harness(){
 const memory=new Map([['ash-save','live-campaign'],['ash-profile','live-profile'],['qa-ash-language','en'],['qa-ash-smoke-quality','low'],['qa-ash-backup-before-restore','an older backup'],['qa-ash-run-log','a log']]);let fail=null;
 globalThis.location={search:'?test=1'};
 globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>{if(fail===`set:${k}`){fail=null;throw Error('write failed');}memory.set(k,v);},removeItem:k=>{if(fail===`remove:${k}`){fail=null;throw Error('remove failed');}memory.delete(k);}};
 const storage=await import(`../src/storage.js?stale=${serial++}`);
 return {memory,storage,failNext:op=>fail=op};
}
// A profile with something in every part a player keeps (a finished run in its history among them), and the old run's
// own ledger line as play credited it.
const OTHER=new Game(9,[],0,'soldier','onyx');
function profileWith(g){
 const p=normalizeProfile({version:7,runs:2,wins:0,bestFloor:2,bestKills:9,protocol:{balance:50,earned:80},unlocks:{weapons:[],characters:['berserker'],stories:[STORY_IDS[0]]}});
 settleRun(p,{...OTHER,status:'won'});p.protocolRuns[g.runId]={earned:5,recorded:false};return p;
}
function oldRun(version=RUN_SAVE_FLOOR-1){const g=new Game(4242,[],0,'bulwark','onyx');g.protocol.earned=5;g.turn=17;const raw=JSON.parse(g.serialize());raw.version=version;return {g,raw:JSON.stringify(raw)};}

test('the floor is this version: every save written before 3.210.0 is an old run, a current one is not',()=>{
 assert.equal(SAVE_VERSION,87);assert.equal(RUN_SAVE_FLOOR,87,'saves of 3.209.0 and earlier (86 and below) are dropped');
 const {g,raw}=oldRun(86);assert.deepEqual(staleRunOf(raw),{version:86,runId:g.runId});
 assert.equal(staleRunOf(g.serialize()),null,'a run saved by this version continues');
 const done=JSON.parse(raw);done.data.status='dead';assert.equal(staleRunOf(JSON.stringify(done)),null,'only an unfinished run');
 assert.equal(staleRunOf('not json'),null);assert.equal(staleRunOf(JSON.stringify({version:'86',data:{status:'playing'}})),null);
});

test('an old unfinished run is settled like 放棄任務: nothing loads, the raw save is kept, the profile keeps everything else',async()=>{
 const {memory,storage}=await harness(),{g,raw}=oldRun();
 memory.set('qa-ash-profile',JSON.stringify(profileWith(g)));memory.set('qa-ash-save',raw);
 assert.equal(storage.loadGame(),null,'the run is not continued');
 assert.equal(memory.get(`qa-${storage.DROPPED_SAVE_KEY}`),raw,'the raw save is kept in its backup key');
 assert.equal(memory.has('qa-ash-save'),false,'and the run is closed');
 assert.deepEqual(storage.storage.droppedRun,{version:RUN_SAVE_FLOOR-1,rewarded:true,kept:true},'the title screen is told');
 const p=storage.profile();
 assert.equal(p.runs,4);assert.equal(p.wins,1);assert.equal(p.protocolRuns[g.runId].recorded,true);
 assert.equal(p.history[0].id,g.runId);assert.equal(p.history[0].outcome,'abandoned');assert.equal(p.history[0].won,false);assert.equal(p.history[0].character,'bulwark');assert.equal(p.history[0].turn,17);
 assert.deepEqual(p.protocol,{balance:50,earned:80},'points earned in play stay, nothing more');
 assert.deepEqual(p.unlocks.characters.includes('berserker'),true);assert.deepEqual(p.unlocks.stories,[STORY_IDS[0]]);assert.equal(p.history[1].id,OTHER.runId);assert.equal(p.bestKills,9);
 for(const [k,v] of [['ash-save','live-campaign'],['ash-profile','live-profile'],['qa-ash-language','en'],['qa-ash-smoke-quality','low'],['qa-ash-backup-before-restore','an older backup'],['qa-ash-run-log','a log']])assert.equal(memory.get(k),v,`${k} untouched`);
 // The same as abandoning it in Settings would have recorded.
 const {memory:m2,storage:s2}=await harness(),again=Game.restore(raw);m2.set('qa-ash-profile',JSON.stringify(profileWith(g)));s2.saveGame(again);assert.equal(s2.abandonRun(again),true);
 const q=s2.profile(),strip=e=>({...e,date:undefined});assert.deepEqual(strip(q.history[0]),strip(p.history[0]));assert.deepEqual(q.protocol,p.protocol);assert.equal(q.runs,p.runs);
 storage.startCampaign({seed:5,character:'soldier'});assert.equal(storage.storage.droppedRun,null,'the notice is gone once a new run starts');
});

test('a run saved by this version loads as before; nothing is settled or kept aside',async()=>{
 const {memory,storage}=await harness(),g=new Game(77,[],0,'ninja','onyx');memory.set('qa-ash-profile',JSON.stringify(profileWith(g)));memory.set('qa-ash-save',g.serialize());
 const back=storage.loadGame();assert.ok(back);assert.equal(back.runId,g.runId);assert.deepEqual(back.player,g.player);
 assert.equal(memory.has(`qa-${storage.DROPPED_SAVE_KEY}`),false);assert.equal(storage.profile().runs,3);assert.equal(storage.storage.droppedRun,null);
});

test('an old save that cannot be read is settled as abandoned with no rewards; one without a run id is just closed',async()=>{
 const {memory,storage}=await harness(),{g,raw}=oldRun(),broken=JSON.parse(raw);delete broken.data.player;const text=JSON.stringify(broken);
 memory.set('qa-ash-profile',JSON.stringify(profileWith(g)));memory.set('qa-ash-save',text);
 assert.equal(storage.loadGame(),null);assert.equal(memory.get('qa-ash-save-abandoned'),text);assert.equal(memory.has('qa-ash-save'),false);
 const p=storage.profile();assert.equal(p.runs,4);assert.equal(p.protocolRuns[g.runId].recorded,true);assert.equal(p.protocolRuns[g.runId].earned,5);
 assert.equal(p.history[0].id,OTHER.runId,'no history line for a run it could not read');assert.deepEqual(p.protocol,{balance:50,earned:80});
 assert.deepEqual(storage.storage.droppedRun,{version:RUN_SAVE_FLOOR-1,rewarded:false,kept:true});
 const {memory:m2,storage:s2}=await harness(),bare=JSON.stringify({version:12,data:{status:'playing'}});m2.set('qa-ash-profile',JSON.stringify(profileWith(g)));m2.set('qa-ash-save',bare);
 assert.equal(s2.loadGame(),null);assert.equal(m2.get('qa-ash-save-abandoned'),bare);assert.equal(m2.has('qa-ash-save'),false);assert.equal(s2.profile().runs,3,'nothing to count it under');
});

test('settling is all or nothing and never counts a run twice',async()=>{
 // The profile write fails: the save stays, the profile is untouched, and the next load settles it.
 const {memory,storage,failNext}=await harness(),{g,raw}=oldRun();memory.set('qa-ash-profile',JSON.stringify(profileWith(g)));memory.set('qa-ash-save',raw);
 failNext('set:qa-ash-profile');assert.equal(storage.loadGame(),null);assert.equal(memory.get('qa-ash-save'),raw);assert.equal(storage.profile().runs,3);assert.equal(storage.storage.droppedRun,null);
 storage.storage.available=true;assert.equal(storage.loadGame(),null);assert.equal(storage.profile().runs,4);assert.equal(memory.has('qa-ash-save'),false);
 // The copy's first write fails: it is tried once more, and the run is settled either way.
 const {memory:m3,storage:s3,failNext:f3}=await harness();m3.set('qa-ash-profile',JSON.stringify(profileWith(g)));m3.set('qa-ash-save',raw);
 f3('set:qa-ash-save-abandoned');assert.equal(s3.loadGame(),null);assert.equal(m3.get('qa-ash-save-abandoned'),raw);assert.equal(s3.storage.droppedRun.kept,true);assert.equal(s3.profile().runs,4);
 // The profile is written but the save cannot be removed: the next load settles it again without counting it again.
 const {memory:m2,storage:s2,failNext:f2}=await harness();m2.set('qa-ash-profile',JSON.stringify(profileWith(g)));m2.set('qa-ash-save',raw);
 f2('remove:qa-ash-save');assert.equal(s2.loadGame(),null);assert.equal(m2.get('qa-ash-save'),raw);assert.equal(s2.profile().runs,4);
 s2.storage.available=true;assert.equal(s2.loadGame(),null);assert.equal(m2.has('qa-ash-save'),false);const p=s2.profile();assert.equal(p.runs,4);assert.equal(p.history.filter(h=>h.id===g.runId).length,1);
 const twice=settleStaleRun(settleStaleRun(profileWith(g),raw).profile,raw);assert.equal(twice.profile.runs,4);
});

test('a full backup holding an old run restores its profile with the run settled, and refuses nothing for it',async()=>{
 const {g,raw}=oldRun(),backup={format:'ash-protocol-backup',version:1,namespace:'qa',createdAt:new Date().toISOString(),profile:profileWith(g),campaign:JSON.parse(raw)};
 const decoded=decodeBackup(JSON.stringify(backup),'qa');
 assert.equal(decoded.game,null);assert.equal(decoded.snapshot.campaign,null);assert.deepEqual(decoded.dropped,{version:RUN_SAVE_FLOOR-1,rewarded:true});
 assert.equal(decoded.snapshot.profile.runs,4);assert.equal(decoded.snapshot.profile.history[0].outcome,'abandoned');assert.deepEqual(decoded.snapshot.profile.unlocks.stories,[STORY_IDS[0]]);
 // A broken old campaign no longer sinks the whole backup.
 const broken={...backup,campaign:{...JSON.parse(raw),data:{...JSON.parse(raw).data,player:undefined}}};assert.equal(decodeBackup(JSON.stringify(broken),'qa').dropped.rewarded,false);
 // A current run still travels in a backup.
 const now=new Game(78,[],0,'recon','onyx'),fresh=decodeBackup(JSON.stringify(makeBackup(now,normalizeProfile(),'qa')),'qa');assert.equal(fresh.dropped,null);assert.equal(fresh.game.runId,now.runId);
 // Restoring it through the storage writes the settled profile and leaves no save behind.
 const {memory,storage}=await harness();memory.set('qa-ash-profile',JSON.stringify(normalizeProfile()));
 const next=storage.restoreBackup(JSON.stringify(backup),new Game(79));assert.ok(next.dropped);assert.equal(memory.has('qa-ash-save'),false);assert.equal(storage.profile().runs,4);
});

// Independent review of 3.210.0 (2026-10-01): four findings in the settlement.
test('review: settling never credits more than the run\'s ledger line holds (a backup cannot over-claim)',async()=>{
 const {g,raw}=oldRun(),claim=JSON.parse(raw);claim.data.protocol.earned=5000;
 const backup={format:'ash-protocol-backup',version:1,namespace:'qa',createdAt:new Date().toISOString(),profile:profileWith(g),campaign:claim};
 const decoded=decodeBackup(JSON.stringify(backup),'qa');
 assert.deepEqual(decoded.snapshot.profile.protocol,{balance:50,earned:80},'nothing beyond the 5 the ledger already credited');
 assert.equal(decoded.snapshot.profile.history[0].protocol,5);assert.equal(decoded.snapshot.profile.runs,4);
 // The same through the storage, from an edited local save.
 const {memory,storage}=await harness();memory.set('qa-ash-profile',JSON.stringify(profileWith(g)));memory.set('qa-ash-save',JSON.stringify(claim));
 assert.equal(storage.loadGame(),null);assert.deepEqual(storage.profile().protocol,{balance:50,earned:80});
});

test('review: a full storage keeps the settlement — the run is counted once even when its raw copy has no room',async()=>{
 // New keys over 10 KB are refused (QuotaExceededError); replacing a key works.
 const memory=new Map();globalThis.location={search:'?test=1'};
 globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>{if(!memory.has(k)&&v.length>10000)throw Object.assign(Error('QuotaExceededError'),{name:'QuotaExceededError'});memory.set(k,v);},removeItem:k=>memory.delete(k),get length(){return memory.size;},key:i=>[...memory.keys()][i]};
 const storage=await import(`../src/storage.js?stale=${serial++}`),{g,raw}=oldRun();
 memory.set('qa-ash-profile',JSON.stringify(profileWith(g)));memory.set('qa-ash-save',raw);
 assert.equal(storage.loadGame(),null);assert.deepEqual(storage.storage.droppedRun,{version:RUN_SAVE_FLOOR-1,rewarded:true,kept:false});
 assert.equal(memory.has('qa-ash-save-abandoned'),false);assert.equal(memory.get('qa-ash-save'),raw,'with no copy the save stays where it is');
 let p=storage.profile();assert.equal(p.runs,4);assert.equal(p.protocolRuns[g.runId].recorded,true);assert.equal(p.history[0].outcome,'abandoned');
 // The next deploy saves over it; the run is not counted again.
 const next=storage.startCampaign({seed:5,character:'soldier'});storage.saveGame(next);
 p=storage.profile();assert.equal(p.runs,4);assert.equal(p.history.filter(h=>h.id===g.runId).length,1);
 // A total quota: the old pre-migration copies (and an earlier dropped run's) are let go to make room for this one.
 const big=new Map(),limit=raw.length*2+JSON.stringify(profileWith(g)).length*3;
 globalThis.localStorage={getItem:k=>big.get(k)??null,setItem:(k,v)=>{const used=[...big].reduce((n,[key,val])=>n+(key===k?0:val.length),0);if(used+v.length>limit)throw Error('QuotaExceededError');big.set(k,v);},removeItem:k=>big.delete(k),get length(){return big.size;},key:i=>[...big.keys()][i]};
 const s2=await import(`../src/storage.js?stale=${serial++}`);big.set('qa-ash-profile',JSON.stringify(profileWith(g)));big.set('qa-ash-save',raw);big.set('qa-ash-save-v85-backup','x'.repeat(raw.length));big.set('qa-ash-language','en');
 assert.equal(s2.loadGame(),null);assert.equal(s2.storage.droppedRun.kept,true);assert.equal(big.get('qa-ash-save-abandoned'),raw);assert.equal(big.has('qa-ash-save-v85-backup'),false);assert.equal(big.has('qa-ash-save'),false);assert.equal(s2.profile().runs,4);assert.equal(big.get('qa-ash-language'),'en','settings stay');
});

test('review: a readable save from before run ids is settled under the id the loader gives it',async()=>{
 const raw=readFileSync(new URL('../qa/fixtures/legacy-3.1.2-save.json',import.meta.url),'utf8');
 assert.equal(JSON.parse(raw).data.runId,undefined);assert.deepEqual(staleRunOf(raw),{version:JSON.parse(raw).version,runId:null});
 const id=Game.restore(raw).runId,p=settleStaleRun(normalizeProfile({version:7,runs:2}),raw);
 assert.equal(p.rewarded,true,'read, so counted with its record');assert.equal(p.profile.runs,3);assert.equal(p.profile.history[0].id,id);assert.equal(p.profile.history[0].outcome,'abandoned');assert.equal(p.profile.protocolRuns[id].recorded,true);
 assert.deepEqual(p.profile.protocol,{balance:0,earned:0});
 const {memory,storage}=await harness();memory.set('qa-ash-profile',JSON.stringify(normalizeProfile({version:7})));memory.set('qa-ash-save',raw);
 assert.equal(storage.loadGame(),null);assert.equal(storage.storage.droppedRun.rewarded,true,'the notice says abandoned, not unreadable');
});
