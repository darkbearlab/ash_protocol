import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,SIZE,makeEnemy,combatSight} from '../src/engine.js';
import {grantTrait,removeTraitSource,activeTrait,initiative,initiativeQueue,traitLabels,validTraits} from '../src/traits.js';
import {captureAction,planPresentation,snapshot} from '../src/presentation.js';
import {targetDetails} from '../src/target-card.js';
import {makeBackup,decodeBackup} from '../src/backup.js';
import {normalizeProfile} from '../src/progression.js';

function arena(Type=Game){const g=new Type(310);g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));Object.assign(g.player,{x:10,y:10});g.enemies=[];g.props=[];g.items=[];g.hazards=[];g.marks=[];g.rng=Object.assign(()=>0,{state:()=>0});g.reveal();return g;}
function enemy(g,id,x=14,y=10,type='rifleman'){const e=makeEnemy(type,x,y,id);e.hp=e.maxHp=500;e.alert=true;g.enemies.push(e);g.reveal();return e;}
function trait(actor,id,turns){assert.equal(grantTrait(actor,id,`test:${id}`,turns),true);}

test('independent opposites cancel without deleting sources; duplicate sources never stack',()=>{
  const p={traits:[]};trait(p,'large');trait(p,'fast');assert.equal(activeTrait(p,'no_cover'),false);assert.equal(initiative(p),-1);
  trait(p,'small');trait(p,'slow');assert.equal(activeTrait(p,'large'),false);assert.equal(initiative(p),0);assert.equal(p.traits.length,4);
  assert.ok(traitLabels(p).includes('快速（抵銷）'));grantTrait(p,'fast','equipment');removeTraitSource(p,'test:slow');removeTraitSource(p,'test:fast');assert.equal(initiative(p),-1);
  grantTrait(p,'fast','equipment',2);assert.equal(p.traits.filter(t=>t.source==='equipment').length,1);removeTraitSource(p,'equipment');assert.equal(initiative(p),0);
  assert.equal(grantTrait(p,'unknown','test'),false);assert.equal(grantTrait(p,'fast','bad source'),false);assert.equal(grantTrait(p,'fast','test',0),false);assert.equal(validTraits([{id:['fast'],source:'test'}]),false);
});
test('size and mobility modify player and enemy hit chance equally, with opposite cancellation',()=>{
  const g=arena(),e=enemy(g,'e');const cases=[['large',false,99],['small',false,82],['agile',true,62],['clumsy',true,88]];
  for(const [id,moved,chance] of cases){
    e.traits=[];g.player.traits=[];e.moved=moved;trait(e,id);assert.equal(g.accuracy(g.player,e).chance,chance);
    e.traits=[];g.player.moved=moved;trait(g.player,id);assert.equal(g.accuracy(e,g.player).chance,chance);
  }
  e.traits=[];e.moved=true;trait(e,'large');trait(e,'agile');assert.equal(g.accuracy(g.player,e).chance,77);
  trait(e,'small');trait(e,'clumsy');assert.equal(g.accuracy(g.player,e).chance,75);
  g.player.affixes[0]='tracking';assert.equal(g.accuracy(g.player,e).chance,87);traitLabels(e);
});
test('no-cover removes both hit protection and damage reduction for either side, but walls remain opaque',()=>{
  const g=arena(),e=enemy(g,'e',14,10,'gunner');g.props=[{id:'box',type:'cover',x:13,y:10,hp:100,maxHp:100}];
  assert.equal(g.accuracy(g.player,e).chance,62);g.hitTarget(e,20,g.player);assert.equal(e.hp,489);
  trait(e,'no_cover');assert.equal(g.accuracy(g.player,e).chance,97);g.hitTarget(e,20,g.player);assert.equal(e.hp,469);
  g.props=[{id:'shield',type:'cover',x:11,y:10,hp:100,maxHp:100}];g.damagePlayer(20,'test',e);assert.equal(g.player.hp,89);
  trait(g.player,'no_cover');g.damagePlayer(20,'test',e);assert.equal(g.player.hp,69);assert.equal(g.cover.length,0);
  for(let y=0;y<SIZE;y++)g.grid[y][12]=0;assert.equal(combatSight(g.grid,g.player,e),false);assert.equal(g.visible(e),false);
});
test('all speed combinations use stable order and each actor acts once; equal speed favors player',()=>{
  for(const [playerTraits,want] of [[[],['fast-a','fast-b','player','normal','slow']],[['fast'],['player','fast-a','fast-b','normal','slow']],[['slow'],['fast-a','fast-b','normal','player','slow']],[['fast','slow'],['fast-a','fast-b','player','normal','slow']]]){
    const g=arena(),normal=enemy(g,'normal'),slow=enemy(g,'slow',15),fastA=enemy(g,'fast-a',16),fastB=enemy(g,'fast-b',17);trait(slow,'slow');trait(fastA,'fast');trait(fastB,'fast');for(const id of playerTraits)trait(g.player,id);
    const seen=[];g.executePlayer=()=>{seen.push('player');return true;};g.enemyAct=e=>seen.push(e.id);
    assert.equal(g.action('wait'),true);assert.deepEqual(seen,want);assert.equal(g.turn,2);assert.equal(normal.hp,500);
  }
});
test('queue speeds are frozen for the round and reinforcements wait until the next round',()=>{
  const g=arena(),e=enemy(g,'normal');const seen=[];g.executePlayer=()=>{seen.push('player');trait(e,'fast');enemy(g,'reinforcement',15);return true;};g.enemyAct=e=>seen.push(e.id);
  g.action('wait');assert.deepEqual(seen,['player','normal']);assert.equal(initiativeQueue(g.player,g.enemies)[0].actor.id,'normal');
});
test('invalid intentions consume no turn, trait duration, RNG, focus or fast enemy action',()=>{
  const g=arena(),e=enemy(g,'fast');trait(e,'fast',2);g.player.owned=[0];g.player.focus=g.player.guard=g.player.evasive=true;g.grid[10][9]=0;g.target=null;
  let actions=0;g.enemyAct=()=>actions++;
  for(const [type,arg] of [['move',[-1,0]],['move',[1,1]],['fire'],['reload'],['heal'],['grenade',{x:25,y:25}],['weapon',0],['salvage',0],['takeWeapon',999],['replaceWeapon',{take:999,leave:0}],['upgrade'],['terminal','heal'],['interact']]){
    assert.equal(g.action(type,arg),false, type);assert.equal(g.turn,1);assert.equal(actions,0);assert.equal(e.traits[0].turns,2);assert.equal(g.player.focus,true);assert.equal(g.player.guard,true);
  }
});
class EscapeGame extends Game{enemyAct(e){if(e.id==='escape'){e.x=this.escape.x;e.y=this.escape.y;e.moved=true;}else super.enemyAct(e);}}
test('a fast moving target keeps its identity; bullets use the new position and the actual movement penalty',()=>{
  const g=arena(EscapeGame),e=enemy(g,'escape');trait(e,'fast');g.escape={x:15,y:10};enemy(g,'other',13,11);g.target=e.id;
  const {steps}=captureAction(g,()=>g.action('fire')),shot=steps.find(s=>s.effects.some(f=>f.type==='shot'));
  assert.equal(g.player.ammo[0],7);assert.equal(g.player.stats.shots,1);assert.equal(shot.effects[0].to.x,15);assert.equal(shot.before.targeted.id,'escape');assert.equal(shot.before.accuracy(shot.before.player,shot.before.targeted).chance,75);
  assert.equal(steps[0].before.enemies[0].x,14);assert.equal(steps[0].after.enemies[0].x,15);assert.equal(steps[0].effects.length,0,'quiet fast movement gets its own presentation step');
  assert.ok(planPresentation(steps).events.find(e=>e.effects.some(f=>f.type==='shot')).time>0);
});
test('target fleeing range or sight consumes committed ammunition without replacement targeting',()=>{
  for(const hidden of [false,true]){
    const g=arena(EscapeGame),e=enemy(g,'escape');trait(e,'fast');enemy(g,'other',11,10);g.target=e.id;g.escape=hidden?{x:14,y:12}:{x:18,y:10};
    if(hidden)for(let x=0;x<SIZE;x++)g.grid[11][x]=0;
    assert.equal(g.action('fire'),true);assert.equal(g.turn,2);assert.equal(g.player.ammo[0],7);assert.equal(g.player.stats.shots,1);assert.equal(g.enemies[1].hp,500);assert.equal(e.hp,500);
    const shot=g.effects.find(f=>f.type==='shot');assert.equal(shot.miss,true);assert.deepEqual(shot.to,{x:14,y:10});
    assert.ok(g.logs.some(l=>l.text.includes('開火落空')));
  }
});
test('if the original target dies before player action, no other target is shot',()=>{
  const g=arena(),e=enemy(g,'bomber',11,10,'bomber');trait(e,'fast');e.charge=true;e.windup=1;enemy(g,'other',14,10);g.target=e.id;
  assert.equal(g.action('fire'),true);assert.ok(e.hp<=0);assert.equal(g.player.stats.shots,1);assert.equal(g.player.ammo[0],7);assert.equal(g.player.kills,1);assert.equal(g.enemies[1].hp,500);
});
test('fast lethal attack cancels the player action and all later actors; replay starts with enemy damage',()=>{
  const g=arena(),e=enemy(g,'fast');trait(e,'fast');e.charge=true;e.windup=1;enemy(g,'later',14,11);g.player.hp=1;g.target=e.id;
  const {steps}=captureAction(g,()=>g.action('fire'));assert.equal(g.status,'dead');assert.equal(g.player.ammo[0],8);assert.equal(g.turn,2);assert.equal(g.effects.filter(e=>e.type==='enemyShot').length,1);assert.equal(steps[0].effects[0].type,'enemyShot');
  const plan=planPresentation(steps);assert.equal(plan.events[0].state.player.hp,1);assert.ok(plan.events.some(e=>e.effects.some(f=>f.type==='fall'&&f.actorType==='player')));
});
test('a fast enemy can block committed movement; the player stays put and the turn is spent',()=>{
  const g=arena(),e=enemy(g,'fast',12,10,'crawler');trait(e,'fast');
  assert.equal(g.action('move',[1,0]),true);assert.equal(e.x,11);assert.equal(g.player.x,10);assert.equal(g.player.moved,false);assert.equal(g.turn,2);
});
test('ordinary enemy fire follows the new player position, while thrown grenades retain the chosen tile',()=>{
  const g=arena(),e=enemy(g,'shooter');e.charge=true;e.windup=1;g.action('move',[0,1]);assert.deepEqual(g.effects.find(f=>f.type==='enemyShot').to,{x:10,y:11});
  const grenade=arena(EscapeGame),flee=enemy(grenade,'escape');trait(flee,'fast');grenade.escape={x:18,y:10};grenade.target=flee.id;grenade.action('grenade');
  assert.deepEqual(grenade.effects.find(f=>f.style==='grenade').to,{x:14,y:10});assert.equal(flee.hp,500);assert.equal(grenade.player.grenades,1);
});
test('previous waiting protection lasts until player acts, and a new wait cannot protect against earlier fast fire',()=>{
  const g=arena(),e=enemy(g,'fast');trait(e,'fast');e.charge=true;e.windup=1;g.action('wait');assert.equal(g.player.hp,81,'first fast shot happens before wait protection');
  e.charge=true;g.action('reload');assert.equal(g.player.hp,81,'invalid reload cannot advance a fast enemy');
  g.action('wait');assert.equal(g.player.hp,71,'previous wait still halves the next fast shot before player renewal');
});
test('temporary opposites expire after one whole committed round and survive saves',()=>{
  const g=arena(),e=enemy(g,'e');trait(e,'fast');trait(e,'slow',1);const restored=Game.restore(g.serialize());assert.ok(restored);assert.equal(initiative(restored.enemies[0]),0);
  restored.action('reload');assert.equal(initiative(restored.enemies[0]),0);restored.action('wait');assert.equal(initiative(restored.enemies[0]),-1);assert.equal(restored.enemies[0].traits.length,1);
  const snapshotGame=snapshot(restored);assert.equal(initiative(snapshotGame.enemies[0]),-1);assert.notEqual(snapshotGame.enemies[0].traits,restored.enemies[0].traits);
});
test('fast attackers act before elevators, normal and slow old-floor enemies never follow downstairs',()=>{
  const g=arena(),fast=enemy(g,'fast');trait(fast,'fast');fast.charge=true;fast.windup=1;const later=enemy(g,'later',14,11);later.charge=true;later.windup=1;g.end={x:10,y:10};
  assert.equal(g.action('interact'),true);assert.equal(g.floor,2);assert.equal(g.turn,2);assert.equal(g.effects.filter(e=>e.type==='enemyShot').length,1);
});
test('bombardment and environment resolve once after slow actions, not once per speed phase',()=>{
  const g=arena();trait(g.player,'slow');enemy(g,'normal');g.marks=[{x:10,y:10,due:2}];g.hazards=[{x:10,y:10,type:'fire'}];
  g.action('move',[0,1]);assert.equal(g.player.hp,72);assert.equal(g.marks.length,0);assert.equal(g.effects.filter(e=>e.type==='blast').length,1);
});
test('save migration and full backups preserve trait sources, timers and unrelated weapon progress',()=>{
  const g=arena();trait(g.player,'small');trait(g.player,'slow',2);const e=enemy(g,'e');trait(e,'agile');g.player.upgrades[0]=2;
  const restored=decodeBackup(JSON.stringify(makeBackup(g,normalizeProfile(),'qa')),'qa').game;assert.deepEqual(restored.player,g.player);assert.deepEqual(restored.enemies,g.enemies);
  const old=JSON.parse(g.serialize());old.version=6;delete old.data.player.traits;for(const e of old.data.enemies)delete e.traits;
  const migrated=Game.restore(JSON.stringify(old));assert.ok(migrated);assert.deepEqual(migrated.player.traits.map(t=>t.id),['braced','correction']);assert.equal(migrated.player.upgrades[0],2);assert.equal(migrated.player.ammo[0],8);
  const bad=JSON.parse(g.serialize());bad.data.player.traits=[{id:'fast',source:'test',turns:0}];assert.equal(Game.restore(JSON.stringify(bad)),null);
});
test('target cards explain effective order and cancelled traits; spawn defaults stay small in scope',()=>{
  const g=arena(),e=enemy(g,'e');trait(e,'fast');g.target=e.id;assert.equal(targetDetails(g).order,'行動在你之前');assert.equal(targetDetails(g).traits,'快速');trait(g.player,'fast');assert.equal(targetDetails(g).order,'同速，你先行動');trait(e,'slow');assert.match(targetDetails(g).traits,/抵銷/);
  assert.equal(activeTrait(makeEnemy('drone',1,1,'drone'),'no_cover'),true);assert.equal(activeTrait(makeEnemy('brute',1,1,'brute'),'large'),true);assert.equal(activeTrait(makeEnemy('brute',1,1,'brute'),'no_cover'),false);
  assert.equal(initiative(makeEnemy('crawler',1,1,'early',1)),0);assert.equal(initiative(makeEnemy('crawler',1,1,'late',4)),-1);
});

test('lost-target commitment respects every weapon ammunition cost, burst remainder and replay',()=>{
  for(const [slot,ammo,spent] of [[0,8,1],[1,4,1],[2,18,2],[2,1,1],[3,3,1],[4,5,1],[5,2,1]]){
    const g=arena(EscapeGame),e=enemy(g,'escape');trait(e,'fast');g.escape={x:14,y:12};g.target=e.id;
    for(let x=0;x<SIZE;x++)g.grid[11][x]=0;
    g.player.owned=[slot];g.player.weapon=slot;g.player.ammo[slot]=ammo;
    const {steps}=captureAction(g,()=>g.action('fire'));
    assert.equal(g.player.ammo[slot],ammo-spent);assert.equal(g.player.stats.shots,spent);assert.equal(e.hp,500);
    const shots=steps.filter(s=>s.effects.some(f=>f.type==='shot'));assert.equal(shots.length,spent);
    assert.equal(shots[0].before.player.ammo[slot],ammo);assert.equal(shots.at(-1).after.player.ammo[slot],ammo-spent);
    assert.ok(shots.every(s=>s.effects[0].miss));assert.equal(g.effects.some(f=>f.type==='blast'),false);
    const plan=planPresentation(steps);assert.ok(plan.events.some(e=>e.effects.some(f=>f.type==='miss')));
    const restored=Game.restore(g.serialize());assert.ok(restored);assert.equal(restored.player.ammo[slot],ammo-spent);
  }
});
