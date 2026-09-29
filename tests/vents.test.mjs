import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,SIZE,makeEnemy} from '../src/engine.js';
import {generate,key} from '../src/world.js';
import {roomContains} from '../src/map-geometry.js';
import {VENT_TUNING,ventCells} from '../src/vent-map.js';
import {ventStage,tickVents,hazeShot,validVents} from '../src/vents.js';
import {hazardTile} from '../src/hazard-paths.js';
import {WEAPONS} from '../src/data.js';
import {archiveFloor} from '../src/retreat.js';

// 3.202.0 (user design 2026-09-29, docs/HAZARDS.md section 3): smoke vents, light smoke and steam.
function field(){
  const g=new Game(4242,[],0,'soldier','onyx','extraction',{facilityFaction:'loyalist'});
  g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.lighting=g.grid.map(r=>r.map(()=>1));
  g.barriers=[];g.props=[];g.items=[];g.hazards=[];g.marks=[];g.smoke=[];g.flares=[];g.enemies=[];g.vents=[];
  Object.assign(g.player,{x:10,y:10});g.player.hp=g.player.maxHp=999;g.reveal();
  return g;
}

test('vents: 0-2 a floor, one to a room, off the start and exit rooms, on free floor; swarm floors get toxic gas',()=>{
  const counts=[0,0,0];let swarm=0;
  for(let seed=1;seed<=24;seed++)for(const floor of [1,3,5]){
    const map=generate(seed,floor,[],0,seed%4===0?'swarm':'loyalist'),again=generate(seed,floor,[],0,seed%4===0?'swarm':'loyalist');
    assert.deepEqual(map.vents,again.vents,'the same floor always gets the same vents');
    const vents=map.vents||[];counts[vents.length]++;
    assert.ok(vents.length<=2&&(map.vents===undefined||vents.length>0),'no empty list is stored');
    for(const v of vents){
      assert.equal(map.grid[v.y][v.x],1);assert.ok(ventCells(map.grid,v).length>=4);
      assert.ok(!roomContains(map.rooms[map.startRoom],v)&&!roomContains(map.rooms.find(r=>roomContains(r,map.start))||{x:-9,y:-9,w:0,h:0},v));
      assert.ok(!map.hazards.some(h=>h.x===v.x&&h.y===v.y)&&!map.props.some(p=>p.x===v.x&&p.y===v.y)&&!map.enemies.some(e=>e.x===v.x&&e.y===v.y));
      const spray=new Set(ventCells(map.grid,v).map(key));
      assert.ok(![map.start,map.end,...map.enemies].some(p=>spray.has(key(p))),'the spray keeps off the start, the exit and the units');
      if(seed%4===0){assert.equal(v.kind,'toxic');swarm++;}else assert.ok(['smoke','haze','steam'].includes(v.kind));
    }
    if(vents.length===2)assert.ok(!map.rooms.some(r=>roomContains(r,vents[0])&&roomContains(r,vents[1])),'one to a room');
  }
  assert.ok(counts.every(n=>n>0)&&swarm>0,`counts ${counts}`);
});

test('the cycle: a round of warning, two of spraying, four quiet; the spray is one cloud over the plus',()=>{
  const g=field();const v={id:'vent-1-0',x:12,y:12,kind:'steam',phase:3};g.vents=[v];
  const stages=[...Array(VENT_TUNING.period)].map((_,i)=>ventStage(v,i+11));
  assert.deepEqual([...stages].sort(),[0,1,2,3,4,5,6]);
  let turn=1;while(ventStage(v,turn)!==0)turn++;
  g.turn=turn;tickVents(g);assert.equal(g.smoke.length,0,'the warning round sprays nothing');
  g.turn++;tickVents(g);
  assert.equal(g.smoke.length,1);assert.equal(g.smoke[0].kind,'steam');assert.equal(g.smoke[0].cells.length,5);assert.equal(g.smoke[0].expires,g.turn+1,'it hangs for this round and the next');
  const dense={...v,id:'vent-1-1',kind:'smoke'};g.vents=[dense];g.smoke=[];g.turn=1;while(ventStage(dense,g.turn)!==1)g.turn++;tickVents(g);
  assert.equal(g.smoke[0].kind,undefined,'dense smoke is plain smoke');
});

test('light smoke and steam: seen through, half the hit chance, full damage; dense smoke still blinds',()=>{
  const g=field(),e=makeEnemy('rifleman',15,10,'r',1,0,'loyalist');e.alert=true;g.enemies=[e];g.reveal();
  const clear=g.accuracy(g.player,e).chance;
  g.smoke=[{kind:'haze',cells:[{x:12,y:10}],expires:g.turn+1}];
  assert.ok(g.sight(g.player,e),'light smoke does not block sight');
  const hazed=g.accuracy(g.player,e);assert.ok(hazed.haze);assert.equal(hazed.chance,Math.max(1,Math.round(clear/2)));
  assert.equal(hazed.toxic,false,'no toxic halving of the damage');
  assert.ok(hazeShot(g,e,g.player,{ranged:true}),'enemies shooting through it are slowed too');
  assert.equal(hazeShot(g,g.player,e,WEAPONS.find(w=>w.melee)),false,'a blade is not');
  g.smoke=[{kind:'steam',cells:[{x:12,y:10}],expires:g.turn+1}];assert.ok(g.sight(g.player,e)&&g.accuracy(g.player,e).haze);
  g.smoke=[{cells:[{x:12,y:10}],expires:g.turn+1}];assert.equal(g.sight(g.player,e),false,'dense smoke blocks it');
});

test('steam scalds in its second round only, flyers aside; idle guards step out of it; the routes keep off it',()=>{
  const g=field(),e=makeEnemy('rifleman',11,10,'r',1,0,'loyalist'),d=makeEnemy('drone',10,11,'d',1,0,'loyalist'),idle=makeEnemy('rifleman',10,9,'i',1,0,'loyalist');
  e.alert=true;g.enemies=[e,d,idle];
  g.smoke=[{kind:'steam',cells:[{x:10,y:10},{x:11,y:10},{x:10,y:11},{x:10,y:9}],expires:g.turn+1}];
  const hp=g.player.hp,ehp=e.hp,dhp=d.hp,ihp=idle.hp;g.environmentTurn();
  assert.equal(g.player.hp,hp,'the round it rises it only warns: the hiss and this round leave two actions to get clear');assert.equal(e.hp,ehp);
  assert.ok(!(idle.x===10&&idle.y===9),'an idle guard steps out rather than standing in it');
  g.turn++;g.environmentTurn();
  assert.equal(hp-g.player.hp,VENT_TUNING.damage-g.player.hazmat);assert.equal(ehp-e.hp,VENT_TUNING.damage);assert.equal(d.hp,dhp,'a drone is not scalded');assert.equal(idle.hp,ihp);
  assert.ok(g.logs.some(l=>/蒸氣/.test(l.text)));
  assert.ok(hazardTile(g,11,10)&&hazardTile(g,11,10,e),'steam is a hazard for walkers');
  g.smoke=[{kind:'toxic',cells:[{x:12,y:12}],expires:g.turn+1}];
  assert.equal(hazardTile(g,12,12,e),false,'mist does not hurt enemies, so they do not avoid it');
  assert.ok(hazardTile(g,12,12,{kind:'pet'}),'your own units do avoid it');
});

test('a round trip: a floor left without vents and a floor with them both come back from a save',()=>{
  const g=new Game(331,[],0,'soldier','onyx','roundtrip');g.vents=undefined;
  Object.assign(g.player,g.exitPoint);assert.ok(g.descend());
  const spot=[...Array(SIZE*SIZE).keys()].map(i=>({x:i%SIZE,y:Math.floor(i/SIZE)})).find(p=>g.grid[p.y][p.x]===1&&g.floorStates[1].grid[p.y]?.[p.x]!==1);
  assert.ok(spot,'a tile that is floor here and wall on the floor above');
  g.vents=[{id:'vent-2-0',x:spot.x,y:spot.y,kind:'steam',phase:0}];
  const back=Game.restore(g.serialize());
  assert.ok(back,'the archived floor does not inherit the vents of this one when the save is checked');
  assert.deepEqual(back.vents,g.vents);assert.equal(back.floorStates[1].vents,undefined);
});

test('vents and their clouds survive a save and a floor change, and bad vents are refused',()=>{
  const g=new Game(5,[],0,'soldier','onyx','extraction',{facilityFaction:'rebel'});
  g.vents=[{id:'vent-1-0',x:g.start.x,y:g.start.y,kind:'haze',phase:2}];g.smoke=[{kind:'haze',cells:[{x:g.start.x,y:g.start.y}],expires:g.turn+1}];
  const back=Game.restore(g.serialize());
  assert.ok(back,'restores');assert.deepEqual(back.vents,g.vents);assert.equal(back.smoke[0].kind,'haze');
  assert.deepEqual(archiveFloor(g).vents,g.vents,'a floor left behind keeps its vents');
  for(const bad of [{kind:'lava'},{phase:7},{x:-1}])assert.equal(validVents({grid:g.grid,vents:[{...g.vents[0],...bad}]}),false,JSON.stringify(bad));
  assert.equal(validVents({vents:undefined}),true,'a floor without vents');
});
