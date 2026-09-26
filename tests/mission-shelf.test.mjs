// 3.177.11 (user): besides extraction, the campaign missions play too much alike to be worth choosing, so they are shelved.
// Endless is its own mode and stays. Shelved missions are still in the catalog, so runs that have one keep working.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../src/engine.js';
import {MISSIONS,SHELVED_MISSIONS,OFFERED_MISSION_IDS,CAMPAIGN_MISSION_IDS,offeredMission,validMissionId} from '../src/missions.js';

test('only extraction, survival and endless are offered; quick and daily games roll extraction',()=>{
 assert.deepEqual(OFFERED_MISSION_IDS,['extraction','survival','endless']);   // survival: 3.189.0
 assert.deepEqual(CAMPAIGN_MISSION_IDS,['extraction']);
 assert.deepEqual([...SHELVED_MISSIONS].sort(),['archive','hunt','retrieval','roundtrip','sweep']);
 for(const id of SHELVED_MISSIONS)assert.equal(offeredMission(id),'extraction',`${id} redeploys as extraction`);
 assert.equal(offeredMission('endless'),'endless');
});
test('a run on a shelved mission still loads and plays',()=>{
 for(const id of SHELVED_MISSIONS){
  assert.ok(validMissionId(id)&&MISSIONS[id],id);
  const g=new Game(7,[],0,'soldier','onyx',id),back=Game.restore(g.serialize());
  assert.ok(back,`${id} restores`);assert.equal(back.mission.id,id);
 }
});
test('the deployment screen lists the offered missions; quick, daily and retry use them',()=>{
 const source=readFileSync(new URL('../src/controller.js',import.meta.url),'utf8');
 assert.match(source,/const MISSION_IDS=CAMPAIGN_MISSION_IDS;/);
 assert.match(source,/offered=OFFERED_MISSION_IDS\.map\(id=>\[id,MISSIONS\[id\]\]\)/);
 assert.doesNotMatch(source,/Object\.entries\(MISSIONS\)/,'no screen lists the whole catalog any more');
 assert.match(source,/mission:offeredMission\(plan\.mission\)/);
});
