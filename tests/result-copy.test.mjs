import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game.js';
import {resultCopy,lossCopy,retryPlan,RESULT_EYEBROWS,RESULT_TUNING} from '../src/result-copy.js';
import {rollFacilityFaction} from '../src/faction-catalog.js';

// A run that ended on a given floor, with the purge ledger forced to a tier.
function ended({mission='extraction',floor=1,status='dead',tier=null,deepest=floor,realMode=false}={}){
 const g=new Game(11,[],0,'soldier','onyx',mission,{facilityFaction:'random',realMode});
 g.status=status;g.floor=floor;
 Object.defineProperty(g,'deepestFloor',{get:()=>deepest});
 if(tier){const quota=10,purged={excellent:10,adequate:6,deficient:0}[tier];g.purge={floors:{1:{quota,alive:quota-purged}}};g.floor=2;if(!['excellent','adequate','deficient'].includes(tier))throw new Error(tier);}
 else g.purge={floors:{}};
 return g;
}

test('the report never consoles: eyebrows are clinical and a win does not promise the unit\'s fate',()=>{
 assert.deepEqual(RESULT_EYEBROWS,{abandoned:'MISSION ABANDONED',won:'PURGE COMPLETE',dead:'UNIT EXPENDED',failed:'FACILITY LOST'});   // failed: 3.189.0
 const win=resultCopy(ended({status:'won'}));
 assert.equal(win.title,'火種已熄滅。');
 assert.doesNotMatch(win.body,/回收|撤離電梯|重新部署|處決/,'the purge verdict below decides what happens to the unit');
 for(const copy of [win,resultCopy(ended()),resultCopy(ended({status:'abandoned'}))])
  assert.doesNotMatch(copy.title+copy.body,/回音|下一位|協助|適應|生存|你/,'none of the old warm wording');
});

test('a lost unit is graded by how far it got into its own mission',()=>{
 assert.equal(lossCopy(ended({floor:1})).title,'損耗在預期範圍內。');
 assert.equal(lossCopy(ended({floor:3,deepest:3})).title,'推進中斷。');
 assert.equal(lossCopy(ended({floor:4,deepest:4})).title,'任務部分完成。');
 assert.equal(lossCopy(ended({floor:6,deepest:6})).title,'任務部分完成。');
 // A three-floor round trip is measured against three floors, not six.
 assert.equal(lossCopy(ended({mission:'roundtrip',floor:2,deepest:2})).title,'任務部分完成。');
});

test('an excellent purge record turns any loss into a consumed threat',()=>{
 assert.equal(lossCopy(ended({floor:2,deepest:2,tier:'excellent'})).title,'高威脅個體已消耗。');
 assert.notEqual(lossCopy(ended({floor:2,deepest:2,tier:'adequate'})).title,'高威脅個體已消耗。');
});

test('endless losses report the depth, with the deepest band reserved for real threats',()=>{
 const at=(floor,tier)=>lossCopy(ended({mission:'endless',floor,deepest:floor,tier}));
 assert.equal(at(3).title,'訊號於第 3 層中斷。');
 assert.equal(at(RESULT_TUNING.endlessMid).title,`追蹤於第 ${RESULT_TUNING.endlessMid} 層終止。`);
 assert.match(at(RESULT_TUNING.endlessDeep).title,/高威脅個體已於第 13 層消耗/);
});

test('redeploying reuses the mission, seed and options, and rolls the same facility',()=>{
 const g=ended({mission:'extraction',realMode:true});
 const plan=retryPlan(g);
 assert.equal(plan.mission,'extraction');assert.equal(plan.seed,g.seed);
 assert.equal(plan.options.realMode,true);assert.equal(plan.options.difficultyOffset,g.difficultyOffset);
 assert.equal(plan.options.facilityFaction,'random','a facility rolled from the seed is rolled again');
 const again=new Game(plan.seed,[],0,'recon','onyx',plan.mission,plan.options);
 assert.equal(again.facilityFaction,rollFacilityFaction(g.seed));
 assert.deepEqual(again.grid,new Game(plan.seed,[],0,'soldier','onyx',plan.mission,plan.options).grid,'same seed, same floor');
});
