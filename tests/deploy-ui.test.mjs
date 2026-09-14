import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,AFFIX_TUNING,DIFFICULTY_TUNING,REAL_MODE_TUNING,validDifficultyOffset} from '../src/engine.js';
import {DIFFICULTY_OPTIONS,difficultyOption,difficultyMeta,realModeMeta,runOptions} from '../src/deploy-ui.js';

test('run options default to standard and only a real boolean turns real mode on',()=>{
 assert.deepEqual(runOptions(),{realMode:false,difficultyOffset:DIFFICULTY_TUNING.defaultOffset});
 assert.deepEqual(runOptions({difficulty:'standard',realMode:true}),{realMode:true,difficultyOffset:DIFFICULTY_TUNING.defaultOffset});
 assert.equal(runOptions({realMode:'on'}).realMode,false);
 assert.equal(runOptions({difficulty:'nightmare'}).difficultyOffset,DIFFICULTY_TUNING.defaultOffset,'unknown ids fall back to standard');
});

test('the reserved difficulty list is valid and its text reads the tuning tables',()=>{
 assert.ok(DIFFICULTY_OPTIONS.length>=1&&DIFFICULTY_OPTIONS.every(d=>validDifficultyOffset(d.offset)));
 assert.equal(difficultyOption().id,'standard');
 assert.equal(difficultyMeta(difficultyOption()),`詞條自第 ${AFFIX_TUNING.startDepth-DIFFICULTY_TUNING.defaultOffset} 層`);
 assert.ok(realModeMeta().includes(String(REAL_MODE_TUNING.protocolPercent)));
});

test('a deployment with the switch on starts a locked real-mode run',()=>{
 const g=new Game(7,[],0,'soldier','onyx','extraction',runOptions({realMode:true}));
 assert.equal(g.realMode,true);assert.equal(g.difficultyOffset,DIFFICULTY_TUNING.defaultOffset);
 assert.equal(Game.restore(g.serialize()).realMode,true);
 assert.equal(new Game(7,[],0,'soldier','onyx','extraction',runOptions()).realMode,false);
});
