import {AFFIX_TUNING} from '../src/enemy-affixes.js';
// 3.49.1 endless / level-cap interface (Claude): labels, notices and texts read the shared constants.
import test from 'node:test';
import {makeEnemy} from '../src/engine.js';
import assert from 'node:assert/strict';
import {Game} from '../src/engine.js';
import {MAX_LEVEL,CAP_SUPPLY,ENDLESS_DISPLAY_FLOORS,ENDLESS_MAX_FLOOR,ENDLESS_TUNING,capSupplyText,giveCapSupply} from '../src/endless.js';
import {depthLabel,levelLabel,levelTitle,endlessRules,levelCapRules,endlessRecordRows,isRecordRun,growthLabel,endlessFloorText} from '../src/endless-ui.js';

test('the UI shows 666 floors while the rule limit stays separate',()=>{
 assert.equal(ENDLESS_DISPLAY_FLOORS,666);assert.ok(ENDLESS_MAX_FLOOR>ENDLESS_DISPLAY_FLOORS);
 assert.equal(depthLabel(7),'07 / 666');
 const g=new Game(4901,[],0,'soldier','onyx','endless');g.floor=12;g.loadFloor();assert.equal(g.missionSummary,'無盡深入 · 第 12 / 666 層');
 const normal=new Game(4902,[],0,'soldier','onyx','extraction');assert.doesNotMatch(normal.missionSummary,/666/);
});

test('level label marks the cap; the title explains what comes after it',()=>{
 assert.equal(levelLabel(MAX_LEVEL-1),'LV.19');assert.equal(levelLabel(MAX_LEVEL),'LV.20 MAX');
 assert.equal(levelLabel(25),'LV.20 MAX','a legacy number above the cap still reads MAX');
 assert.doesNotMatch(levelTitle(19,3),/上限/);assert.match(levelTitle(20,5),/經驗 5 \/ 22；已達等級上限，之後每 22 點經驗/);
});

// The log line is what the message bar shows after the kill settles, so it carries the contents itself.
test('cap supply log names every item of the real supply',()=>{
 assert.equal(capSupplyText().split('、').length,Object.keys(CAP_SUPPLY).length);assert.ok(capSupplyText().startsWith(`醫療包 +${CAP_SUPPLY.meds}、手榴彈 +${CAP_SUPPLY.grenade}`));
 const g=new Game(4903,[],0,'soldier','onyx','endless');giveCapSupply(g);
 assert.equal(g.logs[0].text,`獲得封頂補給（${capSupplyText()}；超量彈藥留在腳下）。`);
});

test('endless arrival text: no tutorial line past floor 6 and no extraction wording on core floors',()=>{
 assert.doesNotMatch(endlessFloorText(6),/撤離/);assert.doesNotMatch(endlessFloorText(12),/撤離/);
 assert.doesNotMatch(endlessFloorText(13),/殘存補給/);assert.match(endlessFloorText(1),/殘存補給/);assert.equal(endlessFloorText(8),endlessFloorText(2));
});

test('rules texts quote the tuning constants',()=>{
 assert.ok(endlessRules().includes('野餐 35%、普通 50%、困難 100%'),'the affix chance where it freezes, per tier');assert.ok(endlessRules().includes(`第 ${ENDLESS_TUNING.freeze+1} 層起每三層`));
 assert.ok(endlessRules().includes(`第 ${ENDLESS_TUNING.freeze} 層`)&&endlessRules().includes(`第 ${ENDLESS_TUNING.densityStart} 層`)&&endlessRules().includes(`${Math.round(ENDLESS_TUNING.attritionFloor*100)}%`));   // 3.222.0assert.ok(endlessRules().includes(`${Math.round(AFFIX_TUNING.chanceCap*100)}%`));
 assert.ok(levelCapRules().includes(`整局最多 ${MAX_LEVEL-1} 次`));
 // 3.222.0: frozen at 9, half pace past it — the toast reads what the enemies get.
 assert.equal(growthLabel(6),'');assert.equal(growthLabel(9),`敵人生命 ×${(1.04**3).toFixed(2)}、攻擊 ×${(1.03**3).toFixed(2)}`);assert.equal(growthLabel(12),`敵人生命 ×${(1.04**3*1.02**3).toFixed(2)}、攻擊 ×${(1.03**3*1.015**3).toFixed(2)}`);   // 3.137.0 standard
 assert.equal(growthLabel(12,{curve:'classic',offset:0}),`敵人生命 ×${(1.07**3*1.035**3).toFixed(2)}、攻擊 ×${(1.04**3*1.02**3).toFixed(2)}`);
 for(const f of [15,20,30]){const g=makeEnemy('boss',1,1,'x',f).maxHp/makeEnemy('boss',1,1,'x',6).maxHp;assert.ok(Math.abs(Number(growthLabel(f).match(/×([\d.]+)/)[1])-g)<.02,`floor ${f}: the toast matches a boss's real growth`);}
});

test('record rows: overall best with 666 label, classes sorted by depth, unknown ids skipped; record-run check',()=>{
 const records={endless:{best:{floor:17,level:23,kills:180},byCharacter:{ninja:{floor:11,level:21,kills:90},berserker:{floor:17,level:23,kills:180},ghost:{floor:30,level:1,kills:0}}}};
 const rows=endlessRecordRows(records,{ninja:'忍者',berserker:'狂戰士'});
 assert.equal(rows.best,'第 17 / 666 層 · LV.23 · 180 擊殺');assert.deepEqual(rows.classes,['狂戰士 17','忍者 11']);
 assert.deepEqual(endlessRecordRows({endless:{best:null,byCharacter:{}}},{}),{best:null,classes:[]});
 assert.equal(isRecordRun(records,17,23,180),true);assert.equal(isRecordRun(records,17,22,180),false);
});
