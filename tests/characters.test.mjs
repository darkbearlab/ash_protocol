import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,SIZE,makeEnemy} from '../src/engine.js';
import {CHARACTERS,characterName} from '../src/characters.js';
import {grantTrait,activeTrait,sidestepPenalty} from '../src/traits.js';
import {captureAction} from '../src/presentation.js';
import {targetDetails} from '../src/target-card.js';
import {makeBackup,decodeBackup} from '../src/backup.js';
import {normalizeProfile} from '../src/progression.js';

function arena(character='soldier',Type=Game){const g=new Type(312,[],0,character);g.barriers=[];g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.lighting=g.grid.map(row=>row.map(()=>1));Object.assign(g.player,{x:10,y:10});g.enemies=[];g.props=[];g.items=[];g.hazards=[];g.marks=[];g.rng=Object.assign(()=>.99,{state:()=>0});g.reveal();return g;}
function enemy(g,x=14,y=10,id='target'){const e=makeEnemy('rifleman',x,y,id);e.hp=e.maxHp=1000;e.alert=true;e.charge=true;g.enemies.push(e);g.target=e.id;g.reveal();return e;}
function coverTarget(g){g.props=[{id:'shield',type:'cover',x:13,y:10,hp:10000,maxHp:10000}];}

test('Soldier and Recon have separate passives and starting kits, with distinct innate stats and initial utility supplies',()=>{
  const soldier=arena(),recon=arena('recon');assert.equal(soldier.player.character,'soldier');assert.deepEqual(soldier.player.owned,[0,1]);assert.deepEqual(recon.player.owned,[2,1]);assert.equal(recon.player.weapon,2);assert.equal(recon.player.ammo[2],18);assert.equal(recon.player.ammo[0],0);
  assert.deepEqual(soldier.player.traits.map(t=>t.id),CHARACTERS.soldier.traits);assert.deepEqual(recon.player.traits.map(t=>t.id),CHARACTERS.recon.traits);
  for(const key of ['hp','maxHp','meds','pistol','shell','reserve','armor','scrap'])assert.equal(soldier.player[key],recon.player[key],key);
  assert.equal(soldier.player.grenades,2);assert.equal(recon.player.grenades,0);assert.equal(recon.player.smoke,2);assert.equal(recon.player.emp,0);assert.equal(recon.player.stun,2);assert.equal(recon.ammoCapacity('grenade'),6);assert.equal(recon.player.prepared.grenade,'smoke');assert.equal(recon.protocol.earned,0);assert.match(characterName('recon'),/Recon/);assert.throws(()=>arena('unknown'));
});
test('braced uses the shooter-facing cover direction, applies symmetrically and respects no-cover',()=>{
  const g=arena(),e=enemy(g);coverTarget(g);assert.equal(g.accuracy(g.player,e).chance,70);assert.equal(g.accuracy(g.player,e).bracedBonus,0);
  g.props.push({id:'own',type:'cover',x:11,y:10,hp:10000,maxHp:10000});assert.equal(g.accuracy(g.player,e).chance,82);assert.equal(g.accuracy(g.player,e).bracedBonus,12);
  grantTrait(e,'braced','test');assert.equal(g.accuracy(e,g.player).chance,74);grantTrait(g.player,'no_cover','test');assert.equal(g.accuracy(g.player,e).bracedBonus,0);
  g.player.traits=g.player.traits.filter(t=>t.id!=='no_cover');g.props=g.props.filter(p=>p.id!=='own');g.grid[10][11]=0;assert.equal(g.accuracy(g.player,e).bracedBonus,12);
  g.grid[10][11]=1;g.grid[10][9]=0;assert.equal(g.accuracy(g.player,e).bracedBonus,0,'wall behind the shooter is not bracing against this target');
});
test('correction increases by committed firing rounds including misses, capped at +24',()=>{
  const g=arena(),e=enemy(g);coverTarget(g);
  for(const bonus of [0,8,16,24,24]){
    assert.equal(g.accuracy(g.player,e).trackingBonus,bonus);assert.equal(g.accuracy(g.player,e).chance,70+bonus);
    const {steps}=captureAction(g,()=>g.action('fire'));const shot=steps.find(s=>s.effects.some(f=>f.type==='shot'));
    assert.equal(shot.before.accuracy(shot.before.player,shot.before.enemies[0]).trackingBonus,bonus);assert.equal(shot.effects[0].miss,true);
  }
  assert.equal(e.hp,1000);assert.equal(g.player.fireChain.count,3);assert.match(targetDetails(g).state,/修正 \+24/);
});
test('free selection and invalid actions preserve correction; paid actions, changed targets and floors reset it',()=>{
  const g=arena(),e=enemy(g);coverTarget(g);g.action('fire');assert.equal(g.accuracy(g.player,e).trackingBonus,8);
  g.action('prepare',{category:'item',id:null});g.action('heal');g.action('move',[1,1]);assert.equal(g.accuracy(g.player,e).trackingBonus,8);
  const other=enemy(g,14,12,'other');assert.equal(g.accuracy(g.player,other).trackingBonus,0);g.target=e.id;assert.equal(g.accuracy(g.player,e).trackingBonus,8,'just viewing another target does not break a committed chain');
  g.target=other.id;g.action('fire');assert.equal(g.accuracy(g.player,e).trackingBonus,0);assert.equal(g.accuracy(g.player,other).trackingBonus,8);
  g.action('wait');assert.equal(g.player.fireChain,null);g.target=e.id;g.action('fire');g.action('reload');assert.equal(g.player.fireChain,null);
  g.action('fire');g.enemies=[];g.end={x:10,y:10};g.action('interact');assert.equal(g.player.fireChain,null);assert.deepEqual(g.player.moveDelta,[0,0]);
});
test('SMG bursts build only one correction step and free quick reload keeps it',()=>{
  const g=arena('recon'),e=enemy(g);grantTrait(g.player,'correction','test');coverTarget(g);
  for(const bonus of [0,8]){
    const {steps}=captureAction(g,()=>g.action('fire')),shots=steps.filter(s=>s.effects.some(f=>f.type==='shot'));
    assert.equal(shots.length,2);for(const s of shots)assert.equal(s.before.accuracy(s.before.player,s.before.enemies[0]).trackingBonus,bonus);
  }
  assert.equal(g.player.fireChain.count,2);const turn=g.turn;g.action('reload');assert.equal(g.turn,turn);assert.equal(g.accuracy(g.player,e).trackingBonus,16);
});
class EscapeGame extends Game{executeEnemy(e){e.y=12;e.moved=true;}}
test('lost-target committed shots still build correction without revealing or hitting the target',()=>{
  const g=arena('soldier',EscapeGame),e=enemy(g);grantTrait(e,'fast','test');for(let x=0;x<SIZE;x++)g.grid[11][x]=0;
  g.action('fire');assert.equal(g.player.ammo[0],7);assert.equal(e.hp,1000);assert.equal(g.player.fireChain.targetId,e.id);assert.equal(g.player.fireChain.count,1);
});
test('sidestep is relative to each shooter, excludes forward/backward and exact diagonal, and stacks with agile',()=>{
  const g=arena('recon'),east=enemy(g),south=enemy(g,10,14,'south');g.player.moved=true;g.player.moveDelta=[0,1];
  assert.equal(g.accuracy(east,g.player).sidePenalty,20);assert.equal(g.accuracy(east,g.player).chance,45);assert.equal(g.accuracy(south,g.player).chance,65);
  assert.equal(sidestepPenalty({x:14,y:14},g.player),0);grantTrait(g.player,'agile','test');assert.equal(g.accuracy(east,g.player).chance,32);
  g.player.moveDelta=[1,0];assert.equal(sidestepPenalty(east,g.player),0);g.player.moveDelta=[-1,0];assert.equal(sidestepPenalty(east,g.player),0);
  east.moved=true;east.moveDelta=[0,1];grantTrait(east,'sidestep','test');assert.equal(g.accuracy(g.player,east).sidePenalty,20);
});
test('movement history follows actual cardinal movement and ends at the next paid action',()=>{
  const g=arena('recon'),e=enemy(g);g.action('move',[0,1]);assert.deepEqual(g.player.moveDelta,[0,1]);assert.equal(g.accuracy(e,g.player).sidePenalty,20);
  g.player.ammo[2]=3;g.action('reload');assert.deepEqual(g.player.moveDelta,[0,1]);assert.equal(g.player.moved,true);g.action('wait');assert.deepEqual(g.player.moveDelta,[0,0]);assert.equal(g.accuracy(e,g.player).sidePenalty,0);
  const moving=arena(),f=enemy(moving,19,10);f.charge=false;moving.action('wait');assert.equal(f.moved,true);assert.equal(Math.abs(f.moveDelta[0])+Math.abs(f.moveDelta[1]),1);
});
test('sideways movement changes actual hit rolls independently for crossing enemy fire',()=>{
  const g=arena('recon');enemy(g,14,10,'east');enemy(g,10,14,'south');g.rng=()=>.6;
  const {steps}=captureAction(g,()=>g.action('move',[0,1]));
  const shots=steps.flatMap(s=>s.effects).filter(e=>e.type==='enemyShot');assert.equal(shots.length,2);
  assert.equal(shots[0].miss,true);assert.equal(shots[1].miss,undefined);assert.equal(g.player.hp,81);
});
test('quick reload transfers only missing pistol ammunition and preserves fast enemies, environment and all bonuses',()=>{
  const g=arena('recon'),e=enemy(g);grantTrait(e,'fast','test',2);grantTrait(g.player,'slow','test',2);Object.assign(g.player,{ammo:[0,4,16,0,0,0],pistol:1,guard:true,focus:true,evasive:true,moved:true,moveDelta:[0,1],poison:3});g.hazards=[{x:10,y:10,type:'fire'}];g.marks=[{x:10,y:10,due:1}];
  const before=JSON.parse(g.serialize());assert.equal(g.actionCost('reload'),0);const {success,steps}=captureAction(g,()=>g.action('reload'));assert.equal(success,true);assert.equal(steps.length,0);
  const after=JSON.parse(g.serialize());before.data.player.ammo[2]=17;before.data.player.pistol=0;before.data.logs=after.data.logs;assert.deepEqual(after,before);assert.equal(g.action('reload'),false);
  g.player.pistol=10;g.player.ammo[2]=18;assert.equal(g.action('reload'),false);assert.equal(g.turn,1);assert.equal(g.player.pistol,10);
});
test('quick reload does not apply to other ammunition or Soldier; normal reload can be interrupted by fast death',()=>{
  const g=arena('recon');g.player.weapon=1;g.player.ammo[1]=1;assert.equal(g.actionCost('reload'),1);assert.equal(g.action('reload'),true);assert.equal(g.turn,2);
  const soldier=arena();soldier.player.owned.push(2);soldier.player.weapon=2;soldier.player.ammo[2]=1;assert.equal(soldier.actionCost('reload'),1);const e=enemy(soldier);grantTrait(e,'fast','test');soldier.player.hp=1;soldier.rng=()=>0;
  soldier.action('reload');assert.equal(soldier.status,'dead');assert.equal(soldier.player.ammo[2],1);
});
test('character, movement and correction survive snapshots, complete backup and saves; v8 preserves old progress',()=>{
  const g=arena('recon');g.action('move',[0,1]);const restored=decodeBackup(JSON.stringify(makeBackup(g,normalizeProfile(),'qa')),'qa').game;assert.deepEqual(restored.player,g.player);
  const soldier=arena(),e=enemy(soldier);coverTarget(soldier);soldier.action('fire');const saved=Game.restore(soldier.serialize());assert.equal(saved.accuracy(saved.player,saved.enemies[0]).trackingBonus,8);
  const old=JSON.parse(g.serialize());old.version=8;delete old.data.player.character;delete old.data.player.moveDelta;delete old.data.player.fireChain;old.data.player.traits=[{id:'small',source:'old:custom',turns:2}];old.data.player.prepared.item=null;
  const migrated=Game.restore(JSON.stringify(old));assert.ok(migrated);assert.equal(migrated.player.character,'soldier');assert.deepEqual(migrated.player.owned,g.player.owned);assert.deepEqual(migrated.player.ammo,g.player.ammo);assert.equal(migrated.player.prepared.item,null);assert.equal(migrated.player.traits[0].source,'old:custom');assert.equal(activeTrait(migrated.player,'braced'),true);assert.equal(activeTrait(migrated.player,'correction'),true);
  assert.deepEqual(Game.restore(migrated.serialize()).player,migrated.player);
});
test('v9 rejects unknown characters and malformed movement or correction histories',()=>{
  for(const mutate of [p=>delete p.character,p=>p.character='scout',p=>p.moveDelta=[1,1],p=>p.moveDelta=[.5,0],p=>delete p.fireChain,p=>p.fireChain={targetId:'e',turn:999,count:1},p=>p.fireChain={targetId:'e',turn:1,count:4}]){
    const raw=JSON.parse(arena().serialize());mutate(raw.data.player);assert.equal(Game.restore(JSON.stringify(raw)),null);
  }
});
test('enemies granted correction track consecutive ranged attacks and reset after a move',()=>{
  const g=arena('recon'),e=enemy(g);grantTrait(e,'correction','test');g.action('wait');assert.equal(e.fireChain.count,1);assert.equal(g.accuracy(e,g.player).trackingBonus,8);
  g.action('wait');assert.equal(e.fireChain.count,2);e.x=23;g.action('wait');assert.equal(e.fireChain,null);
});
test('character is included in run history and its backup, without spending profile currency',async()=>{
  const memory=new Map();globalThis.location={search:'?test=1'};globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
  const storage=await import('../src/storage.js?characters');const g=arena('recon');g.status='won';const p=storage.recordResult(g);assert.equal(p.history[0].character,'recon');assert.equal(p.protocol.balance,0);assert.equal(decodeBackup(JSON.stringify(makeBackup(null,p,'qa')),'qa').snapshot.profile.history[0].character,'recon');
  const old=JSON.parse(arena().serialize());old.version=8;delete old.data.player.character;delete old.data.player.moveDelta;delete old.data.player.fireChain;memory.set('qa-ash-save',JSON.stringify(old));assert.ok(storage.loadGame());assert.equal(memory.get('qa-ash-save-v8-backup'),JSON.stringify(old));assert.equal(memory.has('ash-save'),false);
});
