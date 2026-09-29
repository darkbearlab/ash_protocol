// The inner-loop test run (3.206.1): the whole suite minus the slow generation sweeps listed in qa/slow-tests.txt.
// `npm test` stays the full run and CI runs it on every push; use this while iterating, the full suite before handing off.
//   npm run test:quick                                   every test file, slow tests skipped
//   npm run test:quick -- tests/fire.test.mjs            only these files, slow tests skipped
import {readdirSync,readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const slow=readFileSync(root+'qa/slow-tests.txt','utf8').split(/\r?\n/).map(s=>s.trim()).filter(s=>s&&!s.startsWith('#'));
const extra=process.argv.slice(2),picked=extra.filter(a=>a.endsWith('.test.mjs'));
const files=picked.length?picked:readdirSync(root+'tests').filter(f=>f.endsWith('.test.mjs')).sort().map(f=>'tests/'+f);
const args=['--test',...slow.map(n=>`--test-skip-pattern=^${escape(n)}$`),...extra.filter(a=>!a.endsWith('.test.mjs')),...files];
process.exit(spawnSync(process.execPath,args,{stdio:'inherit',cwd:root}).status??1);
