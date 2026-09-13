import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game.js';
import {learningInventory} from '../src/learning.js';
import {SUPPRESSION_TUNING as T} from '../src/suppression.js';
import {suppressionTag,suppressionStatus,learningEntries,suppressionHelp} from '../src/suppression-ui.js';

test('suppression tags show stacks, penalty and pinning, and stay silent at zero or on machines',()=>{
 assert.equal(suppressionTag({suppression:0,traits:[]}),'');
 assert.equal(suppressionTag({suppression:2,traits:[]}),`壓制 2/5 · 命中 −${2*T.accuracy}`);
 assert.match(suppressionTag({suppression:T.pinned,traits:[]}),/釘住$/);
 assert.equal(suppressionTag({suppression:4,traits:[{id:'mechanical',source:'qa'}]}),'');
 assert.equal(suppressionStatus({suppression:T.pinned,traits:[]}),`壓制 ${T.pinned} · 命中 −${T.pinned*T.accuracy} · 無法移動`);
 assert.equal(suppressionStatus({traits:[]}),'');
});

test('learning entries list skills before passives and keep rules-layer reasons',()=>{
 const g=new Game(374,[],0,'soldier','onyx');
 g.player.learningItems={trait_rapid_fire:1,skill_suppressive_fire:2,skill_early_warning:1};
 const entries=learningEntries(learningInventory(g));
 assert.deepEqual(entries.map(e=>e.kind),['主動技能','主動技能','被動']);
 const warning=entries.find(e=>e.id==='skill_early_warning');
 assert.ok(warning.useReason.length>0,'a soldier already knows early warning');
 assert.equal(warning.dismantleReason,'');
 const fire=entries.find(e=>e.id==='skill_suppressive_fire');
 assert.equal(fire.count,2);assert.equal(fire.useReason,'');assert.match(fire.detail,/壓制射擊/);
 assert.match(entries.find(e=>e.id==='trait_rapid_fire').detail,/^被動 · 學會後直接生效/);
});

test('help text reads the suppression tuning table',()=>{
 const text=suppressionHelp();
 for(const n of [T.max,T.accuracy,T.pinned,T.skillRounds,T.skillAccuracy])assert.ok(text.includes(String(n)),`missing ${n}`);
});
