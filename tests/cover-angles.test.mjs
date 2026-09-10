import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,SIZE,makeEnemy,combatSight,bracingBonus} from '../src/engine.js';
import {coverEfficiency,coverEffects,bestCover} from '../src/cover.js';
import {makeBarrier} from '../src/barriers.js';
import {targetDetails} from '../src/target-card.js';

function arena(){const g=new Game(323);g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.barriers=[];g.props=[];g.enemies=[];g.items=[];g.hazards=[];g.marks=[];Object.assign(g.player,{x:10,y:10,hp:500,maxHp:500,armor:0,plates:0,traits:[],guard:0});return g;}
const crate=(x,y)=>({id:'cover-angle',type:'cover',x,y,hp:65,maxHp:65});

test('exact 45 and knight thresholds are symmetric in four directions, including half-cell edges',()=>{
  const target={x:10,y:10};
  for(const [nx,ny]of [[1,0],[-1,0],[0,1],[0,-1]])for(const scale of [1,.5])for(const side of [-1,1]){
    const c={x:10+nx*scale,y:10+ny*scale};
    for(const [forward,lateral,expected]of [[3,1,1],[100,99,1],[1,1,.5],[2,3,.5],[100,199,.5],[1,2,0],[100,201,0],[0,1,0],[-1,0,0],[0,0,0]]){
      const a={x:10+nx*forward-ny*lateral*side,y:10+ny*forward+nx*lateral*side};
      assert.equal(coverEfficiency(c,target,a),expected,JSON.stringify({nx,ny,scale,side,forward,lateral}));
    }
  }
});
test('all cover types scale protection, rounding only the hit penalty',()=>{
  for(const type of ['cover','wall','door','partition']){
    const c={type,x:11,y:10},p={x:10,y:10},strong=type!=='cover';
    assert.deepEqual(coverEffects(c,p,{x:13,y:11}),{efficiency:1,penalty:strong?42:35,reduction:.45});
    assert.deepEqual(coverEffects(c,p,{x:12,y:13}),{efficiency:.5,penalty:strong?21:18,reduction:.225});
    assert.deepEqual(coverEffects(c,p,{x:11,y:12}),{efficiency:0,penalty:0,reduction:0});
  }
});
test('strongest real protection wins over old terrain priority and retains object identity',()=>{
  const g=arena(),p=g.player,a={x:12,y:13},c=crate(10,11);g.props=[c];g.grid[10][11]=0;
  assert.equal(g.protectingCover(p,a),c); // full crate beats half wall
  g.grid[10][11]=1;const door=makeBarrier('door',p,{x:11,y:10},'edge-angle');g.barriers=[door];
  assert.equal(g.protectingCover(p,a),c); // full crate beats half door
  c.hp=0;assert.equal(g.protectingCover(p,a),door);
  door.open=true;assert.equal(g.protectingCover(p,a),undefined);
  door.open=false;door.hp=0;assert.equal(g.protectingCover(p,a),undefined);
  const twin={...c,hp:65};c.hp=65;assert.equal(bestCover([c,twin],p,a),c);
  g.grid[11][10]=0;c.x=11;c.y=10;assert.equal(g.protectingCover(p,a).type,'wall');
});
test('player and enemy receive the same angular hit penalties and direct damage reduction',()=>{
  for(const [dx,dy,penalty,damage]of [[3,1,35,22],[1,1,18,31],[2,3,18,31],[1,2,0,40]]){
    const g=arena(),a={x:10+dx,y:10+dy},c=crate(11,10);g.props=[c];
    const enemy=makeEnemy('rifleman',10,10,'qa-angle');Object.assign(enemy,{hp:500,maxHp:500,traits:[]});g.enemies=[enemy];
    assert.equal(g.accuracy(a,g.player).coverPenalty,penalty);assert.equal(g.accuracy(a,enemy).coverPenalty,penalty);
    g.damagePlayer(40,'QA',a);g.hitTarget(enemy,40,a);assert.equal(500-g.player.hp,damage);assert.equal(500-enemy.hp,damage);
  }
});
test('penetration scales half reduction and only selected destructible cover takes durability damage',()=>{
  const g=arena(),e=makeEnemy('rifleman',10,10,'qa-angle');Object.assign(e,{hp:500,maxHp:500,traits:[]});g.enemies=[e];
  const c=crate(11,10);g.props=[c];g.hitTarget(e,80,{x:12,y:13},.5);
  assert.equal(e.hp,429);assert.equal(c.hp,37);
  const south=crate(10,11);south.id='cover-south';g.props.push(south);c.hp=1;
  g.hitTarget(e,40,{x:12,y:13});assert.equal(c.hp,1);assert.equal(south.hp,51);
  south.hp=1;g.hitTarget(e,40,{x:12,y:13});assert.ok(south.hp<=0);assert.equal(g.protectingCover(e,{x:12,y:13}),c);
});
test('parallel wall and partition endpoints give no protection while corner leaning stays reciprocal',()=>{
  const g=arena(),p=g.player,a={x:10,y:13};g.grid[10][11]=0;
  assert.equal(g.protectingCover(p,a),undefined);assert.equal(combatSight(g.grid,p,{x:12,y:11}),true);assert.equal(combatSight(g.grid,{x:12,y:11},p),true);
  g.grid[10][11]=1;g.barriers=[makeBarrier('partition',p,{x:11,y:10},'edge-angle')];assert.equal(g.protectingCover(p,a),undefined);
});
test('half cover supports bracing; no_cover removes protection and bracing',()=>{
  const g=arena(),p=g.player,a={x:12,y:13};g.props=[crate(11,10)];p.traits=[{id:'braced',source:'qa'}];
  assert.equal(bracingBonus(g,p,a),12);assert.equal(bracingBonus(g,p,{x:11,y:12}),0);
  p.traits.push({id:'no_cover',source:'qa'});assert.equal(g.accuracy(a,p).coverPenalty,0);assert.equal(bracingBonus(g,p,a),0);
});
test('aim card shows half cover and save restore recalculates it without mutating state',()=>{
  const g=arena(),e=makeEnemy('rifleman',11,11,'qa-angle');g.props=[crate(10,11)];g.enemies=[e];g.target=e.id;g.runId='qa-cover-angles';g.reveal();
  const before=g.serialize();assert.match(targetDetails(g).cover,/半效/);assert.equal(g.accuracy(g.player,e).coverPenalty,18);assert.equal(g.serialize(),before);
  const restored=Game.restore(before);assert.ok(restored);assert.match(targetDetails(restored).cover,/半效/);
  g.player.y=9;assert.equal(targetDetails(g).cover,'無掩護');
});
