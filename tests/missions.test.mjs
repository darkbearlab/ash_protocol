import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game.js';
import {SIZE} from '../src/data.js';
import {MISSIONS,newMission,prepareMission,validMission,missionObjects,missionProgress,missionTarget} from '../src/missions.js';
import {reachable,key,makeEnemy} from '../src/world.js';
import {makeBarrier} from '../src/barriers.js';
import {grantTrait} from '../src/traits.js';
import {captureAction,planPresentation} from '../src/presentation.js';
import {makeBackup,decodeBackup} from '../src/backup.js';
import {normalizeProfile} from '../src/progression.js';
import {targetDetails} from '../src/target-card.js';

function finalFloor(id='archive',seed=319){const g=new Game(seed,[],0,'soldier','onyx',id);g.floor=6;g.loadFloor();return g;}
function arena(id='retrieval'){
  const g=new Game(319,[],0,'soldier','onyx',id);g.floor=6;g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.barriers=[];g.props=[];g.items=[];g.enemies=[];g.hazards=[];g.marks=[];g.smoke=[];
  Object.assign(g.player,{x:10,y:10});g.end={x:20,y:20};g.mission.targets=[{id:'objective-1',x:11,y:10,done:false}];g.reveal();return g;
}
test('all five contracts persist from deployment, with no extra first-floor loot or RNG',()=>{
  const base=new Game(9,[],0,'soldier','onyx');
  for(const id of Object.keys(MISSIONS)){
    const g=new Game(9,[],0,'soldier','onyx',id);assert.equal(g.mission.id,id);assert.deepEqual(g.mission.targets,[]);assert.deepEqual(g.items,base.items);assert.deepEqual(g.props,base.props);assert.deepEqual(g.enemies,base.enemies);assert.equal(g.rng.state(),base.rng.state());assert.equal(Game.restore(g.serialize()).mission.id,id);
  }
  assert.throws(()=>new Game(1,[],0,'soldier','onyx','invalid'));
});
test('100 final maps place distinct reachable mission targets in separate rooms without changing loot or RNG',()=>{
  for(let seed=0;seed<100;seed++){
    const g=finalFloor('extraction',seed),before=JSON.stringify([g.enemies,g.items,g.props,g.barriers]),rng=g.rng.state(),seen=reachable(g,g.start);
    for(const [id,def]of Object.entries(MISSIONS)){
      g.mission=newMission(id);prepareMission(g);assert.ok(validMission(g.mission,g));assert.equal(g.mission.targets.length,def.count);
      const rooms=new Set();for(const t of g.mission.targets){const point=def.kind==='hunt'?g.enemies.find(e=>e.id===t.id):t;assert.ok(seen.has(key(point)));rooms.add(g.rooms.findIndex(r=>point.x>=r.x&&point.x<r.x+r.w&&point.y>=r.y&&point.y<r.y+r.h));if(def.kind==='recover')assert.ok(![...g.props,...g.items,...g.enemies,...g.hazards,g.end].some(o=>key(o)===key(t)));}
      assert.equal(rooms.size,def.count);assert.equal(JSON.stringify([g.enemies,g.items,g.props,g.barriers]),before);assert.equal(g.rng.state(),rng);
      const again=structuredClone(g.mission);prepareMission(g);assert.deepEqual(g.mission,again);
    }
  }
});
test('ordinary kills never substitute for a target; partial progress stays locked and optional boss can survive extraction',()=>{
  const g=finalFloor('sweep');g.player.x=g.end.x;g.player.y=g.end.y;assert.equal(g.action('interact'),false);assert.equal(g.turn,1);
  const other=g.enemies.find(e=>!missionTarget(g,e)&&e.type!=='boss');g.hurt(other,9999);g.pendingPerks=0;assert.equal(missionProgress(g).done,0);
  for(const t of g.mission.targets.slice(0,2))g.hurt(g.enemies.find(e=>e.id===t.id),9999);g.pendingPerks=0;assert.equal(missionProgress(g).done,2);assert.ok(g.exitBlocked);
  const target=g.enemies.find(e=>e.id===g.mission.targets[2].id);target.x=12;target.y=12;g.hurt(target,9999);g.pendingPerks=0;
  assert.equal(missionProgress(g).done,3);assert.equal(g.exitBlocked,'');assert.equal(g.bossAlive,true);assert.equal(g.status,'playing');assert.ok(g.descend());assert.equal(g.status,'won');assert.equal(g.protocol.events.filter(e=>e.includes('extraction')).length,1);
});
test('core contract retains final boss gate and every contract retains floor-three gate',()=>{
  const g=finalFloor('extraction');Object.assign(g.player,g.end);assert.ok(g.exitBlocked);assert.equal(g.descend(),false);
  g.hurt(g.enemies.find(e=>e.type==='boss'),9999);assert.equal(g.exitBlocked,'');
  for(const id of Object.keys(MISSIONS)){const g=new Game(319,[],0,'soldier','onyx',id);g.floor=3;g.loadFloor();Object.assign(g.player,g.end);assert.ok(g.exitBlocked);assert.equal(g.descend(),false);g.hurt(g.enemies.find(e=>e.type==='warden'),9999);assert.equal(g.exitBlocked,'');}
});
test('recover costs one turn, clears waiting and correction, does not consume pack capacity and cannot duplicate',()=>{
  const g=arena();g.player.owned.push(2);const inventory=structuredClone([g.player.owned,g.player.prepared,g.player.meds,g.player.grenades]);g.player.guard=true;g.player.focus=true;g.player.fireChain={targetId:'old',turn:g.turn,count:3};
  assert.equal(g.action('recoverObjective','objective-1'),true);assert.equal(g.turn,2);assert.equal(g.player.guard,false);assert.equal(g.player.focus,false);assert.equal(g.player.fireChain,null);assert.deepEqual([g.player.owned,g.player.prepared,g.player.meds,g.player.grenades],inventory);
  assert.equal(g.mission.targets[0].done,true);assert.equal(g.status,'playing');assert.equal(g.action('recoverObjective','objective-1'),false);assert.equal(g.turn,2);assert.equal(g.protocol.earned,0);
});
test('closed doors block recovery, explosion leaves data intact, and opening the door permits it',()=>{
  const g=arena();g.barriers=[makeBarrier('door',g.player,g.mission.targets[0],'test-door')];assert.equal(g.action('recoverObjective','objective-1'),false);assert.equal(g.turn,1);
  const before=structuredClone(g.mission);g.explode(g.mission.targets[0],1,20);assert.deepEqual(g.mission,before);g.pendingPerks=0;g.setDoor(g.barriers[0],true);assert.equal(g.action('recoverObjective','objective-1'),true);
});
test('fast lethal attacks cancel recovery; disabled player spends an action without taking the objective',()=>{
  const g=arena(),e=makeEnemy('rifleman',12,10,'fast',6);grantTrait(e,'fast','qa');Object.assign(e,{alert:true,charge:true,lastKnown:{x:10,y:10}});g.enemies=[e];g.player.hp=1;g.rng=Object.assign(()=>0,{state:()=>0});g.reveal();assert.ok(g.action('recoverObjective','objective-1'));assert.equal(g.status,'dead');assert.equal(g.mission.targets[0].done,false);
  const h=arena();h.player.control.disabled=1;assert.ok(h.action('recoverObjective','objective-1'));assert.equal(h.turn,2);assert.equal(h.mission.targets[0].done,false);
});
test('recovered data and tracked deaths survive reload and complete backups without rerolling targets',()=>{
  for(const id of ['archive','sweep']){
    const g=finalFloor(id);if(id==='archive')g.mission.targets[0].done=true;else g.hurt(g.enemies.find(e=>e.id===g.mission.targets[0].id),9999);
    const a=Game.restore(g.serialize()),b=decodeBackup(JSON.stringify(makeBackup(g,normalizeProfile(),'qa')),'qa').game;
    for(const restored of [a,b]){assert.ok(restored);assert.deepEqual(restored.mission,g.mission);assert.equal(missionProgress(restored).done,1);assert.deepEqual(restored.enemies,g.enemies);assert.equal(restored.rng.state(),g.rng.state());}
  }
});
test('v15 migrates to original extraction without regenerating current map, even on final floor',()=>{
  const g=finalFloor('extraction'),raw=JSON.parse(g.serialize());raw.version=15;delete raw.data.mission;g.hurt(g.enemies[0],5);
  const migrated=Game.restore(JSON.stringify(raw));assert.ok(migrated);assert.deepEqual(migrated.mission,newMission());for(const key of ['grid','barriers','props','items','enemies','player'])assert.deepEqual(migrated[key],raw.data[key]);assert.ok(migrated.exitBlocked);
});
test('malformed and missing mission objectives are rejected instead of silently granting completion',()=>{
  for(const mutate of [m=>m.id='unknown',m=>m.targets.pop(),m=>m.targets.push({...m.targets[0]}),m=>m.targets[0].done=1,m=>m.targets[0].x=-1,m=>m.targets[0].id='other',m=>Object.assign(m.targets[1],m.targets[0])]){const raw=JSON.parse(finalFloor('archive').serialize());mutate(raw.data.mission);assert.equal(Game.restore(JSON.stringify(raw)),null);}
  const hunt=JSON.parse(finalFloor('hunt').serialize());hunt.data.mission.targets[0].id='missing';assert.equal(Game.restore(JSON.stringify(hunt)),null);
  const first=JSON.parse(new Game(3).serialize());delete first.data.mission;assert.equal(Game.restore(JSON.stringify(first)),null);
});
test('target badge and mission progress follow projectile arrival, without completing a run automatically',()=>{
  const g=arena('hunt'),e=makeEnemy('rifleman',11,10,'wanted',6);e.hp=1;g.enemies=[e];g.mission.targets=[{id:e.id}];g.target=e.id;g.rng=Object.assign(()=>0,{state:()=>0});g.reveal();assert.match(targetDetails(g).name,/◇/);
  const {steps}=captureAction(g,()=>g.action('fire')),events=planPresentation(steps).events;assert.equal(missionProgress(events[0].state).done,0);assert.equal(missionProgress(events.at(-1).state).done,1);assert.equal(g.status,'playing');
});
test('v15 local load retains original bytes and mission history survives profile backup',async()=>{
  const memory=new Map();globalThis.location={search:'?test=1'};globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
  const storage=await import('../src/storage.js?missions');const old=JSON.parse(new Game(3).serialize());old.version=15;delete old.data.mission;const raw=JSON.stringify(old);memory.set('qa-ash-save',raw);assert.ok(storage.loadGame());assert.equal(memory.get('qa-ash-save-v15-backup'),raw);assert.equal(memory.has('ash-save'),false);
  const g=arena();g.status='dead';g.player.hp=0;const p=storage.recordResult(g);assert.equal(p.history[0].mission,'retrieval');assert.equal(decodeBackup(JSON.stringify(makeBackup(null,p,'qa')),'qa').snapshot.profile.history[0].mission,'retrieval');
});
