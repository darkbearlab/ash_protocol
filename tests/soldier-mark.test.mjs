// 3.159.0 (user decision 2026-09-21): 預警 marks what it scans from rank 0, and the soldier's two mark lines deepen it.
import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,SIZE,makeEnemy,SAVE_VERSION} from '../src/engine.js';
import {activeTrait,correctionLimit} from '../src/traits.js';
import {markValues,CLASS_PERK_TUNING} from '../src/class-perks.js';
import {skillText,SKILLS} from '../src/skills.js';
import {PERKS} from '../src/data.js';
function arena(){
 const g=new Game(3159,[],0,'soldier','onyx');g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.lighting=g.grid.map(r=>r.map(()=>1));g.barriers=[];g.props=[];g.items=[];g.hazards=[];g.marks=[];g.enemies=[];g.allies=[];g.smoke=[];g.end={x:20,y:20};Object.assign(g.player,{x:10,y:10});g.rng=Object.assign(()=>0,{state:()=>0});Object.defineProperty(g,'enemyAct',{value:()=>{},configurable:true});g.reveal();return g;
}
function enemy(g,x,y){const e=makeEnemy('rifleman',x,y,'qa-'+g.enemies.length);Object.assign(e,{hp:1000,maxHp:1000,alert:true});g.enemies.push(e);g.target=e.id;g.reveal();return e;}

test('rank 0: the scan marks what it reaches for one turn; the soldier hits and hurts the marked more, they aim no worse',()=>{
 const g=arena(),p=g.player,near=enemy(g,13,10),far=enemy(g,10,19);near.moved=true;g.target=near.id;
 assert.deepEqual(markValues(p),{duration:1,accuracy:10,damage:.1,evasion:0});
 const plain=g.accuracy(p,near);assert.equal(plain.markBonus,0);
 assert.ok(g.action('skill','early_warning'));assert.ok(activeTrait(near,'exposed'));assert.ok(!activeTrait(far,'exposed'),'nine tiles away is outside the scan');
 const aim=g.accuracy(p,near);assert.equal(aim.markBonus,10);assert.equal(aim.chance,plain.chance+10);assert.equal(g.accuracy(near,p).specialEvasion,0,'no debuff at rank 0');
 const hp=near.hp,turn=g.turn;assert.ok(g.action('fire'));assert.equal(g.turn,turn+1);assert.equal(hp-near.hp,Math.round(22*1.1),'the rifle\'s minimum roll, one tenth deeper');
 assert.ok(!activeTrait(near,'exposed'),'one turn, then gone');
 const h=arena(),e=enemy(h,13,10);const base=e.hp;assert.ok(h.action('fire'));assert.equal(base-e.hp,22,'unmarked: the plain roll');
});
test('the two lines: 標定壓制 deepens damage, 標定弱化 blunts their aim, each rank adds a turn, five at most',()=>{
 const g=arena(),p=g.player,e=enemy(g,12,10);
 p.perks.soldier_hunter=2;assert.deepEqual(markValues(p),{duration:3,accuracy:10,damage:.3,evasion:0});
 p.perks.soldier_marked=1;assert.deepEqual(markValues(p),{duration:4,accuracy:10,damage:.3,evasion:6});
 p.perks.soldier_hunter=3;p.perks.soldier_marked=3;assert.deepEqual(markValues(p),{duration:5,accuracy:10,damage:.4,evasion:18});
 assert.ok(g.action('skill','early_warning'));assert.equal(e.traits.find(t=>t.id==='exposed').turns,5);assert.equal(g.accuracy(e,p).specialEvasion,18);
 const hp=e.hp;assert.ok(g.action('fire'));assert.equal(hp-e.hp,Math.round(22*1.4));assert.ok(activeTrait(e,'exposed'),'four turns left');
 assert.ok(g.action('skill','early_warning')===false,'still cooling down');
 assert.equal(correctionLimit(p),3);assert.equal(CLASS_PERK_TUNING.braced,undefined);assert.ok(!PERKS.some(o=>o.id==='soldier_braced'));assert.ok(PERKS.some(o=>o.id==='soldier_hunter'&&o.characters.includes('soldier')));
});
test('the skill text carries the mark and still reads 掃描 N 格 … 冷卻 N 次',()=>{
 const g=arena(),p=g.player;assert.match(skillText(p,'early_warning'),/標定它們 1 回合：標定中你對它們命中 \+10、傷害 \+10%。/);assert.match(SKILLS.early_warning.text,/掃描 8 格.*冷卻 5 次/);
 p.perks.soldier_hunter=2;p.perks.soldier_marked=1;assert.match(skillText(p,'early_warning'),/標定它們 4 回合：標定中你對它們命中 \+10、傷害 \+30%、它們對你的命中 −6。/);
});
test('a v68 save: 架槍精通 ranks become 標定壓制, a pending draft follows, a long fire chain is clamped',()=>{
 assert.equal(SAVE_VERSION,71);
 const g=arena();enemy(g,13,10);g.player.level=6;g.perkPicks=2;g.pendingPerks=1;g.player.perks={soldier_hunter:2};const drawn=g.perkChoices.map(o=>o.id);assert.ok(drawn.length>=2,'a real draft');
 // The old id stands where the draft offers the new line (a v68 draft could hold one or the other, never both).
 const raw=JSON.parse(g.serialize());raw.version=68;raw.data.player.perks={soldier_braced:2};const at=Math.max(0,raw.data.perkDraft.ids.indexOf('soldier_hunter'));raw.data.perkDraft.ids[at]='soldier_braced';
 raw.data.player.fireChain={targetId:'qa-0',turn:raw.data.turn,count:5};
 const back=Game.restore(JSON.stringify(raw));assert.ok(back);
 assert.deepEqual(back.player.perks,{soldier_hunter:2});assert.deepEqual(back.perkDraft.ids,drawn.map((id,i)=>i===at?'soldier_hunter':id));assert.equal(back.player.fireChain.count,3);
 assert.deepEqual(markValues(back.player),{duration:3,accuracy:10,damage:.3,evasion:0});
});
