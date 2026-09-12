import {clearGeneratedMap} from './helpers/arena.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,SIZE,makeEnemy} from '../src/engine.js';
import {skillActive,skillStatus,ANCHOR_SOURCE} from '../src/skills.js';
import {grantTrait,activeTrait} from '../src/traits.js';
import {applyDisruption,DISRUPT_TURNS} from '../src/throwables.js';
import {makeBarrier} from '../src/barriers.js';
import {addAlly} from '../src/allies.js';
import {captureAction,planPresentation} from '../src/presentation.js';
import {makeBackup,decodeBackup} from '../src/backup.js';
import {normalizeProfile} from '../src/progression.js';

function arena(){const g=new Game(335,[],0,'bulwark','onyx');g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.lighting=g.grid.map(r=>r.slice());g.seen=g.grid.map(r=>r.map(()=>true));for(const k of ['allies','enemies','props','items','barriers','hazards','marks','rooms','traces','smoke'])g[k]=[];clearGeneratedMap(g);Object.assign(g.player,{x:10,y:10,hp:200,maxHp:200});g.start={x:5,y:5};g.end={x:20,y:20};g.reveal();return g;}
const toggle=g=>g.action('usePrepared',{category:'skill'});
function foe(g,{x=14,y=10,speed=0}={}){const e=makeEnemy('rifleman',x,y,'anchor-enemy-'+g.enemies.length);Object.assign(e,{hp:1000,maxHp:1000,alert:true});if(speed)grantTrait(e,speed<0?'fast':'slow','test:anchor');g.enemies.push(e);g.reveal();g.target=e.id;return e;}
function anchored(){const g=arena();assert.ok(toggle(g));return g;}

test('Bulwark learns a paid toggle; activation and release each occur at the original slow phase',()=>{
 const g=arena(),p=g.player;assert.equal(p.prepared.skill,'anchor');assert.equal(skillStatus(p,'anchor'),'啟動');
 const seen=[];foe(g);g.enemyAct=()=>seen.push(skillActive(p,'anchor'));
 assert.ok(toggle(g));assert.equal(g.turn,2);assert.ok(skillActive(p,'anchor'));assert.equal(skillStatus(p,'anchor'),'解除');
 assert.ok(p.traits.some(t=>t.source===ANCHOR_SOURCE&&t.id==='clumsy'));
 assert.ok(toggle(g));assert.equal(g.turn,3);assert.deepEqual(seen,[false,true]);assert.equal(skillActive(p,'anchor'),false);assert.ok(activeTrait(p,'clumsy'));assert.ok(!p.traits.some(t=>t.source===ANCHOR_SOURCE));
});
test('anchor blocks movement, vaulting and either floor-change API without spending a turn; bump melee and door use remain possible',()=>{
 const g=anchored(),p=g.player,t=g.turn,ammo=[...p.ammo],rng=g.rng.state();
 assert.equal(g.action('move',[0,1]),false);g.barriers=[makeBarrier('low_partition',p,{x:10,y:11},'edge-anchor-low')];assert.equal(g.action('move',[0,1]),false);
 Object.assign(p,g.end);assert.equal(g.action('interact'),false);assert.equal(g.descend(),false);assert.equal(g.turn,t);assert.equal(g.rng.state(),rng);assert.deepEqual(p.ammo,ammo);
 Object.assign(p,{x:10,y:10});g.barriers=[makeBarrier('door',p,{x:11,y:10},'edge-anchor-door')];assert.ok(g.action('move',[1,0]));assert.ok(g.barriers[0].open);assert.equal(p.x,10);
 const e=foe(g,{x:11});g.enemyAct=()=>{};g.rng=Object.assign(()=>0,{state:()=>0});assert.ok(g.action('move',[1,0]));assert.equal(e.hp,860);assert.equal(p.weapon,6);assert.equal(p.x,10);
});
test('two real LMG bursts bracket normal enemies; all units and environment otherwise act once',()=>{
 const g=anchored(),p=g.player,fast=foe(g,{speed:-1}),normal=foe(g,{x:15}),slow=foe(g,{x:16,speed:1}),order=[];g.target=normal.id;
 g.rng=Object.assign(()=>0,{state:()=>0});g.enemyAct=e=>order.push([e.id,p.stats.shots]);let environment=0;g.environmentTurn=()=>environment++;
 const t=g.turn;assert.ok(g.action('fire'));assert.equal(g.turn,t+1);assert.equal(p.ammo[6],24);assert.equal(p.stats.shots,6);assert.deepEqual(order,[[fast.id,0],[normal.id,3],[slow.id,6]]);assert.equal(environment,1);
});
test('partial magazines never create ammunition and each attack uses independent hit rolls',()=>{
 const g=anchored(),p=g.player,e=foe(g);g.enemyAct=()=>{};p.ammo[6]=4;let n=0;
 g.rng=Object.assign(()=>++n%2===0?.999:0,{state:()=>0});assert.ok(g.action('fire'));assert.equal(p.stats.shots,4);assert.equal(p.ammo[6],0);assert.equal(e.hp,1000);assert.equal(g.effects.filter(e=>e.type==='shot').length,4);
 const t=g.turn;assert.equal(g.action('fire'),false);assert.equal(g.turn,t);
});
test('second shot follows the same moving target, and escaped or killed targets still consume committed rounds without retargeting',()=>{
 for(const outcome of ['move','escape','death']){
  const g=anchored(),p=g.player,e=foe(g),other=foe(g,{x:13,y:11});g.target=e.id;g.rng=Object.assign(()=>0,{state:()=>0});
  g.enemyAct=actor=>{if(actor!==e)return;if(outcome==='move')e.y=11;else if(outcome==='escape')e.x=25;else e.hp=0;g.reveal();};
  assert.ok(g.action('fire'));assert.equal(p.ammo[6],24);assert.equal(other.hp,1000);
  const shots=g.effects.filter(e=>e.type==='shot');assert.equal(shots.length,6);assert.deepEqual(shots.at(-1).to,outcome==='move'?{x:14,y:11}:{x:14,y:10});
 }
});
test('a first burst kill does not redirect the second burst into another visible enemy',()=>{
 const g=anchored(),e=foe(g),other=foe(g,{x:13,y:11});e.hp=1;g.target=e.id;g.enemyAct=()=>{};g.rng=Object.assign(()=>0,{state:()=>0});
 assert.ok(g.action('fire'));assert.equal(g.player.stats.shots,4);assert.equal(g.player.kills,1);assert.equal(other.hp,1000);assert.equal(g.player.ammo[6],26);
});
test('both equipped melee and integrated bump strikes repeat with independent hit checks',()=>{
 for(const bump of [false,true]){const g=anchored(),e=foe(g,{x:11});g.enemyAct=()=>{};if(!bump)g.action('weapon',7);const ammo=[...g.player.ammo];let n=0;g.rng=Object.assign(()=>n++===0?.999:0,{state:()=>0});
  assert.ok(g.action(bump?'move':'fire',bump?[1,0]:undefined));assert.equal(e.hp,930);assert.deepEqual(g.player.ammo,ammo);assert.equal(g.player.weapon,bump?6:7);assert.equal(g.effects.filter(e=>e.style==='slash').length,2);
 }
});
test('a target leaving melee range after the normal strike makes the slow strike miss without walking',()=>{
 const g=anchored(),e=foe(g,{x:11});g.rng=Object.assign(()=>0,{state:()=>0});g.enemyAct=()=>{e.x=14;g.reveal();};g.action('move',[1,0]);assert.equal(e.hp,930);assert.equal(g.player.x,10);assert.equal(g.effects.filter(e=>e.style==='slash').length,2);
});
test('anchor leaves all four throwable types at one use in the original slow phase',()=>{
 for(const [id,resource] of [['frag','grenades'],['smoke','smoke'],['emp','emp'],['stun','stun']]){
  const g=anchored(),p=g.player;p[resource]=2;g.action('prepare',{category:'grenade',id});const t=g.turn,before=[];foe(g,{x:17});g.enemyAct=()=>before.push(p.stats.grenades);
  assert.ok(g.action('usePrepared',{category:'grenade',target:{x:14,y:10}}));assert.equal(p[resource],1);assert.equal(p.stats.grenades,1);assert.equal(g.turn,t+1);assert.equal(g.effects.filter(e=>e.style==='grenade').length,1);assert.deepEqual(before,[0]);
  if(id==='smoke')assert.equal(g.smoke.length,1);
 }
 const g=anchored();g.player.grenades=1;assert.ok(g.action('grenade',{x:14,y:10}));assert.equal(g.player.grenades,0);assert.equal(g.player.stats.grenades,1);
});
test('normal enemy lethal damage interrupts the second attack; fast lethal damage prevents both',()=>{
 for(const speed of [0,-1]){const g=anchored();foe(g,{speed});g.enemyAct=()=>{g.player.hp=0;};assert.ok(g.action('fire'));assert.equal(g.status,'dead');assert.equal(g.player.stats.shots,speed===0?3:0);}
});
test('disability skips both attacks but counts one lost round, and immunity decrements once',()=>{
 const g=anchored(),p=g.player;foe(g);g.enemyAct=()=>{};p.control.disabled=1;assert.ok(g.action('fire'));assert.equal(p.stats.shots,0);assert.deepEqual(p.control,{disabled:0,immune:2});
 g.action('fire');assert.equal(p.stats.shots,6);assert.equal(p.control.immune,1);assert.ok(skillActive(p,'anchor'));
});
test('mid-round disruption cancels the slow attack without clearing anchor, and a single self-stun grenade retains normal disability timing',()=>{
 const g=anchored(),p=g.player;foe(g);g.enemyAct=()=>applyDisruption(p,'biological');assert.ok(g.action('fire'));assert.equal(p.stats.shots,3);assert.equal(p.control.disabled,DISRUPT_TURNS-1);assert.ok(skillActive(p,'anchor'));
 const h=anchored();h.player.stun=2;h.action('prepare',{category:'grenade',id:'stun'});h.action('grenade',{x:11,y:10});assert.equal(h.player.stun,1);assert.equal(h.player.control.disabled,DISRUPT_TURNS);
});
test('anchor does not duplicate allies, healing, reload, waits or free weapon swaps and cannot be disabled by unpreparing',()=>{
 const g=anchored(),p=g.player,e=foe(g),a=addAlly(g,'drone','drone',{sourceId:'drone_sentry',point:{x:11,y:10}});a.ammo=8;a.bornTurn=1;g.enemyAct=()=>{};g.rng=Object.assign(()=>0,{state:()=>0});g.action('fire');assert.equal(a.ammo,7);
 p.hp=80;const meds=p.meds,t=g.turn;g.action('heal');assert.equal(p.meds,meds-1);assert.equal(p.hp,102);assert.equal(g.turn,t+1);
 const turns=g.turn;g.action('weapon',7);g.action('weapon',6);g.action('prepare',{category:'skill',id:null});assert.equal(g.turn,turns);assert.ok(skillActive(p,'anchor'));assert.equal(g.action('move',[0,1]),false);assert.equal(toggle(g),false);
 g.action('wait');assert.ok(p.guard);assert.ok(skillActive(p,'anchor'));assert.equal(g.turn,turns+1);
});
test('continuous correction advances once per turn, not once per extra burst',()=>{
 const g=anchored(),p=g.player,e=foe(g);g.enemyAct=()=>{};grantTrait(p,'correction','test:anchor');p.fireChain={targetId:e.id,turn:g.turn,count:2};
 const values=[],original=g.fireChance.bind(g);g.fireChance=t=>{values.push(p.fireChain?.count);return original(t);};g.rng=Object.assign(()=>.5,{state:()=>0});g.action('fire');assert.deepEqual(values,[2,2,2,2,2,2]);assert.equal(p.fireChain.count,3);
});
test('toggle state and skill-sourced clumsy roundtrip, remain through time and backup, and reject contradictory saves',()=>{
 const g=anchored();g.action('wait');g.action('prepare',{category:'skill',id:null});const copy=Game.restore(g.serialize());assert.ok(copy);assert.ok(skillActive(copy.player,'anchor'));assert.equal(copy.player.prepared.skill,null);
 assert.deepEqual(decodeBackup(JSON.stringify(makeBackup(g,normalizeProfile(),'qa')),'qa').game.player,g.player);
 for(const mutate of [p=>p.skillState.anchor.remaining=2,p=>p.skillState.anchor.cooldown=1,p=>p.traits=p.traits.filter(t=>t.source!==ANCHOR_SOURCE),p=>p.skillState.anchor.remaining=0]){const raw=JSON.parse(g.serialize());mutate(raw.data.player);assert.equal(Game.restore(JSON.stringify(raw)),null);}
});
test('v24 Bulwark receives an inactive prepared anchor without changing resources, RNG or other units; first load backs up exact bytes',async()=>{
 const g=arena(),raw=JSON.parse(g.serialize());raw.version=24;raw.data.player.skills=[];raw.data.player.prepared.skill=null;raw.data.player.skillState={};raw.data.player.hp=81;raw.data.player.ammo[6]=7;const text=JSON.stringify(raw),memory=new Map([['qa-ash-save',text],['ash-save','untouched']]);
 globalThis.location={search:'?test=1'};globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
 const storage=await import('../src/storage.js?anchor335'),restored=storage.loadGame();assert.ok(restored);assert.equal(restored.player.hp,81);assert.equal(restored.player.ammo[6],7);assert.deepEqual(restored.allies,g.allies);assert.equal(restored.rng.state(),g.rng.state());assert.equal(restored.player.prepared.skill,'anchor');assert.ok(!skillActive(restored.player,'anchor'));assert.equal(memory.get('qa-ash-save-v24-backup'),text);assert.equal(memory.get('ash-save'),'untouched');
});
test('playback keeps normal burst, enemy counterattack and slow burst in that order with no pre-impact death',()=>{
 const g=anchored(),e=foe(g);g.rng=Object.assign(()=>0,{state:()=>0});e.charge=true;e.windup=1;
 const result=captureAction(g,()=>g.action('fire')),plan=planPresentation(result.steps),shots=plan.events.flatMap(x=>x.effects).filter(e=>e.type==='shot'||e.type==='enemyShot');
 const i=shots.findIndex(e=>e.type==='enemyShot');assert.ok(i>0&&i<shots.length-1);assert.ok(shots.slice(0,i).every(e=>e.type==='shot'));assert.ok(shots.slice(i+1).some(e=>e.type==='shot'));
});
