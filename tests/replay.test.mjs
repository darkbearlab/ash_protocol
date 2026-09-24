import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {Game} from '../src/engine.js';
import {REPLAY_FORMAT,textHash,stateHash,createReplay,startReplay,applyOp,makeOp,replayLog,recordReplay,validReplay} from '../src/replay.js';
import {play} from '../tools/balance.mjs';

// 3.124.0 (user request): one operation log reproduces a run in the text client and in the browser (docs/TEXT_PLAY.md).
const read=async path=>(await readFile(new URL(path,import.meta.url),'utf8')).replace(/\r\n/g,'\n');
const fresh=(faction='rebel',character='soldier',seed=4242)=>new Game(seed,[],0,character,'onyx','extraction',{facilityFaction:faction});
function botLog(seed,character,faction,maxActions){
  let log,recorder,game;
  class Recorded extends Game{constructor(a,b,c,d){super(a,b,c,d,'onyx','extraction',{facilityFaction:faction});log=createReplay(this,{seed:a}).log;recorder=recordReplay(this,log);game=this;}}
  play(seed,maxActions,character,Recorded);recorder.flush();return {log,game};
}

test('the hash reads the save, not its key order, and is the same string in any runtime',()=>{
  assert.equal(textHash('abc'),textHash('abc'));assert.notEqual(textHash('abc'),textHash('abd'));assert.match(textHash(''),/^[0-9a-f]{16}$/);
  const g=fresh(),restored=Game.restore(g.serialize());
  // A restored game carries the same content with fields in another order; the hash must not care.
  const player=restored.player;delete restored.player;restored.player=player;
  assert.notEqual(textHash(restored.serialize()),textHash(g.serialize()));assert.equal(stateHash(restored),stateHash(g));
  g.player.hp--;assert.notEqual(stateHash(restored),stateHash(g));
});

test('a log starts from a save, applies the four kinds of step, and records refusals too',()=>{
  const {log,game}=createReplay(fresh(),{seed:4242});
  assert.equal(log.format,REPLAY_FORMAT);assert.equal(validReplay(log),'');assert.equal(stateHash(startReplay(log.start)),log.startHash);
  const push=op=>{const result=applyOp(game,op);op.h=stateHash(game);log.ops.push(op);return result;};
  assert.equal(push(makeOp('action','move',[0,-1])),true);assert.equal(game.turn,2);
  const turn=game.turn,lines=game.logs.length;
  assert.equal(push(makeOp('action','reload')),false);assert.equal(game.turn,turn);assert.ok(game.logs.length>=lines);
  push(makeOp('target','nobody'));assert.equal(game.target,'nobody');
  assert.equal(push(makeOp('perk','damage')),false);assert.equal(push(makeOp('recover')),false);
  // The weapon action without an argument means "next weapon"; the log must keep it undefined, not null.
  const op=makeOp('action','weapon',undefined);assert.equal('arg' in op,false);
  const played=replayLog(JSON.parse(JSON.stringify(log)));assert.equal(played.mismatch,null);assert.equal(stateHash(played.game),stateHash(game));
});

test('replay names the first step that differs',()=>{
  const {log}=createReplay(fresh());const g=startReplay(log.start);
  for(const step of [[0,-1],[0,1],[1,0]]){const op=makeOp('action','move',step);applyOp(g,op);op.h=stateHash(g);log.ops.push(op);}
  log.ops[1].h='0000000000000000';
  const result=replayLog(log);assert.equal(result.mismatch.step,2);assert.equal(result.step,2);
  assert.match(validReplay({format:REPLAY_FORMAT,version:1,start:'x',ops:[{op:'teleport'}]}),/第 1 步/);
  assert.equal(validReplay({format:'save'}),'不是操作紀錄。');
});

test('recording a live game (the bot, or the browser controller) replays identically, perks and floors included',()=>{
  const {log,game}=botLog(11,'soldier','rebel',400);
  assert.ok(log.ops.some(o=>o.op==='perk'),'the run levelled up');assert.ok(game.floor>=2,'the run changed floors');
  const played=replayLog(log);assert.equal(played.mismatch,null);assert.equal(stateHash(played.game),stateHash(game));
  // Restoring between every step (the text client resumes from its cache) changes nothing either.
  let g=startReplay(log.start);
  for(const op of log.ops){if(g.status==='playing')g=Game.restore(g.serialize());applyOp(g,op);assert.equal(stateHash(g),op.h);}
});

test('text client: new, commands, verify; the cache resumes and a stale cache falls back to a full replay',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'ash-text-')),file=join(dir,'run.json'),run=(...args)=>execFileSync(process.execPath,[new URL('../tools/text-play.mjs',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'),...args],{encoding:'utf8'});
  try{
    assert.match(run('new',file,'--seed','4242','--faction','rebel'),/種子 4242/);
    const out=run(file,'n; s; wait; t zz; look');
    assert.match(out,/> n：移動 1 步/);assert.match(out,/> t zz：錯誤：視野內沒有 zz/);assert.match(out,/未執行：look/);
    const log=JSON.parse(await readFile(file,'utf8'));assert.equal(log.ops.length,3);assert.deepEqual(log.ops.map(o=>o.type),['move','move','wait']);
    assert.match(run('verify',file),/✓ 3 步全部相同/);
    await rm(`${file}.cache`);assert.match(run(file,'e'),/> e：/);assert.match(run('verify',file),/✓ 4 步全部相同/);
    assert.match(run(file,'help'),/go exit/);
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('browser wiring: test mode only, played through act(), no profile writes, offline file list',async()=>{
  const source=await read('../src/controller.js'),html=await read('../index.html'),worker=await read('../sw.js');
  assert.ok(html.includes('id="import-replay"'));assert.ok(worker.includes("'./src/replay.js'"));
  assert.match(source,/\$\{TEST_MODE\?`\$\{sec\('測試：操作紀錄'\)\}/);
  assert.match(source,/if\(TEST_MODE\)globalThis\.__ashReplay=/);
  assert.match(source,/act\(op\.type,op\.arg===undefined\?undefined:structuredClone\(op\.arg\)\)/);
  // 3.174.0: a death holds the results until the killed-in-action scene has played; the result is still recorded at once.
  assert.match(source,/lastStatus=game\.status;if\(!replay\)recordResult\(game\);if\(kia\)kia\.resultPending=true;else endRun\(\);/);
  // The replayed game is never connected to the profile, so it cannot grant unlocks or stories.
  const load=source.slice(source.indexOf('function loadReplay'),source.indexOf('function replayTick'));assert.ok(load.includes('game=start.game;'));assert.ok(!load.includes('connectUnlocks'));
});
