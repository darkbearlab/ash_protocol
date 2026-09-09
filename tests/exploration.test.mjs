import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,generate,reachable,key,distance,makeEnemy,WEAPONS,SIZE} from '../src/engine.js';
import {normalizeProfile,creditProtocol,weaponUnlocked} from '../src/progression.js';

function arena(){const g=new Game(42);g.barriers=[];g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));Object.assign(g.player,{x:10,y:10});g.enemies=[];g.props=[];g.items=[];g.hazards=[];g.marks=[];g.reveal();return g;}

test('routes vary entrances, exits and connections; reward rooms remain reachable off the shortest route',()=>{
  const starts=new Set(),ends=new Set(),routes=new Set();
  for(let seed=1;seed<=100;seed++){
    const m=generate(seed,1),seen=reachable(m,m.start);starts.add(key(m.start));ends.add(key(m.end));routes.add(JSON.stringify(m.links));
    assert.ok(m.links.length>=9);assert.equal(m.rewardRooms.length,3);
    assert.ok(m.rewardRooms.some(i=>!m.mainRoute.includes(i)));
    assert.equal(new Set(m.rewardRooms.map(i=>m.rooms[i].supply)).size,3);
    for(const [a,b]of m.links)assert.equal(Math.abs(a%3-b%3)+Math.abs(Math.floor(a/3)-Math.floor(b/3)),1);
    for(const item of m.items)assert.ok(seen.has(key(item)));
    for(const terminal of m.props.filter(o=>o.type==='terminal'))assert.ok([...seen].some(k=>{const [x,y]=k.split(',').map(Number);return distance({x,y},terminal)<=1;}));
    assert.equal(m.enemies.length,25);assert.ok(m.mainRoute.length>=3);
    assert.deepEqual(generate(seed,1),m);
  }
  assert.ok(starts.size>=4);assert.ok(ends.size>=4);assert.ok(routes.size>=30);
});

test('classified caches contain all five ammo pools, medical supplies and armor plates',()=>{
  const g=arena();g.items=generate(21,1).items.filter(i=>i.cache).map(i=>({...i,x:10,y:10}));g.pickup();
  assert.equal(g.player.pistol,48);assert.equal(g.player.shell,18);assert.equal(g.player.reserve,68);assert.equal(g.player.energy,30);assert.equal(g.player.ordnance,7);
  assert.equal(g.player.meds,3);assert.equal(g.player.plates,20);
});

test('plates absorb only half of post-mitigation damage, deplete, and do not protect against hazards',()=>{
  const g=arena();g.player.plates=20;g.damagePlayer(20,'test');assert.equal(g.player.hp,90);assert.equal(g.player.plates,10);
  g.damagePlayer(40,'test');assert.equal(g.player.hp,60);assert.equal(g.player.plates,0);
  g.player.plates=30;g.player.armor=4;g.player.guard=true;g.damagePlayer(24,'test',null,true);assert.equal(g.player.hp,55);assert.equal(g.player.plates,25);
  g.hazards=[{x:10,y:10,type:'fire'}];g.environmentTurn();assert.equal(g.player.hp,43);assert.equal(g.player.plates,25);
});

test('full armor leaves pickup in place and replenishment respects capacity',()=>{
  const g=arena();g.player.plates=30;g.items=[{x:10,y:10,type:'armor',amount:20}];g.pickup();assert.equal(g.items.length,1);
  g.player.plates=25;g.pickup();assert.equal(g.player.plates,30);assert.equal(g.items.length,0);
});

test('enemy loot uses weapon and ammo type; the same corpse never grants loot twice',()=>{
  for(const [type,index,ammo]of [['rifleman',0,'ammo'],['raider',2,'pistol'],['gunner',1,'shell'],['sniper',3,'ammo'],['warden',4,'energy']]){
    const g=arena();g.rng=()=>0;const e=makeEnemy(type,14,10,'loot');g.hurt(e,999);
    assert.equal(g.items.find(i=>i.type==='weapon').weapon,index);assert.ok(g.items.some(i=>i.type===ammo));
    const count=g.items.length;g.hurt(e,999);assert.equal(g.items.length,count);assert.equal(g.player.kills,1);
  }
  const g=arena();g.rng=()=>.99;g.hurt(makeEnemy('rifleman',14,10,'none'),999);assert.equal(g.items.length,0);
});

test('protocol milestones are earned once, including death-turn boss kills and extraction',()=>{
  const g=arena();g.items=[{x:10,y:10,type:'lore',floor:1}];g.pickup();assert.equal(g.protocol.earned,3);
  g.awardProtocol('lore',1);assert.equal(g.protocol.earned,3);
  g.hurt(makeEnemy('warden',14,10,'warden'),999);assert.equal(g.protocol.earned,11);
  g.player.x=g.end.x;g.player.y=g.end.y;g.descend();assert.equal(g.protocol.earned,15);
  g.floor=6;g.enemies=[];g.player.x=g.end.x;g.player.y=g.end.y;g.descend();assert.equal(g.protocol.earned,35);assert.equal(g.status,'won');
  g.awardProtocol('extraction','win');assert.equal(g.protocol.earned,35);
});

test('legacy profile migration preserves history; cumulative credit survives old saves and history trimming',()=>{
  const p=normalizeProfile({runs:5,wins:1,history:[{id:'old'}]}),g=arena();assert.equal(p.runs,5);assert.equal(p.history[0].id,'old');assert.equal(p.protocol.balance,0);assert.deepEqual(p.unlocks.characters,['operator']);
  g.awardProtocol('lore',1);assert.equal(creditProtocol(p,g),3);assert.equal(creditProtocol(p,g),0);
  const old=Game.restore(g.serialize());g.awardProtocol('floor',1);assert.equal(creditProtocol(p,g),4);
  p.history=[];assert.equal(creditProtocol(p,old),0);assert.equal(p.protocol.balance,7);
  const other=new Game(g.seed);assert.notEqual(other.runId,g.runId);other.awardProtocol('lore',1);assert.equal(creditProtocol(p,other),3);
});

test('old saves retain their floor; new progression and armor fields survive save reload',()=>{
  const g=arena();g.player.plates=17;g.awardProtocol('lore',1);const loaded=Game.restore(g.serialize());assert.equal(loaded.player.plates,17);assert.equal(loaded.runId,g.runId);assert.deepEqual(loaded.protocol,g.protocol);
  const old=JSON.parse(g.serialize());delete old.data.runId;delete old.data.protocol;delete old.data.player.plates;delete old.data.unlockedWeapons;
  const migrated=Game.restore(JSON.stringify(old));assert.equal(migrated.protocol.earned,0);assert.equal(migrated.player.plates,0);assert.deepEqual(migrated.grid,g.grid);assert.equal(Game.restore(JSON.stringify(old)).runId,migrated.runId);
  old.data.player.plates=-1;assert.equal(Game.restore(JSON.stringify(old)),null);
});

test('weapon unlock hooks keep all base weapons available and gate optional future weapons',()=>{
  for(const w of WEAPONS)assert.ok(weaponUnlocked(w,[]));
  const future={id:'future',unlockId:'weapon-future'};assert.equal(weaponUnlocked(future,[]),false);assert.equal(weaponUnlocked(future,['weapon-future']),true);
});
