import {clearGeneratedMap} from './helpers/arena.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,SIZE,generate,reachable,makeEnemy,makeBarrier} from '../src/engine.js';
import {packSupplies,isContainer,allSupplies,validContainers} from '../src/containers.js';
import {grantTrait} from '../src/traits.js';
import {captureAction,planPresentation} from '../src/presentation.js';
import {makeBackup,decodeBackup} from '../src/backup.js';
import {normalizeProfile} from '../src/progression.js';

function arena(){const g=new Game(317);g.barriers=[];g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.props=[];g.enemies=[];g.items=[];g.hazards=[];g.marks=[];g.smoke=[];g.rooms=[];clearGeneratedMap(g);g.end={x:20,y:20};Object.assign(g.player,{x:10,y:10,hp:500,maxHp:500});g.reveal();return g;}
function box(g,x=11,y=10,contents=[{type:'ammo',amount:20}]){const c={id:`case-test-${g.props.length}`,type:'container',kind:'ammo',x,y,opened:false,indestructible:true,contents};g.props.push(c);return c;}

test('opening is one paid action, keeps position, clears waiting, and moves contents to ground exactly once',()=>{
  const g=arena(),c=box(g),rng=g.rng.state(),before=g.player.reserve;g.player.guard=g.player.focus=true;
  assert.ok(g.action('openContainer',c.id));assert.equal(g.turn,2);assert.equal(g.player.x,10);assert.equal(g.player.reserve,before);assert.equal(g.player.guard,false);assert.equal(g.player.focus,false);
  assert.deepEqual(c.contents,[]);assert.equal(c.opened,true);assert.deepEqual(g.items,[{type:'ammo',amount:20,x:11,y:10}]);assert.equal(g.rng.state(),rng);
  assert.equal(g.action('openContainer',c.id),false);assert.equal(g.turn,2);assert.equal(g.items.length,1);
  assert.ok(g.action('move',[1,0]));assert.equal(g.player.reserve,before+20);assert.equal(g.items.length,0);assert.equal(g.props[0],c);
});
test('walking over a closed case does not open or collect it, and opening on top uses the facing cell',()=>{
  const g=arena(),c=box(g);assert.ok(g.action('move',[1,0]));assert.equal(c.opened,false);assert.equal(g.items.length,0);
  g.action('openContainer',c.id);assert.deepEqual(g.items.map(i=>[i.x,i.y]),[[12,10]]);assert.equal(g.player.reserve,48);
});
test('closed doors prevent remote opening and loot never appears across a blocked edge',()=>{
  const g=arena(),c=box(g),door=makeBarrier('door',g.player,c,'edge-case');g.barriers=[door];
  assert.equal(g.action('openContainer',c.id),false);assert.equal(g.turn,1);door.open=true;
  g.enemies=[makeEnemy('rifleman',11,10,'occupant')];g.enemies[0].alert=false;
  g.barriers.push(makeBarrier('partition',c,{x:11,y:9},'edge-north'));
  g.openContainer(c.id);assert.equal(g.items[0].x,12);assert.equal(g.items[0].y,10);
});
test('occupied/hazardous drop cells fall back to the player without losing or auto-collecting supplies',()=>{
  const g=arena(),c=box(g);g.enemies=[makeEnemy('rifleman',11,10,'occupant')];
  g.hazards=[{x:11,y:9,type:'fire'},{x:12,y:10,type:'acid'},{x:11,y:11,type:'fire'}];
  g.openContainer(c.id);assert.deepEqual(g.items,[{type:'ammo',amount:20,x:10,y:10}]);assert.equal(g.player.reserve,48);assert.match(g.logs[0].text,/腳下/);
});
test('existing loose items are preserved and grouped contents may stack at one safe landing tile',()=>{
  const g=arena(),c=box(g,11,10,[{type:'ammo',amount:20},{type:'med',amount:1}]);g.items=[{type:'weapon',weapon:2,x:11,y:10}];
  g.openContainer(c.id);assert.equal(g.items[0].type,'weapon');assert.deepEqual(g.items.slice(1).map(i=>[i.x,i.y]),[[11,9],[11,9]]);
});
test('unopened and empty cases are walkable, indestructible and never count as cover or combat targets',()=>{
  const g=arena(),c=box(g);g.target=c.id;assert.equal(g.targeted,undefined);assert.ok(g.passable(11,10));assert.equal(g.protectingCover(g.player,{x:13,y:10}),undefined);
  const contents=structuredClone(c.contents);g.damageProp(c,999);g.explode({x:11,y:10},2,100);assert.deepEqual(c.contents,contents);assert.equal(c.opened,false);
  g.openContainer(c.id);g.explode({x:11,y:10},2,100);assert.equal(g.items.length,1);assert.equal(c.opened,true);
});
test('full ammo or throwable capacity leaves the unpacked excess on ground without recreating box contents',()=>{
  const g=arena(),c=box(g,11,10,[{type:'ammo',amount:20},{type:'emp',amount:3}]);g.player.reserve=g.ammoCapacity('rifle')-1;g.player.grenades=4;
  g.action('openContainer',c.id);g.action('move',[1,0]);assert.equal(g.player.reserve,g.ammoCapacity('rifle'));assert.equal(g.items.find(i=>i.type==='ammo').amount,19);assert.equal(g.items.find(i=>i.type==='emp').amount,3);assert.deepEqual(c.contents,[]);
});
test('opening honors fast enemies and a closed door before the player phase consumes the committed turn without unpacking',()=>{
  const g=arena(),c=box(g),e=makeEnemy('drone',14,10,'fast');grantTrait(e,'fast','qa');e.alert=true;g.enemies=[e];
  const door=makeBarrier('door',g.player,c,'edge-fast');door.open=true;g.barriers=[door];g.enemyAct=()=>g.setDoor(door,false);
  assert.ok(g.action('openContainer',c.id));assert.equal(g.turn,2);assert.equal(c.opened,false);assert.equal(g.items.length,0);
});
test('disabled player skips opening and free preparation never unpacks or advances time',()=>{
  const g=arena(),c=box(g);g.player.control.disabled=1;g.action('openContainer',c.id);assert.equal(c.opened,false);assert.equal(g.player.control.disabled,0);
  const turn=g.turn;g.action('prepare',{category:'grenade',id:null});assert.equal(g.turn,turn);assert.equal(c.opened,false);
});
test('presentation snapshots retain sealed contents until the opening step',()=>{
  const g=arena(),c=box(g);const {steps}=captureAction(g,()=>g.action('openContainer',c.id));const step=steps.find(s=>s.effects.some(e=>e.type==='unpack'));
  assert.ok(step);assert.equal(step.before.props[0].opened,false);assert.equal(step.before.items.length,0);assert.equal(step.after.props[0].opened,true);assert.equal(step.after.items.length,1);assert.ok(planPresentation(steps).duration>0);
});
test('packing conserves every supply entry while weapons, lore and random state stay outside containers',()=>{
  const g=arena();g.rooms=[{x:8,y:8,w:7,h:7,cx:11,cy:11,supply:'ammo'}];
  g.items=[{x:10,y:11,type:'ammo',amount:20,cache:true},{x:11,y:11,type:'emp',amount:1,cache:true},{x:11,y:11,type:'scrap',amount:18},{x:11,y:12,type:'weapon',weapon:2},{x:11,y:12,type:'lore',floor:1},{x:8,y:8,type:'med'}];
  const before=g.items.map(({x,y,...i})=>i),rng=g.rng.state();packSupplies(g,1);
  assert.deepEqual(allSupplies(g).map(({x,y,...i})=>i).sort((a,b)=>a.type.localeCompare(b.type)),before.sort((a,b)=>a.type.localeCompare(b.type)));
  assert.deepEqual(g.items.map(i=>i.type),['weapon','lore']);assert.equal(g.props.length,2);assert.equal(g.props[0].contents.length,3);assert.equal(g.rng.state(),rng);assert.ok(validContainers(g.props,g.grid));
});
test('all generated cases remain reachable and contain unchanged classified rewards across 144 floors',()=>{
  for(let seed=1;seed<=24;seed++)for(let floor=1;floor<=6;floor++){
    const map=generate(seed,floor),seen=reachable(map,map.start),cases=map.props.filter(isContainer);assert.ok(cases.length>=6);assert.ok(validContainers(map.props,map.grid));
    for(const c of cases)assert.ok(seen.has(`${c.x},${c.y}`));assert.ok(map.items.every(i=>i.type==='weapon'||i.type==='lore'));
    const rewards=allSupplies(map).filter(i=>i.cache);for(const type of ['ammo','pistol','shell','energy','ordnance','med','armor','emp','stun','smoke'])assert.ok(rewards.some(i=>i.type===type));
    assert.deepEqual(map,generate(seed,floor));
  }
});
test('save and full backup preserve opened cases and ground loot; v13 does not convert current-floor supplies',()=>{
  const g=arena(),c=box(g),other=box(g,10,11,[{type:'smoke',amount:1}]);g.action('openContainer',c.id);
  const restored=decodeBackup(JSON.stringify(makeBackup(g,normalizeProfile(),'qa')),'qa').game;assert.deepEqual(restored.props,g.props);assert.deepEqual(restored.items,g.items);assert.equal(restored.action('openContainer',c.id),false);assert.equal(restored.props.find(p=>p.id===other.id).contents.length,1);
  const legacy=arena();legacy.items=[{x:11,y:10,type:'med'}];const raw=JSON.parse(legacy.serialize());raw.version=13;
  const old=Game.restore(JSON.stringify(raw));assert.ok(old);assert.deepEqual(old.items,legacy.items);assert.deepEqual(old.props,[]);assert.deepEqual(old.player,legacy.player);
});
test('malformed container IDs, contents and states are rejected before a save can replace progress',()=>{
  const g=arena();box(g);
  for(const mutate of [d=>d.props.push({...d.props[0]}),d=>d.props[0].contents[0].amount=-1,d=>d.props[0].contents[0].type='weapon',d=>d.props[0].opened=true,d=>d.props[0].contents=[],d=>d.props[0].kind='invalid-kind',d=>d.props[0].hp=60,d=>d.props[0].indestructible=false,d=>d.props[0].x=.5,d=>d.props[0].id='case-<html>',d=>d.props[0].contents[0].slot=1]){
    const value=JSON.parse(g.serialize());mutate(value.data);assert.equal(Game.restore(JSON.stringify(value)),null);
  }
});
