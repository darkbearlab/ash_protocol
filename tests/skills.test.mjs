import {clearGeneratedMap} from './helpers/arena.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,SIZE,makeEnemy} from '../src/engine.js';
import {canUseSkill,skillActive,skillStatus} from '../src/skills.js';
import {grantTrait} from '../src/traits.js';
import {captureAction} from '../src/presentation.js';
import {makeBackup,decodeBackup} from '../src/backup.js';
import {normalizeProfile} from '../src/progression.js';

function arena(character='recon'){
  const g=new Game(327,[],0,character,'onyx');
  g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.lighting=g.grid.map(r=>r.slice());
  for(const key of ['barriers','props','items','hazards','marks','enemies','smoke','rooms','traces'])g[key]=[];clearGeneratedMap(g);
  Object.assign(g.player,{x:10,y:10});g.end={x:20,y:20};g.reveal();return g;
}
const use=g=>g.action('usePrepared',{category:'skill'});
const state=g=>g.player.skillState.signal_break;
function enemy(g,type='rifleman',x=14,y=10){const e=makeEnemy(type,x,y,'skill-'+g.enemies.length);g.enemies.push(e);return e;}

test('Recon alone starts with learned, prepared, ready signal break and normal supplies',()=>{
  const g=arena();assert.deepEqual(g.player.skills,['signal_break']);assert.equal(g.player.prepared.skill,'signal_break');
  assert.deepEqual(state(g),{remaining:0,cooldown:0});assert.ok(canUseSkill(g.player,'signal_break'));
  assert.equal(g.player.emp,2);assert.equal(g.player.smoke,2);assert.equal(g.player.meds,2);
  for(const id of ['bulwark']){const other=arena(id);assert.deepEqual(other.player.skills,['anchor']);assert.equal(canUseSkill(other.player,'signal_break'),false);assert.equal(other.turn,1);}
});

test('activation is free, preserves resources, enemy memory and RNG, and emits one presentation step',()=>{
  const g=arena(),e=enemy(g);g.reveal();const before=JSON.parse(g.serialize()),memory=structuredClone(e.lastKnown);
  const result=captureAction(g,()=>use(g));assert.equal(result.success,true);assert.equal(result.steps.length,1);
  assert.equal(result.steps[0].effects[0].type,'pulse');assert.equal(result.steps[0].before.player.skillState.signal_break.remaining,0);
  assert.equal(result.steps[0].after.player.skillState.signal_break.remaining,3);
  const after=JSON.parse(g.serialize());before.data.player.skillState=after.data.player.skillState;before.data.logs=after.data.logs;
  assert.deepEqual(after,before);assert.deepEqual(e.lastKnown,memory);assert.equal(e.alert,true);
});

test('three paid actions are protected, cooldown begins on activation and ends after six',()=>{
  const g=arena();use(g);assert.equal(skillStatus(g.player,'signal_break'),'生效 3');
  for(let i=1;i<=6;i++){
    assert.equal(use(g),false);assert.equal(g.action('wait'),true);
    assert.deepEqual(state(g),{remaining:Math.max(0,3-i),cooldown:6-i});
    assert.equal(skillActive(g.player),i<3);
  }
  assert.equal(skillStatus(g.player,'signal_break'),'就緒');assert.equal(use(g),true);assert.equal(g.turn,7);
});

test('quick reload, preparation, invalid actions and reloading saves cannot reduce timers',()=>{
  const g=arena();g.player.weapon=2;g.player.ammo[2]=0;use(g);
  assert.equal(g.actionCost('reload'),0);assert.equal(g.action('reload'),true);
  assert.equal(g.action('prepare',{category:'skill',id:null}),true);assert.equal(use(g),false);
  assert.equal(g.action('prepare',{category:'skill',id:'signal_break'}),true);
  assert.equal(g.action('move',[1,1]),false);assert.equal(g.action('reload'),false);
  assert.deepEqual(state(g),{remaining:3,cooldown:6});assert.equal(g.turn,1);
  assert.deepEqual(state(Game.restore(g.serialize())),state(g));
});

test('invalid preparation, disability, pending upgrades and ended runs cannot activate the skill',()=>{
  for(const block of [g=>g.player.prepared.skill=null,g=>g.player.control.disabled=1,g=>g.pendingPerks=1,g=>g.status='dead']){
    const g=arena();block(g);const before=state(g);assert.equal(g.action('skill','signal_break'),false);assert.deepEqual(state(g),before);assert.equal(g.turn,1);
  }
  const g=arena();use(g);g.player.control.disabled=1;g.action('wait');assert.deepEqual(state(g),{remaining:2,cooldown:5});
});

test('biological, mechanical and enhanced senses lose player perception while player vision stays intact',()=>{
  for(const type of ['rifleman','drone','sniper','warden']){
    const g=arena();use(g);const e=enemy(g,type);grantTrait(e,'night_vision','qa');grantTrait(e,'infrared','qa');g.reveal();
    assert.equal(g.sight(e,g.player),false);assert.equal(g.sight({...e},g.player),false);
    assert.equal(g.sight(g.player,e),true);assert.equal(g.visible(e),true);assert.equal(g.shotClear(e,g.player),true);
    assert.equal(e.alert,false);assert.equal(e.lastKnown,null);
    for(let i=0;i<3;i++)g.action('wait');assert.equal(e.alert,true);assert.deepEqual(e.lastKnown,{x:10,y:10});
  }
});

test('all initiative phases remain blind for the full third action, then reacquire',()=>{
  const g=arena();for(const [i,speed]of ['fast',null,'slow'].entries()){const e=enemy(g,'rifleman',14,9+i);if(speed)grantTrait(e,speed,'qa');}
  g.reveal();use(g);const observations=[],original=g.executeEnemy.bind(g);
  g.executeEnemy=e=>{observations.push(g.sight(e,g.player));return original(e);};
  for(let i=0;i<3;i++)g.action('wait');assert.equal(observations.length,9);assert.ok(observations.every(v=>!v));
  g.action('wait');assert.ok(observations.slice(9).every(Boolean));
});

test('alert enemies search last seen position without following live movement or stepping onto the player',()=>{
  const g=arena(),e=enemy(g);g.reveal();use(g);g.action('move',[0,1]);
  assert.deepEqual(e.lastKnown,{x:10,y:10});assert.deepEqual({x:e.x,y:e.y},{x:13,y:10});
  e.x=11;e.y=11;e.lastKnown={x:9,y:11};g.enemyAct(e);
  assert.notDeepEqual({x:e.x,y:e.y},{x:g.player.x,y:g.player.y});
  assert.deepEqual(e.lastKnown,{x:9,y:11});
});

test('committed sniper fires at its original tile through signal break; moving still dodges it',()=>{
  for(const move of [false,true]){
    const g=arena(),e=enemy(g,'sniper');g.reveal();e.charge=true;e.windup=1;e.aim={x:10,y:10};use(g);
    g.rng=()=>0;g.action(move?'move':'wait',move?[0,1]:undefined);
    assert.equal(e.charge,false);assert.equal(e.aim,null);
    const shot=g.effects.find(effect=>effect.type==='enemyShot');assert.ok(shot);assert.deepEqual(shot.to,{x:10,y:10});
    assert.equal(g.player.hp<100,!move);if(move)assert.equal(shot.miss,true);
  }
});

test('marked bombardment and environmental damage still resolve during the effect',()=>{
  const g=arena();g.marks=[{x:10,y:10,due:g.turn+1}];g.hazards=[{x:10,y:10,type:'fire'}];use(g);
  g.action('wait');assert.equal(g.marks.length,0);assert.ok(g.player.hp<88);assert.equal(state(g).remaining,2);
});

test('shooting uses one duration tick and does not cancel signal break',()=>{
  const g=arena(),e=enemy(g);e.hp=e.maxHp=500;g.reveal();g.target=e.id;use(g);
  const ammo=g.player.ammo[g.player.weapon];assert.equal(g.action('fire'),true);assert.ok(g.player.ammo[g.player.weapon]<ammo);
  assert.deepEqual(state(g),{remaining:2,cooldown:5});assert.equal(g.sight(e,g.player),false);
});

test('descending clears active effect and spends one cooldown turn without recharging it',()=>{
  const g=arena();g.end={x:11,y:10};use(g);assert.equal(g.action('interact'),true);assert.equal(g.floor,2);
  assert.deepEqual(state(g),{remaining:0,cooldown:5});assert.equal(use(g),false);
});

test('current save and full backup preserve active timers and intentionally empty prepared slots',()=>{
  const g=arena();use(g);g.action('wait');g.action('prepare',{category:'skill',id:null});
  assert.deepEqual(Game.restore(g.serialize()).player,g.player);
  const restored=decodeBackup(JSON.stringify(makeBackup(g,normalizeProfile(),'qa')),'qa').game;
  assert.deepEqual(restored.player,g.player);assert.equal(restored.player.prepared.skill,null);
});

test('v19 Recon migration adds a ready prepared skill without refilling or changing RNG',()=>{
  for(const character of ['soldier','recon','bulwark']){
    const g=arena(character);Object.assign(g.player,{hp:43,meds:0,emp:0,smoke:0,reserve:7});
    const legacy=JSON.parse(g.serialize());legacy.version=19;const p=legacy.data.player;p.skills=[];p.prepared.skill=null;delete p.skillState;
    const restored=Game.restore(JSON.stringify(legacy));assert.ok(restored);assert.equal(restored.rng.state(),g.rng.state());
    const expected=structuredClone(p);const id=character==='recon'?'signal_break':character==='soldier'?'early_warning':'anchor';expected.skills=id?[id]:[];expected.prepared.skill=id;
    expected.skillState=id?{[id]:{remaining:0,cooldown:0}}:{};assert.deepEqual(restored.player,expected);
  }
});

test('save rejects missing, unknown, malformed and out-of-bounds skill timers',()=>{
  for(const mutate of [p=>delete p.skillState,p=>p.skillState={},p=>p.skillState.extra={},p=>p.skillState.signal_break=null,
    p=>p.skillState.signal_break.remaining=-1,p=>p.skillState.signal_break.remaining=4,p=>p.skillState.signal_break.cooldown=7,
    p=>p.skillState.signal_break.cooldown=2.5,p=>p.skillState.signal_break={remaining:3,cooldown:2},p=>p.skillState.signal_break.extra=0]){
    const raw=JSON.parse(arena().serialize());mutate(raw.data.player);assert.equal(Game.restore(JSON.stringify(raw)),null);
  }
});

test('v19 storage migration keeps the original QA backup and leaves live saves untouched',async()=>{
  const memory=new Map([['ash-save','live campaign'],['ash-profile','live profile']]);globalThis.location={search:'?test=1'};
  globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
  const legacy=JSON.parse(arena().serialize());legacy.version=19;legacy.data.player.skills=[];legacy.data.player.prepared.skill=null;delete legacy.data.player.skillState;
  const raw=JSON.stringify(legacy);memory.set('qa-ash-save',raw);const storage=await import('../src/storage.js?skill-migration');
  const g=storage.loadGame();assert.ok(g);assert.equal(memory.get('qa-ash-save-v19-backup'),raw);
  use(g);storage.saveGame(g);assert.deepEqual(state(storage.loadGame()),{remaining:3,cooldown:6});
  assert.equal(memory.get('qa-ash-save-v19-backup'),raw);assert.equal(memory.get('ash-save'),'live campaign');assert.equal(memory.get('ash-profile'),'live profile');
});
