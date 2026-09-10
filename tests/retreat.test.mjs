import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game.js';
import {SIZE,SAVE_VERSION} from '../src/data.js';
import {missionDepth,missionObjects,missionProgress,returning,validMission} from '../src/missions.js';
import {archiveFloor,resumedFloor,scheduleRetreatWave,arrivalCell} from '../src/retreat.js';
import {reachable,key,makeEnemy} from '../src/world.js';
import {captureAction,planPresentation} from '../src/presentation.js';
import {makeBackup,decodeBackup} from '../src/backup.js';
import {normalizeProfile} from '../src/progression.js';
import {route} from '../tools/balance.mjs';

const game=seed=>new Game(seed??328,[],0,'recon','onyx','roundtrip');
function descend(g){Object.assign(g.player,g.exitPoint);return g.descend();}
function third(seed){const g=game(seed);descend(g);descend(g);return g;}
function collect(g){const t=g.mission.targets[0];Object.assign(g.player,t);return g.recoverObjective(t.id);}
function clear(g){for(const e of g.enemies)e.hp=0;g.pendingPerks=0;g.reveal();}
function openArena(g){g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.lighting=g.grid.map(r=>r.slice());g.seen=g.grid.map(r=>r.map(()=>true));for(const k of ['props','items','enemies','hazards','marks','barriers','smoke','traces','reinforcements'])g[k]=[];g.start={x:5,y:5};g.end={x:20,y:20};Object.assign(g.player,{x:10,y:10});g.reveal();}

test('three-floor contract targets are reachable, deterministic and independent of combat RNG for 100 seeds',()=>{
  for(let seed=0;seed<100;seed++){
    const g=third(seed),t=g.mission.targets[0];assert.equal(missionDepth(g),3);assert.ok(validMission(g.mission,g));
    assert.ok(reachable(g,g.start).has(key(t)));assert.ok(![...g.props,...g.items,...g.enemies,...g.hazards].some(o=>key(o)===key(t)));
    const other=third(seed);assert.deepEqual(g.mission,other.mission);assert.equal(g.rng.state(),other.rng.state());
  }
});

test('return requires both data and warden; recovering switches exit to original entrance without winning',()=>{
  const g=third();assert.equal(g.exitLabel,'撤離');assert.ok(g.exitBlocked);assert.equal(descend(g),false);
  const original=g.start;collect(g);assert.equal(returning(g),true);assert.equal(g.exitPoint,original);assert.equal(g.exitLabel,'上樓');assert.equal(g.status,'playing');
  assert.match(g.exitBlocked,/頭目/);assert.equal(descend(g),false);g.enemies.find(e=>e.type==='warden').hp=0;assert.equal(g.exitBlocked,'');
  assert.equal(g.recoverObjective('objective-1'),false);assert.deepEqual(g.mission.reinforced,[3]);
  const h=third();h.enemies.find(e=>e.type==='warden').hp=0;assert.match(h.exitBlocked,/回收/);assert.equal(descend(h),false);
});

test('outbound archives preserve doors, containers, injury, debris, explored tiles and independent weapon slots',()=>{
  const g=game();const door=g.barriers.find(b=>b.type==='door');door.open=true;door.hp=21;
  const box=g.props.find(p=>p.type==='container');box.opened=true;box.contents=[];
  const station=g.props.find(p=>p.type==='terminal');station.used=true;
  g.enemies[0].hp=3;g.traces=[{x:g.start.x,y:g.start.y,kind:'blood',variant:0,rotation:0}];
  const first=archiveFloor(g);descend(g);const stored=structuredClone(g.floorStates[1]);
  for(const k of ['grid','barriers','props','enemies','items','seen','traces'])assert.deepEqual(stored[k],first[k]);
  assert.notEqual(g.grid,g.floorStates[1].grid);descend(g);clear(g);collect(g);descend(g);descend(g);
  for(const k of ['grid','barriers','props','items','traces'])assert.deepEqual(g[k],stored[k]);
  const physical=es=>es.map(({alert,lastKnown,...e})=>e);assert.deepEqual(physical(g.enemies),physical(stored.enemies));
  assert.ok(stored.seen.every((r,y)=>r.every((v,x)=>!v||g.seen[y][x])));assert.deepEqual(g.floorStates,{});
});

test('return travel grants no HP, ammunition, supplies or repeated floor rewards; extraction happens at floor-one entrance',()=>{
  const g=third();clear(g);collect(g);Object.assign(g.player,{hp:43,reserve:7,pistol:2,meds:0,smoke:0,emp:0,poison:2});
  for(const floor of [2,1]){const before=g.protocol.earned;assert.equal(descend(g),true);assert.equal(g.floor,floor);assert.equal(g.status,'playing');
    assert.equal(g.player.hp,43);assert.equal(g.player.reserve,7);assert.equal(g.player.pistol,2);assert.equal(g.player.meds,0);assert.equal(g.player.poison,2);
    assert.equal(g.protocol.earned,before+(floor===2?4:0));assert.equal(g.deepestFloor,3);
  }
  Object.assign(g.player,g.end);const turn=g.turn;assert.equal(g.action('interact'),false);assert.equal(g.turn,turn);
  assert.equal(descend(g),true);assert.equal(g.status,'won');assert.equal(g.floor,1);assert.equal(g.deepestFloor,3);
  assert.deepEqual(g.protocol.events.filter(e=>e.startsWith('floor:')).sort(),['floor:1','floor:2','floor:3']);
  assert.equal(g.protocol.events.filter(e=>e==='extraction:win').length,1);assert.equal(g.action('interact'),false);
});

test('a scripted legal traversal can complete 1→2→3→2→1 without refreshing floor geometry',()=>{
  const g=game(35),floors=[1];clear(g);let actions=0;
  while(g.status==='playing'&&actions<900){
    if(g.pendingPerks){g.choosePerk(g.perkChoices[0].id);continue;}
    clear(g);const objective=g.nearbyObjectives[0];
    if(objective)assert.ok(g.action('recoverObjective',objective.id));
    else if(g.canTouch(g.exitPoint)&&!g.exitBlocked)assert.ok(g.action('interact'));
    else{const goal=g.floor===3&&!returning(g)?g.mission.targets[0]:g.exitPoint;const step=route(g,goal);assert.ok(step);assert.ok(g.action('move',step));}
    actions++;if(floors.at(-1)!==g.floor)floors.push(g.floor);
    if(g.status==='playing')assert.ok(Game.restore(g.serialize()),`reload at floor ${g.floor} turn ${g.turn}`);
  }
  assert.equal(g.status,'won');assert.deepEqual(floors,[1,2,3,2,1]);
});

test('inactive floor smoke and bombardments pause; expired departure smoke cannot return',()=>{
  const g=game();g.smoke=[{cells:[{...g.start}],expires:g.turn+4}];g.marks=[{...g.start,due:g.turn+2}];
  const frozen=archiveFloor(g),resumed=resumedFloor(frozen,g.turn+30);
  assert.equal(resumed.smoke[0].expires,g.turn+34);assert.equal(resumed.marks[0].due,g.turn+32);
  g.smoke[0].expires=g.turn;g.marks[0].due=g.turn;const expired=archiveFloor(g);
  assert.deepEqual(expired.smoke,[]);assert.equal(expired.marks[0].due,g.turn+1);assert.equal(g.marks[0].due,g.turn);
});

test('return entry avoids an enemy occupying the previous elevator and cannot receive an immediate enemy phase',()=>{
  const g=third();clear(g);collect(g);const frame=g.floorStates[2];frame.enemies=[makeEnemy('rifleman',frame.end.x,frame.end.y,'qa-elevator')];
  const cell=arrivalCell(frame);assert.notDeepEqual(cell,frame.end);const hp=g.player.hp;Object.assign(g.player,g.exitPoint);
  assert.ok(g.action('interact'));assert.equal(g.floor,2);assert.equal(g.player.hp,hp);assert.deepEqual({x:g.player.x,y:g.player.y},cell);
});

test('each return floor schedules at most one two-unit wave, using stable IDs and no RNG or loot generation',()=>{
  const g=third();clear(g);const rng=g.rng.state(),loot=JSON.stringify([g.items,g.props]);collect(g);
  assert.equal(g.reinforcements.length,2);const wave=structuredClone(g.reinforcements);scheduleRetreatWave(g);assert.deepEqual(g.reinforcements,wave);
  for(const spawn of wave){assert.ok(reachable(g,g.player).has(key(spawn)));assert.ok(Math.abs(spawn.x-g.player.x)+Math.abs(spawn.y-g.player.y)>=5);assert.equal(spawn.due,g.turn+2);}
  assert.equal(g.rng.state(),rng);assert.equal(JSON.stringify([g.items,g.props]),loot);
  descend(g);assert.equal(g.reinforcements.length,2);assert.deepEqual(g.mission.reinforced,[3,2]);
  descend(g);assert.equal(g.reinforcements.length,2);assert.deepEqual(g.mission.reinforced,[3,2,1]);
});

test('teleports warn for two paid actions, arrive after the enemy phase and respect signal break',()=>{
  const g=third();clear(g);openArena(g);g.mission.targets=[{id:'objective-1',x:10,y:10,done:false}];collect(g);
  const ids=g.reinforcements.map(s=>s.id);g.action('usePrepared',{category:'skill'});const turn=g.turn;
  g.action('prepare',{category:'grenade',id:'emp'});assert.equal(g.turn,turn);assert.equal(g.reinforcements.length,2);
  g.action('wait');assert.equal(g.reinforcements.length,2);assert.ok(ids.every(id=>!g.enemies.some(e=>e.id===id)));
  const result=captureAction(g,()=>g.action('wait'));assert.equal(g.reinforcements.length,0);assert.equal(g.enemies.length,2);
  assert.ok(g.enemies.every(e=>!e.charge&&!e.alert&&e.lastKnown===null));assert.ok(result.steps.some(s=>s.effects.some(e=>e.type==='pulse')));
  const events=planPresentation(result.steps).events;assert.equal(events[0].state.enemies.length,0);assert.equal(events.at(-1).state.enemies.length,2);
});

test('occupied arrival signals delay in place, never displace actors and never duplicate a spawn',()=>{
  const g=third();clear(g);openArena(g);g.mission.targets=[{id:'objective-1',x:10,y:10,done:false}];collect(g);
  const blocked=g.reinforcements[0];Object.assign(g.player,{x:blocked.x,y:blocked.y});g.action('wait');g.action('wait');
  assert.equal(g.reinforcements.length,1);assert.equal(g.reinforcements[0].id,blocked.id);assert.equal(g.enemies.length,1);
  g.enemies[0].hp=0;g.action('move',[1,0]);assert.equal(g.reinforcements.length,0);assert.equal(g.enemies.filter(e=>e.id===blocked.id).length,1);
  g.enemies.forEach(e=>e.hp=0);g.action('wait');scheduleRetreatWave(g);assert.equal(g.reinforcements.length,0);
});

test('reinforcements give finite XP and scrap but drop no equipment, ammo or medical replacements',()=>{
  const g=game(),e=makeEnemy('rifleman',g.player.x+1,g.player.y,'qa-loot');e.reinforcement=true;g.enemies.push(e);
  const items=structuredClone(g.items),rng=g.rng.state(),xp=g.player.xp,scrap=g.player.scrap;g.hurt(e,999);
  assert.deepEqual(g.items,items);assert.equal(g.rng.state(),rng);assert.ok(g.player.xp>xp);assert.ok(g.player.scrap>scrap);
  const kills=g.player.kills;g.hurt(e,999);assert.equal(g.player.kills,kills);
});

test('returning saves and full backups keep archives, weapon identities, progress and pending warnings',()=>{
  const g=third();clear(g);collect(g);
  for(let i=0;i<3;i++){
    const restored=Game.restore(g.serialize());assert.ok(restored);assert.equal(JSON.parse(g.serialize()).version,SAVE_VERSION);
    const backup=decodeBackup(JSON.stringify(makeBackup(g,normalizeProfile(),'qa')),'qa').game;
    for(const r of [restored,backup]){assert.deepEqual(r.floorStates,g.floorStates);assert.deepEqual(r.mission,g.mission);assert.deepEqual(r.reinforcements,g.reinforcements);assert.deepEqual(r.player,g.player);assert.equal(r.rng.state(),g.rng.state());assert.equal(missionProgress(r).done,1);}
    if(i<2)descend(g);
  }
});

test('missing, forged, duplicated or malformed archived state is rejected before travel',()=>{
  const g=third();
  for(const mutate of [d=>delete d.floorStates,d=>delete d.floorStates[1],d=>d.floorStates[3]=d.floorStates[1],d=>d.floorStates[1].savedTurn=d.turn+1,
    d=>d.floorStates[1].grid[0][0]=4,d=>d.floorStates[1].seen[0][0]='yes',d=>d.floorStates[1].enemies[0].x=-1,d=>d.floorStates[1].rooms=null,d=>d.floorStates[1].links=[[0,999]],
    d=>d.floorStates[1].reinforcements=[{x:5,y:5,due:2}],d=>d.floorStates[1].items.push({...d.items.find(i=>i.type==='weapon')}),
    d=>d.mission.returning=true,d=>d.mission.reinforced=[3],d=>d.floor=4]){
    const raw=JSON.parse(g.serialize());mutate(raw.data);assert.equal(Game.restore(JSON.stringify(raw)),null);
  }
  clear(g);collect(g);
  for(const mutate of [d=>d.reinforcements.push({...d.reinforcements[0]}),d=>d.reinforcements[0].due=d.turn+9,d=>d.mission.reinforced=[3,3],d=>d.mission.targets[0].done=false]){
    const raw=JSON.parse(g.serialize());mutate(raw.data);assert.equal(Game.restore(JSON.stringify(raw)),null);
  }
});

test('v20 migration preserves active smoke expiry and Recon skill counters without adding archived floors',()=>{
  const g=new Game(51,[],0,'recon');g.action('usePrepared',{category:'skill'});g.smoke=[{cells:[{...g.start}],expires:g.turn+2}];
  const raw=JSON.parse(g.serialize());raw.version=20;delete raw.data.floorStates;delete raw.data.reinforcements;
  const r=Game.restore(JSON.stringify(raw));assert.ok(r);assert.deepEqual(r.player,g.player);assert.deepEqual(r.smoke,g.smoke);assert.deepEqual(r.floorStates,{});assert.deepEqual(r.reinforcements,[]);
});

test('history records deepest floor three after returning to floor one, and v20 original backup is retained',async()=>{
  const memory=new Map([['ash-save','live'],['ash-profile','live profile']]);globalThis.location={search:'?test=1'};globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
  const storage=await import('../src/storage.js?retreat');const old=JSON.parse(new Game(5).serialize());old.version=20;delete old.data.floorStates;delete old.data.reinforcements;
  const raw=JSON.stringify(old);memory.set('qa-ash-save',raw);assert.ok(storage.loadGame());assert.equal(memory.get('qa-ash-save-v20-backup'),raw);
  const g=third();clear(g);collect(g);descend(g);descend(g);descend(g);const p=storage.recordResult(g);
  assert.equal(p.history[0].floor,3);assert.equal(p.bestFloor,3);assert.equal(p.history[0].mission,'roundtrip');assert.equal(p.history[0].won,true);
  const abandoned=third(51);clear(abandoned);collect(abandoned);descend(abandoned);descend(abandoned);storage.saveGame(abandoned);assert.equal(storage.abandonRun(abandoned),true);assert.equal(storage.profile().history[0].floor,3);assert.equal(storage.profile().history[0].outcome,'abandoned');
  assert.equal(memory.get('ash-save'),'live');assert.equal(memory.get('ash-profile'),'live profile');
});
