import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {t} from '../src/i18n.js';

// 3.192.0 (user): on the results screen the operator (portrait, class, damage) sits above the unit/status block, and the
// points line is just the points; where to spend them is not taught there (nor anywhere outside the manual and UNLOCKS).
test('results: the operator row comes before the unit block, and the points line carries no lesson',()=>{
 const source=readFileSync(new URL('../src/controller.js',import.meta.url),'utf8'),body=source.slice(source.indexOf('function showResult(){'),source.indexOf('// Kill house sessions'));
 assert.ok(body.indexOf('result-identity')>0&&body.indexOf('result-identity')<body.indexOf('purgeReportMarkup(game)'));
 assert.equal((body.match(/result-identity/g)||[]).length,1);
 assert.doesNotMatch(body,/protocolNote/);
 assert.equal(t('controller.result.protocolTotal',{v:t('controller.result.protocol',{earned:5}),v2:1136}),'協定點數 +5 · 累計 1136');
 for(const id of ['game.protocolEarned','controller.journal.protocolNote'])assert.doesNotMatch(t(id,{n:5,earned:5,v:3}),/UNLOCKS|死亡仍保留|解鎖職業與設施紀錄/);
});
