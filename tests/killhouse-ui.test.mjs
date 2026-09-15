import test from 'node:test';
import assert from 'node:assert/strict';
import {createKillhouse,makeEnemy,recordArcade,emptyKillhouse} from '../src/engine.js';
import {enemyTint,SIMULATION_VISUAL} from '../src/enemy-visuals.js';
import {CHARACTERS} from '../src/characters.js';
import {TUTORIAL_PROMPTS,roomPrompt,roomPromptMarkup,killhouseScore,KILLHOUSE_SCORE,bestRecord,disposedMarkup,tutorialResultMarkup,arcadeResultMarkup,killhouseMenuMarkup,tutorialGateMarkup,simulationLabel} from '../src/killhouse-ui.js';

// Kill house interface (docs/KILLHOUSE.md section 10, 3.88.0).
const inside=(r,p)=>p.x>=r.x&&p.x<r.x+r.w&&p.y>=r.y&&p.y<r.y+r.h;

test('each tutorial room has one card in recipe order; the researcher room carries the spec sentence',()=>{
 const g=createKillhouse({mode:'tutorial'}),first=g.takeRoomEvents().map(roomPrompt);
 assert.equal(first.length,1);assert.ok(first[0].modal);assert.equal(first[0].title,TUTORIAL_PROMPTS[0].title);
 assert.equal(TUTORIAL_PROMPTS.length,g.rooms.length);
 const prompts=g.rooms.map((r,roomId)=>roomPrompt({type:'roomEntered',phase:'tutorial',roomId}));
 assert.ok(prompts.every(p=>p?.modal));assert.equal(new Set(prompts.map(p=>p.title)).size,g.rooms.length);
 assert.match(prompts[4].text,/非戰鬥人員同樣列入肅清評估，不要手下留情/);
 assert.ok(g.enemies.filter(e=>e.type==='civilian').every(e=>inside(g.rooms[4],e)),'the researchers stand in the room that warns about them');
 assert.ok(g.enemies.filter(e=>e.type==='sniper').every(e=>inside(g.rooms[2],e)),'the charge lesson room holds the sniper');
 assert.match(roomPromptMarkup(prompts[4]),/data-modal="close"/);
});

test('arcade phases only toast on their first room',()=>{
 const a=createKillhouse({mode:'arcade',character:'recon',seed:4});
 const armory=a.takeRoomEvents().map(roomPrompt).filter(Boolean);
 assert.equal(armory.length,1);assert.equal(armory[0].modal,false);assert.match(armory[0].text,/整備/);
 Object.assign(a.player,a.end);a.descend();
 const combat=a.takeRoomEvents().map(roomPrompt).filter(Boolean);
 assert.equal(combat.length,1);assert.match(combat[0].text,/計分開始/);
 assert.equal(roomPrompt({type:'roomEntered',phase:'combat',roomId:2}),null);assert.equal(roomPrompt({type:'other'}),null);
});

test('score v1 rises with purge and falls with turns, never rewards overtime, and fits the stored record',()=>{
 assert.equal(KILLHOUSE_SCORE.formula,'v1');
 assert.equal(killhouseScore({rate:1,turns:0}),13000);
 assert.ok(killhouseScore({rate:1,turns:30})>killhouseScore({rate:.9,turns:30}));
 assert.ok(killhouseScore({rate:.8,turns:10})>killhouseScore({rate:.8,turns:40}));
 assert.equal(killhouseScore({rate:.5,turns:500}),5000,'the speed bonus stops at zero');
 assert.equal(killhouseScore({rate:.1,turns:0})-killhouseScore({rate:0,turns:0}),1000);
 assert.ok(Number.isSafeInteger(killhouseScore({rate:1/3,turns:7})));
 const p={killhouse:emptyKillhouse()},result={mode:'arcade',outcome:'won',rate:.75,turns:12,character:'soldier',scoreScope:'shared'};
 assert.equal(recordArcade(p,result,killhouseScore(result),{formula:KILLHOUSE_SCORE.formula}),true);
 assert.equal(bestRecord(p,result).score,killhouseScore(result));assert.equal(bestRecord(p,{...result,scoreScope:'character'}),null);
});

test('result screens: disposal follows the death destination, the tutorial always screens the unit in, arcade shows the score',()=>{
 const t=createKillhouse({mode:'tutorial'});t.status='dead';
 const restart=disposedMarkup(t.simulationResult);
 assert.match(restart,/銷毀此庫存/);assert.match(restart,/data-modal="khTutorial"/);assert.match(restart,/data-modal="khMenu"/);
 const menu=disposedMarkup({...t.simulationResult,deathDestination:'menu'});
 assert.doesNotMatch(menu,/khTutorial/);assert.match(menu,/class="modal-button" data-modal="khMenu"/);
 assert.match(disposedMarkup({...t.simulationResult,mode:'arcade'}),/data-modal="khRetry"/);
 const w=createKillhouse({mode:'tutorial'});Object.assign(w.player,w.end);w.descend();
 const done=tutorialResultMarkup(w,{saved:true});assert.equal(w.simulationResult.tier,'deficient','nobody was purged');
 assert.match(done,/篩選合格/);assert.match(done,/後續績效尚待評估/);
 assert.doesNotMatch(done,/列為資產封存|記憶校正|已處決|績效不足|績效優異|績效合格/,'the tutorial never grades the purge (user decision, 3.88.2)');
 assert.match(done,/data-modal="deploy"/);assert.doesNotMatch(done,/deploy-warning/);
 assert.match(tutorialResultMarkup(w,{saved:false}),/deploy-warning/);
 const a=createKillhouse({mode:'arcade',character:'recon',seed:4});Object.assign(a.player,a.end);a.descend();
 for(const e of a.enemies)a.hurt(e,9999,a.player);Object.assign(a.player,a.end);a.descend();
 const score=killhouseScore(a.simulationResult),html=arcadeResultMarkup(a,{score,best:score,newRecord:true,saved:true});
 assert.match(html,new RegExp(`<b>${score}</b>`));assert.match(html,/新紀錄/);assert.match(html,/<b>100%<\/b>/);
 assert.doesNotMatch(arcadeResultMarkup(a,{score,best:score+1,newRecord:false,saved:true}),/新紀錄/);
});

test('menu lists training and every class; the gate offers training and skip; labels follow the phase',()=>{
 const menu=killhouseMenuMarkup({killhouse:emptyKillhouse()},Object.keys(CHARACTERS));
 assert.equal((menu.match(/data-modal="khArcade"/g)||[]).length,Object.keys(CHARACTERS).length);assert.match(menu,/data-modal="khTutorial"/);
 const gate=tutorialGateMarkup();assert.match(gate,/data-modal="khTutorial"/);assert.match(gate,/data-modal="khSkip"/);
 assert.equal(simulationLabel(createKillhouse({mode:'tutorial'})),'KILL HOUSE · 模擬訓練');
 const a=createKillhouse({mode:'arcade',seed:1});assert.equal(simulationLabel(a),'KILL HOUSE · 整備區');
});

test('simulation humanoids draw as holograms; campaign enemies keep their colours',()=>{
 const t=createKillhouse({mode:'tutorial'});assert.ok(t.enemies.every(e=>enemyTint(e)===SIMULATION_VISUAL.tint));
 const e=makeEnemy('rifleman',1,1,'qa',1);assert.notEqual(enemyTint(e),SIMULATION_VISUAL.tint);
 assert.equal(enemyTint({...e,simulation:true}),SIMULATION_VISUAL.tint);
});
