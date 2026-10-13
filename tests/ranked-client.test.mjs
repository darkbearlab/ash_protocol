import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {sourceFamily} from './helpers/source.mjs';

// 3.224.0 ranked daily, the browser side (src/ranked-client.js, docs/LEADERBOARD.md): the identity in the profile, a
// run recorded by the client that the server's check accepts, and the queue that sends finished runs. The storage here
// is a plain map standing in for the browser's; the server is a stub.
const memory=new Map();
globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k),key:i=>[...memory.keys()][i]??null,get length(){return memory.size;}};
const {saveGame,loadGame,startCampaign,profile,isRankedRun,rankedRun,RANKED_RUN_KEY,abandonRun}=await import('../src/storage.js');
const {trackRun,persistRunLog,storedRunLog}=await import('../src/run-log.js');
const {rankedParams,verifyRankedRun}=await import('../src/ranked-daily.js');
const {SCORES_URL,LOCAL_SCORES_URL,RANKED_QUEUE_KEY,channelOf,flushRanked,playerIdOf,rankedQueue,rankedStatus,rankedVerdicts,saveRankedName,scoresBase,settleRankedRun,startRankedCampaign,taipeiDay}=await import('../src/ranked-client.js');
const {newRankedKey,rankedName,validRankedKey,validRankedName}=await import('../src/ranked-profile.js');
const {normalizeProfile}=await import('../src/progression.js');
const {makeBackup,decodeBackup}=await import('../src/backup.js');
const {collectStory}=await import('../src/run-unlocks.js');
const {STORIES}=await import('../src/story-data.js');
const {VERSION}=await import('../src/version.js');

const SPEC={format:1,day:'2026-10-13',variant:'standard',seed:14,mission:'extraction',facility:'loyalist',difficulty:'hard',realMode:true};
const TICKET={ticket:'ticket-1',spec:SPEC,submitBy:Date.now()+86400000};
const turn=(g,type,arg)=>{g.action(type,arg);saveGame(g);persistRunLog(g);};
function play(g,steps){for(let i=0;i<steps&&g.status==='playing';i++)turn(g,...[['move',[1,0]],['wait'],['move',[0,1]],['wait'],['move',[-1,0]]][i%5]);}
const unpack=async b64=>JSON.parse(await new Response(new Blob([Buffer.from(b64,'base64')]).stream().pipeThrough(new DecompressionStream('gzip'))).text());
function rankedRunToEnd(status){
  memory.clear();saveRankedName('ACE');
  const g=startRankedCampaign(TICKET,{character:'soldier',portrait:'onyx'});trackRun(g,rankedParams(SPEC,g));play(g,6);
  g.status=status;saveGame(g);persistRunLog(g);return g;
}

test('the callsign keeps three capitals or digits; the key is random and the profile and a backup keep both',()=>{
  assert.equal(rankedName(' ab-c9z '),'ABC');assert.equal(rankedName('名字x1'),'X1');
  assert.ok(validRankedName('A1Z'));for(const bad of ['ab1','ABCD','AB','A B',null])assert.ok(!validRankedName(bad));
  const key=newRankedKey();assert.ok(validRankedKey(key));assert.equal(key.length,32);assert.notEqual(newRankedKey(),key);
  const p=normalizeProfile({ranked:{key,name:'ACE',extra:1}});assert.deepEqual(p.ranked,{key,name:'ACE'});
  assert.equal(normalizeProfile({ranked:{key:'short',name:'ACE'}}).ranked,undefined,'a damaged identity is asked for again');
  const backup=makeBackup(null,p,'qa');assert.deepEqual(decodeBackup(JSON.stringify(backup),'qa').snapshot.profile.ranked,{key,name:'ACE'});
  const bad=JSON.parse(JSON.stringify(backup));bad.profile.ranked={key,name:'<b>'};assert.throws(()=>decodeBackup(JSON.stringify(bad),'qa'));
  memory.clear();const first=saveRankedName('ACE');assert.ok(validRankedKey(first.key));
  assert.equal(saveRankedName('BOB').key,first.key,'renaming keeps the key');assert.deepEqual(profile().ranked,{key:first.key,name:'BOB'});
});

test('the server address, the channel, the Taipei day and the player id match the server',async()=>{
  assert.equal(scoresBase('',false),SCORES_URL);assert.equal(scoresBase('?test=1',true),LOCAL_SCORES_URL);
  assert.equal(scoresBase('?test=1&scores=live',true),SCORES_URL);assert.equal(scoresBase('?scores=off',false),'');assert.equal(scoresBase('?scores=local',false),LOCAL_SCORES_URL);
  assert.equal(channelOf('html-classic.itch.zone'),'itch');assert.equal(channelOf('darkbearlab.github.io'),'web');assert.equal(channelOf('localhost'),'dev');
  assert.equal(taipeiDay(Date.UTC(2026,9,13,15,59)),'2026-10-13');assert.equal(taipeiDay(Date.UTC(2026,9,13,16,0)),'2026-10-14');assert.equal(taipeiDay(Date.UTC(2026,9,13,16,0),1),'2026-10-13');
  const key=newRankedKey();assert.equal(await playerIdOf(key),createHash('sha256').update(`ash-player|${key}`).digest('hex').slice(0,32));
});

test('a ranked run recorded by the client passes the server check, and a reload neither binds it to the profile nor breaks its log',()=>{
  memory.clear();const all=normalizeProfile();all.unlocks.stories=STORIES.map(s=>s.id);localStorage.setItem('ash-profile',JSON.stringify(all));
  const g=startRankedCampaign(TICKET,{character:'soldier',portrait:'onyx'});
  assert.deepEqual(rankedRun(),{runId:g.runId,ticket:'ticket-1',spec:SPEC,submitBy:TICKET.submitBy,language:'zh-TW',startedAt:rankedRun().startedAt});
  assert.equal(isRankedRun(g),true);assert.equal(trackRun(g,rankedParams(SPEC,g)).params.ranked.day,SPEC.day);
  play(g,15);assert.deepEqual(verifyRankedRun(SPEC,storedRunLog(),{language:'zh-TW'}),{ok:false,reason:'unfinished'},'start, steps and hashes all match');
  const again=loadGame();assert.equal(again.runId,g.runId);assert.ok(trackRun(again).ops.length>=15,'the log continues');
  // Every story is owned, yet the ranked run picks from its own start as the server's playback does.
  assert.ok(collectStory(again,{x:1,y:1,floor:1}),'not bound to the profile');
  const normal=startCampaign({seed:14,character:'soldier',mission:'extraction',options:{facilityFaction:'loyalist'}});
  assert.equal(isRankedRun(normal),false);assert.equal(collectStory(normal,{x:1,y:1,floor:1}),null,'a normal run is');
});

test('a finished ranked run is packed into the queue and sent; the result screen follows the answer',async()=>{
  const g=rankedRunToEnd('dead');assert.deepEqual(rankedStatus(g),{state:'settling'});
  assert.equal(await settleRankedRun(g),true);assert.equal(rankedRun(),null);assert.equal(await settleRankedRun(g),false,'once');
  assert.equal(rankedStatus(g).state,'queued');const [entry]=rankedQueue();
  assert.deepEqual(await unpack(entry.log),storedRunLog(),'the whole log, gzipped');
  const calls=[];globalThis.fetch=async(url,init)=>{calls.push({url,body:JSON.parse(init.body)});return new Response(JSON.stringify({ok:true,board:{version:VERSION},best:{rank:3},newBest:true,result:{status:'dead'}}),{status:200});};
  assert.deepEqual(await flushRanked('html-classic.itch.zone'),{sent:1,retryIn:0});
  assert.equal(calls[0].url,`${SCORES_URL}/v1/daily/runs`);
  const {log,...body}=calls[0].body;assert.equal(log,entry.log);
  assert.deepEqual(body,{ticket:'ticket-1',playerKey:profile().ranked.key,name:'ACE',version:VERSION,channel:'itch',language:'zh-TW'});
  assert.deepEqual(rankedQueue(),[]);assert.equal(memory.has(RANKED_QUEUE_KEY),false);
  const v=rankedStatus(g);assert.equal(v.state,'sent');assert.equal(v.rank,3);assert.equal(v.newBest,true);
});

test('the queue keeps runs through a lost connection, a server fault or a busy server, and drops what the server refuses',async()=>{
  rankedRunToEnd('won');
  const entry=id=>({runId:id,ticket:id,day:SPEC.day,submitBy:Date.now()+3600000,language:'en',version:VERSION,log:'H4sI'});
  localStorage.setItem(RANKED_QUEUE_KEY,JSON.stringify([{...entry('late'),submitBy:Date.now()-1},entry('a'),entry('b'),entry('c')]));
  let answers=[];globalThis.fetch=async()=>{const a=answers.shift();if(a==='down')throw new TypeError('offline');return new Response(JSON.stringify(a.body),{status:a.status});};
  answers=['down'];assert.deepEqual(await flushRanked('localhost'),{sent:1,retryIn:60000});
  assert.equal(rankedVerdicts().late.state,'expired','past its deadline: never sent');assert.deepEqual(rankedQueue().map(e=>e.runId),['a','b','c']);
  answers=[{status:422,body:{ok:false,error:'rejected',reason:'replay'}},{status:410,body:{ok:false,error:'closed'}},{status:429,body:{ok:false,error:'rate'}}];
  assert.deepEqual(await flushRanked('localhost'),{sent:2,retryIn:31000});
  assert.deepEqual(rankedVerdicts().a,{state:'rejected',reason:'replay',day:SPEC.day,at:rankedVerdicts().a.at});
  assert.equal(rankedVerdicts().b.state,'expired');assert.deepEqual(rankedQueue().map(e=>e.runId),['c']);
  answers=[{status:400,body:{ok:false,error:'version'}}];assert.deepEqual(await flushRanked('localhost'),{sent:0,retryIn:0});assert.equal(rankedQueue().length,1,'kept until the server knows this build');
  answers=[{status:409,body:{ok:false,error:'ticket-used'}}];assert.deepEqual(await flushRanked('localhost'),{sent:0,retryIn:90000});
  assert.equal(rankedQueue().length,1,'an earlier send is still being checked');
  answers=[{status:500,body:{ok:false,error:'server'}}];assert.deepEqual(await flushRanked('localhost'),{sent:0,retryIn:60000});
  answers=[{status:200,body:{ok:true,repeat:true,best:{rank:4},newBest:false,board:{version:VERSION},result:{}}}];await flushRanked('localhost');
  assert.deepEqual(rankedQueue(),[]);assert.equal(rankedVerdicts().c.rank,4,'its lost answer, given again');
});

test('an abandoned ranked run is not sent, and nothing is sent without a callsign',async()=>{
  memory.clear();const g=startRankedCampaign(TICKET,{character:'soldier',portrait:'onyx'});trackRun(g,rankedParams(SPEC,g));play(g,3);
  abandonRun(g);persistRunLog(g);assert.equal(await settleRankedRun(g),true);
  assert.equal(rankedStatus(g).state,'abandoned');assert.deepEqual(rankedQueue(),[]);
  localStorage.setItem(RANKED_QUEUE_KEY,JSON.stringify([{runId:'x',submitBy:Date.now()+1000}]));
  globalThis.fetch=async()=>assert.fail('no request without an identity');
  assert.deepEqual(await flushRanked('localhost'),{sent:0,retryIn:0});
});

test('controller wiring: the ranked start records the day, a finished run is sent, and its language is locked',()=>{
  const source=sourceFamily('controller');
  assert.ok(source.includes('trackRun(g,rankedParams(ticket.spec,g))'));
  assert.match(source,/function persist\(\)\{if\(tabLost\)return false;const ok=saveGame\(game\);persistRunLog\(game\);if\(game\.status!=='playing'&&isRankedRun\(game\)\)sendRanked\(\);/);
  assert.ok(source.includes("case 'language':{if(runIsLive()&&isRankedRun(game)){notify(t('ranked.languageLocked'));break;}"));
  assert.ok(source.includes('data-modal="language" lang="en"${rankedLock()?\' disabled\':\'\'}'));
  assert.ok(source.includes("sendRanked();window.addEventListener('online',()=>sendRanked());"));
  assert.ok(source.includes('${rankedResultMarkup(rankedStatus(g))}'));
});
