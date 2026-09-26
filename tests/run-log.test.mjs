import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// 3.186.0 run logs (src/run-log.js): every campaign run records itself beside the save, and the results screen hands it
// over. The storage here is a plain map standing in for the browser's.
const memory=new Map();
globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k),key:i=>[...memory.keys()][i]??null,get length(){return memory.size;}};
const {saveGame,loadGame,startCampaign,storage}=await import('../src/storage.js');
const {trackRun,persistRunLog,runLogFor,lastRunLog,runLogName,storedRunLog,runParams,RUN_LOG_KEY,noteRunError}=await import('../src/run-log.js');
const {replayLog,stateHash}=await import('../src/replay.js');
const {VERSION}=await import('../src/version.js');
const read=path=>readFile(new URL(path,import.meta.url),'utf8');

// What the controller does after each action: act, save, keep the log.
const turn=(g,type,arg)=>{g.action(type,arg);saveGame(g);persistRunLog(g);};
function play(g,steps){for(let i=0;i<steps&&g.status==='playing';i++){if(i%5===2&&g.visibleEnemies?.length)g.target=g.visibleEnemies[0].id;turn(g,...[['move',[1,0]],['wait'],['move',[0,1]],['fire'],['move',[-1,0]]][i%5]);}}

test('a new run records from its first turn, keeps the log beside the save, and replays to the same state',()=>{
  memory.clear();const g=startCampaign({seed:41,character:'soldier',mission:'extraction',options:{facilityFaction:'swarm'}});
  const log=trackRun(g);assert.equal(log.partial,false);assert.equal(log.runId,g.runId);assert.equal(log.build,VERSION);assert.deepEqual(log.params,runParams(g));
  assert.equal(trackRun(g),log,'tracking the same game again changes nothing');
  play(g,12);assert.ok(log.ops.length>=12);
  assert.ok(JSON.stringify(storedRunLog())===JSON.stringify(log),'written after each save');
  const played=replayLog(storedRunLog());assert.equal(played.mismatch,null);assert.equal(stateHash(played.game),stateHash(g));
});

test('a reload picks the same log up again; a save the log does not end at, or another version, starts a new one',()=>{
  memory.clear();const g=startCampaign({seed:47,character:'soldier',mission:'extraction'});trackRun(g);play(g,8);assert.equal(g.status,'playing');
  const before=storedRunLog().ops.length,resumed=loadGame();assert.notEqual(resumed,g);
  const again=trackRun(resumed);assert.equal(again.ops.length,before,'continued, not restarted');assert.equal(again.partial,false);
  play(resumed,6);assert.equal(resumed.status,'playing');assert.ok(storedRunLog().ops.length>before);assert.equal(replayLog(storedRunLog()).mismatch,null,'one log across the reload');
  // An imported or restored save no longer matches the log's last step.
  const other=loadGame();other.player.hp-=1;saveGame(other);const fresh=trackRun(other);
  assert.equal(fresh.ops.length,0);assert.equal(fresh.partial,other.turn);
  // A run resumed on another version starts over from where it stands.
  const stored=storedRunLog();stored.build='0.0.0';memory.set(RUN_LOG_KEY,JSON.stringify(stored));
  const next=loadGame();assert.equal(trackRun(next).build,VERSION);assert.equal(storedRunLog().ops.length,0);
});

test('a finished run keeps its result until the next run, and the file is named by seed, result and build',()=>{
  memory.clear();const g=startCampaign({seed:43,character:'soldier',mission:'extraction'});trackRun(g);play(g,3);
  g.status='dead';saveGame(g);persistRunLog(g);
  const log=runLogFor(g);assert.deepEqual(log.result,{status:'dead',floor:g.floor,deepest:g.deepestFloor||g.floor,turn:g.turn});
  assert.equal(runLogName(log),`ash-run-43-dead-${VERSION}.json`);assert.equal(lastRunLog(null)?.runId,g.runId,'settings can still hand it over');
  const h=startCampaign({seed:44,character:'soldier',mission:'extraction'});assert.equal(runLogFor(g)?.result?.status,'dead','kept until the next run records');
  trackRun(h);assert.equal(runLogFor(g),null);assert.equal(storedRunLog().runId,h.runId);
});

test('a log that cannot be written is dropped without touching the save or the storage warning',()=>{
  memory.clear();const g=startCampaign({seed:45,character:'soldier',mission:'extraction'});
  const setItem=globalThis.localStorage.setItem;globalThis.localStorage.setItem=(k,v)=>{if(k===RUN_LOG_KEY)throw new Error('QuotaExceededError');setItem(k,v);};
  try{
    assert.equal(trackRun(g),null);assert.equal(memory.has(RUN_LOG_KEY),false);
    g.action('wait');assert.equal(saveGame(g),true);assert.equal(storage.available,true);assert.equal(persistRunLog(g),false);assert.equal(trackRun(g),null,'not retried for this run');
  }finally{globalThis.localStorage.setItem=setItem;}
});

test('controller wiring: every live campaign records, never a simulation or replay; results and settings download it',async()=>{
  const source=await read('../src/controller.js'),worker=await read('../sw.js');
  assert.ok(worker.includes("'./src/run-log.js'"));
  assert.ok(source.includes("if(!replay&&!isSimulation(game)&&game.status==='playing'&&(entered||resumable))trackRun(game);"));
  assert.match(source,/function persist\(\)\{if\(tabLost\)return false;const ok=saveGame\(game\);persistRunLog\(game\);/);
  assert.ok(source.includes("window.addEventListener('pagehide',()=>{if(entered){saveGame(game);persistRunLog(game);}});"));
  const result=source.slice(source.indexOf('function showResult'),source.indexOf('function showResult')+3000);assert.ok(result.includes('${runRecordMarkup(game)}'));
  assert.match(source,/data-modal="runLog" \$\{lastRunLog\(game\)\?'':'disabled'\}/);
  assert.ok(source.includes("case 'runLog':"));assert.ok(!source.includes('recordStart'),'the manual test-mode recorder gave way');
});

// 3.197.0 (freeze audit): an unexpected error is noted in the log a tester sends (the last five, cut short), the replay
// still plays, and the controller shows a notice once instead of a silently stuck screen.
test('errors ride along in the run log without breaking its replay; the page reports them',async()=>{
  memory.clear();const g=startCampaign({seed:43,character:'soldier',mission:'extraction',options:{facilityFaction:'swarm'}});
  trackRun(g);play(g,4);
  for(let i=0;i<7;i++)assert.ok(noteRunError(`TypeError: boom ${i}
${'x'.repeat(600)}`));
  const log=storedRunLog();assert.equal(log.errors.length,5);assert.equal(log.errors[4].turn,g.turn);assert.ok(log.errors[0].message.startsWith('TypeError: boom 2'));assert.ok(log.errors.every(e=>e.message.length<=400));
  const played=replayLog(log);assert.equal(played.mismatch,null);assert.equal(stateHash(played.game),stateHash(g));
  const controller=await read('../src/controller.js');
  assert.match(controller,/addEventListener\('error',e=>\{if\(e\.error\|\|e\.message\)reportError\(e\.error\|\|e\.message\);\}\);/);
  assert.match(controller,/addEventListener\('unhandledrejection',e=>reportError\(e\.reason\)\);/);
});
