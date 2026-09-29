import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,SIZE,makeEnemy} from '../src/engine.js';
import {DIRECTIONS,key,distance} from '../src/world.js';
import {barrierBetween,edgeBlocks,vaultable} from '../src/barriers.js';
import {HAZARD_TUNING,hazardTile,stepOffHazard} from '../src/hazard-paths.js';
import {combatStep} from '../src/tactics.js';
import {routeCells,occupied,addAlly,allyAct} from '../src/allies.js';
import {pinned} from '../src/suppression.js';
import {clearGeneratedMap} from './helpers/arena.mjs';

// 3.201.0 (user, 2026-09-29): walkers route around hazard tiles (acid, fire): passable, but each costs
// HAZARD_TUNING.stepCost extra, so they cross only when going round is longer; flyers ignore the floor.
function field(type='rifleman'){
  const g=new Game(4242,[],0,'soldier','onyx','extraction',{facilityFaction:'loyalist'});
  g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));
  g.lighting=g.grid.map(r=>r.map(()=>1));
  g.barriers=[];g.props=[];g.items=[];g.hazards=[];g.marks=[];g.smoke=[];g.flares=[];g.enemies=[];
  Object.assign(g.player,{x:20,y:10});g.player.hp=g.player.maxHp=999;g.reveal();
  const e=makeEnemy(type,10,10,'w',1,0,'loyalist');e.alert=true;e.lastKnown={x:20,y:10};g.enemies.push(e);
  return {g,e};
}
const walk=(g,e,goal,limit=60)=>{const path=[];for(let i=0;i<limit&&distance(e,goal)>1;i++){const s=g.nextStep(e,goal);if(!s)break;e.x=s.x;e.y=s.y;path.push(key(s));}return path;};

test('a walker goes round a hazard on its line when a way round exists',()=>{
  const {g,e}=field();g.hazards=[{x:13,y:10,type:'acid'},{x:14,y:10,type:'fire'}];
  const path=walk(g,e,g.player);
  assert.ok(path.length>0&&distance(e,g.player)===1,'it arrives');
  assert.ok(!path.some(k=>['13,10','14,10'].includes(k)),`it never steps on the hazards: ${path.join(' ')}`);
});

test('with no way round it still crosses, and a flyer never minds the floor',()=>{
  const {g,e}=field();
  for(let y=0;y<SIZE;y++)if(y!==10)g.grid[y][13]=0;   // a wall with one gap, and acid in the gap
  g.hazards=[{x:13,y:10,type:'acid'}];
  assert.ok(walk(g,e,g.player).includes('13,10'),'the only way on crosses the acid');
  const air=field('drone');air.g.hazards=[{x:13,y:10,type:'acid'},{x:14,y:10,type:'acid'}];
  assert.ok(walk(air.g,air.e,air.g.player).some(k=>k==='13,10'||k==='14,10'),'a drone flies straight over');
});

test('route searches and the in-sight combat step charge the same hazard cost',()=>{
  const {g,e}=field();g.hazards=[{x:11,y:10,type:'acid'}];
  const route=g.routeSearch(e,{x:12,y:10},null);
  assert.ok(!route.path.some(q=>key(q)==='11,10'),'the cheaper way is round');
  assert.equal(route.steps,4);
  const plan=combatStep(g,e,g.player,{range:5});
  assert.ok(plan?.step&&!hazardTile(g,plan.step.x,plan.step.y),'the combat step keeps off it too');
  assert.ok(HAZARD_TUNING.stepCost>=20);
});

test('with no hazard the weighted search returns the old breadth-first steps',()=>{
  // The pre-3.201.0 breadth-first nextStep, kept here as the reference.
  const bfs=(g,e,target)=>{
    const queue=[{x:e.x,y:e.y,first:null}],visited=new Set([key(e)]);
    const busy=new Set([...g.enemies.filter(o=>o!==e&&o.hp>0),...g.activeAllies].filter(a=>a!==target).map(key));
    for(let i=0;i<queue.length&&i<SIZE*SIZE;i++)for(const [dx,dy] of DIRECTIONS){
      const q=queue[i],x=q.x+dx,y=q.y+dy,k=`${x},${y}`;
      if(visited.has(k)||!g.passable(x,y,e))continue;
      const edge=barrierBetween(g.barriers,q,{x,y});if(edgeBlocks(edge)&&edge.type!=='door'&&!vaultable(edge))continue;
      if(x===target.x&&y===target.y)return q.first||(distance(target,g.player)>0||edgeBlocks(edge)?{x,y}:null);
      if(busy.has(k))continue;
      visited.add(k);queue.push({x,y,first:q.first||{x,y}});
    }return null;
  };
  let compared=0;
  for(const seed of [3,11,29,57])for(const floor of [1,3]){
    const g=new Game(seed,[],0,'soldier','onyx','extraction',{facilityFaction:'rebel'});g.floor=floor;g.hazards=[];
    for(const e of g.enemies.slice(0,12)){if(e.hp<=0)continue;assert.deepEqual(g.nextStep(e,g.player),bfs(g,e,g.player),`${seed}/${floor}/${e.id}`);compared++;}
  }
  assert.ok(compared>40,`${compared} routes compared`);
});

test('a walker on a hazard steps off first, toward where it is going and never back',()=>{
  const {g,e}=field();Object.assign(e,{x:15,y:10});g.hazards=[{x:15,y:10,type:'fire'}];
  g.enemyAct(e);
  assert.ok(!hazardTile(g,e.x,e.y)&&distance(e,g.player)===4,`stepped toward you to ${key(e)}`);
  const w=field();Object.assign(w.e,{x:15,y:10,charge:true});w.g.hazards=[{x:15,y:10,type:'fire'}];
  assert.equal(stepOffHazard(w.g,w.e,w.g.player,{pinned,occupied}),false,'committed to its shot');
  const t=field('hive_beast');Object.assign(t.e,{x:11,y:10});t.g.player.x=15;t.g.hazards=[{x:11,y:10,type:'acid'}];
  t.e.tongueIntent={origin:{x:11,y:10},target:{x:15,y:10},point:{x:12,y:10}};t.g.turn++;t.g.enemyAct(t.e);
  assert.equal(key(t.g.player),'12,10','a telegraphed tongue still pulls');
});

test('enemies driven turn by turn cross a hazard that is the only way, without going back and forth',()=>{
  const strip=field();for(let y=0;y<SIZE;y++)if(y!==10){strip.g.grid[y][13]=0;strip.g.grid[y][14]=0;}
  strip.g.hazards=[{x:13,y:10,type:'acid'},{x:14,y:10,type:'acid'}];strip.e.hp=strip.e.maxHp=9999;
  const seen=[];for(let t=0;t<12;t++){strip.g.turn++;strip.g.enemyAct(strip.e);seen.push(key(strip.e));}
  assert.ok(strip.e.x>=15,`through the two-tile strip: ${seen.join(' ')}`);
  const g=new Game(4242,[],0,'soldier','onyx','extraction',{facilityFaction:'loyalist'});
  g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(0));g.lighting=g.grid.map(r=>r.map(()=>1));
  for(let x=5;x<=15;x++){g.grid[5][x]=1;g.grid[15][x]=1;}for(let y=5;y<=15;y++)g.grid[y][15]=1;
  g.barriers=[];g.props=[];g.items=[];g.hazards=[{x:10,y:5,type:'acid'}];g.marks=[];g.smoke=[];g.flares=[];g.enemies=[];
  Object.assign(g.player,{x:8,y:15});g.player.hp=g.player.maxHp=9999;g.reveal();
  const e=makeEnemy('rifleman',7,5,'r',1,0,'loyalist');e.alert=true;e.lastKnown={x:8,y:15};e.hp=e.maxHp=9999;g.enemies.push(e);
  for(let t=0;t<10;t++){g.turn++;g.enemyAct(e);}
  assert.ok(e.x===15,`round the bend of the corridor: ${key(e)}`);
});

test('a resting fodder does not get a free step off',()=>{
  const {g,e}=field('fodder');g.hazards=[{x:10,y:10,type:'acid'},{x:11,y:10,type:'acid'},{x:9,y:10,type:'acid'},{x:10,y:9,type:'acid'},{x:10,y:11,type:'acid'}];
  const moves=[];for(let t=0;t<6;t++){g.turn++;const before=key(e);g.enemyAct(e);moves.push(key(e)!==before);}
  assert.deepEqual(moves,[true,false,true,false,true,false]);
});

test('an ally takes the dry way when it is open and crosses only when it is blocked',()=>{
  for(const blocked of [false,true]){
    const g=new Game(330,[],0,'druid','onyx');g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.lighting=g.grid.map(r=>r.slice());g.seen=g.grid.map(r=>r.map(()=>true));
    for(const k of ['allies','enemies','props','items','barriers','hazards','marks','rooms','traces','smoke'])g[k]=[];clearGeneratedMap(g);g.allySerial=0;g.player.petBond=null;
    Object.assign(g.player,{x:10,y:10,hp:500,maxHp:500});
    for(let y=0;y<SIZE;y++)if(y!==10&&y!==14){g.grid[y][13]=0;g.grid[y][14]=0;}
    g.hazards=[{x:13,y:10,type:'acid'},{x:14,y:10,type:'acid'}];
    if(blocked)addAlly(g,'drone','drone',{point:{x:13,y:14},sourceId:'drone_follow'});
    const a=addAlly(g,'pet','crawler',{point:{x:11,y:12},sourceId:'pet_command'});a.hp=a.maxHp=9999;a.order={x:17,y:12};
    const trail=[];for(let t=0;t<16;t++){g.turn++;allyAct(g,a);trail.push(key(a));}
    assert.equal(key(a),'17,12',`${blocked?'blocked':'open'}: ${trail.join(' ')}`);
    assert.equal(trail.some(k=>k==='13,10'||k==='14,10'),blocked,'on the acid only when the dry gap is taken');
  }
});

test('the weighted ally listing charges the hazard cost; the plain one is unchanged',()=>{
  const {g}=field();g.hazards=[{x:21,y:10,type:'acid'}];
  const walker=makeEnemy('rifleman',20,10,'w2',1,0,'loyalist'),weighted=routeCells(g,g.player,{limit:3,ignoreActors:true,weighted:true,actor:walker}),at=weighted.find(q=>key(q)==='21,10');
  assert.equal(at.cost,1+HAZARD_TUNING.stepCost);
  assert.ok(routeCells(g,g.player,{limit:3,ignoreActors:true}).map(key).includes('21,10'));
});
