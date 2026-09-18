import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,SIZE,makeEnemy} from '../src/engine.js';
import {activeTrait,grantTrait} from '../src/traits.js';
import {DETOUR_TRAIT,DETOUR_TUNING,exposedFrom} from '../src/detour.js';
import {cower,rally} from '../src/rebels.js';
import {areaCells} from '../src/throwables.js';

// 3.129.0 迂迴 (user design 2026-09-18, docs/DETOUR.md): the trait alone decides who takes the route you cannot see.
// A wall row at y=12 screens the north half from a player standing south of it.
function field({wallFrom=6,wallTo=20}={}){
  const g=new Game(4242,[],0,'soldier','onyx','extraction',{facilityFaction:'loyalist'});
  g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));for(let x=wallFrom;x<=wallTo;x++)g.grid[12][x]=0;
  g.lighting=g.grid.map(r=>r.map(()=>1));
  g.barriers=[];g.props=[];g.items=[];g.hazards=[];g.marks=[];g.smoke=[];g.flares=[];g.enemies=[];
  Object.assign(g.player,{x:13,y:16});g.player.hp=g.player.maxHp=999;g.reveal();
  const e=makeEnemy('rifleman',4,14,'w',1,0,'loyalist');e.alert=true;e.lastKnown={x:13,y:16};g.enemies.push(e);
  return {g,e};
}
function walk(g,e,goal,limit=60){
  const seen=exposedFrom(g,e.lastKnown);let exposed=0,steps=0;
  for(;steps<limit&&(e.x!==goal.x||e.y!==goal.y);steps++){const s=g.nextStep(e,goal);if(!s)break;e.x=s.x;e.y=s.y;if(seen.has(`${s.x},${s.y}`))exposed++;}
  return {exposed,steps,arrived:e.x===goal.x&&e.y===goal.y};
}
const goal={x:22,y:14};

test('a unit with 迂迴 goes round behind the wall; without it, it walks the open line',()=>{
  const plain=field(),direct=walk(plain.g,plain.e,goal);
  const {g,e}=field();grantTrait(e,DETOUR_TRAIT,'test');const covered=walk(g,e,goal);
  assert.ok(direct.arrived&&covered.arrived);
  assert.ok(covered.exposed<direct.exposed,`exposed ${covered.exposed} vs ${direct.exposed}`);
  assert.ok(covered.steps>direct.steps&&covered.steps<=direct.steps+DETOUR_TUNING.extraSteps,`steps ${covered.steps} vs ${direct.steps}`);
});

test('a detour longer than a small room\'s outside is not taken: it walks the shortest route',()=>{
  const plain=field({wallFrom:1,wallTo:25}),direct=walk(plain.g,plain.e,goal);
  const {g,e}=field({wallFrom:1,wallTo:25});grantTrait(e,DETOUR_TRAIT,'test');const tried=walk(g,e,goal);
  assert.equal(tried.steps,direct.steps,'the only cover is too far round');
});

test('what counts as seen is judged from where it last knew you were, not where you are',()=>{
  const {g,e}=field();grantTrait(e,DETOUR_TRAIT,'test');
  Object.assign(g.player,{x:13,y:5});g.reveal();e.lastKnown={x:13,y:16};   // you slipped north; it still fears the south
  const first=g.nextStep(e,goal);
  assert.ok(first.y<e.y||first.x<e.x,'it still heads for the north side of the wall');
  delete e.lastKnown;const blind=g.nextStep(e,goal);
  const {g:g2,e:e2}=field();Object.assign(g2.player,{x:13,y:5});g2.reveal();delete e2.lastKnown;
  assert.deepEqual(blind,g2.nextStep(e2,goal),'no idea where you are: the plain route');
});

test('smoke hides a tile; darkness does not',()=>{
  const {g}=field();const from={x:13,y:16},tile={x:13,y:14};
  assert.ok(exposedFrom(g,from).has('13,14'));
  g.lighting[14][13]=0;assert.ok(exposedFrom(g,from).has('13,14'),'dark is still seen');
  g.smoke=[{x:13,y:14,cells:areaCells(g.grid,tile,1,g.barriers,g),expires:g.turn+5}];
  assert.ok(!exposedFrom(g,from).has('13,14'),'smoke hides it');
});

test('who has 迂迴: a hiding rebel until it rallies; nothing else by default',()=>{
  const g=new Game(4242,[],0,'soldier','onyx','extraction',{facilityFaction:'rebel'});
  for(const e of g.enemies)assert.ok(!activeTrait(e,DETOUR_TRAIT),e.type);
  const e=g.enemies.find(o=>o.type==='rifleman'&&!o.elite);assert.ok(e);
  cower(g,e);assert.ok(activeTrait(e,DETOUR_TRAIT),'hiding: detours');
  rally(g,e);assert.ok(!activeTrait(e,DETOUR_TRAIT),'rallied: straight at you again');assert.equal(e.order,undefined,'and its retreat order is over');
});
