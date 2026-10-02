import test from 'node:test';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {Game,DIFFICULTY_TUNING,REAL_MODE_TUNING,validDifficultyOffset} from '../src/engine.js';
import {DIFFICULTY_CURVES} from '../src/endless.js';
import {FACTIONS,rollFacilityFaction} from '../src/factions.js';
import {DIFFICULTY_OPTIONS,difficultyOption,difficultyLabel,difficultyMeta,realModeMeta,runOptions,FACILITY_OPTIONS,facilityOption} from '../src/deploy-ui.js';

// 3.222.0 (user 2026-10-02): 普通 (the curve that was 困難) is the default for a new profile.
test('run options default to 普通, no real mode and a seed-rolled facility',()=>{
 assert.deepEqual(runOptions(),{realMode:false,difficulty:'hard',difficultyOffset:DIFFICULTY_TUNING.defaultOffset,facilityFaction:'random'});
 assert.deepEqual(runOptions({difficulty:'standard',realMode:true}),{realMode:true,difficulty:'standard',difficultyOffset:DIFFICULTY_TUNING.defaultOffset,facilityFaction:'random'});
 assert.equal(runOptions({difficulty:'easy'}).difficulty,'standard');   // 3.137.0; 3.222.0: the retired 簡單 plays 野餐
 assert.equal(runOptions({realMode:'on'}).realMode,false);
 assert.equal(runOptions({difficulty:'nightmare'}).difficultyOffset,DIFFICULTY_TUNING.defaultOffset,'unknown ids fall back to 普通');assert.equal(runOptions({difficulty:'nightmare'}).difficulty,'hard');
 assert.equal(runOptions({facility:'rebel'}).facilityFaction,'rebel');assert.equal(runOptions({facility:'nowhere'}).facilityFaction,'random');
});

// 3.222.0 (user 2026-10-02): the ladder moves up a step, each id keeping its strength — 野餐 (was 標準), 普通 (was 困難),
// 困難 (new, every affix chance doubled); the retired 簡單 plays 野餐 and keeps its name on a run begun with it.
test('the difficulty list and facility list are valid and read the tuning tables',()=>{
 assert.deepEqual(DIFFICULTY_OPTIONS.map(d=>[d.id,d.name,d.curve]),[['standard','野餐','standard'],['hard','普通','hard'],['brutal','困難','brutal']]);
 assert.equal(runOptions({difficulty:'easy'}).difficulty,'standard','a profile that chose 簡單 plays 野餐');assert.equal(difficultyOption('nonsense').id,'hard');
 assert.equal(difficultyLabel('easy'),'簡單');assert.equal(difficultyLabel('classic'),'舊制');
 assert.ok(difficultyMeta(difficultyOption('brutal')).endsWith('詞條機率加倍'),'困難 says it doubles');assert.ok(!difficultyMeta(difficultyOption('hard')).includes('加倍'));
 assert.ok(readFileSync(new URL('../src/controller-deploy.js',import.meta.url),'utf8').includes('newGame(seed,pick(availableCharacters(profile())),mission,runOptions());'),'quick play takes the default tier');assert.equal(difficultyLabel('hard'),'普通');assert.equal(difficultyLabel('brutal'),'困難');
 assert.ok(DIFFICULTY_OPTIONS.every(d=>validDifficultyOffset(d.offset)&&DIFFICULTY_CURVES[d.curve]));
 assert.equal(difficultyOption().id,'hard');   // 3.222.0: 普通
 assert.equal(difficultyMeta(difficultyOption('standard')),`詞條自第 ${DIFFICULTY_CURVES.standard.affixStart} 層 · 第 2 層起出現特殊敵人`);
 assert.equal(difficultyMeta(difficultyOption('brutal')),`詞條自第 ${DIFFICULTY_CURVES.brutal.affixStart} 層 · 第 2 層起出現特殊敵人 · 菁英自第 ${DIFFICULTY_CURVES.brutal.eliteStart} 層 · 詞條機率加倍`);   // 3.222.0: 簡單 is no longer offered
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
