import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,AFFIX_TUNING,DIFFICULTY_TUNING,REAL_MODE_TUNING,validDifficultyOffset} from '../src/engine.js';
import {FACTIONS,rollFacilityFaction} from '../src/factions.js';
import {DIFFICULTY_OPTIONS,difficultyOption,difficultyMeta,realModeMeta,runOptions,FACILITY_OPTIONS,facilityOption} from '../src/deploy-ui.js';

test('run options default to standard, no real mode and a seed-rolled facility',()=>{
 assert.deepEqual(runOptions(),{realMode:false,difficultyOffset:DIFFICULTY_TUNING.defaultOffset,facilityFaction:'random'});
 assert.deepEqual(runOptions({difficulty:'standard',realMode:true}),{realMode:true,difficultyOffset:DIFFICULTY_TUNING.defaultOffset,facilityFaction:'random'});
 assert.equal(runOptions({realMode:'on'}).realMode,false);
 assert.equal(runOptions({difficulty:'nightmare'}).difficultyOffset,DIFFICULTY_TUNING.defaultOffset,'unknown ids fall back to standard');
 assert.equal(runOptions({facility:'rebel'}).facilityFaction,'rebel');assert.equal(runOptions({facility:'nowhere'}).facilityFaction,'random');
});

test('the reserved difficulty list and facility list are valid and read the tuning tables',()=>{
 assert.ok(DIFFICULTY_OPTIONS.length>=1&&DIFFICULTY_OPTIONS.every(d=>validDifficultyOffset(d.offset)));
 assert.equal(difficultyOption().id,'standard');
 assert.equal(difficultyMeta(difficultyOption()),`詞條自第 ${AFFIX_TUNING.startDepth-DIFFICULTY_TUNING.defaultOffset} 層`);
 assert.ok(realModeMeta().includes(String(REAL_MODE_TUNING.protocolPercent)));
 assert.equal(FACILITY_OPTIONS[0].id,'random');assert.equal(facilityOption().id,'random');
 assert.deepEqual(FACILITY_OPTIONS.slice(1).map(o=>o.id).sort(),Object.keys(FACTIONS).sort());
 const firstTest=FACILITY_OPTIONS.findIndex(o=>o.id!=='random'&&!FACTIONS[o.id].pickable);assert.ok(FACILITY_OPTIONS.slice(1,firstTest).every(o=>FACTIONS[o.id].pickable),'pickable factions are listed before test mixes');
});

test('a deployment with the switch on starts a locked real-mode run in a rolled or chosen facility',()=>{
 const g=new Game(7,[],0,'soldier','onyx','extraction',runOptions({realMode:true}));
 assert.equal(g.realMode,true);assert.equal(g.difficultyOffset,DIFFICULTY_TUNING.defaultOffset);assert.equal(g.facilityFaction,rollFacilityFaction(7));
 assert.equal(Game.restore(g.serialize()).realMode,true);
 assert.equal(new Game(7,[],0,'soldier','onyx','extraction',runOptions()).realMode,false);
 assert.equal(new Game(7,[],0,'soldier','onyx','extraction',runOptions({facility:'loyalist'})).facilityFaction,'loyalist');
});
