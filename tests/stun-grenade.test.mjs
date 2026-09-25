import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,AFFIX_TUNING,affixChance} from '../src/engine.js';
import {DISRUPT_TURNS} from '../src/throwables.js';
import {grenadeMarkers} from '../src/affix-ui.js';
import {eliteChance} from '../src/elite-enemies.js';
import {DIFFICULTY_CURVES,floorHpBonus,floorDamageBonus,scaleEnemy} from '../src/endless.js';
import {DIFFICULTY_OPTIONS,difficultyMeta,runOptions} from '../src/deploy-ui.js';
import {affixArena,sceneEnemy} from '../qa/enemy-affix-scenes.mjs';
import {makeBarrier} from '../src/barriers.js';

// 3.188.0 (user): a grenadier throws a stun grenade a third of the time. It does no damage and disables what its 3×3
// reaches; a player who waited that round is disabled half as long. And a hard difficulty.
const rolls=(...values)=>Object.assign(()=>values.length?values.shift():0,{state:()=>1});
const stunMark=(g,e,x,y)=>({kind:'grenade',phase:'flight',sourceId:e.id,x,y,origin:{x:e.x,y:e.y},radius:1,stun:true,damage:0,due:g.turn+1});

test('the grenadier decides as it gets ready, says which, and a stun grenade flies as a 3×3 with no damage',()=>{
  const g=affixArena(),e=sceneEnemy(g,'raider',['grenadier']);g.rng=rolls(0,.99);g.enemyAct(e);
  assert.equal(e.grenadeIntent?.stun,true,'the top third of the roll');assert.ok(g.logs.some(l=>/準備投震撼彈/.test(l.text)));
  assert.deepEqual(grenadeMarkers(g).map(m=>[m.phase,m.stun,m.label]),[['prepare',true,'投擲震撼']]);
  g.rng=rolls();g.enemyAct(e);const m=g.marks.find(x=>x.kind==='grenade');
  assert.equal(m.stun,true);assert.equal(m.damage,0);assert.ok(g.logs.some(l=>/已投出震撼彈/.test(l.text)));
  assert.equal(grenadeMarkers(g)[0].label,'震撼 1');
  const f=affixArena(),frag=sceneEnemy(f,'raider',['grenadier']);f.rng=rolls();f.enemyAct(frag);assert.equal(frag.grenadeIntent.stun,undefined,'a low roll is a frag');
  assert.ok(Math.abs(AFFIX_TUNING.stunShare-1/3)<1e-9);
});

test('it disables everything living in the square, you half as long if you waited, and hurts no one',()=>{
  for(const braced of [false,true]){
    const g=affixArena(),p=g.player,e=sceneEnemy(g,'raider',[],14,10),near=sceneEnemy(g,'rifleman',[],11,11);g.enemyAct=()=>{};
    g.marks=[stunMark(g,e,10,10)];const hp=[p.hp,near.hp];
    if(braced)assert.ok(g.action('wait'));else assert.ok(g.action('move',[1,0]));   // stays inside the square
    assert.equal(g.marks.length,0,'it went off');
    assert.equal(p.control.disabled,braced?Math.ceil(DISRUPT_TURNS/2):DISRUPT_TURNS);assert.equal(near.control.disabled,DISRUPT_TURNS);
    assert.equal(e.control.disabled,0,'outside the square');assert.deepEqual([p.hp,near.hp],hp,'no damage');
    assert.equal(g.logs.some(l=>/你事先穩住/.test(l.text)),braced,'said only afterwards, only when it helped');
  }
});

test('walls shield the square; saves keep a stun throw; a stun mark with damage is refused',()=>{
  const g=affixArena(),p=g.player,e=sceneEnemy(g,'raider',['grenadier'],14,10);g.enemyAct=()=>{};Object.assign(p,{x:12,y:12});
  g.barriers=[makeBarrier('door',{x:10,y:10},{x:9,y:10},'edge-stun')];const behind=sceneEnemy(g,'rifleman',[],9,10);g.marks=[stunMark(g,e,10,10)];assert.ok(g.action('wait'));
  assert.equal(behind.control.disabled,0,'the wall between the blast and it');
  const h=affixArena(),t=sceneEnemy(h,'raider',['grenadier']);t.affixes[0].revealed=true;t.grenadeIntent={stage:'prepare',targetId:'player',x:10,y:10,origin:{x:t.x,y:t.y},stun:true};h.marks=[stunMark(h,t,10,11)];
  const copy=Game.restore(h.serialize());assert.ok(copy);assert.equal(copy.enemies[0].grenadeIntent.stun,true);assert.equal(copy.marks[0].stun,true);
  for(const bad of [m=>m.damage=5,m=>m.stun='yes',m=>{delete m.stun;m.damage=0;}]){const raw=JSON.parse(h.serialize());bad(raw.data.marks[0]);assert.equal(Game.restore(JSON.stringify(raw)),null);}
  const raw=JSON.parse(h.serialize());raw.data.enemies[0].grenadeIntent.stun=false;assert.equal(Game.restore(JSON.stringify(raw)),null);
});

test('hard: standard numbers, affixes from the first floor and more of them, elites from floor 4',()=>{
  const hard={curve:'hard',offset:0},standard={curve:'standard',offset:0};
  assert.deepEqual(DIFFICULTY_OPTIONS.map(o=>o.id),['easy','standard','hard']);assert.equal(runOptions({difficulty:'hard'}).difficulty,'hard');
  for(const k of ['hpStep','damageStep','hpGrowth','damageGrowth','deployerStart','preview'])assert.equal(DIFFICULTY_CURVES.hard[k],DIFFICULTY_CURVES.standard[k],k);
  for(const floor of [1,4,9])assert.deepEqual([floorHpBonus(floor,hard),floorDamageBonus(floor,hard),scaleEnemy(100,floor,'hp',hard)],[floorHpBonus(floor,standard),floorDamageBonus(floor,standard),scaleEnemy(100,floor,'hp',standard)]);
  assert.deepEqual([1,3,6].map(f=>+affixChance(f,hard).toFixed(2)),[.07,.21,.42]);assert.deepEqual([1,3,6].map(f=>+affixChance(f,standard).toFixed(2)),[0,.05,.2]);
  assert.equal(eliteChance(3,hard),0);assert.ok(eliteChance(4,hard)>0);assert.equal(eliteChance(6,standard),0);
  assert.equal(difficultyMeta(DIFFICULTY_OPTIONS[2]),'詞條自第 1 層 · 第 2 層起出現特殊敵人 · 菁英自第 4 層');
  const g=new Game(8,[],0,'soldier','onyx','extraction',{difficulty:'hard'});assert.equal(g.difficulty,'hard');assert.equal(Game.restore(g.serialize()).difficulty,'hard');
});
