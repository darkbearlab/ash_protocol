import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,SIZE,makeEnemy,WEAPONS} from '../src/engine.js';
import {activeTrait,grantTrait,initiative} from '../src/traits.js';
import {weaponSwitchTurns} from '../src/prepared.js';
import {weaponStats,rollAffix} from '../src/weapons.js';
import {captureAction,planPresentation} from '../src/presentation.js';
import {targetDetails} from '../src/target-card.js';
import {makeBackup,decodeBackup} from '../src/backup.js';
import {normalizeProfile} from '../src/progression.js';

function arena(Type=Game){const g=new Type(314,[],0,'bulwark','onyx');g.barriers=[];g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));Object.assign(g.player,{x:10,y:10});g.enemies=[];g.items=[];g.props=[];g.hazards=[];g.marks=[];g.rng=Object.assign(()=>0,{state:()=>0});g.reveal();return g;}
function add(g,x=11,y=10){const e=makeEnemy('rifleman',x,y,'enemy');Object.assign(e,{hp:1000,maxHp:1000,alert:true,charge:true});g.enemies.push(e);g.target=e.id;g.reveal();return e;}

test('Bulwark starts with independent large, clumsy, slow and armor traits and the two new weapons',()=>{
  const g=arena();assert.equal(g.player.hp,200);assert.equal(g.player.maxHp,200);assert.equal(g.player.armor,6);assert.equal(g.player.plates,30);
  assert.deepEqual(g.player.owned,[6,7]);assert.equal(g.player.ammo[6],30);assert.equal(g.player.ammo[7],0);assert.equal(g.weapon.ammoType,'rifle');
  for(const trait of ['large','clumsy','slow','heavy_armor'])assert.equal(activeTrait(g.player,trait),true);
  assert.equal(initiative(g.player),1);const e=add(g,14);assert.equal(g.accuracy(e,g.player).chance,99);
  g.player.moved=true;assert.equal(g.accuracy(e,g.player).movePenalty,9);
  grantTrait(g.player,'fast','test');assert.equal(initiative(g.player),0);
});
test('integrated fist equips in both directions for free and preserves the entire round state',()=>{
  const g=arena(),e=add(g);grantTrait(e,'fast','test',2);Object.assign(g.player,{guard:true,focus:true,evasive:true,moved:true,moveDelta:[0,1],poison:2});g.hazards=[{x:10,y:10,type:'fire'}];g.marks=[{x:10,y:10,due:1}];
  for(const slot of [7,6]){
    assert.equal(g.actionCost('weapon',slot),0);const before=JSON.parse(g.serialize());
    assert.equal(g.action('weapon',slot),true);const after=JSON.parse(g.serialize());
    before.data.player.weapon=slot;before.data.logs=after.data.logs;assert.deepEqual(after,before);
  }
  assert.equal(weaponSwitchTurns(WEAPONS[7],WEAPONS[6]),0);assert.equal(weaponSwitchTurns(WEAPONS[6],WEAPONS[7]),0);
  assert.equal(weaponSwitchTurns(WEAPONS[0],WEAPONS[6]),1);
});
test('fist never spends ammo or reloads, ignores cover/movement hit penalties, and still takes a turn',()=>{
  const g=arena(),e=add(g);e.moved=true;e.moveDelta=[0,1];grantTrait(e,'small','test');grantTrait(e,'sidestep','test');g.grid[10][12]=0;
  g.action('weapon',7);assert.equal(g.fireChance(e),99);assert.match(targetDetails(g).cover,/近戰無視掩體/);
  const ammo=[...g.player.ammo],reserve=g.player.reserve,turn=g.turn;assert.equal(g.action('reload'),false);assert.equal(g.reload(),false);assert.equal(g.turn,turn);
  assert.equal(g.action('fire'),true);assert.equal(g.turn,turn+1);assert.equal(e.hp,930);assert.deepEqual(g.player.ammo,ammo);assert.equal(g.player.reserve,reserve);assert.equal(g.player.stats.shots,0);
  assert.equal(g.player.fireChain,null);
});
test('fist has a strict cardinal range of one, can miss, and damages destructible props',()=>{
  const g=arena(),e=add(g,11,11);g.action('weapon',7);const turn=g.turn;assert.equal(g.action('fire'),false);assert.equal(g.turn,turn);
  e.y=10;g.rng=()=>.999;assert.equal(g.action('fire'),true);assert.equal(e.hp,1000);
  g.enemies=[];g.rng=()=>0;g.props=[{id:'box',type:'cover',x:11,y:10,hp:100,maxHp:100}];g.target='box';assert.equal(g.action('fire'),true);assert.equal(g.props[0].hp,30);
});
class Flee extends Game{executeEnemy(e){e.x+=1;e.moved=true;}}
test('slow melee commits its original target; an enemy that moves away causes an empty swing without damaging replacements',()=>{
  const g=arena(Flee),e=add(g);g.action('weapon',7);const {steps}=captureAction(g,()=>g.action('fire'));
  assert.equal(g.turn,2);assert.equal(e.x,12);assert.equal(e.hp,1000);assert.equal(g.player.ammo[7],0);
  const shot=steps.flatMap(s=>s.effects).find(e=>e.type==='shot');assert.equal(shot.miss,true);assert.deepEqual(shot.to,{x:11,y:10});assert.equal(shot.style,'slash');
});
test('fixed fist cannot be salvaged or exchanged, but upgrades work and ranged weapons remain replaceable',()=>{
  const g=arena();const item=g.registerWeapon({type:'weapon',weapon:0,x:10,y:10});g.items.push(item);g.player.scrap=100;g.action('weapon',7);
  const turn=g.turn;assert.equal(g.action('salvage',7),false);assert.equal(g.salvage(7),false);assert.equal(g.action('replaceWeapon',{take:item.slot,leave:7}),false);assert.equal(g.replaceWeapon({take:item.slot,leave:7}),false);assert.equal(g.turn,turn);
  assert.equal(g.action('upgrade'),true);assert.equal(g.player.upgrades[7],1);assert.equal(g.weaponDamage().min,75);
  assert.equal(g.action('replaceWeapon',{take:item.slot,leave:6}),true);assert.ok(g.player.owned.includes(7));assert.equal(g.player.weapon,7);
  assert.equal(rollAffix(7,'any-seed'),null);assert.equal(weaponStats(7,'longbarrel').range,1);
});
test('heavy armor reduces direct damage after flat armor; plates and wait stack, hazards do not',()=>{
  const g=arena();g.player.plates=0;g.damagePlayer(19,'test');assert.equal(g.player.hp,190,'ceil((19-6)*.75)=10');
  g.player.hp=200;g.player.guard=true;g.player.plates=30;g.damagePlayer(19,'blast',null,true);assert.equal(g.player.hp,197);assert.equal(g.player.plates,28);
  g.player.hp=200;g.hazards=[{x:10,y:10,type:'fire'}];g.environmentTurn();assert.equal(g.player.hp,188);
  const e=add(g);grantTrait(e,'heavy_armor','test');g.player.weapon=7;g.hitTarget(e,80,g.player);assert.equal(e.hp,940);
});
test('LMG spends rifle rounds per real shot, handles partial bursts and reloads from the capped reserve',()=>{
  const g=arena(),e=add(g,14);g.player.ammo[6]=2;
  const {steps}=captureAction(g,()=>g.action('fire'));assert.equal(g.player.ammo[6],0);assert.equal(g.player.stats.shots,2);assert.equal(e.hp,964);
  const bullets=steps.flatMap(s=>s.effects).filter(e=>e.type==='shot');assert.equal(bullets.length,2);
  assert.ok(planPresentation(steps).events.flatMap(e=>e.effects).some(e=>e.weaponId==='lmg'));
  g.player.reserve=7;assert.equal(g.action('reload'),true);assert.equal(g.player.ammo[6],7);assert.equal(g.player.reserve,0);
});
test('normal enemies act before Bulwark and can kill before its committed attack',()=>{
  const g=arena();add(g);g.player.hp=1;g.player.plates=0;g.action('fire');assert.equal(g.status,'dead');assert.equal(g.player.ammo[6],30);
});
test('fist impact and death appear after swing completion; LMG has a three-shot burst',()=>{
  const g=arena(),e=add(g);e.hp=1;g.action('weapon',7);
  const {steps}=captureAction(g,()=>g.action('fire'));const plan=planPresentation(steps);
  const swing=plan.events.find(ev=>ev.effects.some(f=>f.weaponId==='powerfist'));
  const fall=plan.events.find(ev=>ev.effects.some(f=>f.type==='fall'));
  assert.ok(fall.time>swing.time);assert.equal(swing.state.enemies[0].hp,1);assert.ok(fall.state.enemies[0].hp<=0);
  const h=arena();add(h,14);h.action('fire');assert.equal(h.player.stats.shots,3);assert.equal(h.player.ammo[6],27);
});
test('new character and fixed fist survive save, floor and backup; malformed or removable fist saves are rejected',()=>{
  const g=arena();g.player.upgrades[7]=2;g.action('weapon',7);const p=decodeBackup(JSON.stringify(makeBackup(g,normalizeProfile(),'qa')),'qa').game.player;assert.deepEqual(p,g.player);
  g.floor=2;g.loadFloor();assert.equal(g.player.character,'bulwark');assert.equal(g.player.weapon,7);assert.equal(g.player.upgrades[7],2);
  for(const mutate of [p=>p.owned=[6],p=>p.ammo[7]=1,p=>p.affixes[7]='extended']){const raw=JSON.parse(g.serialize());mutate(raw.data.player);assert.equal(Game.restore(JSON.stringify(raw)),null);}
  const old=new Game(314,[],0,'recon');const raw=JSON.parse(old.serialize());raw.version=10;const restored=Game.restore(JSON.stringify(raw));assert.deepEqual(restored.player,old.player);assert.equal(restored.rng.state(),old.rng.state());
});
test('v10 migration saves an untouched QA original and Bulwark result history is valid in a complete backup',async()=>{
  const memory=new Map();globalThis.location={search:'?test=1'};globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
  const storage=await import('../src/storage.js?bulwark');const old=new Game(314,[],0,'recon');
  const raw=JSON.parse(old.serialize());raw.version=10;const text=JSON.stringify(raw);memory.set('qa-ash-save',text);
  assert.ok(storage.loadGame());assert.equal(memory.get('qa-ash-save-v10-backup'),text);assert.equal(memory.has('ash-save'),false);
  const g=arena();g.status='won';const p=storage.recordResult(g),backup=makeBackup(null,p,'qa');
  assert.equal(decodeBackup(JSON.stringify(backup),'qa').snapshot.profile.history[0].character,'bulwark');
});
