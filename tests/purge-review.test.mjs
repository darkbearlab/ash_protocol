import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,purgeReview,cloneDesignation,PURGE_TUNING,isNoncombatant,isBossClass} from '../src/engine.js';
import {purgeRows,purgeReportMarkup,PURGE_VERDICTS} from '../src/purge-review-ui.js';

// Purge review (docs/PURGE_REVIEW.md, user decision 2026-09-15): narrative verdict on the result screen only.
test('the quota is the generated population plus non-combatants, without bosses, fodder or hunt targets',()=>{
 const g=new Game(319,[],0,'soldier','onyx','extraction',{facilityFaction:'loyalist'}),rec=g.purge.floors['1'];
 assert.ok(g.enemies.some(isNoncombatant),'loyalist floors carry civilians');
 assert.deepEqual(rec.ids,g.enemies.filter(e=>!e.expendable&&!e.reinforcement&&!isBossClass(e)).map(e=>e.id));
 assert.ok(g.enemies.filter(isNoncombatant).every(e=>rec.ids.includes(e.id)));
 assert.deepEqual([rec.quota,rec.alive],[rec.ids.length,null]);
 g.floor=3;g.loadFloor();
 const boss=g.enemies.find(isBossClass);assert.ok(boss);assert.ok(!g.purge.floors['3'].ids.includes(boss.id));
 const h=new Game(319,[],0,'soldier','onyx','sweep');h.floor=6;h.loadFloor();
 assert.equal(h.mission.targets.length,3);assert.ok(h.mission.targets.every(t=>!h.purge.floors['6'].ids.includes(t.id)));
});

test('tiers follow the purged share of the quota: 90% excellent, 60% adequate, otherwise deficient',()=>{
 const g=new Game(319);g.status='won';
 const ids=g.purge.floors['1'].ids,n=ids.length;assert.ok(n>=3);
 for(let k=0;k<=n;k++){
  for(const e of g.enemies)if(ids.includes(e.id))e.hp=ids.indexOf(e.id)<k?0:10;
  const r=purgeReview(g),want=k*100>=n*PURGE_TUNING.excellent?'excellent':k*100>=n*PURGE_TUNING.adequate?'adequate':'deficient',v=PURGE_VERDICTS[want];
  assert.equal(r.tier,want,`${k}/${n}`);assert.equal(r.purged,k);assert.equal(r.turns,g.turn);
  assert.deepEqual(purgeRows(g).slice(2).map(row=>row[1]),[v.status,v.reason,...(v.note?[v.note]:[])]);
 }
 assert.deepEqual([PURGE_VERDICTS.excellent.status,PURGE_VERDICTS.deficient.status],['列為資產封存','已處決']);
});

test('departure files the survivors; later arrivals never enter the quota',()=>{
 const g=new Game(319),ids=g.purge.floors['1'].ids;
 g.enemies.find(e=>e.id===ids[0]).hp=0;
 const late=g.spawnEnemy('rifleman',g.start.x,g.start.y,'qa-late');g.enemies.push(late);
 const before=purgeReview(g);late.hp=0;assert.deepEqual(purgeReview(g),before,'killing a later arrival changes nothing');
 Object.assign(g.player,g.exitPoint);assert.ok(g.descend());
 assert.deepEqual(g.purge.floors['1'],{quota:ids.length,alive:ids.length-1},'one-way floors drop their IDs');
 assert.equal(g.purge.floors['2'].alive,null);
 const r=purgeReview(g);assert.equal(r.quota,ids.length+g.purge.floors['2'].quota);assert.equal(r.purged,1);
});

test('return-trip floors keep their IDs, so purging a resumed floor still counts',()=>{
 const g=new Game(331,[],0,'soldier','onyx','roundtrip'),first=[...g.purge.floors['1'].ids];assert.ok(first.length);
 Object.assign(g.player,g.exitPoint);assert.ok(g.descend());
 assert.deepEqual(g.purge.floors['1'],{quota:first.length,alive:first.length,ids:first});
 g.mission.returning=true;g.mission.targets=[{id:'objective-1',x:g.start.x,y:g.start.y,done:true}];g.mission.reinforced=[];Object.assign(g.player,g.start);g.enemies.forEach(e=>e.hp=0);
 assert.ok(g.descend());assert.equal(g.floor,1);
 assert.equal(g.purge.floors['2'].alive,0);assert.ok(g.purge.floors['2'].ids);
 const before=purgeReview(g).purged;g.enemies.find(e=>e.id===first[0]).hp=0;assert.equal(purgeReview(g).purged,before+1);
});

test('the ledger survives a save; older or damaged ledgers never cost the run, only the verdict',()=>{
 const g=new Game(319);Object.assign(g.player,g.exitPoint);assert.ok(g.descend());
 const copy=Game.restore(g.serialize());assert.ok(copy);assert.deepEqual(copy.purge,g.purge);
 const raw=JSON.parse(g.serialize());delete raw.data.purge;
 const legacy=Game.restore(JSON.stringify(raw));assert.ok(legacy);assert.equal(legacy.purge,null);
 legacy.status='won';assert.equal(purgeReview(legacy),null);assert.deepEqual(purgeRows(legacy).map(row=>row[0]),['單位','目標狀態']);
 legacy.status='playing';legacy.floor=3;legacy.loadFloor();assert.equal(legacy.purge,null,'an untracked run stays untracked');
 const partial=JSON.parse(g.serialize());delete partial.data.purge.floors['2'];
 assert.deepEqual(Game.restore(JSON.stringify(partial)).purge,{floors:{'1':g.purge.floors['1']}},'a floor without a record is simply not reviewed');
 for(const mutate of [d=>d.purge.floors['1'].alive=999,d=>d.purge.floors['9']={quota:0,alive:null},
   d=>d.purge.floors['2'].ids.push('qa-duplicate'),d=>d.purge.extra=1,d=>d.purge=[]]){
  const bad=JSON.parse(g.serialize());mutate(bad.data);const copy=Game.restore(JSON.stringify(bad));
  assert.ok(copy,String(mutate));assert.equal(copy.purge,null,String(mutate));
 }
});

test('losses are filed without a review, and the report never prints counts or rates',()=>{
 const g=new Game(319),unit=cloneDesignation(g.runId);
 assert.match(unit,/^[A-Z]-\d{4}$/);assert.equal(cloneDesignation(g.runId),unit);
 assert.ok(new Set(['a','b','c','d','e','f'].map(cloneDesignation)).size>1);
 g.status='dead';assert.deepEqual(purgeRows(g),[['單位',`${unit} 訊號中斷`],['狀態','列入損耗']]);
 g.status='abandoned';assert.deepEqual(purgeRows(g),[['單位',`${unit} 任務中止`],['狀態','列入損耗']]);
 g.status='playing';assert.equal(purgeReportMarkup(g),'');
 g.status='won';const html=purgeReportMarkup(g);
 assert.match(html,/data-verdict="(excellent|adequate|deficient)"/);
 assert.doesNotMatch(html.replace(unit,''),/\d|%/,'no counts or rates');
});
