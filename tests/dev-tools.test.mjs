import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// 3.206.1 (docs/CHECKLIST.md): the development tools stay usable. A slow-test name that no longer exists would quietly
// stop being skipped, and a broken save fuzz would quietly stop checking saves.
const root=fileURLToPath(new URL('../',import.meta.url));

test('every name in qa/slow-tests.txt is a test that exists, so the quick run skips exactly those',()=>{
  const names=readFileSync(root+'qa/slow-tests.txt','utf8').split(/\r?\n/).map(s=>s.trim()).filter(s=>s&&!s.startsWith('#'));
  const sources=readdirSync(root+'tests').filter(f=>f.endsWith('.test.mjs')).map(f=>readFileSync(root+'tests/'+f,'utf8')).join('\n');
  assert.ok(names.length>=20,'the list holds the slow generation sweeps');
  for(const name of names)assert.ok(sources.includes(`test('${name}'`)||sources.includes(`test("${name}"`)||sources.includes('test(`'+name+'`'),name);
  const pkg=JSON.parse(readFileSync(root+'package.json','utf8'));
  assert.equal(pkg.scripts['test:quick'],'node tools/test-quick.mjs');
});

test('the save fuzz plays, saves, restores and replays a few steps cleanly',()=>{
  const run=spawnSync(process.execPath,['qa/save-fuzz.mjs','--faction','swarm','--floors','3','--seeds','1','--classes','soldier','--steps','12'],{cwd:root,encoding:'utf8'});
  assert.equal(run.status,0,run.stdout+run.stderr);
  const stats=JSON.parse(run.stdout.trim().split(/\r?\n/).at(-1));
  assert.equal(stats.runs,1);assert.ok(stats.steps>0);
  assert.equal(stats.refusedBefore+stats.refusedAfter+stats.diverged,0);
});

// 3.206.1: the trace a behaviour-neutral refactor is checked with (docs/CHECKLIST.md 1).
test('the save-fuzz trace is the same run after run, and --against names the first step that differs',()=>{
  const dir=mkdtempSync(join(tmpdir(),'ash-trace-')),a=join(dir,'a.trace'),b=join(dir,'b.trace');
  try{
    const args=['qa/save-fuzz.mjs','--faction','rebel','--floors','3','--seeds','1','--classes','soldier','--steps','6','--near-boss','--trace'];
    const first=spawnSync(process.execPath,[...args,a],{cwd:root,encoding:'utf8'});assert.equal(first.status,0,first.stdout+first.stderr);
    const lines=readFileSync(a,'utf8').trim().split(/\r?\n/);assert.equal(lines.length,6);
    assert.match(lines[0],/^rebel 3 1 soldier 0 \S+ [0-9a-f]{16} /,'where, the action and the state hash come first');
    const again=spawnSync(process.execPath,[...args,b,'--against',a],{cwd:root,encoding:'utf8'});assert.equal(again.status,0,again.stdout);assert.match(again.stdout,/trace identical/);
    writeFileSync(a,lines.map((l,i)=>i===3?l.replace(/ [0-9a-f]{16} /,' 0000000000000000 '):l).join('\n')+'\n');
    const differs=spawnSync(process.execPath,[...args,b,'--against',a],{cwd:root,encoding:'utf8'});assert.equal(differs.status,1);assert.match(differs.stdout,/differs from .* at line 4/);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
