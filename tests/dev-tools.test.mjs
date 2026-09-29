import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
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
