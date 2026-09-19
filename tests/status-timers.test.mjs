import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/engine.js';
import {poisonTurns,suppressionTurns,cloudTurns,timedStatuses} from '../src/status-timers.js';
import {tickPoison} from '../src/poison.js';
import {decayedStacks} from '../src/suppression.js';
import {SKILLS,skillText,skillValues} from '../src/skills.js';
import {summonInterval,summonLimit} from '../src/allies.js';

// 3.151.0 (user 2026-09-20): timed states show how long they last in the status line, and skill texts show the
// player's actual numbers after class perks.
function arena(character='soldier'){
 const g=new Game(3,[],0,character,undefined,'extraction'),p=g.player;
 g.grid=g.grid.map(r=>r.map(()=>1));g.props=[];g.barriers=[];g.hazards=[];g.items=[];g.allies=[];g.enemies=[];g.smoke=[];g.flares=[];
 g.lighting=g.grid.map(r=>r.map(()=>1));Object.assign(p,{x:10,y:10});g.end={x:25,y:25};g.reveal();
 return g;
}

test('poison turns count the ticks that still hurt',()=>{
 for(const [poison,clock] of [[1,0],[1,1],[2,0],[3,1],[4,0]]){
  const g=arena(),p=g.player;p.poison=poison;if(clock)p.poisonClock=clock;p.hp=p.maxHp=999;
  const said=poisonTurns(p);let hurt=0;while(p.poison){const before=p.hp;tickPoison(g);if(p.hp<before)hurt++;}
  assert.equal(said,hurt,`${poison} stacks, clock ${clock}`);
 }
});

test('suppression turns follow the halving rule, five stacks last four turns',()=>{
 assert.deepEqual([0,1,2,3,4,5].map(n=>suppressionTurns({suppression:n,traits:[]})),[0,1,2,3,3,4]);
 for(let n=1;n<=5;n++){let s=n,turns=0;while(s>0){s=decayedStacks(s);turns++;}assert.equal(suppressionTurns({suppression:n,traits:[]}),turns);}
});

test('the smoke count matches the rounds the cloud really stands',()=>{
 const g=arena(),p=g.player;g.smoke=[{cells:[{x:p.x,y:p.y}],expires:g.turn+3}];
 const said=cloudTurns(g,'smoke');let rounds=0;while(g.smoke.length){assert.ok(g.action('wait'));rounds++;}
 assert.equal(said,rounds);assert.equal(said,3);
});

test('timed statuses name each state with its remaining turns',()=>{
 const g=arena(),p=g.player;
 g.shadowSteps=2;p.poison=2;p.control.immune=1;p.skillState.signal_break={remaining:2,cooldown:6};
 g.smoke=[{kind:'toxic',cells:[{x:p.x,y:p.y}],expires:g.turn+2}];
 const line=timedStatuses(g);
 assert.ok(line.includes('免費移動 2 步'));assert.ok(line.includes('中毒 2 層 · 4 回合'));assert.ok(line.includes('失能免疫 1 回合'));
 assert.ok(line.includes('斷層 2 回合'));assert.ok(line.includes('毒霧中 2 回合'));
 p.control.disabled=3;assert.ok(timedStatuses(g).includes('失能 3 回合 · 按等待'));
 p.traits.push({id:'clumsy',source:'test',turns:2});assert.ok(timedStatuses(g).includes('笨拙 2 回合'));
 const n=arena('ninja');n.player.skillState.camouflage={remaining:3,cooldown:0};assert.ok(timedStatuses(n).includes('迷彩 3 回合'));
 assert.deepEqual(timedStatuses(arena()),[]);
});

test('skill texts show the actual values after class perks',()=>{
 const fresh={perks:{}};
 for(const id of Object.keys(SKILLS))assert.equal(skillText(fresh,id),SKILLS[id].text,`${id}: a fresh player reads the base text`);
 const p={perks:{soldier_overwatch:2,recon_blackout:1,ninja_overload:3,necro_haste:1,necro_horde:2}};
 const ew=skillValues(p,'early_warning'),sb=skillValues(p,'signal_break'),cam=skillValues(p,'camouflage');
 assert.match(skillText(p,'early_warning'),new RegExp(`掃描 ${ew.radius} 格.*冷卻 ${ew.cooldown} 次`));assert.notEqual(ew.radius,SKILLS.early_warning.radius);
 assert.match(skillText(p,'signal_break'),new RegExp(`，${sb.duration} 次.*起算 ${sb.cooldown} 次`));assert.notEqual(sb.duration,SKILLS.signal_break.duration);
 assert.match(skillText(p,'camouflage'),new RegExp(`接下來 ${cam.duration} 次.*冷卻 ${cam.cooldown} 回合`));assert.notEqual(cam.duration,SKILLS.camouflage.duration);
 assert.match(skillText(p,'raise_dead'),new RegExp(`每 ${summonInterval(p)} 回合.*最多 ${summonLimit(p)} 隻`));assert.notEqual(summonLimit(p),summonLimit(fresh));
});
