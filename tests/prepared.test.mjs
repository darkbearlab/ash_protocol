import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,SIZE,makeEnemy,WEAPONS} from '../src/engine.js';
import {defaultPrepared,preparedEntry,preparedOptions,validPrepared,weaponSwitchTurns,PREPARED_CATALOG} from '../src/prepared.js';
import {grantTrait} from '../src/traits.js';
import {captureAction} from '../src/presentation.js';
import {makeBackup,decodeBackup} from '../src/backup.js';
import {normalizeProfile} from '../src/progression.js';

function arena(Type=Game){const g=new Type(311);g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));Object.assign(g.player,{x:10,y:10});g.enemies=[];g.props=[];g.items=[];g.hazards=[];g.marks=[];g.reveal();return g;}
function fastEnemy(g){const e=makeEnemy('rifleman',14,10,'fast');e.alert=true;e.charge=true;e.windup=1;grantTrait(e,'fast','test:fast',2);g.enemies.push(e);g.reveal();return e;}
const prepare=(g,category,id)=>g.action('prepare',{category,id});

test('new campaigns have three independent prepared slots and no fabricated skills',()=>{
  const g=arena();assert.deepEqual(g.player.prepared,defaultPrepared());assert.deepEqual(g.player.skills,[]);
  assert.equal(preparedEntry(g.player,'item').resource,'meds');assert.equal(preparedEntry(g.player,'grenade').resource,'grenades');
  assert.deepEqual(preparedOptions(g.player,'skill'),[]);assert.equal(validPrepared(g.player),true);
});
test('preparation preserves the entire world, timed states, RNG and waiting bonuses',()=>{
  const g=arena();fastEnemy(g);Object.assign(g.player,{poison:3,guard:true,focus:true,evasive:true,moved:true});grantTrait(g.player,'slow','test:slow',2);
  g.hazards=[{x:10,y:10,type:'fire'}];g.marks=[{x:10,y:10,due:1}];const before=JSON.parse(g.serialize());
  const {steps,success}=captureAction(g,()=>prepare(g,'item',null));assert.equal(success,true);assert.equal(steps.length,0);
  assert.equal(g.player.prepared.grenade,'frag');assert.equal(prepare(g,'grenade',null),true);
  assert.equal(prepare(g,'item','medkit'),true);assert.equal(prepare(g,'grenade','frag'),true);
  assert.deepEqual(JSON.parse(g.serialize()),before);
});
test('invalid, repeated, ended or upgrade-blocked preparation cannot mutate state',()=>{
  const g=arena();fastEnemy(g);const before=g.serialize();
  for(const arg of [null,{}, {category:'weapon',id:'frag'},{category:'item',id:'frag'},{category:'skill',id:'unknown'},{category:'item',id:'medkit'},{category:'__proto__',id:null}])assert.equal(g.action('prepare',arg),false);
  assert.equal(g.serialize(),before);g.pendingPerks=1;assert.equal(prepare(g,'item',null),false);g.pendingPerks=0;g.status='dead';assert.equal(prepare(g,'item',null),false);
});
test('unprepared items cannot bypass the slot through legacy actions; actual use spends a turn',()=>{
  const g=arena();g.player.hp=30;prepare(g,'item',null);const turn=g.turn,meds=g.player.meds;
  assert.equal(g.action('heal'),false);assert.equal(g.action('usePrepared',{category:'item'}),false);assert.equal(g.turn,turn);assert.equal(g.player.meds,meds);
  prepare(g,'item','medkit');assert.equal(g.action('usePrepared',{category:'item'}),true);assert.equal(g.player.hp,75);assert.equal(g.player.meds,meds-1);assert.equal(g.turn,turn+1);
  prepare(g,'grenade',null);assert.equal(g.action('grenade',{x:14,y:10}),false);assert.equal(g.action('usePrepared',{category:'grenade',target:{x:14,y:10}}),false);assert.equal(g.turn,turn+1);
  prepare(g,'grenade','frag');assert.equal(g.action('usePrepared',{category:'grenade',target:{x:14,y:10}}),true);assert.equal(g.player.grenades,1);assert.equal(g.player.meds,meds-1);assert.equal(g.turn,turn+2);
  assert.deepEqual(g.effects.find(e=>e.style==='grenade').to,{x:14,y:10});
});
test('zero stock keeps its selection, and invalid usage never advances the queue',()=>{
  const g=arena();fastEnemy(g);g.player.meds=0;g.player.grenades=0;g.player.hp=50;
  const before=g.enemies[0].hp,turn=g.turn;
  for(const category of ['item','grenade','skill'])assert.equal(g.action('usePrepared',{category,target:{x:14,y:10}}),false);
  assert.equal(g.turn,turn);assert.equal(g.player.hp,50);assert.equal(g.enemies[0].hp,before);assert.deepEqual(g.player.prepared,defaultPrepared());
  g.player.meds=1;g.enemies=[];assert.equal(g.action('usePrepared',{category:'item'}),true);assert.equal(g.player.meds,0);assert.equal(g.player.prepared.item,'medkit');
});
test('prepared healing still respects fast lethal attacks and turn ordering',()=>{
  const g=arena();fastEnemy(g);g.player.hp=1;const meds=g.player.meds;
  assert.equal(g.action('usePrepared',{category:'item'}),true);assert.equal(g.status,'dead');assert.equal(g.player.meds,meds);assert.equal(g.turn,2);
});
class HandgunHookGame extends Game{weaponAt(slot){const w=super.weaponAt(slot);return slot===1?{...w,weaponClass:'pistol'}:w;}}
test('handgun switch hook is destination-based and free; pistol-ammo SMG is still a full turn',()=>{
  assert.ok(WEAPONS.every(w=>weaponSwitchTurns(w)===1));assert.equal(weaponSwitchTurns({weaponClass:'smg',ammoType:'pistol'}),1);assert.equal(weaponSwitchTurns({weaponClass:'pistol'}),0);
  const g=arena(HandgunHookGame);fastEnemy(g);Object.assign(g.player,{guard:true,focus:true,evasive:true,moved:true,poison:2});g.hazards=[{x:10,y:10,type:'fire'}];g.marks=[{x:10,y:10,due:1}];
  const before=JSON.parse(g.serialize());assert.equal(g.actionCost('weapon',1),0);const result=captureAction(g,()=>g.action('weapon',1));assert.equal(result.success,true);assert.equal(result.steps.length,0);
  const after=JSON.parse(g.serialize());before.data.player.weapon=1;before.data.logs=after.data.logs;assert.deepEqual(after,before);
  assert.equal(g.action('weapon',1),false);g.hazards=[];g.marks=[];g.player.poison=0;assert.equal(g.actionCost('weapon',0),1);assert.equal(g.action('weapon',0),true);assert.equal(g.turn,2);assert.equal(g.player.focus,false);
  const smg=arena();smg.player.owned.push(2);assert.equal(smg.action('weapon',2),true);assert.equal(smg.turn,2);
});
test('v7 migration defaults prepared slots, v8 rejects malformed selection, backups retain intentional empty slots',()=>{
  const g=arena();grantTrait(g.player,'small','test:small');g.player.ammo[0]=3;g.player.upgrades[0]=2;
  const old=JSON.parse(g.serialize());old.version=7;delete old.data.player.prepared;delete old.data.player.skills;
  const migrated=Game.restore(JSON.stringify(old));assert.ok(migrated);assert.deepEqual(migrated.player.prepared,defaultPrepared());assert.deepEqual(migrated.player.traits,g.player.traits);assert.equal(migrated.player.ammo[0],3);assert.equal(migrated.player.upgrades[0],2);assert.equal(migrated.rng.state(),g.rng.state());
  prepare(g,'grenade',null);prepare(g,'item',null);const restored=decodeBackup(JSON.stringify(makeBackup(g,normalizeProfile(),'qa')),'qa').game;assert.deepEqual(restored.player,g.player);
  for(const mutate of [p=>delete p.prepared,p=>delete p.skills,p=>p.prepared.skill='unknown',p=>p.prepared.item='frag',p=>p.prepared.extra=null,p=>p.skills=['unknown'],p=>p.prepared=[]]){const bad=JSON.parse(g.serialize());mutate(bad.data.player);assert.equal(Game.restore(JSON.stringify(bad)),null);}
});
test('skill selection supports registered learned skills but refuses unlearned ones',()=>{
  PREPARED_CATALOG.skill.test={name:'test',short:'test',icon:'◇',text:'test'};
  try{const g=arena();assert.equal(prepare(g,'skill','test'),false);g.player.skills.push('test');assert.equal(prepare(g,'skill','test'),true);assert.equal(g.player.prepared.item,'medkit');assert.equal(g.player.prepared.grenade,'frag');assert.equal(g.turn,1);assert.ok(Game.restore(g.serialize()));assert.equal(prepare(g,'skill',null),true);}finally{delete PREPARED_CATALOG.skill.test;}
});
test('loading v7 keeps an original QA-only backup and preserves v8 prepared choices on later loads',async()=>{
  const memory=new Map([['ash-save','live untouched'],['ash-profile','live profile']]);globalThis.location={search:'?test=1'};
  globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
  const s=await import('../src/storage.js?prepared-qa');const old=JSON.parse(arena().serialize());old.version=7;delete old.data.player.prepared;delete old.data.player.skills;const raw=JSON.stringify(old);memory.set('qa-ash-save',raw);
  const g=s.loadGame();assert.ok(g);assert.equal(memory.get('qa-ash-save-v7-backup'),raw);prepare(g,'item',null);s.saveGame(g);assert.equal(s.loadGame().player.prepared.item,null);assert.equal(memory.get('qa-ash-save-v7-backup'),raw);assert.equal(memory.get('ash-save'),'live untouched');assert.equal(memory.get('ash-profile'),'live profile');
});
