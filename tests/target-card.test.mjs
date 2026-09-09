import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,SIZE,makeEnemy} from '../src/engine.js';
import {targetDetails,targetCardPlacement} from '../src/target-card.js';

function arena(){const g=new Game(51);g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));Object.assign(g.player,{x:10,y:10});g.enemies=[];g.items=[];g.props=[];g.hazards=[];g.marks=[];g.reveal();return g;}
test('target card reports actual health, shot chance, distance, cover and target state',()=>{
  const g=arena(),e=makeEnemy('rifleman',14,10,'e');g.enemies=[e];g.props=[{x:13,y:10,type:'cover',hp:65,maxHp:65}];g.reveal();
  let details=targetDetails(g);assert.equal(details.name,'斷訊槍兵');assert.equal(details.hp,'HP 22 / 22');assert.equal(details.chance,'命中 62%');assert.equal(details.cover,'箱體掩護');assert.equal(details.distance,'距離 4 格 / 射程 7');
  e.moved=true;e.charge=true;details=targetDetails(g);assert.equal(details.chance,'命中 40%');assert.match(details.state,/移動中/);assert.match(details.state,/即將攻擊/);
  e.x=19;g.reveal();details=targetDetails(g);assert.equal(details.withinRange,false);assert.equal(details.chance,'無法射擊');assert.match(details.state,/超出射程/);
  g.enemies=[];g.target=null;assert.equal(targetDetails(g),null);
});
test('destructible targets show health without claiming enemy cover or movement',()=>{
  const g=arena();g.props=[{id:'barrel',type:'barrel',x:11,y:10,hp:18,maxHp:18}];g.target='barrel';const d=targetDetails(g);assert.equal(d.name,'爆裂油桶');assert.equal(d.hp,'HP 18 / 18');assert.equal(d.cover,'可破壞物');assert.equal(d.chance,'命中 97%');
});
test('target cards stay inside all viewport edges and keep ordinary target/player silhouettes clear',()=>{
  for(const side of [262,320,388,480])for(const target of [{x:20,y:20},{x:side-20,y:20},{x:20,y:side-20},{x:side-20,y:side-20},{x:side/2+35,y:side/2}]){
    const player={x:side/2,y:side/2},p=targetCardPlacement({target,player,tile:32,width:side,height:side,cardWidth:160,cardHeight:94});
    assert.ok(p.x>=0&&p.y>=0&&p.x+p.w<=side&&p.y+p.h<=side);
    for(const point of [target,player])assert.ok(!(point.x>=p.x&&point.x<=p.x+p.w&&point.y>=p.y&&point.y<=p.y+p.h),JSON.stringify({side,target,p}));
  }
});
test('waiting combines reduction, evasion and next-shot aim, without stacking or spending on invalid input',()=>{
  const g=arena(),e=makeEnemy('rifleman',14,10,'e');e.charge=true;e.windup=1;g.enemies=[e];g.reveal();g.rng=Object.assign(()=>0,{state:()=>0});
  g.action('wait');assert.equal(g.player.hp,90);assert.equal(g.accuracy(e,g.player).chance,82);assert.equal(g.accuracy(g.player,e).chance,99);
  const turn=g.turn;assert.equal(g.action('move',[1,1]),false);assert.equal(g.turn,turn);assert.equal(g.player.guard,true);
  g.action('wait');assert.equal(g.player.hp,80);assert.equal(g.player.guard,true);
  const restored=Game.restore(g.serialize());assert.equal(restored.player.guard,true);assert.equal(restored.player.evasive,true);assert.equal(restored.player.focus,true);
  restored.action('move',[0,1]);assert.equal(restored.player.guard,false);assert.equal(restored.player.focus,false);assert.equal(restored.player.evasive,false);
});
test('waiting reduction does not carry into the next player grenade and does not protect against fire',()=>{
  const g=arena();g.action('wait');g.action('grenade',{x:10,y:10});assert.equal(g.player.hp,45);assert.equal(g.player.guard,false);
  const other=arena();other.hazards=[{x:10,y:10,type:'fire'}];other.action('wait');assert.equal(other.player.hp,88);assert.equal(other.player.guard,true);
});
